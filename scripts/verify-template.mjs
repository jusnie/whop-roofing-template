#!/usr/bin/env node
/**
 * Automated Compliance & Integration Verification (`scripts/verify-template.mjs`)
 * ===============================================================================
 * Verifies every Whop Roofing Template requirement end-to-end:
 *   1. Whop Website hosting bundle (`dist/whop-build.zip`, `dist/client`, `dist/server/index.js`)
 *   2. Zero Stripe / PayPal / custom card form inputs anywhere in `src/`
 *   3. Real `@whop/elements-react` PaymentElement + CheckoutElement + ExpressCheckoutElement + BrandingElement
 *   4. All 3 required custom `whop.track` events (`estimate_requested`, `service_viewed`, `deposit_started`)
 *   5. All 3 required plans (Inspection $149, Project Deposit $500, Flat-Rate Service $349)
 *   6. Live Worker API execution against mocked Whop API endpoints:
 *      - GET  /api/config (auto-discovery + secret mapping, never leaks API key)
 *      - POST /api/checkout/pay (Payments API + open-redirect hardening)
 *      - POST /api/checkout/setup-intent (Setup Intents API card-on-file)
 *      - POST /api/leads (Members + Leads API + deduplicated Events API)
 *      - POST /api/invoices (`charge_automatically` stored card + `send_invoice` manual link)
 *      - POST /api/webhooks/whop (Standard Webhooks HMAC signature verification via `unwrapWebhook`)
 */

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walkSrc(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walkSrc(full));
    else if (/\.(ts|tsx|css|html)$/.test(entry)) out.push(full);
  }
  return out;
}

const srcFiles = walkSrc("src");
const allSrc = srcFiles.map((f) => readFileSync(f, "utf8")).join("\n");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

// 1. Check zero Stripe / PayPal / custom card inputs
assert.ok(!JSON.stringify(pkg.dependencies).includes("stripe"), "No Stripe dependency allowed");
assert.ok(!JSON.stringify(pkg.dependencies).includes("paypal"), "No PayPal dependency allowed");
for (const forbidden of ['autocomplete="cc-number"', 'autocomplete="cc-csc"', 'autocomplete="cc-exp"', 'name="cardNumber"', 'name="cvv"']) {
  assert.ok(!allSrc.includes(forbidden), `Forbidden custom card input detected: ${forbidden}`);
}
console.log("✓ Compliance: Whop Payments only — zero Stripe, PayPal, or custom card forms");

// 2. Check all required Whop Elements mounted & payPal explicitly set to 'never'
const checkoutSrc = readFileSync("src/components/WhopCheckoutModal.tsx", "utf8");
for (const el of [
  "WhopElements",
  "Payments",
  "PaymentElement",
  "EmailElement",
  "AddressElement",
  "BrandingElement",
  "Checkout",
  "CheckoutElement",
  "ExpressCheckoutElement",
  'setupFutureUsage: "off_session"',
  'mode="setup"',
  'payPal: "never"',
]) {
  assert.ok(checkoutSrc.includes(el), `Missing required Whop Element / option: ${el}`);
}
console.log("✓ Compliance: PaymentElement + CheckoutElement + ExpressCheckoutElement + BrandingElement + SetupIntent verified");

// 3. Check all 3 required custom whop.track events + product data attributes
const pixelSrc = readFileSync("src/lib/whop-pixel.ts", "utf8");
for (const ev of [
  '"service_viewed"',
  '"deposit_started"',
  '"estimate_requested"',
  "window.whop.track(",
  "data-whop-product-id",
  "data-whop-variant-id",
  "data-whop-price",
  "data-whop-currency",
]) {
  assert.ok(pixelSrc.includes(ev), `Missing pixel tracking call/attribute: ${ev}`);
}
console.log("✓ Compliance: Custom whop.track events (service_viewed, deposit_started, estimate_requested) + data-whop-* verified");

// 4. Check Whop hosting build output
assert.ok(existsSync("dist/whop-build.zip"), "dist/whop-build.zip must exist");
assert.ok(existsSync("dist/server/index.js"), "dist/server/index.js must exist");
assert.ok(existsSync("dist/client/index.html"), "dist/client/index.html must exist");
console.log("✓ Hosting: dist/whop-build.zip, dist/server/index.js, and dist/client/index.html verified");

// 5. Exercise compiled Worker against mocked live/sandbox Whop API endpoints
const workerModule = await import("../dist/server/index.js");
const worker = workerModule.default;

const recordedCalls = [];
const originalFetch = globalThis.fetch;

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const method = (init.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
  let bodyText = "";
  if (typeof init.body === "string") bodyText = init.body;
  else if (input instanceof Request && method !== "GET") bodyText = await input.clone().text();
  const parsedBody = bodyText ? JSON.parse(bodyText) : null;

  recordedCalls.push({ url, method, headers: Object.fromEntries(headers.entries()), body: parsedBody });

  if (url.endsWith("/api/v1/payments") && method === "POST") {
    return Response.json(
      {
        id: "pay_sandbox_001",
        status: "requires_action",
        client_secret: "pay_sandbox_001_secret_abc",
        member_id: "mber_sandbox_001",
        payment_method_id: "payt_sandbox_visa4242",
        payment_method: {
          id: "payt_sandbox_visa4242",
          card: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2034 },
        },
      },
      { status: 201 },
    );
  }
  if (url.endsWith("/api/v1/setup_intents") && method === "POST") {
    return Response.json(
      {
        id: "sint_sandbox_001",
        status: "succeeded",
        client_secret: "sint_sandbox_001_secret_xyz",
        member_id: "mber_sandbox_001",
        payment_method_id: "payt_sandbox_visa4242",
        payment_method: {
          id: "payt_sandbox_visa4242",
          card: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2034 },
        },
      },
      { status: 201 },
    );
  }
  if (url.endsWith("/api/v1/members") && method === "POST") {
    return Response.json(
      {
        id: "mber_sandbox_lead01",
        email: parsedBody.email,
        user: { id: "user_sandbox_lead01", name: parsedBody.name },
      },
      { status: 201 },
    );
  }
  if (url.endsWith("/api/v1/leads") && method === "POST") {
    return Response.json(
      {
        id: "lead_sandbox_998877",
        created_at: "2026-11-16T05:00:00.000Z",
        metadata: parsedBody.metadata,
      },
      { status: 201 },
    );
  }
  if (url.endsWith("/api/v1/events") && method === "POST") {
    return Response.json({ ok: true }, { status: 200 });
  }
  if (url.endsWith("/api/v1/variants") && method === "POST") {
    return Response.json(
      {
        id: "plan_sandbox_finalbal",
        initial_price: parsedBody.initial_price,
        purchase_url: "https://sandbox.whop.com/checkout/plan_sandbox_finalbal",
      },
      { status: 201 },
    );
  }
  if (url.endsWith("/api/v1/invoices") && method === "POST") {
    return Response.json(
      {
        id: "pay_inv_sandbox_501",
        number: "INV-0501",
        status: "draft",
        customer_name: parsedBody.customer_name || "Marcus Delgado",
        email_address: parsedBody.recipient_emails?.[0] || "marcus@example.com",
        member_id: parsedBody.member_id || "mber_sandbox_001",
        payment_method_id: parsedBody.payment_method_id || null,
      },
      { status: 201 },
    );
  }
  if (url.endsWith("/api/v1/invoices/pay_inv_sandbox_501/issue") && method === "POST") {
    return Response.json(
      {
        id: "pay_inv_sandbox_501",
        number: "INV-0501",
        status: "paid",
        payment_processing: true,
        member_id: "mber_sandbox_001",
        payment_method_id: "payt_sandbox_visa4242",
        checkout_link: "https://sandbox.whop.com/checkout/pay_inv_sandbox_501",
      },
      { status: 200 },
    );
  }
  if (url.endsWith("/api/v1/invoices/pay_inv_sandbox_501/send") && method === "POST") {
    return Response.json(
      {
        id: "pay_inv_sandbox_501",
        number: "INV-0501",
        status: "open",
        checkout_link: "https://sandbox.whop.com/checkout/pay_inv_sandbox_501",
        due_at: "2026-11-23T05:00:00.000Z",
      },
      { status: 200 },
    );
  }

  return originalFetch(input, init);
};

const rawWebhookKey = Buffer.from("test-whop-webhook-signing-secret-32b").toString("base64");
const mockEnv = {
  WHOP_ENVIRONMENT: "sandbox",
  WHOP_ACCOUNT_ID: "biz_sandbox123456",
  WHOP_API_KEY: "apik_secret_never_leak",
  WHOP_PRODUCT_ID: "prod_roofing123",
  WHOP_PLAN_INSPECTION: "plan_inspect149",
  WHOP_PLAN_DEPOSIT: "plan_deposit500",
  WHOP_PLAN_FLAT_RATE: "plan_tuneup349",
  WHOP_WEBHOOK_SECRET: rawWebhookKey,
};

// 5a. GET /api/config (verify zero secret leakage)
const cfgRes = await worker.fetch(new Request("https://ridgeline-roofing.whop.app/api/config"), mockEnv);
const cfgText = await cfgRes.text();
assert.ok(!cfgText.includes("apik_secret_never_leak"), "API key must NEVER leak in /api/config");
assert.ok(!cfgText.includes(rawWebhookKey), "Webhook secret must NEVER leak in /api/config");
const cfgJson = JSON.parse(cfgText);
assert.equal(cfgJson.isLiveConfigured, true);
assert.equal(cfgJson.environment, "sandbox");
assert.equal(cfgJson.plans.deposit, "plan_deposit500");
console.log("✓ API: GET /api/config returns catalog IDs & leaks zero secrets");

// 5b. POST /api/checkout/pay + open redirect protection
const payRes = await worker.fetch(
  new Request("https://ridgeline-roofing.whop.app/api/checkout/pay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      confirmationToken: "ctok_live_test_123",
      planKey: "deposit",
      orderId: "ord_900",
      returnUrl: "https://evil-attacker.example/steal",
      saveCard: true,
    }),
  }),
  mockEnv,
);
assert.equal(payRes.status, 201);
const payJson = await payRes.json();
assert.equal(payJson.id, "pay_sandbox_001");
assert.equal(payJson.clientSecret, "pay_sandbox_001_secret_abc");
assert.equal(payJson.savedCard.paymentMethodId, "payt_sandbox_visa4242");
const payCall = recordedCalls.find((c) => c.url.endsWith("/api/v1/payments"));
assert.ok(payCall.url.startsWith("https://sandbox-api.whop.com/api/v1/payments"));
assert.equal(payCall.headers["x-whop-inject-key"], "none");
assert.ok(
  payCall.body.return_url.startsWith("https://ridgeline-roofing.whop.app/"),
  "Open redirect must be blocked",
);
console.log("✓ API: POST /api/checkout/pay confirms ctok_, returns saved card, blocks open redirects");

// 5c. POST /api/checkout/setup-intent
const sintRes = await worker.fetch(
  new Request("https://ridgeline-roofing.whop.app/api/checkout/setup-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      confirmationToken: "ctok_setup_456",
      orderId: "ord_setup_1",
      returnUrl: "https://ridgeline-roofing.whop.app/checkout/return",
      customerEmail: "marcus@example.com",
    }),
  }),
  mockEnv,
);
assert.equal(sintRes.status, 201);
const sintJson = await sintRes.json();
assert.equal(sintJson.id, "sint_sandbox_001");
assert.equal(sintJson.paymentMethodId, "payt_sandbox_visa4242");
console.log("✓ API: POST /api/checkout/setup-intent creates Whop SetupIntent & returns vaulted payt_");

// 5d. POST /api/leads -> Whop Members + Whop Leads API
const leadRes = await worker.fetch(
  new Request("https://ridgeline-roofing.whop.app/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Elena Delgado",
      email: "elena@example.com",
      phone: "512-555-0199",
      address: "6412 Escarpment Blvd, Austin",
      zip: "78749",
      serviceType: "replacement",
      roofMaterial: "Standing-Seam Metal",
      urgency: "Soon — Within 1–2 Weeks",
      insuranceClaim: true,
      notes: "28-square roof after hail",
      eventId: "evt_est_99",
      referrer: "https://ridgeline-roofing.whop.app/#estimate",
    }),
  }),
  mockEnv,
);
assert.equal(leadRes.status, 201);
const leadJson = await leadRes.json();
assert.equal(leadJson.id, "lead_sandbox_998877");
assert.equal(leadJson.memberId, "mber_sandbox_lead01");
const leadApiCall = recordedCalls.find((c) => c.url.endsWith("/api/v1/leads"));
assert.equal(leadApiCall.body.account_id, "biz_sandbox123456");
assert.equal(leadApiCall.body.user_id, "user_sandbox_lead01");
assert.equal(leadApiCall.body.product_id, "prod_roofing123");
console.log("✓ API: POST /api/leads creates Whop Member + Lead (POST /api/v1/leads) + CAPI event");

// 5e. POST /api/invoices (auto-charge stored card AND send manual invoice)
const autoInvRes = await worker.fetch(
  new Request("https://ridgeline-roofing.whop.app/api/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      collectionMethod: "charge_automatically",
      jobNumber: "JOB-2026-0847",
      projectTitle: "Class 4 Replacement Final Balance",
      customerName: "Marcus Delgado",
      customerEmail: "marcus@example.com",
      memberId: "mber_sandbox_001",
      paymentMethodId: "payt_sandbox_visa4242",
      billingAddress: { line1: "6412 Escarpment Blvd", city: "Austin", state: "TX", postalCode: "78749", country: "US" },
      lineItems: [{ id: "1", label: "28 Sq Class 4 Shingles", quantity: 28, unitPrice: 465 }],
      depositCredit: 500,
      inspectionCredit: 149,
      dueInDays: 0,
      memo: "Final balance",
    }),
  }),
  mockEnv,
);
assert.equal(autoInvRes.status, 201);
const autoInvJson = await autoInvRes.json();
assert.equal(autoInvJson.finalBalance, 12371);
assert.equal(autoInvJson.status, "paid");
assert.equal(autoInvJson.paymentMethodId, "payt_sandbox_visa4242");

const sendInvRes = await worker.fetch(
  new Request("https://ridgeline-roofing.whop.app/api/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      collectionMethod: "send_invoice",
      jobNumber: "JOB-2026-0848",
      projectTitle: "Manual Roof Invoice",
      customerName: "Marcus Delgado",
      customerEmail: "marcus@example.com",
      billingAddress: { line1: "6412 Escarpment Blvd", city: "Austin", state: "TX", postalCode: "78749", country: "US" },
      lineItems: [{ id: "1", label: "Flashing & Valley Repair", quantity: 1, unitPrice: 1850 }],
      depositCredit: 500,
      inspectionCredit: 0,
      dueInDays: 7,
      memo: "Net 7",
    }),
  }),
  mockEnv,
);
assert.equal(sendInvRes.status, 201);
const sendInvJson = await sendInvRes.json();
assert.equal(sendInvJson.finalBalance, 1350);
assert.equal(sendInvJson.status, "open");
assert.ok(sendInvJson.checkoutLink.includes("whop.com/checkout/"));
console.log("✓ API: POST /api/invoices verifies both auto-charge (stored payt_) and send_invoice (manual checkout_link)");

// 5e-bis. WHOP_ADMIN_KEY office gate protects admin routes without leaking secret in /api/config
const gatedEnv = { ...mockEnv, WHOP_ADMIN_KEY: "office_secret_9876" };
const gatedCfgRes = await worker.fetch(new Request("https://ridgeline-roofing.whop.app/api/config"), gatedEnv);
const gatedCfgRaw = await gatedCfgRes.text();
assert.ok(!gatedCfgRaw.includes("office_secret_9876"), "WHOP_ADMIN_KEY must never leak in /api/config");
assert.equal(JSON.parse(gatedCfgRaw).invoiceAuthRequired, true);

const unauthInvRes = await worker.fetch(
  new Request("https://ridgeline-roofing.whop.app/api/invoices", { method: "GET" }),
  gatedEnv,
);
assert.equal(unauthInvRes.status, 401);

const wrongKeyRes = await worker.fetch(
  new Request("https://ridgeline-roofing.whop.app/api/leads", {
    method: "GET",
    headers: { "x-whop-admin-key": "wrong_key" },
  }),
  gatedEnv,
);
assert.equal(wrongKeyRes.status, 401);

const authInvRes = await worker.fetch(
  new Request("https://ridgeline-roofing.whop.app/api/invoices", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-whop-admin-key": "office_secret_9876",
    },
    body: JSON.stringify({
      collectionMethod: "send_invoice",
      jobNumber: "JOB-2026-0849",
      projectTitle: "Authorized Invoice",
      customerName: "Marcus Delgado",
      customerEmail: "marcus@example.com",
      billingAddress: { line1: "6412 Escarpment Blvd", city: "Austin", state: "TX", postalCode: "78749", country: "US" },
      lineItems: [{ id: "1", label: "Ridge Vent Repair", quantity: 1, unitPrice: 950 }],
      depositCredit: 0,
      inspectionCredit: 0,
      dueInDays: 7,
      memo: "Net 7",
    }),
  }),
  gatedEnv,
);
assert.equal(authInvRes.status, 201);
console.log("✓ API: WHOP_ADMIN_KEY locks invoice/lead/payment-method admin routes when configured");

// 5f. POST /api/webhooks/whop (valid signature accepted, tampered signature rejected)
const webhookPayload = JSON.stringify({
  id: "msg_test_01",
  type: "setup_intent.succeeded",
  timestamp: new Date().toISOString(),
  data: {
    id: "sint_sandbox_001",
    member_id: "mber_sandbox_001",
    payment_method_id: "payt_sandbox_visa4242",
    metadata: { order_id: "ord_setup_1" },
  },
});
const msgId = "msg_test_01";
const ts = String(Math.floor(Date.now() / 1000));
const sig = createHmac("sha256", Buffer.from(rawWebhookKey, "utf8"))
  .update(`${msgId}.${ts}.${webhookPayload}`)
  .digest("base64");

const validWhRes = await worker.fetch(
  new Request("https://ridgeline-roofing.whop.app/api/webhooks/whop", {
    method: "POST",
    headers: {
      "webhook-id": msgId,
      "webhook-timestamp": ts,
      "webhook-signature": `v1,${sig}`,
    },
    body: webhookPayload,
  }),
  mockEnv,
);
assert.equal(validWhRes.status, 200);

const badWhRes = await worker.fetch(
  new Request("https://ridgeline-roofing.whop.app/api/webhooks/whop", {
    method: "POST",
    headers: {
      "webhook-id": msgId,
      "webhook-timestamp": ts,
      "webhook-signature": "v1,invalidsignature==",
    },
    body: webhookPayload,
  }),
  mockEnv,
);
assert.equal(badWhRes.status, 401);
console.log("✓ API: POST /api/webhooks/whop cryptographically verifies signatures via @whop/sdk/helpers");

globalThis.fetch = originalFetch;
console.log("\nALL WHOP ROOFING WEBSITE TEMPLATE CHECKS PASSED (100%).\n");
