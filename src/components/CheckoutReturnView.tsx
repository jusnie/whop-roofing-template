import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { COMPANY_CONFIG, formatUsd, getPlanByKey, type PlanKey } from "../config/company.config";
import type { SavedCardSummary } from "../types/whop";

interface CheckoutReturnViewProps {
  onBackToSite: () => void;
  onJumpToInvoice: () => void;
  onSavedCard: (card: SavedCardSummary) => void;
}

interface StatusPayload {
  id: string;
  status: string;
  amount: number | null;
  currency: string;
  memberId: string | null;
  paymentMethodId: string | null;
  savedCard?: SavedCardSummary | null;
}

export function CheckoutReturnView({
  onBackToSite,
  onJumpToInvoice,
  onSavedCard,
}: CheckoutReturnViewProps) {
  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState<StatusPayload | null>(null);
  const [planName, setPlanName] = useState<string>("Roofing booking");
  const [planPrice, setPlanPrice] = useState<number | null>(null);
  const [orderId, setOrderId] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentId =
      params.get("payment_id") || params.get("id") || params.get("receipt_id") || "";
    const setupIntentId = params.get("setup_intent_id") || params.get("setup_intent") || "";
    const queryStatus = params.get("status") || params.get("redirect_status") || "succeeded";
    const planKey = (params.get("plan") || "") as PlanKey;
    const ord = params.get("order_id") || "";
    setOrderId(ord);

    if (planKey === "inspection" || planKey === "deposit" || planKey === "flat_rate") {
      const p = getPlanByKey(planKey);
      setPlanName(p.name);
      setPlanPrice(p.price);
    }

    if (!paymentId && !setupIntentId) {
      setStatusData({
        id: ord || "confirmed",
        status: queryStatus,
        amount: null,
        currency: "USD",
        memberId: null,
        paymentMethodId: null,
      });
      setLoading(false);
      return;
    }

    const qs = new URLSearchParams();
    if (paymentId) qs.set("payment_id", paymentId);
    if (setupIntentId) qs.set("setup_intent_id", setupIntentId);

    fetch(`/api/checkout/status?${qs.toString()}`)
      .then((res) => res.json())
      .then((json: StatusPayload) => {
        setStatusData(json);
        if (json.savedCard) {
          onSavedCard(json.savedCard);
        }
      })
      .catch(() => {
        setStatusData({
          id: paymentId || setupIntentId,
          status: queryStatus,
          amount: null,
          currency: "USD",
          memberId: null,
          paymentMethodId: null,
        });
      })
      .finally(() => setLoading(false));
  }, [onSavedCard]);

  const rawStatus = (statusData?.status || "processing").toLowerCase();
  const isSuccess = rawStatus === "paid" || rawStatus === "succeeded";
  const isFailed = rawStatus === "failed" || rawStatus === "canceled";

  return (
    <main className="min-h-screen bg-[var(--surface-page)] flex items-center justify-center p-6">
      <div className="w-full max-w-[520px] rounded-[16px] border border-[var(--border-hairline)] bg-[var(--surface-card)] p-8 shadow-float space-y-6">
        {loading ? (
          <div className="py-12 text-center space-y-3">
            <Loader2
              size={20}
              strokeWidth={1.5}
              className="mx-auto animate-spin text-[var(--text-muted)]"
            />
            <p className="text-[14px] text-[var(--text-secondary)]">
              Confirming payment with Whop…
            </p>
          </div>
        ) : (
          <>
            <div>
              <p
                className={`font-mono text-[12px] leading-4 ${
                  isSuccess
                    ? "text-[var(--status-positive)]"
                    : isFailed
                      ? "text-[var(--status-negative)]"
                      : "text-[var(--text-muted)]"
                }`}
              >
                {isSuccess ? "Confirmed" : isFailed ? "Incomplete" : "Processing"}
              </p>
              <h1 className="mt-2 font-display text-[36px] leading-[1.08] text-[var(--text-primary)]">
                {isSuccess
                  ? "Payment received"
                  : isFailed
                    ? "Payment not completed"
                    : "Payment processing"}
              </h1>
              <p className="mt-2 text-[14px] leading-5 text-[var(--text-secondary)]">
                {COMPANY_CONFIG.brand.name} · {planName}
              </p>
            </div>

            <div className="border-t border-[var(--border-hairline)]">
              {statusData?.id && (
                <div className="spec-row">
                  <span className="text-[13px] text-[var(--text-muted)]">Reference</span>
                  <span className="font-mono text-[13px] text-[var(--text-primary)]">
                    {statusData.id}
                  </span>
                </div>
              )}
              {orderId && (
                <div className="spec-row">
                  <span className="text-[13px] text-[var(--text-muted)]">Order</span>
                  <span className="font-mono text-[13px] text-[var(--text-primary)]">
                    {orderId}
                  </span>
                </div>
              )}
              {(statusData?.amount || planPrice) && (
                <div className="spec-row">
                  <span className="text-[13px] text-[var(--text-muted)]">Amount</span>
                  <span className="font-mono text-[14px] font-medium text-[var(--text-primary)] tabular-nums">
                    {formatUsd(statusData?.amount ?? planPrice ?? 0)}
                  </span>
                </div>
              )}
              {statusData?.paymentMethodId && (
                <div className="spec-row">
                  <span className="text-[13px] text-[var(--text-muted)]">Saved card</span>
                  <span className="font-mono text-[13px] text-[var(--status-positive)]">
                    {statusData.paymentMethodId}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {statusData?.paymentMethodId && (
                <button
                  type="button"
                  onClick={onJumpToInvoice}
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-[8px] bg-[var(--brand-primary)] px-4 text-[14px] font-medium text-white hover:bg-[var(--brand-primary-hover)] ui-transition cursor-pointer"
                >
                  Open final invoice
                </button>
              )}
              <button
                type="button"
                onClick={onBackToSite}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-page)] px-4 text-[14px] text-[var(--text-primary)] hover:bg-[var(--surface-raised)] ui-transition cursor-pointer"
              >
                Return to site
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
