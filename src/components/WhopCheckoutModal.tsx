/**
 * Whop Payment Elements Checkout Dialog (`WhopCheckoutModal.tsx`)
 * ===============================================================
 * Zero custom card forms — every payment input is rendered inside Whop's
 * PCI-isolated frames via `@whop/elements-react`:
 *
 *  1. `<ExpressCheckoutElement />` inside `<Checkout />` (Apple Pay & Google Pay, `payPal: "never"`)
 *  2. `<EmailElement />` + `<AddressElement />` + `<PaymentElement />` + required `<BrandingElement />`
 *     inside `<Payments />`, passing `setupFutureUsage: "off_session"` on the $500 deposit plan
 *  3. Optional `<CheckoutElement />` tab for all-in-one embedded Whop checkout
 *  4. Dedicated `<Payments mode="setup">` tab running `POST /api/checkout/setup-intent`
 *     to place or update a vaulted card (`payt_...`) for final balance billing
 */

import { useEffect, useMemo, useState } from "react";
import {
  AddressElement,
  type Appearance,
  BrandingElement,
  Checkout,
  CheckoutElement,
  EmailElement,
  ExpressCheckoutElement,
  PaymentElement,
  Payments,
  WhopElements,
  usePayments,
  useWhop,
} from "@whop/elements-react";
import { loadWhop } from "@whop/elements";
import { Loader2, X } from "lucide-react";
import {
  COMPANY_CONFIG,
  formatUsd,
  getPlanByKey,
  type PlanKey,
  type RoofingPlanConfig,
} from "../config/company.config";
import { trackWhopEvent } from "../lib/whop-pixel";
import type {
  CheckoutPayResponse,
  RuntimeConfigResponse,
  SavedCardSummary,
  SetupIntentResponse,
} from "../types/whop";

type CheckoutSurfaceTab = "payment_element" | "checkout_element" | "setup_intent";

interface WhopCheckoutModalProps {
  planKey: PlanKey;
  orderId: string;
  runtime: RuntimeConfigResponse;
  onClose: () => void;
  onSelectPlan: (planKey: PlanKey) => void;
  onCheckoutSuccess: (result: {
    paymentId?: string;
    setupIntentId?: string;
    planKey: PlanKey;
    orderId: string;
    status: string;
    savedCard: SavedCardSummary | null;
    memberId: string | null;
  }) => void;
  onJumpToInvoice: () => void;
}

const ELEMENTS_APPEARANCE: Appearance = {
  theme: {
    appearance: "light",
    accentColor: COMPANY_CONFIG.brand.whopAccentColor,
    grayColor: "sand",
  },
};

function LivePaymentElementsForm({
  plan,
  planId,
  orderId,
  returnUrl,
  propertyAddress,
  onSuccess,
}: {
  plan: RoofingPlanConfig;
  planId: string;
  orderId: string;
  returnUrl: string;
  propertyAddress: string;
  onSuccess: (payload: {
    paymentId: string;
    status: string;
    savedCard: SavedCardSummary | null;
    memberId: string | null;
  }) => void;
}) {
  const payments = usePayments();
  const whop = useWhop();
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!payments || !whop || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const { confirmationToken } = await payments.createConfirmationToken({});

      const response = await fetch("/api/checkout/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmationToken,
          planKey: plan.key,
          planId,
          orderId,
          returnUrl,
          saveCard: plan.savesCardOnFile,
          propertyAddress,
        }),
      });

      const data = (await response.json()) as CheckoutPayResponse;
      if (!response.ok || data.error) {
        setError(data.error ?? "Payment could not be created");
        setSubmitting(false);
        return;
      }

      if (data.status === "paid" || data.status === "succeeded") {
        onSuccess({
          paymentId: data.id,
          status: "succeeded",
          savedCard: data.savedCard ?? null,
          memberId: data.memberId ?? null,
        });
        return;
      }

      if (data.clientSecret) {
        const next = await whop.payments.handleNextAction({
          clientSecret: data.clientSecret,
        });
        if (next.redirected) return;

        if (next.status === "succeeded") {
          const statusRes = await fetch(
            `/api/checkout/status?payment_id=${encodeURIComponent(data.id)}`,
          ).catch(() => null);
          const refreshed = statusRes?.ok
            ? ((await statusRes.json()) as {
                savedCard?: SavedCardSummary | null;
                memberId?: string | null;
              })
            : null;

          onSuccess({
            paymentId: data.id,
            status: "succeeded",
            savedCard: refreshed?.savedCard ?? data.savedCard ?? null,
            memberId: refreshed?.memberId ?? data.memberId ?? null,
          });
          return;
        }

        if (next.status === "failed") {
          setError(next.lastPaymentError?.message ?? "Card authentication did not succeed");
          setSubmitting(false);
          return;
        }

        onSuccess({
          paymentId: data.id,
          status: "processing",
          savedCard: data.savedCard ?? null,
          memberId: data.memberId ?? null,
        });
        return;
      }

      onSuccess({
        paymentId: data.id,
        status: data.status,
        savedCard: data.savedCard ?? null,
        memberId: data.memberId ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to confirm payment");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <span className="block text-[12px] leading-4 text-[var(--text-muted)] mb-2">
          Receipt email
        </span>
        <EmailElement />
      </div>

      <div>
        <span className="block text-[12px] leading-4 text-[var(--text-muted)] mb-2">
          Billing address
        </span>
        <AddressElement mode="billing" />
      </div>

      <div>
        <span className="block text-[12px] leading-4 text-[var(--text-muted)] mb-2">
          Payment method
        </span>
        <PaymentElement
          wallets={{ applePay: "never", googlePay: "never", payPal: "never" }}
          onChange={(e) => setReady(e.complete)}
        />
      </div>

      {/* Required Whop BrandingElement — createConfirmationToken requires it mounted and visible */}
      <div className="pt-1">
        <BrandingElement />
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-[8px] border border-[var(--status-negative)]/25 bg-[var(--status-negative)]/5 px-4 py-3 text-[13px] leading-5 text-[var(--status-negative)]"
        >
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={!ready || submitting}
        onClick={handleSubmit}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-[var(--brand-primary)] px-5 text-[15px] font-medium text-white hover:bg-[var(--brand-primary-hover)] active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed ui-transition cursor-pointer tabular-nums"
      >
        {submitting ? (
          <>
            <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
            <span>Confirming with Whop…</span>
          </>
        ) : (
          <span>
            {plan.savesCardOnFile
              ? `Pay ${formatUsd(plan.price)} deposit and save card`
              : `Pay ${formatUsd(plan.price)}`}
          </span>
        )}
      </button>
    </div>
  );
}

function LiveSetupIntentForm({
  orderId,
  returnUrl,
  propertyAddress,
  onSuccess,
}: {
  orderId: string;
  returnUrl: string;
  propertyAddress: string;
  onSuccess: (payload: {
    setupIntentId: string;
    status: string;
    savedCard: SavedCardSummary | null;
    memberId: string | null;
  }) => void;
}) {
  const payments = usePayments();
  const whop = useWhop();
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSaveCard() {
    if (!payments || !whop || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const { confirmationToken } = await payments.createConfirmationToken({});
      const res = await fetch("/api/checkout/setup-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmationToken,
          orderId,
          returnUrl,
          propertyAddress,
        }),
      });

      const data = (await res.json()) as SetupIntentResponse;
      if (!res.ok || data.error) {
        setError(data.error ?? "Could not create setup intent");
        setSubmitting(false);
        return;
      }

      if (data.status === "succeeded") {
        onSuccess({
          setupIntentId: data.id,
          status: "succeeded",
          savedCard: data.savedCard ?? null,
          memberId: data.memberId ?? null,
        });
        return;
      }

      if (data.status === "canceled") {
        setError("The payment method could not be saved. Please try a different card.");
        setSubmitting(false);
        return;
      }

      if (data.status === "processing") {
        onSuccess({
          setupIntentId: data.id,
          status: "processing",
          savedCard: data.savedCard ?? null,
          memberId: data.memberId ?? null,
        });
        return;
      }

      if (data.clientSecret) {
        const next = await whop.payments.handleNextAction({
          clientSecret: data.clientSecret,
        });
        if (next.redirected) return;

        if (next.status === "failed") {
          setError(next.lastPaymentError?.message ?? "Card verification did not succeed");
          setSubmitting(false);
          return;
        }

        const statusRes = await fetch(
          `/api/checkout/status?setup_intent_id=${encodeURIComponent(data.id)}`,
        ).catch(() => null);
        const refreshed = statusRes?.ok
          ? ((await statusRes.json()) as {
              savedCard?: SavedCardSummary | null;
              memberId?: string | null;
            })
          : null;

        onSuccess({
          setupIntentId: data.id,
          status: next.status,
          savedCard: refreshed?.savedCard ?? data.savedCard ?? null,
          memberId: refreshed?.memberId ?? data.memberId ?? null,
        });
        return;
      }

      onSuccess({
        setupIntentId: data.id,
        status: data.status,
        savedCard: data.savedCard ?? null,
        memberId: data.memberId ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save card on file");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-[13px] leading-5 text-[var(--text-secondary)]">
        Places a verified payment method on file (payt_) with no charge today so your remaining
        roofing contract balance can be billed after walkthrough sign-off.
      </p>

      <div>
        <span className="block text-[12px] leading-4 text-[var(--text-muted)] mb-2">
          Homeowner email
        </span>
        <EmailElement />
      </div>

      <div>
        <span className="block text-[12px] leading-4 text-[var(--text-muted)] mb-2">
          Payment method to vault
        </span>
        <PaymentElement
          wallets={{ applePay: "never", googlePay: "never", payPal: "never" }}
          onChange={(e) => setReady(e.complete)}
        />
      </div>

      <div className="pt-1">
        <BrandingElement />
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-[8px] border border-[var(--status-negative)]/25 bg-[var(--status-negative)]/5 px-4 py-3 text-[13px] leading-5 text-[var(--status-negative)]"
        >
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={!ready || submitting}
        onClick={handleSaveCard}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-[var(--text-primary)] px-5 text-[14px] font-medium text-[#fdfbf7] hover:bg-[#332d25] active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed ui-transition cursor-pointer"
      >
        {submitting ? (
          <>
            <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
            <span>Vaulting card via Setup Intent…</span>
          </>
        ) : (
          <span>Save card on file · $0 today</span>
        )}
      </button>
    </div>
  );
}

export function WhopCheckoutModal({
  planKey,
  orderId,
  runtime,
  onClose,
  onSelectPlan,
  onCheckoutSuccess,
  onJumpToInvoice,
}: WhopCheckoutModalProps) {
  const plan = getPlanByKey(planKey);
  const planId = runtime.plans[planKey] || "";
  const accountId = runtime.accountId || "";
  const canMountLiveElements = Boolean(accountId.startsWith("biz_") && planId.startsWith("plan_"));

  const [tab, setTab] = useState<CheckoutSurfaceTab>("payment_element");
  const [propertyAddress, setPropertyAddress] = useState("6412 Escarpment Blvd, Austin, TX 78749");
  const [previewName, setPreviewName] = useState("Marcus Delgado");
  const [previewEmail, setPreviewEmail] = useState("marcus.delgado@example.com");
  const [previewSubmitting, setPreviewSubmitting] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [receipt, setReceipt] = useState<{
    id: string;
    kind: "payment" | "setup_intent";
    status: string;
    savedCard: SavedCardSummary | null;
    memberId: string | null;
  } | null>(null);

  useEffect(() => {
    setReceipt(null);
    setPreviewError(null);
    if (planKey !== "deposit" && tab === "setup_intent") {
      setTab("payment_element");
    }
  }, [planKey, tab]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const whopPromise = useMemo(() => {
    if (!canMountLiveElements) return null;
    return loadWhop();
  }, [canMountLiveElements]);

  const returnUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const url = new URL("/checkout/return", window.location.origin);
    url.searchParams.set("order_id", orderId);
    url.searchParams.set("plan", plan.key);
    return url.toString();
  }, [orderId, plan.key]);

  function finishCheckout(payload: {
    id: string;
    kind: "payment" | "setup_intent";
    status: string;
    savedCard: SavedCardSummary | null;
    memberId: string | null;
  }) {
    setReceipt(payload);
    trackWhopEvent(payload.kind === "setup_intent" ? "card_saved_on_file" : "checkout_completed", {
      plan_key: plan.key,
      variant_id: planId || undefined,
      product_id: runtime.productId || undefined,
      value: payload.kind === "setup_intent" ? 0 : plan.price,
      currency: plan.currency,
      payment_id: payload.id,
      card_saved: Boolean(payload.savedCard),
    });

    onCheckoutSuccess({
      paymentId: payload.kind === "payment" ? payload.id : undefined,
      setupIntentId: payload.kind === "setup_intent" ? payload.id : undefined,
      planKey: plan.key,
      orderId,
      status: payload.status,
      savedCard: payload.savedCard,
      memberId: payload.memberId,
    });
  }

  /**
   * Local preview simulator — uses zero custom card inputs (a single synthetic
   * `ctok_preview_*` token call) so the full Deposit -> SetupIntent -> Final Invoice
   * workflow is testable before running `npm run whop:provision`.
   */
  async function handleRunPreviewCheckout(mode: "pay" | "setup") {
    setPreviewSubmitting(true);
    setPreviewError(null);

    try {
      const endpoint = mode === "setup" ? "/api/checkout/setup-intent" : "/api/checkout/pay";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmationToken: `ctok_preview_${Date.now()}`,
          planKey: plan.key,
          orderId,
          returnUrl,
          saveCard: mode === "setup" ? true : plan.savesCardOnFile,
          customerName: previewName,
          customerEmail: previewEmail,
          propertyAddress,
        }),
      });

      const data = (await res.json()) as CheckoutPayResponse & SetupIntentResponse;
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Preview request failed");
      }

      finishCheckout({
        id: data.id,
        kind: mode === "setup" ? "setup_intent" : "payment",
        status: "succeeded",
        savedCard: data.savedCard ?? null,
        memberId: data.memberId ?? null,
      });
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Unable to run preview checkout");
    } finally {
      setPreviewSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#12110f]/65 p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="whop-checkout-title"
    >
      <div className="relative my-auto w-full max-w-[920px] rounded-[16px] border border-[var(--border-hairline)] bg-[var(--surface-card)] shadow-float overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-hairline)]">
          <div className="flex items-baseline gap-3">
            <span className="text-[14px] font-medium text-[var(--text-primary)]">
              {COMPANY_CONFIG.brand.shortName} checkout
            </span>
            <span className="font-mono text-[12px] text-[var(--text-muted)]">
              {runtime.mode === "sandbox"
                ? "Whop sandbox"
                : runtime.mode === "production"
                  ? "Whop live"
                  : "Preview mode"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] ui-transition cursor-pointer"
            aria-label="Close checkout"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 max-h-[84vh] overflow-y-auto">
          {/* Left: Order summary and plan selector */}
          <div className="lg:col-span-5 bg-[var(--surface-page)] p-6 border-b lg:border-b-0 lg:border-r border-[var(--border-hairline)] space-y-6">
            <div>
              <span className="block text-[12px] leading-4 text-[var(--text-muted)] mb-2">
                Selected plan
              </span>
              <div className="grid grid-cols-3 gap-1 rounded-[10px] border border-[var(--border-hairline)] bg-[var(--surface-raised)] p-1">
                {COMPANY_CONFIG.plans.map((p) => {
                  const active = p.key === plan.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => onSelectPlan(p.key)}
                      className={`h-8 rounded-[6px] px-2 font-mono text-[12px] ui-transition cursor-pointer tabular-nums ${
                        active
                          ? "bg-[var(--surface-card)] font-medium text-[var(--text-primary)] shadow-subtle"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {formatUsd(p.price)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h2
                id="whop-checkout-title"
                className="text-[20px] leading-7 font-medium text-[var(--text-primary)]"
              >
                {plan.name}
              </h2>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-mono text-[32px] leading-none font-medium text-[var(--text-primary)] tabular-nums">
                  {tab === "setup_intent" ? "$0" : formatUsd(plan.price)}
                </span>
                <span className="text-[13px] text-[var(--text-muted)]">
                  {tab === "setup_intent" ? "card verification" : "USD one-time"}
                </span>
              </div>
              <p className="mt-2 text-[13px] leading-5 text-[var(--text-secondary)]">
                {plan.priceNote}
              </p>
            </div>

            <ul className="pt-4 border-t border-[var(--border-hairline)] space-y-2">
              {plan.deliverables.map((line) => (
                <li key={line} className="text-[13px] leading-5 text-[var(--text-secondary)]">
                  — {line}
                </li>
              ))}
            </ul>

            <div>
              <label
                htmlFor="checkout-service-address"
                className="block text-[12px] leading-4 text-[var(--text-muted)] mb-2"
              >
                Service property address
              </label>
              <input
                id="checkout-service-address"
                type="text"
                value={propertyAddress}
                onChange={(e) => setPropertyAddress(e.target.value)}
                placeholder="6412 Escarpment Blvd, Austin"
                className="h-10 w-full rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-card)] px-3 text-[13px] text-[var(--text-primary)] focus:border-[var(--text-primary)] focus:outline-none"
              />
            </div>

            <div className="pt-4 border-t border-[var(--border-hairline)] font-mono text-[11px] leading-4 text-[var(--text-muted)] flex justify-between gap-2">
              <span>Order</span>
              <span className="truncate">{orderId}</span>
            </div>
          </div>

          {/* Right: Whop Payment Elements surface */}
          <div className="lg:col-span-7 p-6 lg:p-8 space-y-6">
            {receipt ? (
              <div className="space-y-6 py-2">
                <div>
                  <p className="inline-flex items-center gap-2 font-mono text-[12px] leading-4 text-[var(--status-positive)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-positive)]" />
                    {receipt.status === "processing" ? "Processing" : "Confirmed"}
                  </p>
                  <h3 className="mt-2 font-display text-[32px] leading-[1.1] text-[var(--text-primary)]">
                    {receipt.kind === "setup_intent"
                      ? "Card saved on file"
                      : `${plan.shortName} confirmed`}
                  </h3>
                </div>

                <div className="border-t border-[var(--border-hairline)]">
                  <div className="spec-row">
                    <span className="text-[13px] text-[var(--text-muted)]">
                      {receipt.kind === "setup_intent" ? "Setup intent" : "Payment ID"}
                    </span>
                    <span className="font-mono text-[13px] text-[var(--text-primary)]">
                      {receipt.id}
                    </span>
                  </div>
                  <div className="spec-row">
                    <span className="text-[13px] text-[var(--text-muted)]">Amount charged</span>
                    <span className="font-mono text-[14px] font-medium text-[var(--text-primary)] tabular-nums">
                      {receipt.kind === "setup_intent" ? "$0" : formatUsd(plan.price)}
                    </span>
                  </div>
                  {receipt.memberId && (
                    <div className="spec-row">
                      <span className="text-[13px] text-[var(--text-muted)]">Member ID</span>
                      <span className="font-mono text-[13px] text-[var(--text-primary)]">
                        {receipt.memberId}
                      </span>
                    </div>
                  )}
                  {receipt.savedCard && (
                    <div className="spec-row">
                      <span className="text-[13px] text-[var(--text-muted)]">
                        Vaulted payment method
                      </span>
                      <span className="font-mono text-[13px] text-[var(--status-positive)] tabular-nums">
                        {receipt.savedCard.brand.toUpperCase()} ·••• {receipt.savedCard.last4} (
                        {receipt.savedCard.paymentMethodId})
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  {receipt.savedCard && (
                    <button
                      type="button"
                      onClick={onJumpToInvoice}
                      className="inline-flex h-11 flex-1 items-center justify-center rounded-[8px] bg-[var(--brand-primary)] px-4 text-[14px] font-medium text-white hover:bg-[var(--brand-primary-hover)] ui-transition cursor-pointer"
                    >
                      Bill final balance via Whop Invoices
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex h-11 items-center justify-center rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-page)] px-5 text-[14px] text-[var(--text-primary)] hover:bg-[var(--surface-raised)] ui-transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : canMountLiveElements && whopPromise ? (
              <WhopElements
                elements={whopPromise}
                appearance={ELEMENTS_APPEARANCE}
                environment={runtime.environment}
              >
                {/* Element mode selector */}
                <div className="inline-flex rounded-[10px] border border-[var(--border-hairline)] bg-[var(--surface-raised)] p-1">
                  <button
                    type="button"
                    onClick={() => setTab("payment_element")}
                    className={`h-8 rounded-[6px] px-3 text-[12px] ui-transition cursor-pointer ${
                      tab === "payment_element"
                        ? "bg-[var(--surface-card)] font-medium text-[var(--text-primary)] shadow-subtle"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    Payment Elements
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("checkout_element")}
                    className={`h-8 rounded-[6px] px-3 text-[12px] ui-transition cursor-pointer ${
                      tab === "checkout_element"
                        ? "bg-[var(--surface-card)] font-medium text-[var(--text-primary)] shadow-subtle"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    Embedded Checkout
                  </button>
                  {plan.savesCardOnFile && (
                    <button
                      type="button"
                      onClick={() => setTab("setup_intent")}
                      className={`h-8 rounded-[6px] px-3 text-[12px] ui-transition cursor-pointer ${
                        tab === "setup_intent"
                          ? "bg-[var(--surface-card)] font-medium text-[var(--text-primary)] shadow-subtle"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      Save card only
                    </button>
                  )}
                </div>

                {runtime.mode === "sandbox" && (
                  <p className="rounded-[8px] border border-[var(--border-hairline)] bg-[var(--surface-page)] px-3 py-2 font-mono text-[11px] leading-4 text-[var(--text-secondary)] tabular-nums">
                    Sandbox card 4242 4242 4242 4242 · future exp · CVC 123 · 3DS 5385 3083 6013
                    5181 (Checkout1!)
                  </p>
                )}

                {tab === "payment_element" && (
                  <div className="space-y-6">
                    {/* ExpressCheckoutElement: Apple Pay & Google Pay */}
                    <div className="space-y-2">
                      <span className="block text-[12px] leading-4 text-[var(--text-muted)]">
                        Express checkout
                      </span>
                      <Checkout
                        plan={planId}
                        returnUrl={returnUrl}
                        onComplete={(ev) => {
                          const id = "paymentId" in ev ? ev.paymentId : orderId;
                          finishCheckout({
                            id,
                            kind: "payment",
                            status: "succeeded",
                            savedCard: null,
                            memberId: null,
                          });
                        }}
                      >
                        <ExpressCheckoutElement
                          layout="horizontal"
                          wallets={{
                            applePay: "auto",
                            googlePay: "auto",
                            payPal: "never",
                          }}
                        />
                      </Checkout>
                    </div>

                    <div className="flex items-center gap-3 text-[12px] text-[var(--text-muted)]">
                      <div className="h-px flex-1 bg-[var(--border-hairline)]" />
                      <span>Or pay with card, bank, or financing</span>
                      <div className="h-px flex-1 bg-[var(--border-hairline)]" />
                    </div>

                    {/* Payments + PaymentElement + EmailElement + AddressElement + BrandingElement */}
                    <Payments
                      key={`${planId}-${plan.savesCardOnFile ? "save" : "once"}`}
                      accountId={accountId}
                      plan={planId}
                      returnUrl={returnUrl}
                      {...(plan.savesCardOnFile ? { setupFutureUsage: "off_session" } : {})}
                    >
                      <LivePaymentElementsForm
                        plan={plan}
                        planId={planId}
                        orderId={orderId}
                        returnUrl={returnUrl}
                        propertyAddress={propertyAddress}
                        onSuccess={(res) =>
                          finishCheckout({
                            id: res.paymentId,
                            kind: "payment",
                            status: res.status,
                            savedCard: res.savedCard,
                            memberId: res.memberId,
                          })
                        }
                      />
                    </Payments>
                  </div>
                )}

                {tab === "checkout_element" && (
                  <div className="space-y-4">
                    <Checkout
                      plan={planId}
                      returnUrl={returnUrl}
                      onComplete={(ev) => {
                        const id = "paymentId" in ev ? ev.paymentId : orderId;
                        finishCheckout({
                          id,
                          kind: "payment",
                          status: "succeeded",
                          savedCard: null,
                          memberId: null,
                        });
                      }}
                    >
                      <CheckoutElement />
                    </Checkout>
                  </div>
                )}

                {tab === "setup_intent" && (
                  <Payments
                    accountId={accountId}
                    mode="setup"
                    currency="usd"
                    returnUrl={returnUrl}
                  >
                    <LiveSetupIntentForm
                      orderId={orderId}
                      returnUrl={returnUrl}
                      propertyAddress={propertyAddress}
                      onSuccess={(res) =>
                        finishCheckout({
                          id: res.setupIntentId,
                          kind: "setup_intent",
                          status: res.status,
                          savedCard: res.savedCard,
                          memberId: res.memberId,
                        })
                      }
                    />
                  </Payments>
                )}
              </WhopElements>
            ) : (
              /* Unconfigured preview mode — zero card inputs, exercises live Worker routes */
              <div className="space-y-6">
                <div className="rounded-[12px] border border-[var(--border-hairline)] bg-[var(--surface-page)] p-4 space-y-2">
                  <p className="text-[14px] font-medium text-[var(--text-primary)]">
                    Whop Payment Elements ready for catalog IDs
                  </p>
                  <p className="text-[13px] leading-5 text-[var(--text-secondary)]">
                    Once deployed with Whop plan IDs, ExpressCheckoutElement (Apple Pay and Google
                    Pay), EmailElement, AddressElement, PaymentElement, and BrandingElement render
                    in this frame with zero custom card inputs.
                  </p>
                  <pre className="mt-2 rounded-[8px] bg-[var(--dark-page)] px-3 py-2 font-mono text-[11px] leading-4 text-[var(--dark-secondary)] overflow-x-auto">
                    npm run whop:provision -- --apply-secrets && npm run deploy
                  </pre>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="preview-checkout-name"
                      className="block text-[12px] leading-4 text-[var(--text-muted)] mb-2"
                    >
                      Homeowner
                    </label>
                    <input
                      id="preview-checkout-name"
                      type="text"
                      value={previewName}
                      onChange={(e) => setPreviewName(e.target.value)}
                      className="h-10 w-full rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-page)] px-3 text-[14px] text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="preview-checkout-email"
                      className="block text-[12px] leading-4 text-[var(--text-muted)] mb-2"
                    >
                      Receipt email
                    </label>
                    <input
                      id="preview-checkout-email"
                      type="email"
                      value={previewEmail}
                      onChange={(e) => setPreviewEmail(e.target.value)}
                      className="h-10 w-full rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-page)] px-3 text-[14px] text-[var(--text-primary)]"
                    />
                  </div>
                </div>

                {previewError && (
                  <p
                    role="alert"
                    className="rounded-[8px] border border-[var(--status-negative)]/25 bg-[var(--status-negative)]/5 px-4 py-3 text-[13px] text-[var(--status-negative)]"
                  >
                    {previewError}
                  </p>
                )}

                <div className="space-y-3">
                  <button
                    type="button"
                    disabled={previewSubmitting}
                    onClick={() => handleRunPreviewCheckout("pay")}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-[var(--brand-primary)] px-5 text-[14px] font-medium text-white hover:bg-[var(--brand-primary-hover)] active:scale-[0.98] disabled:opacity-50 ui-transition cursor-pointer tabular-nums"
                  >
                    {previewSubmitting ? (
                      <>
                        <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
                        <span>Running preview…</span>
                      </>
                    ) : (
                      <span>
                        Simulate {formatUsd(plan.price)} checkout
                        {plan.savesCardOnFile ? " + Setup Intent" : ""}
                      </span>
                    )}
                  </button>

                  {plan.savesCardOnFile && (
                    <button
                      type="button"
                      disabled={previewSubmitting}
                      onClick={() => handleRunPreviewCheckout("setup")}
                      className="inline-flex h-10 w-full items-center justify-center rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-page)] px-4 text-[13px] text-[var(--text-primary)] hover:bg-[var(--surface-raised)] ui-transition cursor-pointer"
                    >
                      Simulate standalone Setup Intent ($0 today)
                    </button>
                  )}
                </div>

                <p className="text-[12px] leading-4 text-[var(--text-muted)]">
                  Powered by Whop Payments · Apple Pay, Google Pay, cards, ACH, Klarna, Splitit,
                  and Afterpay
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
