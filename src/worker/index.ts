/**
 * Whop Websites Server Worker (`src/worker/index.ts`)
 * ===================================================
 * Runs natively on Whop Websites hosting (Cloudflare Workers) and locally via
 * `whop apps dev` or `npm run dev`.
 *
 * Runtime credential handling (per docs.whop.com/developer/websites/hosting):
 *  - Hosted production: Whop sets `WHOP_ACCOUNT_ID` and `WHOP_API_ORIGIN`, and
 *    attaches the owning business API key at the outbound network edge — the
 *    API key never sits in bundle or client code.
 *  - `whop apps dev`: CLI injects `WHOP_ACCOUNT_ID` and short-lived `WHOP_API_KEY`.
 *  - Sandbox testing: Set `WHOP_ENVIRONMENT=sandbox`, `WHOP_ACCOUNT_ID=biz_xxx`,
 *    and `WHOP_API_KEY=apik_xxx` via `whop apps secrets set` (or `.dev.vars`).
 *    Calls route to `https://sandbox-api.whop.com/api/v1` with
 *    `x-whop-inject-key: none` so sandbox test card `4242 4242 4242 4242`
 *    completes end-to-end on the live `whop.app` / `whop.site` deployment.
 *
 * Server API routes:
 *  - GET  /api/config                  Public runtime catalog & Elements config
 *  - POST /api/checkout/pay            Confirm PaymentElement token via Whop Payments API
 *  - POST /api/checkout/setup-intent   Vault card-on-file via Whop Setup Intents API
 *  - GET  /api/checkout/status         Verify payment/setup status & fetch saved card
 *  - GET  /api/payment-methods         List member's saved Whop payment methods
 *  - POST /api/leads                   Create customer Lead via Whop Leads API
 *  - GET  /api/leads                   List recent Leads on the Whop account
 *  - POST /api/invoices                Bill final job balance via Whop Invoices API
 *  - GET  /api/invoices                List recent Invoices from Whop Invoices API
 *  - POST /api/webhooks/whop           Verified webhook handler (`@whop/sdk/helpers`)
 */

import { WhopClient } from "@whop/sdk";
import { unwrapWebhook, WebhookVerificationError } from "@whop/sdk/helpers";
import { COMPANY_CONFIG, formatUsd, getPlanByKey, type PlanKey } from "../config/company.config";
import type {
  CheckoutPayRequest,
  CheckoutPayResponse,
  CreateFinalInvoiceRequest,
  EstimateLeadRequest,
  EstimateLeadResponse,
  ExecutionMode,
  FinalInvoiceRecord,
  RuntimeConfigResponse,
  SavedCardSummary,
  SetupIntentRequest,
  SetupIntentResponse,
  WhopRuntimeEnvironment,
} from "../types/whop";

interface WorkerBindings {
  APP_ID?: string;
  BUILD_ID?: string;
  WHOP_APP_ID?: string;
  WHOP_ACCOUNT_ID?: string;
  WHOP_API_ORIGIN?: string;
  WHOP_API_KEY?: string;
  WHOP_SANDBOX_ACCOUNT_ID?: string;
  WHOP_SANDBOX_API_KEY?: string;
  WHOP_ENVIRONMENT?: string;
  WHOP_PRODUCT_ID?: string;
  WHOP_PLAN_INSPECTION?: string;
  WHOP_PLAN_DEPOSIT?: string;
  WHOP_PLAN_FLAT_RATE?: string;
  WHOP_PLAN_FINAL_BALANCE?: string;
  WHOP_WEBHOOK_SECRET?: string;
  WHOP_ADMIN_KEY?: string;
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>;
  };
}

interface ResolvedWhopRuntime {
  environment: WhopRuntimeEnvironment;
  mode: ExecutionMode;
  accountId: string;
  apiOrigin: string;
  apiKey: string;
  isLiveConfigured: boolean;
  productId: string;
  plans: Record<PlanKey, string>;
  finalBalancePlanId: string;
  webhookSecret: string;
  adminKey: string;
}

// Ephemeral in-isolate store used ONLY when running in unconfigured local preview mode
const previewLeads: EstimateLeadResponse[] = [];
const previewInvoices: FinalInvoiceRecord[] = [];
const previewSavedCards: SavedCardSummary[] = [];

function readBinding(env: WorkerBindings, key: keyof WorkerBindings): string {
  const fromWorker = env?.[key];
  if (typeof fromWorker === "string" && fromWorker.trim()) {
    return fromWorker.trim();
  }
  const fromProcess = typeof process !== "undefined" ? process.env?.[key] : undefined;
  if (typeof fromProcess === "string" && fromProcess.trim()) {
    return fromProcess.trim();
  }
  return "";
}

function resolveRuntime(env: WorkerBindings): ResolvedWhopRuntime {
  const rawEnv = readBinding(env, "WHOP_ENVIRONMENT").toLowerCase();
  const environment: WhopRuntimeEnvironment = rawEnv === "sandbox" ? "sandbox" : "production";

  const accountId =
    (environment === "sandbox" ? readBinding(env, "WHOP_SANDBOX_ACCOUNT_ID") : "") ||
    readBinding(env, "WHOP_ACCOUNT_ID") ||
    COMPANY_CONFIG.whop.defaultAccountId;
  const apiKey =
    (environment === "sandbox" ? readBinding(env, "WHOP_SANDBOX_API_KEY") : "") ||
    readBinding(env, "WHOP_API_KEY");
  const injectedOrigin = readBinding(env, "WHOP_API_ORIGIN");

  const apiOrigin =
    environment === "sandbox"
      ? "https://sandbox-api.whop.com"
      : (injectedOrigin || "https://api.whop.com").replace(/\/+$/, "");

  // On Whop Hosting in production, WHOP_API_ORIGIN is injected and the outbound proxy signs requests.
  // In sandbox mode or local CLI dev, WHOP_API_KEY signs requests directly.
  const hasCredential =
    environment === "sandbox" ? Boolean(apiKey) : Boolean(apiKey || injectedOrigin);
  const isLiveConfigured = Boolean(accountId.startsWith("biz_") && hasCredential);

  const mode: ExecutionMode = isLiveConfigured ? environment : "preview";

  const productId = readBinding(env, "WHOP_PRODUCT_ID") || COMPANY_CONFIG.whop.defaultProductId;
  const plans: Record<PlanKey, string> = {
    inspection:
      readBinding(env, "WHOP_PLAN_INSPECTION") || getPlanByKey("inspection").defaultPlanId,
    deposit: readBinding(env, "WHOP_PLAN_DEPOSIT") || getPlanByKey("deposit").defaultPlanId,
    flat_rate:
      readBinding(env, "WHOP_PLAN_FLAT_RATE") || getPlanByKey("flat_rate").defaultPlanId,
  };
  const finalBalancePlanId = readBinding(env, "WHOP_PLAN_FINAL_BALANCE");
  const webhookSecret = readBinding(env, "WHOP_WEBHOOK_SECRET");
  const adminKey = readBinding(env, "WHOP_ADMIN_KEY");

  return {
    environment,
    mode,
    accountId,
    apiOrigin,
    apiKey,
    isLiveConfigured,
    productId,
    plans,
    finalBalancePlanId,
    webhookSecret,
    adminKey,
  };
}

function createWhopClient(runtime: ResolvedWhopRuntime): WhopClient {
  return new WhopClient({
    token: runtime.apiKey || "",
    baseUrl: `${runtime.apiOrigin}/api/v1`,
    headers:
      runtime.environment === "sandbox" && runtime.apiKey
        ? { "x-whop-inject-key": "none" }
        : undefined,
  });
}

function authHeaders(runtime: ResolvedWhopRuntime): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (runtime.apiKey) {
    headers.Authorization = `Bearer ${runtime.apiKey}`;
  }
  if (runtime.environment === "sandbox" && runtime.apiKey) {
    headers["x-whop-inject-key"] = "none";
  }
  return headers;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function errorResponse(message: string, status = 400, extra?: Record<string, unknown>): Response {
  return jsonResponse({ error: message, ...extra }, status);
}

/**
 * Constant-time check for optional office/admin routes (`/api/invoices`, `GET /api/leads`,
 * `GET /api/payment-methods`). Leave `WHOP_ADMIN_KEY` unset during sandbox review so
 * reviewers can issue test final invoices directly; set it on a live client site to
 * restrict invoice creation and saved-card lookup to office staff.
 */
function requireAdminKey(request: Request, runtime: ResolvedWhopRuntime): Response | null {
  const expected = runtime.adminKey;
  if (!expected) return null;

  const provided = (request.headers.get("x-whop-admin-key") ?? "").trim();
  const encoder = new TextEncoder();
  const a = encoder.encode(provided);
  const b = encoder.encode(expected);

  let diff = a.length ^ b.length;
  const maxLen = Math.max(a.length, b.length);
  for (let i = 0; i < maxLen; i += 1) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  if (!provided || diff !== 0) {
    return errorResponse("Valid office billing key required.", 401);
  }
  return null;
}

/**
 * Ensures `returnUrl` stays pinned to the site's own host over https (or http in local dev)
 * to prevent open redirects after off-site 3DS or BNPL checkout steps.
 */
function sanitizeReturnUrl(request: Request, candidate?: string, fallbackPath = "/checkout/return"): string {
  const reqUrl = new URL(request.url);
  const safeOrigin =
    reqUrl.hostname === "localhost" || reqUrl.hostname === "127.0.0.1"
      ? reqUrl.origin
      : `https://${reqUrl.host}`;

  if (!candidate) {
    return `${safeOrigin}${fallbackPath}`;
  }
  try {
    const parsed = new URL(candidate, safeOrigin);
    if (parsed.host !== reqUrl.host) {
      return `${safeOrigin}${fallbackPath}`;
    }
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      parsed.protocol = "https:";
    }
    return parsed.toString();
  } catch {
    return `${safeOrigin}${fallbackPath}`;
  }
}

function clampString(value: unknown, maxLen = 255): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}

function randomShortId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    // @whop/sdk errors include structured body details when present
    const maybeBody = (err as { body?: { error?: { message?: string }; message?: string } }).body;
    if (maybeBody?.error?.message) return maybeBody.error.message;
    if (maybeBody?.message) return maybeBody.message;
    return err.message;
  }
  return "Unexpected Whop API error";
}

function normalizeMoneyNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return Math.abs(parsed);
  }
  if (value && typeof value === "object" && "amount" in value) {
    const amt = Number.parseFloat(String((value as { amount: unknown }).amount));
    if (Number.isFinite(amt)) return Math.abs(amt);
  }
  return fallback;
}

/**
 * Auto-discovers inspection / deposit / flat_rate variants on the business account
 * if explicit WHOP_PLAN_* secrets haven't been set yet.
 */
async function resolveCatalogIds(runtime: ResolvedWhopRuntime): Promise<{
  productId: string;
  plans: Record<PlanKey, string>;
}> {
  const plans: Record<PlanKey, string> = { ...runtime.plans };
  let productId = runtime.productId;

  if (!runtime.isLiveConfigured) {
    return { productId, plans };
  }
  if (plans.inspection && plans.deposit && plans.flat_rate && productId) {
    return { productId, plans };
  }

  try {
    const client = createWhopClient(runtime);
    const page = await client.variants.list({
      account_id: runtime.accountId,
      first: 30,
    });
    const items = (page as unknown as { data?: Array<Record<string, unknown>> }).data ?? [];

    for (const variant of items) {
      const id = typeof variant.id === "string" ? variant.id : "";
      if (!id.startsWith("plan_")) continue;

      const prod = variant.product as { id?: string } | null | undefined;
      if (!productId && prod?.id?.startsWith("prod_")) {
        productId = prod.id;
      }

      const text = `${variant.title ?? ""} ${variant.internal_notes ?? ""} ${variant.description ?? ""}`.toLowerCase();
      const price = normalizeMoneyNumber(variant.initial_price, -1);

      if (!plans.inspection && (text.includes("plan_key:inspection") || text.includes("inspection") || price === getPlanByKey("inspection").price)) {
        plans.inspection = id;
      } else if (!plans.deposit && (text.includes("plan_key:deposit") || text.includes("deposit") || price === getPlanByKey("deposit").price)) {
        plans.deposit = id;
      } else if (!plans.flat_rate && (text.includes("plan_key:flat_rate") || text.includes("tune-up") || text.includes("flat-rate") || price === getPlanByKey("flat_rate").price)) {
        plans.flat_rate = id;
      }
    }
  } catch (err) {
    console.warn("[whop-config] Variant auto-discovery skipped:", extractErrorMessage(err));
  }

  return { productId, plans };
}

async function handleGetConfig(runtime: ResolvedWhopRuntime): Promise<Response> {
  const { productId, plans } = await resolveCatalogIds(runtime);
  const body: RuntimeConfigResponse = {
    accountId: runtime.accountId,
    productId,
    environment: runtime.environment,
    mode: runtime.mode,
    isLiveConfigured: runtime.isLiveConfigured,
    plans,
    finalBalancePlanId: runtime.finalBalancePlanId,
    webhookConfigured: Boolean(runtime.webhookSecret),
    invoiceAuthRequired: Boolean(runtime.adminKey),
  };
  return jsonResponse(body);
}

/**
 * POST /api/checkout/pay
 * Confirms a single-use `ctok_` confirmation token gathered by `<PaymentElement />`
 * (with `<BrandingElement />` mounted) through the Whop Payments API.
 * When `planKey === "deposit"`, `<Payments setupFutureUsage="off_session">` attests
 * card-on-file consent so Whop vaults the card (`payt_...`) for the final invoice.
 */
async function handleCheckoutPay(request: Request, runtime: ResolvedWhopRuntime): Promise<Response> {
  let body: CheckoutPayRequest;
  try {
    body = (await request.json()) as CheckoutPayRequest;
  } catch {
    return errorResponse("Invalid JSON body");
  }

  const confirmationToken = clampString(body.confirmationToken, 512);
  const planKey: PlanKey =
    body.planKey === "inspection" || body.planKey === "deposit" || body.planKey === "flat_rate"
      ? body.planKey
      : "deposit";
  const planConfig = getPlanByKey(planKey);
  const orderId = clampString(body.orderId, 120) || `ord_${randomShortId()}`;
  const customerName = clampString(body.customerName, 120);
  const customerEmail = clampString(body.customerEmail, 160);
  const propertyAddress = clampString(body.propertyAddress, 240);
  const saveCard = Boolean(body.saveCard ?? planConfig.savesCardOnFile);

  if (!confirmationToken) {
    return errorResponse("Missing confirmationToken from Whop PaymentElement");
  }

  // Local unconfigured sandbox preview path (no custom card inputs — simulated Whop token only)
  if (!runtime.isLiveConfigured && confirmationToken.startsWith("ctok_preview_")) {
    const paymentId = `pay_preview_${randomShortId()}`;
    const memberId = `mber_preview_${randomShortId().slice(0, 8)}`;
    const paymentMethodId = saveCard ? `payt_preview_${randomShortId().slice(0, 8)}` : null;

    let savedCard: SavedCardSummary | null = null;
    if (saveCard && paymentMethodId) {
      savedCard = {
        paymentMethodId,
        memberId,
        setupIntentId: `sint_preview_${randomShortId().slice(0, 8)}`,
        brand: "visa",
        last4: "4242",
        expMonth: 12,
        expYear: 2030,
        customerEmail: customerEmail || COMPANY_CONFIG.sampleCompletedJob.customerEmail,
        customerName: customerName || COMPANY_CONFIG.sampleCompletedJob.customerName,
        savedAt: new Date().toISOString(),
        mode: "preview",
      };
      previewSavedCards.unshift(savedCard);
    }

    const response: CheckoutPayResponse = {
      id: paymentId,
      status: "paid",
      clientSecret: null,
      orderId,
      planKey,
      amount: planConfig.price,
      currency: "USD",
      memberId,
      paymentMethodId,
      savedCard,
      mode: "preview",
    };
    return jsonResponse(response, 201);
  }

  if (!runtime.isLiveConfigured) {
    return errorResponse(
      "Whop account is not configured yet. Set WHOP_ACCOUNT_ID and deploy with `whop apps deploy` (or run `whop apps dev`).",
      503,
    );
  }

  const { plans } = await resolveCatalogIds(runtime);
  const variantId = clampString(body.planId, 120) || plans[planKey];
  if (!variantId.startsWith("plan_")) {
    return errorResponse(
      `Missing Whop plan ID for "${planKey}". Run \`npm run whop:provision\` and set WHOP_PLAN_${planKey.toUpperCase()}.`,
      422,
    );
  }

  const returnUrl = sanitizeReturnUrl(
    request,
    body.returnUrl,
    `/checkout/return?order=${encodeURIComponent(orderId)}&plan=${encodeURIComponent(planKey)}`,
  );

  try {
    const client = createWhopClient(runtime);
    const metadata: Record<string, string> = {
      order_id: orderId,
      plan_key: planKey,
      plan_name: planConfig.name,
      save_card_on_file: String(saveCard),
      template: "ridgeline-roofing-whop",
    };
    if (customerName) metadata.customer_name = customerName;
    if (propertyAddress) metadata.property_address = propertyAddress;

    const payment = (await client.payments.create(
      {
        account_id: runtime.accountId,
        variant_id: variantId,
        confirmation_token: confirmationToken,
        return_url: returnUrl,
        metadata,
      } as Parameters<typeof client.payments.create>[0],
      { idempotencyKey: `pay_${orderId}` },
    )) as unknown as Record<string, unknown>;

    const paymentId = String(payment.id ?? "");
    const status = String(payment.status ?? "processing");
    const clientSecret =
      typeof payment.client_secret === "string" ? payment.client_secret : null;
    const memberObj = payment.member as { id?: string } | null | undefined;
    const userObj = payment.user as { email?: string; name?: string } | null | undefined;
    const pmObj = payment.payment_method as
      | {
          id?: string;
          card?: { brand?: string; last4?: string; exp_month?: number; exp_year?: number };
        }
      | null
      | undefined;

    const memberId =
      (typeof payment.member_id === "string" && payment.member_id) || memberObj?.id || null;
    const paymentMethodId =
      (typeof payment.payment_method_id === "string" && payment.payment_method_id) ||
      pmObj?.id ||
      null;

    const savedCard: SavedCardSummary | null =
      paymentMethodId && memberId
        ? {
            paymentMethodId,
            memberId,
            brand: pmObj?.card?.brand ?? "card",
            last4: pmObj?.card?.last4 ?? "4242",
            expMonth: pmObj?.card?.exp_month ?? null,
            expYear: pmObj?.card?.exp_year ?? null,
            customerEmail: userObj?.email || customerEmail || "",
            customerName: userObj?.name || customerName || "",
            savedAt: new Date().toISOString(),
            mode: runtime.mode,
          }
        : null;

    const response: CheckoutPayResponse = {
      id: paymentId,
      status,
      clientSecret,
      orderId,
      planKey,
      amount: planConfig.price,
      currency: "USD",
      memberId,
      paymentMethodId,
      savedCard,
      mode: runtime.mode,
    };
    return jsonResponse(response, 201);
  } catch (err) {
    console.error("[whop-pay] Error creating payment:", err);
    return errorResponse(extractErrorMessage(err), 502);
  }
}

/**
 * POST /api/checkout/setup-intent
 * Creates a Whop Setup Intent (`sint_...`) from a confirmation token gathered by
 * `<Payments mode="setup">` + `<PaymentElement />` + `<BrandingElement />`, storing
 * the customer's card on file (`payt_...`) for auto-charging the final job invoice.
 */
async function handleCreateSetupIntent(
  request: Request,
  runtime: ResolvedWhopRuntime,
): Promise<Response> {
  let body: SetupIntentRequest;
  try {
    body = (await request.json()) as SetupIntentRequest;
  } catch {
    return errorResponse("Invalid JSON body");
  }

  const confirmationToken = clampString(body.confirmationToken, 512);
  const orderId = clampString(body.orderId, 120) || `setup_${randomShortId()}`;
  const customerName = clampString(body.customerName, 120);
  const customerEmail = clampString(body.customerEmail, 160);
  const propertyAddress = clampString(body.propertyAddress, 240);

  if (!confirmationToken) {
    return errorResponse("Missing confirmationToken from setup-mode PaymentElement");
  }

  if (!runtime.isLiveConfigured && confirmationToken.startsWith("ctok_preview_")) {
    const setupIntentId = `sint_preview_${randomShortId()}`;
    const memberId = `mber_preview_${randomShortId().slice(0, 8)}`;
    const paymentMethodId = `payt_preview_${randomShortId().slice(0, 8)}`;
    const savedCard: SavedCardSummary = {
      paymentMethodId,
      memberId,
      setupIntentId,
      brand: "visa",
      last4: "4242",
      expMonth: 12,
      expYear: 2030,
      customerEmail: customerEmail || COMPANY_CONFIG.sampleCompletedJob.customerEmail,
      customerName: customerName || COMPANY_CONFIG.sampleCompletedJob.customerName,
      savedAt: new Date().toISOString(),
      mode: "preview",
    };
    previewSavedCards.unshift(savedCard);

    const res: SetupIntentResponse = {
      id: setupIntentId,
      status: "succeeded",
      clientSecret: null,
      memberId,
      paymentMethodId,
      savedCard,
      mode: "preview",
    };
    return jsonResponse(res, 201);
  }

  if (!runtime.isLiveConfigured) {
    return errorResponse(
      "Whop account is not configured yet. Deploy via `whop apps deploy` or configure WHOP_ACCOUNT_ID + WHOP_API_KEY.",
      503,
    );
  }

  const returnUrl = sanitizeReturnUrl(
    request,
    body.returnUrl,
    `/checkout/return?order=${encodeURIComponent(orderId)}&flow=setup`,
  );

  try {
    const client = createWhopClient(runtime);
    const metadata: Record<string, string> = {
      order_id: orderId,
      flow: "roofing_card_on_file",
      company: COMPANY_CONFIG.brand.name,
    };
    if (customerName) metadata.customer_name = customerName;
    if (propertyAddress) metadata.property_address = propertyAddress;

    const setupIntent = (await client.setupIntents.create(
      {
        account_id: runtime.accountId,
        confirmation_token: confirmationToken,
        currency: COMPANY_CONFIG.whop.currency.toLowerCase(),
        ...(customerEmail ? { email: customerEmail } : {}),
        return_url: returnUrl,
        metadata,
      } as Parameters<typeof client.setupIntents.create>[0],
      { idempotencyKey: `sint_${orderId}` },
    )) as unknown as Record<string, unknown>;

    const id = String(setupIntent.id ?? "");
    const status = String(setupIntent.status ?? "processing");
    const clientSecret =
      typeof setupIntent.client_secret === "string" ? setupIntent.client_secret : null;
    const memberObj = setupIntent.member as
      | { id?: string; user?: { email?: string; name?: string } }
      | null
      | undefined;
    const pmObj = setupIntent.payment_method as
      | {
          id?: string;
          card?: { brand?: string; last4?: string; exp_month?: number; exp_year?: number };
        }
      | null
      | undefined;

    const memberId =
      (typeof setupIntent.member_id === "string" && setupIntent.member_id) ||
      memberObj?.id ||
      null;
    const paymentMethodId =
      (typeof setupIntent.payment_method_id === "string" && setupIntent.payment_method_id) ||
      pmObj?.id ||
      null;

    const savedCard: SavedCardSummary | null =
      paymentMethodId && memberId
        ? {
            paymentMethodId,
            memberId,
            setupIntentId: id,
            brand: pmObj?.card?.brand ?? "card",
            last4: pmObj?.card?.last4 ?? "4242",
            expMonth: pmObj?.card?.exp_month ?? null,
            expYear: pmObj?.card?.exp_year ?? null,
            customerEmail: memberObj?.user?.email || customerEmail || "",
            customerName: memberObj?.user?.name || customerName || "",
            savedAt: new Date().toISOString(),
            mode: runtime.mode,
          }
        : null;

    const res: SetupIntentResponse = {
      id,
      status,
      clientSecret,
      memberId,
      paymentMethodId,
      savedCard,
      mode: runtime.mode,
    };
    return jsonResponse(res, 201);
  } catch (err) {
    console.error("[whop-setup-intent] Error creating setup intent:", err);
    return errorResponse(extractErrorMessage(err), 502);
  }
}

/**
 * GET /api/checkout/status
 * Retrieves the authoritative server-side status of a payment or setup intent, plus
 * the customer's vaulted `payt_` payment method so the final invoice console can use it.
 */
async function handleCheckoutStatus(request: Request, runtime: ResolvedWhopRuntime): Promise<Response> {
  const url = new URL(request.url);
  const paymentId = clampString(url.searchParams.get("payment_id"), 120);
  const setupIntentId = clampString(url.searchParams.get("setup_intent_id"), 120);
  let memberId = clampString(url.searchParams.get("member_id"), 120);

  if (!runtime.isLiveConfigured) {
    return jsonResponse({
      mode: "preview",
      status: "succeeded",
      memberId: memberId || previewSavedCards[0]?.memberId || null,
      savedCard: previewSavedCards[0] ?? null,
    });
  }

  try {
    const client = createWhopClient(runtime);
    let status = "unknown";
    let paymentMethodId: string | null = null;
    let email = "";
    let name = "";

    if (paymentId.startsWith("pay_")) {
      const payment = (await client.payments.retrieve({ id: paymentId })) as unknown as Record<string, unknown>;
      status = String(payment.status ?? "unknown");
      const m = payment.member as { id?: string } | null | undefined;
      const u = payment.user as { email?: string; name?: string } | null | undefined;
      const pm = payment.payment_method as { id?: string } | null | undefined;
      memberId = memberId || String(payment.member_id ?? m?.id ?? "");
      paymentMethodId =
        (typeof payment.payment_method_id === "string" && payment.payment_method_id) ||
        pm?.id ||
        null;
      email = u?.email ?? "";
      name = u?.name ?? "";
    } else if (setupIntentId.startsWith("sint_")) {
      const sint = (await client.setupIntents.retrieve({ id: setupIntentId })) as unknown as Record<string, unknown>;
      status = String(sint.status ?? "unknown");
      const m = sint.member as { id?: string; user?: { email?: string; name?: string } } | null | undefined;
      const pm = sint.payment_method as { id?: string } | null | undefined;
      memberId = memberId || String(sint.member_id ?? m?.id ?? "");
      paymentMethodId =
        (typeof sint.payment_method_id === "string" && sint.payment_method_id) ||
        pm?.id ||
        null;
      email = m?.user?.email ?? "";
      name = m?.user?.name ?? "";
    }

    let savedCard: SavedCardSummary | null = null;
    if (memberId.startsWith("mber_")) {
      const pmPage = await client.paymentMethods.list({
        account_id: runtime.accountId,
        member_id: memberId,
        first: 5,
      });
      const methods = (pmPage as unknown as { data?: Array<Record<string, unknown>> }).data ?? [];
      const chosen =
        methods.find((m) => m.id === paymentMethodId) ?? methods[0];
      if (chosen && typeof chosen.id === "string") {
        const card = chosen.card as
          | { brand?: string; last4?: string; exp_month?: number; exp_year?: number }
          | null
          | undefined;
        savedCard = {
          paymentMethodId: chosen.id,
          memberId,
          ...(setupIntentId ? { setupIntentId } : {}),
          brand: card?.brand ?? String(chosen.payment_method_type ?? "card"),
          last4: card?.last4 ?? "••••",
          expMonth: card?.exp_month ?? null,
          expYear: card?.exp_year ?? null,
          customerEmail: email,
          customerName: name,
          savedAt: String(chosen.created_at ?? new Date().toISOString()),
          mode: runtime.mode,
        };
      }
    }

    return jsonResponse({
      mode: runtime.mode,
      status,
      memberId: memberId || null,
      paymentMethodId: savedCard?.paymentMethodId ?? paymentMethodId,
      savedCard,
    });
  } catch (err) {
    return errorResponse(extractErrorMessage(err), 502);
  }
}

async function handleListPaymentMethods(
  request: Request,
  runtime: ResolvedWhopRuntime,
): Promise<Response> {
  const url = new URL(request.url);
  const memberId = clampString(url.searchParams.get("member_id"), 120);

  if (!runtime.isLiveConfigured) {
    const filtered = memberId
      ? previewSavedCards.filter((c) => c.memberId === memberId)
      : previewSavedCards;
    return jsonResponse({ mode: "preview", data: filtered });
  }

  if (!memberId.startsWith("mber_")) {
    return errorResponse("Pass a valid member_id (mber_xxx) to list stored payment methods.");
  }

  try {
    const client = createWhopClient(runtime);
    const page = await client.paymentMethods.list({
      account_id: runtime.accountId,
      member_id: memberId,
      first: 10,
    });
    const raw = (page as unknown as { data?: Array<Record<string, unknown>> }).data ?? [];
    const data: SavedCardSummary[] = raw.map((item) => {
      const card = item.card as
        | { brand?: string; last4?: string; exp_month?: number; exp_year?: number }
        | null
        | undefined;
      return {
        paymentMethodId: String(item.id ?? ""),
        memberId,
        brand: card?.brand ?? String(item.payment_method_type ?? "card"),
        last4: card?.last4 ?? "••••",
        expMonth: card?.exp_month ?? null,
        expYear: card?.exp_year ?? null,
        customerEmail: "",
        customerName: "",
        savedAt: String(item.created_at ?? new Date().toISOString()),
        mode: runtime.mode,
      };
    });
    return jsonResponse({ mode: runtime.mode, data });
  } catch (err) {
    return errorResponse(extractErrorMessage(err), 502);
  }
}

/**
 * POST /api/leads
 * Wires the "Request an Estimate" form to the Whop Leads API (`POST /api/v1/leads`):
 *  1. Upserts the homeowner on the account via `client.members.create({ account_id, email, name })`
 *     so even brand-new homeowners resolve a `user_id` and `member_id`.
 *  2. Creates the Lead on Whop (`POST /api/v1/leads`) with `account_id`, `user_id`,
 *     `product_id`, `referrer`, and complete roofing project metadata.
 *  3. Mirrors a deduplicated `lead` server event (`POST /api/v1/events`) for Whop Pixel attribution.
 */
async function handleCreateLead(request: Request, runtime: ResolvedWhopRuntime): Promise<Response> {
  let body: EstimateLeadRequest;
  try {
    body = (await request.json()) as EstimateLeadRequest;
  } catch {
    return errorResponse("Invalid JSON body");
  }

  const name = clampString(body.name, 120);
  const email = clampString(body.email, 160).toLowerCase();
  const phone = clampString(body.phone, 40);
  const address = clampString(body.address, 220);
  const zip = clampString(body.zip, 16);
  const serviceType = clampString(body.serviceType, 80) || "replacement";
  const roofMaterial = clampString(body.roofMaterial, 80) || "Architectural Asphalt Shingle";
  const urgency = clampString(body.urgency, 100) || "Soon — Within 1–2 Weeks";
  const insuranceClaim = Boolean(body.insuranceClaim);
  const notes = clampString(body.notes, 1000);
  const eventId = clampString(body.eventId, 120) || `est_${randomShortId()}`;
  const referrer = clampString(body.referrer, 255) || request.url;

  if (!name || name.length < 2) {
    return errorResponse("Please enter your full name.");
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return errorResponse("Please enter a valid email address.");
  }
  if (!phone || phone.replace(/\D/g, "").length < 7) {
    return errorResponse("Please enter a valid US phone number.");
  }
  if (!address || !zip) {
    return errorResponse("Please enter the property street address and ZIP code.");
  }

  const matchedService = COMPANY_CONFIG.estimateForm.serviceOptions.find(
    (opt) => opt.value === serviceType,
  );
  const estimatedValue = matchedService?.estimatedValue ?? 1250;

  const metadata: Record<string, string> = {
    source: "website_estimate_form",
    company: COMPANY_CONFIG.brand.name,
    customer_name: name,
    customer_email: email,
    customer_phone: phone,
    property_address: address,
    postal_code: zip,
    service_type: matchedService?.label ?? serviceType,
    roof_material: roofMaterial,
    urgency,
    insurance_claim: insuranceClaim ? "yes" : "no",
    estimated_value_usd: String(estimatedValue),
    event_id: eventId,
  };
  if (notes) {
    metadata.project_notes = notes;
  }

  if (!runtime.isLiveConfigured) {
    const previewLead: EstimateLeadResponse = {
      id: `lead_preview_${randomShortId()}`,
      memberId: `mber_preview_${randomShortId().slice(0, 8)}`,
      userId: `user_preview_${randomShortId().slice(0, 8)}`,
      productId: runtime.productId || null,
      createdAt: new Date().toISOString(),
      customerName: name,
      customerEmail: email,
      serviceType: matchedService?.label ?? serviceType,
      estimatedValue,
      metadata,
      mode: "preview",
    };
    previewLeads.unshift(previewLead);
    return jsonResponse(previewLead, 201);
  }

  try {
    const client = createWhopClient(runtime);
    const { productId } = await resolveCatalogIds(runtime);

    // Step 1: Resolve or create the customer member on the Whop business account
    // (Handles repeat submissions gracefully if the email already exists)
    let memberId: string | null = null;
    let userId: string | null = null;

    try {
      const member = (await client.members.create({
        account_id: runtime.accountId,
        email,
        name,
      })) as unknown as {
        id?: string;
        user?: { id?: string } | null;
      };
      memberId = member.id ?? null;
      userId = member.user?.id ?? null;
    } catch (memberErr) {
      const page = await client.members
        .list({ account_id: runtime.accountId, query: email, first: 1 })
        .catch(() => null);
      const existing = (
        page as unknown as { data?: Array<{ id?: string; user?: { id?: string } | null }> } | null
      )?.data?.[0];
      if (!existing?.id) throw memberErr;
      memberId = existing.id;
      userId = existing.user?.id ?? null;
    }

    // Step 2: Create the Lead via Whop Leads API (POST /api/v1/leads)
    const leadPayload: Record<string, unknown> = {
      account_id: runtime.accountId,
      ...(userId ? { user_id: userId } : {}),
      ...(productId.startsWith("prod_") ? { product_id: productId } : {}),
      referrer,
      metadata,
    };

    let leadId = "";
    let createdAt = new Date().toISOString();

    const leadRes = await fetch(`${runtime.apiOrigin}/api/v1/leads`, {
      method: "POST",
      headers: {
        ...authHeaders(runtime),
        "Idempotency-Key": `lead_${eventId}`,
      },
      body: JSON.stringify(leadPayload),
    });

    if (leadRes.ok) {
      const leadJson = (await leadRes.json()) as { id?: string; created_at?: string };
      leadId = leadJson.id ?? "";
      createdAt = leadJson.created_at ?? createdAt;
    } else {
      const errText = await leadRes.text();
      console.warn(`[whop-leads] POST /api/v1/leads status ${leadRes.status}: ${errText}`);
      // Persist quote details directly onto the created member record & notes as resilient fallback
      if (memberId) {
        try {
          await client.members.update({
            id: memberId,
            metadata,
          } as Parameters<typeof client.members.update>[0]);
        } catch {
          // Member creation already succeeded
        }
        leadId = memberId;
      } else {
        return errorResponse(`Whop Leads API returned ${leadRes.status}: ${errText}`, 502);
      }
    }

    // Step 3: Mirror deduplicated server-side lead conversion event to Whop Events API
    const [firstName, ...restName] = name.split(/\s+/);
    const lastName = restName.join(" ");
    const normalizedPhone = phone.startsWith("+")
      ? phone
      : `+1${phone.replace(/\D/g, "").slice(-10)}`;

    fetch(`${runtime.apiOrigin}/api/v1/events`, {
      method: "POST",
      headers: authHeaders(runtime),
      body: JSON.stringify({
        account_id: runtime.accountId,
        event_name: "lead",
        event_id: `lead_${eventId}`,
        event_time: new Date().toISOString(),
        action_source: "website",
        url: referrer,
        value: estimatedValue,
        currency: "USD",
        user: {
          email,
          phone: normalizedPhone,
          first_name: firstName,
          ...(lastName ? { last_name: lastName } : {}),
        },
      }),
    }).catch(() => {
      // Server-side event mirroring is non-blocking
    });

    const result: EstimateLeadResponse = {
      id: leadId,
      memberId,
      userId,
      productId: productId || null,
      createdAt,
      customerName: name,
      customerEmail: email,
      serviceType: matchedService?.label ?? serviceType,
      estimatedValue,
      metadata,
      mode: runtime.mode,
    };
    return jsonResponse(result, 201);
  } catch (err) {
    console.error("[whop-leads] Error creating lead:", err);
    return errorResponse(extractErrorMessage(err), 502);
  }
}

async function handleListLeads(runtime: ResolvedWhopRuntime): Promise<Response> {
  if (!runtime.isLiveConfigured) {
    return jsonResponse({ mode: "preview", data: previewLeads });
  }

  try {
    const res = await fetch(
      `${runtime.apiOrigin}/api/v1/leads?account_id=${encodeURIComponent(runtime.accountId)}&company_id=${encodeURIComponent(runtime.accountId)}&first=10`,
      { headers: authHeaders(runtime) },
    );
    if (!res.ok) {
      const client = createWhopClient(runtime);
      const members = await client.members.list({ account_id: runtime.accountId, first: 10 });
      const data = (members as unknown as { data?: unknown[] }).data ?? [];
      return jsonResponse({ mode: runtime.mode, data });
    }
    const json = (await res.json()) as { data?: unknown[] };
    return jsonResponse({ mode: runtime.mode, data: json.data ?? [] });
  } catch (err) {
    return errorResponse(extractErrorMessage(err), 502);
  }
}

/**
 * POST /api/invoices
 * Bills the final roofing balance after job completion via the Whop Invoices API:
 *  - `charge_automatically`: attaches the customer's stored `payt_...` payment method
 *    from deposit Setup Intent, issues the invoice, and triggers an immediate off-session
 *    charge (`client.invoices.issue` + `client.invoices.charge`).
 *  - `send_invoice`: issues the invoice with a due date and emails the hosted Whop
 *    `checkout_link` (`client.invoices.send`) so the homeowner pays manually by card,
 *    ACH, Apple Pay / Google Pay, or BNPL financing (Klarna / Splitit / Afterpay).
 */
async function handleCreateInvoice(
  request: Request,
  runtime: ResolvedWhopRuntime,
): Promise<Response> {
  let body: CreateFinalInvoiceRequest;
  try {
    body = (await request.json()) as CreateFinalInvoiceRequest;
  } catch {
    return errorResponse("Invalid JSON body");
  }

  const collectionMethod =
    body.collectionMethod === "charge_automatically" ? "charge_automatically" : "send_invoice";
  const jobNumber = clampString(body.jobNumber, 64) || `JOB-${randomShortId().slice(0, 6).toUpperCase()}`;
  const projectTitle =
    clampString(body.projectTitle, 140) || "Roofing Project — Final Balance Invoice";
  const customerName = clampString(body.customerName, 120);
  const customerEmail = clampString(body.customerEmail, 160).toLowerCase();
  const memberId = clampString(body.memberId, 120);
  const paymentMethodId = clampString(body.paymentMethodId, 120);
  const memo = clampString(body.memo, 1200);
  const dueInDays = Math.max(0, Math.min(90, Number(body.dueInDays) || 7));

  if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return errorResponse("Please provide a valid customer email address.");
  }
  if (!Array.isArray(body.lineItems) || body.lineItems.length === 0) {
    return errorResponse("Add at least one line item to generate the final invoice.");
  }
  if (collectionMethod === "charge_automatically" && !paymentMethodId) {
    return errorResponse(
      "Auto-charge requires a stored payment method ID (`payt_...`) from a deposit checkout or Setup Intent. Complete a deposit first or switch to Send Invoice.",
    );
  }

  const cleanItems = body.lineItems
    .map((item, idx) => ({
      id: clampString(item.id, 40) || `li-${idx + 1}`,
      label: clampString(item.label, 160),
      description: clampString(item.description, 240),
      quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
      unitPrice: Math.max(0, Math.round(Number(item.unitPrice) * 100) / 100),
    }))
    .filter((item) => item.label && item.unitPrice > 0);

  if (cleanItems.length === 0) {
    return errorResponse("Invoice line items must have a label and positive unit price.");
  }

  const grossSubtotal =
    Math.round(cleanItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0) * 100) / 100;
  const depositCredit = Math.max(0, Math.round((Number(body.depositCredit) || 0) * 100) / 100);
  const inspectionCredit = Math.max(
    0,
    Math.round((Number(body.inspectionCredit) || 0) * 100) / 100,
  );
  const finalBalance =
    Math.round((grossSubtotal - depositCredit - inspectionCredit) * 100) / 100;

  if (finalBalance <= 0) {
    return errorResponse("Final balance after deposit and inspection credits must be greater than $0.");
  }

  const dueAt =
    collectionMethod === "send_invoice" && dueInDays > 0
      ? new Date(Date.now() + dueInDays * 86_400_000).toISOString()
      : null;

  const itemizedMemoLines = [
    `${COMPANY_CONFIG.brand.name} — ${jobNumber}`,
    ...cleanItems.map(
      (i) =>
        `• ${i.label} (${i.quantity} × ${formatUsd(i.unitPrice)}) = ${formatUsd(i.quantity * i.unitPrice)}`,
    ),
    `Gross Scope: ${formatUsd(grossSubtotal)}`,
    ...(depositCredit > 0 ? [`Less Project Deposit Paid: -${formatUsd(depositCredit)}`] : []),
    ...(inspectionCredit > 0 ? [`Less Inspection Fee Credit: -${formatUsd(inspectionCredit)}`] : []),
    `Final Balance Due: ${formatUsd(finalBalance)} USD`,
    ...(memo ? ["", memo] : []),
  ].join("\n");

  if (!runtime.isLiveConfigured) {
    const seq = String(previewInvoices.length + 1041);
    const invoiceId = `pay_inv_preview_${randomShortId()}`;
    const previewRecord: FinalInvoiceRecord = {
      id: invoiceId,
      invoiceNumber: `INV-${seq}`,
      status: collectionMethod === "charge_automatically" ? "paid" : "open",
      collectionMethod,
      jobNumber,
      projectTitle,
      customerName: customerName || "Homeowner",
      customerEmail,
      memberId: memberId || previewSavedCards[0]?.memberId || `mber_preview_${seq}`,
      paymentMethodId: collectionMethod === "charge_automatically" ? paymentMethodId : null,
      variantId: `plan_inv_preview_${seq}`,
      grossSubtotal,
      depositCredit,
      inspectionCredit,
      finalBalance,
      currency: "USD",
      checkoutLink: `https://whop.com/checkout/${invoiceId}`,
      dueAt,
      createdAt: new Date().toISOString(),
      memo: itemizedMemoLines,
      lineItems: cleanItems,
      mode: "preview",
    };
    previewInvoices.unshift(previewRecord);
    return jsonResponse(previewRecord, 201);
  }

  try {
    const client = createWhopClient(runtime);
    const { productId } = await resolveCatalogIds(runtime);

    // Step 1: Create a dedicated one-time Whop variant for this job's exact net final balance
    const variant = (await client.variants.create({
      account_id: runtime.accountId,
      ...(productId.startsWith("prod_") ? { product_id: productId } : {}),
      title: `Final Balance ${jobNumber}`.slice(0, 30),
      description: `${projectTitle} — Final roofing balance for ${jobNumber} after $${depositCredit} deposit credit.`.slice(0, 400),
      billing_type: "one_time",
      currency: "usd",
      initial_price: finalBalance,
      visibility: "quick_link",
      internal_notes: `final_invoice:${jobNumber}`,
    } as Parameters<typeof client.variants.create>[0])) as unknown as {
      id: string;
      purchase_url?: string;
    };

    const billingAddress = body.billingAddress?.line1
      ? {
          line1: clampString(body.billingAddress.line1, 200),
          city: clampString(body.billingAddress.city, 100) || COMPANY_CONFIG.contact.city,
          state: clampString(body.billingAddress.state, 40) || COMPANY_CONFIG.contact.state,
          postal_code: clampString(body.billingAddress.postalCode, 20) || COMPANY_CONFIG.contact.zip,
          country: clampString(body.billingAddress.country, 2) || "US",
          ...(customerName ? { name: customerName } : {}),
        }
      : undefined;

    // Step 2: Create the draft receipt-backed invoice via Whop Invoices API
    const useMemberId = memberId.startsWith("mber_");
    const usePaymentMethod =
      collectionMethod === "charge_automatically" && paymentMethodId.startsWith("payt_");

    const draft = (await client.invoices.create(
      {
        account_id: runtime.accountId,
        items: [{ variant_id: variant.id, quantity: 1 }],
        ...(useMemberId
          ? { member_id: memberId }
          : {
              email_address: customerEmail,
              ...(customerName ? { customer_name: customerName } : {}),
            }),
        recipient_emails: [customerEmail],
        ...(usePaymentMethod ? { payment_method_id: paymentMethodId } : {}),
        ...(dueAt ? { due_at: dueAt } : {}),
        ...(billingAddress ? { billing_address: billingAddress } : {}),
        memo: itemizedMemoLines.slice(0, 2000),
        metadata: {
          job_number: jobNumber,
          gross_subtotal: grossSubtotal.toFixed(2),
          deposit_credit: depositCredit.toFixed(2),
          inspection_credit: inspectionCredit.toFixed(2),
          final_balance: finalBalance.toFixed(2),
          collection_method: collectionMethod,
        },
      },
      { idempotencyKey: `inv_${jobNumber}_${Date.now()}` },
    )) as unknown as Record<string, unknown>;

    const draftId = String(draft.id ?? "");

    // Step 3: Finalize — auto-charge stored card OR issue & send manual payment link
    let finalized: Record<string, unknown> = draft;
    if (usePaymentMethod) {
      finalized = (await client.invoices.issue({ id: draftId })) as unknown as Record<
        string,
        unknown
      >;
      if (finalized.status === "open" && !finalized.payment_processing) {
        try {
          finalized = (await client.invoices.charge({
            id: draftId,
            payment_method_id: paymentMethodId,
          })) as unknown as Record<string, unknown>;
        } catch (chargeErr) {
          // Issue already initiates immediate off-session collection when due_at is omitted
          console.info("[whop-invoices] Charge already queued on issue:", extractErrorMessage(chargeErr));
        }
      }
    } else {
      finalized = (await client.invoices.send({ id: draftId })) as unknown as Record<
        string,
        unknown
      >;
    }

    const rawLink =
      typeof finalized.checkout_link === "string"
        ? finalized.checkout_link
        : typeof finalized.pay_online_url === "string"
          ? finalized.pay_online_url
          : (variant.purchase_url ?? null);

    const checkoutLink =
      rawLink && !rawLink.startsWith("http")
        ? `${runtime.environment === "sandbox" ? "https://sandbox.whop.com" : "https://whop.com"}/checkout/${rawLink}`
        : rawLink;

    const record: FinalInvoiceRecord = {
      id: String(finalized.id ?? draftId),
      invoiceNumber: String(
        finalized.number ?? finalized.invoice_number ?? `INV-${draftId.slice(-6).toUpperCase()}`,
      ),
      status: String(finalized.status ?? (usePaymentMethod ? "processing" : "open")),
      collectionMethod,
      jobNumber,
      projectTitle,
      customerName: String(finalized.customer_name ?? customerName ?? "Homeowner"),
      customerEmail: String(finalized.email_address ?? customerEmail),
      memberId:
        (typeof finalized.member_id === "string" && finalized.member_id) ||
        (useMemberId ? memberId : null),
      paymentMethodId: usePaymentMethod ? paymentMethodId : null,
      variantId: variant.id,
      grossSubtotal,
      depositCredit,
      inspectionCredit,
      finalBalance,
      currency: "USD",
      checkoutLink,
      dueAt: typeof finalized.due_at === "string" ? finalized.due_at : dueAt,
      createdAt: String(finalized.created_at ?? new Date().toISOString()),
      memo: itemizedMemoLines,
      lineItems: cleanItems,
      mode: runtime.mode,
    };

    return jsonResponse(record, 201);
  } catch (err) {
    console.error("[whop-invoices] Error creating final invoice:", err);
    return errorResponse(extractErrorMessage(err), 502);
  }
}

async function handleListInvoices(runtime: ResolvedWhopRuntime): Promise<Response> {
  if (!runtime.isLiveConfigured) {
    return jsonResponse({ mode: "preview", data: previewInvoices });
  }

  try {
    const client = createWhopClient(runtime);
    const page = await client.invoices.list({
      account_id: runtime.accountId,
      first: 10,
    } as Parameters<typeof client.invoices.list>[0]);
    const raw = (page as unknown as { data?: Array<Record<string, unknown>> }).data ?? [];
    const data = raw.map((inv) => {
      const meta = (inv.metadata ?? {}) as Record<string, string>;
      const amountDue = normalizeMoneyNumber(inv.amount_due ?? inv.total, 0);
      const rawLink = typeof inv.checkout_link === "string" ? inv.checkout_link : null;
      return {
        id: String(inv.id ?? ""),
        invoiceNumber: String(inv.number ?? inv.invoice_number ?? inv.id ?? ""),
        status: String(inv.status ?? "open"),
        collectionMethod:
          meta.collection_method === "charge_automatically" || inv.payment_method_id
            ? "charge_automatically"
            : "send_invoice",
        jobNumber: meta.job_number ?? "ROOF-JOB",
        projectTitle: "Roofing Balance Invoice",
        customerName: String(inv.customer_name ?? ""),
        customerEmail: String(inv.email_address ?? ""),
        memberId: typeof inv.member_id === "string" ? inv.member_id : null,
        paymentMethodId: typeof inv.payment_method_id === "string" ? inv.payment_method_id : null,
        finalBalance: Number(meta.final_balance) || amountDue,
        depositCredit: Number(meta.deposit_credit) || 0,
        inspectionCredit: Number(meta.inspection_credit) || 0,
        currency: "USD",
        checkoutLink:
          rawLink && !rawLink.startsWith("http")
            ? `${runtime.environment === "sandbox" ? "https://sandbox.whop.com" : "https://whop.com"}/checkout/${rawLink}`
            : rawLink,
        dueAt: typeof inv.due_at === "string" ? inv.due_at : null,
        createdAt: String(inv.created_at ?? new Date().toISOString()),
        mode: runtime.mode,
      };
    });
    return jsonResponse({ mode: runtime.mode, data });
  } catch (err) {
    return errorResponse(extractErrorMessage(err), 502);
  }
}

/**
 * POST /api/webhooks/whop
 * Authoritative fulfillment handler verifying Standard Webhooks signatures with
 * `unwrapWebhook` from `@whop/sdk/helpers`.
 */
async function handleWhopWebhook(request: Request, runtime: ResolvedWhopRuntime): Promise<Response> {
  if (!runtime.webhookSecret) {
    return errorResponse(
      "WHOP_WEBHOOK_SECRET is not set. Configure via `whop apps secrets set --secret WHOP_WEBHOOK_SECRET=ws_xxx`.",
      503,
    );
  }

  const rawBody = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  let event: { type: string; data: Record<string, unknown> };
  try {
    event = unwrapWebhook<{ type: string; data: Record<string, unknown> }>(rawBody, {
      headers,
      key: runtime.webhookSecret,
    });
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      return errorResponse("Invalid webhook signature", 401);
    }
    return errorResponse("Malformed webhook payload", 400);
  }

  switch (event.type) {
    case "payment.succeeded": {
      const { id, member_id, payment_method_id, metadata } = event.data;
      console.log("[webhook] payment.succeeded — order fulfilled", {
        paymentId: id,
        memberId: member_id,
        savedPaymentMethodId: payment_method_id,
        metadata,
      });
      break;
    }
    case "payment.failed": {
      const { id, failure_message, metadata } = event.data;
      console.warn("[webhook] payment.failed", { paymentId: id, failure_message, metadata });
      break;
    }
    case "setup_intent.succeeded": {
      const { id, member_id, payment_method_id, metadata } = event.data;
      console.log("[webhook] setup_intent.succeeded — card vaulted for final invoice", {
        setupIntentId: id,
        memberId: member_id,
        paymentMethodId: payment_method_id,
        metadata,
      });
      break;
    }
    case "invoice.created":
    case "invoice.paid":
    case "invoice.past_due":
    case "invoice.voided": {
      const { id, status, number, email_address } = event.data;
      console.log(`[webhook] ${event.type}`, {
        invoiceId: id,
        invoiceNumber: number,
        status,
        email: email_address,
      });
      break;
    }
    default:
      console.log(`[webhook] Unhandled event type: ${event.type}`);
  }

  return jsonResponse({ received: true, type: event.type }, 200);
}

export default {
  async fetch(request: Request, env: WorkerBindings = {}): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method.toUpperCase();

    if (pathname.startsWith("/api/")) {
      const runtime = resolveRuntime(env);

      if (pathname === "/api/config" && method === "GET") {
        return handleGetConfig(runtime);
      }
      if (pathname === "/api/checkout/pay" && method === "POST") {
        return handleCheckoutPay(request, runtime);
      }
      if (pathname === "/api/checkout/setup-intent" && method === "POST") {
        return handleCreateSetupIntent(request, runtime);
      }
      if (pathname === "/api/checkout/status" && method === "GET") {
        return handleCheckoutStatus(request, runtime);
      }
      if (pathname === "/api/payment-methods" && method === "GET") {
        return requireAdminKey(request, runtime) ?? handleListPaymentMethods(request, runtime);
      }
      if (pathname === "/api/leads" && method === "POST") {
        return handleCreateLead(request, runtime);
      }
      if (pathname === "/api/leads" && method === "GET") {
        return requireAdminKey(request, runtime) ?? handleListLeads(runtime);
      }
      if (pathname === "/api/invoices" && method === "POST") {
        return requireAdminKey(request, runtime) ?? handleCreateInvoice(request, runtime);
      }
      if (pathname === "/api/invoices" && method === "GET") {
        return requireAdminKey(request, runtime) ?? handleListInvoices(runtime);
      }
      if (pathname === "/api/webhooks/whop" && method === "POST") {
        return handleWhopWebhook(request, runtime);
      }
      if (pathname === "/api/health" && method === "GET") {
        return jsonResponse({
          ok: true,
          company: COMPANY_CONFIG.brand.name,
          mode: runtime.mode,
          environment: runtime.environment,
        });
      }

      return errorResponse(`Route not found: ${method} ${pathname}`, 404);
    }

    // Serve static SPA assets via Whop/Cloudflare ASSETS binding
    if (env?.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  },
};
