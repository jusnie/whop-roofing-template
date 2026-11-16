/**
 * Deposit -> Job -> Final Balance Invoice Workbench (`InvoiceWorkflowSection.tsx`)
 * ================================================================================
 * Demonstrates high-ticket residential roofing billing end-to-end on Whop:
 *   01. Collect $500 project deposit + vault card on file via Whop Setup Intent (`payt_...`)
 *   02. Complete roof installation and final magnetic nail-sweep walkthrough
 *   03. Issue final net balance invoice via Whop Invoices API (`POST /api/invoices`):
 *       - `charge_automatically`: Charges the vaulted `payt_...` payment method
 *       - `send_invoice`: Emails a hosted Whop invoice link supporting card, ACH,
 *         Apple Pay, Google Pay, and BNPL financing
 */

import { useEffect, useState } from "react";
import { ArrowUpRight, Copy, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { COMPANY_CONFIG, formatUsd, getPlanByKey, type PlanKey } from "../config/company.config";
import { trackWhopEvent } from "../lib/whop-pixel";
import type {
  FinalInvoiceRecord,
  InvoiceCollectionMethod,
  InvoiceLineItemPayload,
  RuntimeConfigResponse,
  SavedCardSummary,
} from "../types/whop";

interface InvoiceWorkflowSectionProps {
  runtime: RuntimeConfigResponse;
  savedCard: SavedCardSummary | null;
  latestMemberId: string | null;
  onOpenCheckout: (planKey: PlanKey) => void;
  onInvoiceCreated: (invoice: FinalInvoiceRecord) => void;
}

export function InvoiceWorkflowSection({
  runtime,
  savedCard,
  latestMemberId,
  onOpenCheckout,
  onInvoiceCreated,
}: InvoiceWorkflowSectionProps) {
  const sample = COMPANY_CONFIG.sampleCompletedJob;
  const depositPlan = getPlanByKey("deposit");

  const [collectionMethod, setCollectionMethod] =
    useState<InvoiceCollectionMethod>("send_invoice");
  const [jobNumber, setJobNumber] = useState<string>(sample.jobNumber);
  const [projectTitle, setProjectTitle] = useState<string>(sample.projectTitle);
  const [customerName, setCustomerName] = useState<string>(sample.customerName);
  const [customerEmail, setCustomerEmail] = useState<string>(sample.customerEmail);
  const [propertyLine1, setPropertyLine1] = useState<string>(sample.propertyAddress);
  const [memberId, setMemberId] = useState<string>("");
  const [paymentMethodId, setPaymentMethodId] = useState<string>("");
  const [depositCredit, setDepositCredit] = useState<number>(sample.depositPaid);
  const [inspectionCredit, setInspectionCredit] = useState<number>(sample.inspectionCredit);
  const [dueInDays, setDueInDays] = useState<number>(7);
  const [memo, setMemo] = useState<string>(sample.defaultMemo);
  const [adminKey, setAdminKey] = useState<string>("");
  const [lineItems, setLineItems] = useState<InvoiceLineItemPayload[]>(() =>
    sample.lineItems.map((i) => ({ ...i })),
  );

  const [submitting, setSubmitting] = useState(false);
  const [lookingUpCards, setLookingUpCards] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<FinalInvoiceRecord[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (savedCard) {
      setPaymentMethodId(savedCard.paymentMethodId);
      setMemberId(savedCard.memberId);
      if (savedCard.customerEmail) setCustomerEmail(savedCard.customerEmail);
      if (savedCard.customerName) setCustomerName(savedCard.customerName);
      setCollectionMethod("charge_automatically");
    } else if (latestMemberId && !memberId) {
      setMemberId(latestMemberId);
    }
  }, [savedCard, latestMemberId, memberId]);

  const grossSubtotal = lineItems.reduce(
    (sum, item) => sum + Math.max(0, item.quantity) * Math.max(0, item.unitPrice),
    0,
  );
  const finalBalance = Math.max(0, grossSubtotal - depositCredit - inspectionCredit);

  function updateLineItem(
    id: string,
    field: keyof InvoiceLineItemPayload,
    value: string | number,
  ) {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  }

  function addLineItem() {
    setLineItems((prev) => [
      ...prev,
      {
        id: `li-${Date.now()}`,
        label: "Chimney counter-flashing and cricket",
        description: "24-gauge dark bronze metal",
        quantity: 1,
        unitPrice: 420,
      },
    ]);
  }

  function removeLineItem(id: string) {
    setLineItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));
  }

  async function handleLookupSavedCards() {
    setError(null);
    if (!memberId.trim() && runtime.isLiveConfigured) {
      setError("Enter a customer member ID (mber_...) or complete a $500 deposit first");
      return;
    }

    setLookingUpCards(true);
    try {
      const qs = memberId.trim() ? `?member_id=${encodeURIComponent(memberId.trim())}` : "";
      const headers: Record<string, string> = {};
      if (adminKey.trim()) headers["x-whop-admin-key"] = adminKey.trim();
      const res = await fetch(`/api/payment-methods${qs}`, { headers });
      const json = (await res.json()) as { data?: SavedCardSummary[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Unable to list saved payment methods");

      const first = json.data?.[0];
      if (!first) {
        setError("No saved card found for that member yet — run a $500 deposit checkout first");
        return;
      }
      setPaymentMethodId(first.paymentMethodId);
      setMemberId(first.memberId);
      setCollectionMethod("charge_automatically");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch saved payment methods");
    } finally {
      setLookingUpCards(false);
    }
  }

  async function handleIssueFinalInvoice(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (adminKey.trim()) headers["x-whop-admin-key"] = adminKey.trim();
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers,
        body: JSON.stringify({
          collectionMethod,
          jobNumber,
          projectTitle,
          customerName,
          customerEmail,
          memberId: memberId.trim() || undefined,
          paymentMethodId:
            collectionMethod === "charge_automatically"
              ? paymentMethodId.trim() || undefined
              : undefined,
          billingAddress: {
            line1: propertyLine1.split(",")[0]?.trim() || propertyLine1,
            city: COMPANY_CONFIG.contact.city,
            state: COMPANY_CONFIG.contact.state,
            postalCode: COMPANY_CONFIG.contact.zip,
            country: "US",
          },
          lineItems,
          depositCredit,
          inspectionCredit,
          dueInDays,
          memo,
        }),
      });

      const data = (await response.json()) as FinalInvoiceRecord & { error?: string };
      if (!response.ok || data.error) {
        throw new Error(data.error ?? "Could not issue final invoice");
      }

      setInvoices((prev) => [data, ...prev]);
      onInvoiceCreated(data);

      trackWhopEvent("final_invoice_created", {
        invoice_id: data.id,
        collection_method: data.collectionMethod,
        job_number: data.jobNumber,
        value: data.finalBalance,
        currency: "USD",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invoice creation failed");
    } finally {
      setSubmitting(false);
    }
  }

  function copyLink(link: string, id: string) {
    navigator.clipboard?.writeText(link).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1800);
  }

  const rawBrand = savedCard?.brand || "Visa";
  const cardBrand = rawBrand.charAt(0).toUpperCase() + rawBrand.slice(1).toLowerCase();
  const cardLast4 = savedCard?.last4 || "4242";
  const cardHolder = savedCard?.customerName || customerName || "Marcus Delgado";
  const cardExpiry =
    savedCard?.expMonth && savedCard?.expYear
      ? `${String(savedCard.expMonth).padStart(2, "0")}/${String(savedCard.expYear).slice(-2)}`
      : "12/30";

  return (
    <section
      id="invoice-flow"
      className="py-20 lg:py-28 bg-[var(--surface-page)] border-b border-[var(--border-hairline)]"
    >
      <div className="mx-auto max-w-[1360px] px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="max-w-[640px]">
            <p className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
              04 · Deposit to final invoice workflow
            </p>
            <h2 className="mt-3 font-display text-[36px] sm:text-[44px] leading-[1.08] text-[var(--text-primary)]">
              Vault a card at deposit, bill the contract balance on completion
            </h2>
          </div>
          <p className="max-w-[400px] text-[14px] leading-5 text-[var(--text-secondary)]">
            Connected to the Whop Setup Intents and Invoices APIs so crews close out jobs by
            charging the card on file or sending an itemized payment link
          </p>
        </div>

        {/* Three-step contract flow */}
        <ol className="mt-10 grid grid-cols-1 md:grid-cols-3 border-y border-[var(--border-hairline)] divide-y md:divide-y-0 md:divide-x divide-[var(--border-hairline)]">
          <li className="py-5 md:pr-6">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
                Step 01
              </span>
              {savedCard ? (
                <span className="inline-flex items-center gap-2 font-mono text-[12px] text-[var(--status-positive)] tabular-nums">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-positive)]" />
                  Saved ·••• {savedCard.last4}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenCheckout("deposit")}
                  className="text-[12px] font-medium text-[var(--brand-primary)] hover:underline cursor-pointer tabular-nums"
                >
                  Run {formatUsd(depositPlan.price)} deposit →
                </button>
              )}
            </div>
            <p className="mt-2 text-[15px] leading-5 font-medium text-[var(--text-primary)]">
              Deposit and Setup Intent
            </p>
            <p className="mt-1 text-[13px] leading-5 text-[var(--text-secondary)]">
              Collects {formatUsd(depositPlan.price)} and stores a reusable payment method (payt_)
              for off-session completion billing
            </p>
          </li>

          <li className="py-5 md:px-6">
            <span className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
              Step 02
            </span>
            <p className="mt-2 text-[15px] leading-5 font-medium text-[var(--text-primary)]">
              Installation and walkthrough
            </p>
            <p className="mt-1 text-[13px] leading-5 text-[var(--text-secondary)]">
              Tear-off, decking check, underlayment, shingle or metal install, and signed
              two-pass magnet sweep
            </p>
          </li>

          <li className="py-5 md:pl-6">
            <span className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
              Step 03
            </span>
            <p className="mt-2 text-[15px] leading-5 font-medium text-[var(--text-primary)]">
              Final balance via Whop Invoices
            </p>
            <p className="mt-1 text-[13px] leading-5 text-[var(--text-secondary)]">
              Deducts paid credits and charges the stored card or emails a hosted checkout link
            </p>
          </li>
        </ol>

        {/* Contractor job-sheet workbench + coded vaulted payment card moment */}
        <form
          onSubmit={handleIssueFinalInvoice}
          className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-12 items-start"
        >
          {/* Left: Job scope and collection inputs */}
          <div className="lg:col-span-7 rounded-[16px] border border-[var(--border-hairline)] bg-[var(--surface-card)] p-6 lg:p-8 shadow-subtle space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[var(--border-hairline)]">
              <div>
                <h3 className="text-[18px] leading-6 font-medium text-[var(--text-primary)]">
                  Job closeout invoice
                </h3>
                <p className="mt-1 text-[13px] leading-5 text-[var(--text-muted)]">
                  Contractor billing console · Whop Invoices
                </p>
              </div>

              {/* Segmented collection mode (nested radius: 10px track -> 6px active button) */}
              <div className="inline-flex rounded-[10px] border border-[var(--border-hairline)] bg-[var(--surface-raised)] p-1">
                <button
                  type="button"
                  onClick={() => setCollectionMethod("charge_automatically")}
                  className={`h-8 rounded-[6px] px-3 text-[13px] leading-5 ui-transition cursor-pointer ${
                    collectionMethod === "charge_automatically"
                      ? "bg-[var(--surface-card)] font-medium text-[var(--text-primary)] shadow-subtle"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  Auto-charge card
                </button>
                <button
                  type="button"
                  onClick={() => setCollectionMethod("send_invoice")}
                  className={`h-8 rounded-[6px] px-3 text-[13px] leading-5 ui-transition cursor-pointer ${
                    collectionMethod === "send_invoice"
                      ? "bg-[var(--surface-card)] font-medium text-[var(--text-primary)] shadow-subtle"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  Send invoice link
                </button>
              </div>
            </div>

            {/* Customer & job inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] leading-4 text-[var(--text-muted)] mb-2">
                  Job number
                </label>
                <input
                  type="text"
                  value={jobNumber}
                  onChange={(e) => setJobNumber(e.target.value)}
                  className="h-10 w-full rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-page)] px-3 font-mono text-[13px] text-[var(--text-primary)] focus:border-[var(--text-primary)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[12px] leading-4 text-[var(--text-muted)] mb-2">
                  Project scope
                </label>
                <input
                  type="text"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  className="h-10 w-full rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-page)] px-3 text-[14px] text-[var(--text-primary)] focus:border-[var(--text-primary)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[12px] leading-4 text-[var(--text-muted)] mb-2">
                  Homeowner
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="h-10 w-full rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-page)] px-3 text-[14px] text-[var(--text-primary)] focus:border-[var(--text-primary)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[12px] leading-4 text-[var(--text-muted)] mb-2">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="h-10 w-full rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-page)] px-3 text-[14px] text-[var(--text-primary)] focus:border-[var(--text-primary)] focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[12px] leading-4 text-[var(--text-muted)] mb-2">
                  Property address
                </label>
                <input
                  type="text"
                  value={propertyLine1}
                  onChange={(e) => setPropertyLine1(e.target.value)}
                  className="h-10 w-full rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-page)] px-3 text-[14px] text-[var(--text-primary)] focus:border-[var(--text-primary)] focus:outline-none"
                />
              </div>
            </div>

            {/* Collection-specific parameters */}
            {collectionMethod === "charge_automatically" ? (
              <div className="rounded-[12px] border border-[var(--border-hairline)] bg-[var(--surface-page)] p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-[var(--text-primary)]">
                    Saved Whop payment method
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleLookupSavedCards}
                      disabled={lookingUpCards}
                      className="inline-flex items-center gap-2 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      <RefreshCw
                        size={14}
                        strokeWidth={1.5}
                        className={lookingUpCards ? "animate-spin" : ""}
                      />
                      <span>Load saved card</span>
                    </button>
                    {!savedCard && (
                      <button
                        type="button"
                        onClick={() => onOpenCheckout("deposit")}
                        className="text-[12px] font-medium text-[var(--brand-primary)] hover:underline cursor-pointer"
                      >
                        Pay $500 deposit first
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] leading-4 text-[var(--text-muted)] mb-2">
                      Member ID
                    </label>
                    <input
                      type="text"
                      value={memberId}
                      onChange={(e) => setMemberId(e.target.value)}
                      placeholder="mber_..."
                      className="h-10 w-full rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-card)] px-3 font-mono text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--text-primary)] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] leading-4 text-[var(--text-muted)] mb-2">
                      Payment method ID
                    </label>
                    <input
                      type="text"
                      value={paymentMethodId}
                      onChange={(e) => setPaymentMethodId(e.target.value)}
                      placeholder="payt_..."
                      className="h-10 w-full rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-card)] px-3 font-mono text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--text-primary)] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-[12px] border border-[var(--border-hairline)] bg-[var(--surface-page)] p-4">
                <p className="text-[13px] leading-5 text-[var(--text-secondary)]">
                  Emails an itemized Whop invoice with a hosted payment link (card, ACH, Apple Pay,
                  or monthly financing)
                </p>
                <select
                  aria-label="Payment terms"
                  value={dueInDays}
                  onChange={(e) => setDueInDays(Number(e.target.value))}
                  className="h-9 shrink-0 rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-card)] px-3 text-[13px] text-[var(--text-primary)]"
                >
                  <option value={1}>Due on receipt</option>
                  <option value={7}>Net 7 days</option>
                  <option value={14}>Net 14 days</option>
                  <option value={30}>Net 30 days</option>
                </select>
              </div>
            )}

            {/* Contract line items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-[var(--text-primary)]">
                  Completed scope items
                </span>
                <button
                  type="button"
                  onClick={addLineItem}
                  className="inline-flex items-center gap-2 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <Plus size={16} strokeWidth={1.5} />
                  <span>Add item</span>
                </button>
              </div>

              <div className="space-y-2">
                {lineItems.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-12 gap-2 items-center rounded-[8px] border border-[var(--border-hairline)] bg-[var(--surface-page)] p-2"
                  >
                    <input
                      type="text"
                      aria-label="Line item description"
                      value={item.label}
                      onChange={(e) => updateLineItem(item.id, "label", e.target.value)}
                      className="col-span-12 sm:col-span-6 h-9 rounded-[6px] border border-[var(--border-control)] bg-[var(--surface-card)] px-3 text-[13px] text-[var(--text-primary)]"
                    />
                    <input
                      type="number"
                      min={1}
                      aria-label="Quantity"
                      value={item.quantity}
                      onChange={(e) =>
                        updateLineItem(item.id, "quantity", Math.max(1, Number(e.target.value)))
                      }
                      className="col-span-3 sm:col-span-2 h-9 rounded-[6px] border border-[var(--border-control)] bg-[var(--surface-card)] px-2 text-right font-mono text-[13px] text-[var(--text-primary)] tabular-nums"
                    />
                    <input
                      type="number"
                      min={0}
                      step="1"
                      aria-label="Unit price"
                      value={item.unitPrice}
                      onChange={(e) =>
                        updateLineItem(item.id, "unitPrice", Math.max(0, Number(e.target.value)))
                      }
                      className="col-span-4 sm:col-span-2 h-9 rounded-[6px] border border-[var(--border-control)] bg-[var(--surface-card)] px-2 text-right font-mono text-[13px] text-[var(--text-primary)] tabular-nums"
                    />
                    <div className="col-span-5 sm:col-span-2 flex items-center justify-end gap-1">
                      <span className="font-mono text-[13px] text-[var(--text-primary)] tabular-nums">
                        {formatUsd(item.quantity * item.unitPrice)}
                      </span>
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLineItem(item.id)}
                          className="p-1 text-[var(--text-muted)] hover:text-[var(--status-negative)] cursor-pointer"
                          aria-label="Remove item"
                        >
                          <Trash2 size={15} strokeWidth={1.5} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Credits & memo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] leading-4 text-[var(--text-muted)] mb-2">
                  Project deposit credit (USD)
                </label>
                <input
                  type="number"
                  min={0}
                  value={depositCredit}
                  onChange={(e) => setDepositCredit(Math.max(0, Number(e.target.value)))}
                  className="h-10 w-full rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-page)] px-3 font-mono text-[13px] text-[var(--text-primary)] tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[12px] leading-4 text-[var(--text-muted)] mb-2">
                  Inspection credit (USD)
                </label>
                <input
                  type="number"
                  min={0}
                  value={inspectionCredit}
                  onChange={(e) => setInspectionCredit(Math.max(0, Number(e.target.value)))}
                  className="h-10 w-full rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-page)] px-3 font-mono text-[13px] text-[var(--text-primary)] tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="block text-[12px] leading-4 text-[var(--text-muted)] mb-2">
                Completion note on invoice
              </label>
              <textarea
                rows={2}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="w-full rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-page)] p-3 text-[13px] leading-5 text-[var(--text-primary)]"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-[8px] border border-[var(--status-negative)]/25 bg-[var(--status-negative)]/5 px-4 py-3 text-[13px] leading-5 text-[var(--status-negative)]"
              >
                {error}
              </p>
            )}
          </div>

          {/* Right: Physical vaulted card moment + ruled contract statement */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-[16px] border border-[var(--border-hairline)] bg-[var(--surface-card)] p-6 lg:p-8 shadow-subtle">
              {/* Physical payment card rendered with real material proportions */}
              <div
                className="rounded-[12px] border border-[var(--dark-hairline)] p-5 text-[var(--dark-primary)] btn-dark-surface"
                style={{
                  background: "linear-gradient(180deg, #24221f 0%, #161513 100%)",
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 font-mono text-[12px] leading-4 text-[var(--dark-secondary)]">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        savedCard || paymentMethodId
                          ? "bg-[var(--status-positive-dark)]"
                          : "bg-[var(--dark-muted)]"
                      }`}
                    />
                    {savedCard || paymentMethodId ? "Card vaulted on Whop" : "Awaiting deposit setup"}
                  </span>
                  <span className="font-mono text-[12px] leading-4 text-[var(--dark-muted)]">
                    {cardBrand}
                  </span>
                </div>

                {/* Metallic contact chip */}
                <div className="mt-6 flex items-center justify-between">
                  <svg
                    width="34"
                    height="26"
                    viewBox="0 0 34 26"
                    fill="none"
                    aria-hidden="true"
                  >
                    <rect
                      x="0.5"
                      y="0.5"
                      width="33"
                      height="25"
                      rx="4.5"
                      fill="#C6B497"
                      fillOpacity="0.22"
                      stroke="#C6B497"
                      strokeOpacity="0.45"
                    />
                    <path
                      d="M11 1V25M23 1V25M1 9H11M23 9H33M1 17H11M23 17H33"
                      stroke="#C6B497"
                      strokeOpacity="0.35"
                    />
                  </svg>
                  <span className="font-mono text-[15px] tracking-[0.08em] text-[var(--dark-primary)] tabular-nums">
                    •••• •••• •••• {cardLast4}
                  </span>
                </div>

                <div className="mt-6 flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] leading-4 text-[var(--dark-muted)]">Homeowner</p>
                    <p className="truncate text-[13px] leading-5 font-medium text-[var(--dark-primary)]">
                      {cardHolder}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] leading-4 text-[var(--dark-muted)]">Exp</p>
                    <p className="font-mono text-[13px] leading-5 text-[var(--dark-secondary)] tabular-nums">
                      {cardExpiry}
                    </p>
                  </div>
                </div>
              </div>

              {/* Ruled contractor settlement ledger */}
              <div className="mt-6">
                <div className="spec-row">
                  <span className="text-[13px] text-[var(--text-muted)]">Job reference</span>
                  <span className="font-mono text-[13px] text-[var(--text-primary)] tabular-nums">
                    {jobNumber}
                  </span>
                </div>
                <div className="spec-row">
                  <span className="text-[13px] text-[var(--text-muted)]">Completed work</span>
                  <span className="font-mono text-[14px] text-[var(--text-primary)] tabular-nums">
                    {formatUsd(grossSubtotal)}
                  </span>
                </div>
                {depositCredit > 0 && (
                  <div className="spec-row">
                    <span className="text-[13px] text-[var(--text-muted)]">Less deposit paid</span>
                    <span className="font-mono text-[14px] text-[var(--text-secondary)] tabular-nums">
                      −{formatUsd(depositCredit)}
                    </span>
                  </div>
                )}
                {inspectionCredit > 0 && (
                  <div className="spec-row">
                    <span className="text-[13px] text-[var(--text-muted)]">
                      Less inspection credit
                    </span>
                    <span className="font-mono text-[14px] text-[var(--text-secondary)] tabular-nums">
                      −{formatUsd(inspectionCredit)}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-[var(--text-primary)]/15 flex items-baseline justify-between gap-4">
                <span className="text-[14px] font-medium text-[var(--text-primary)]">
                  Final balance due
                </span>
                <span className="font-mono text-[32px] leading-none font-medium text-[var(--text-primary)] tabular-nums">
                  {formatUsd(finalBalance)}
                </span>
              </div>

              {runtime.invoiceAuthRequired && (
                <label className="mt-5 block">
                  <span className="block text-[12px] leading-4 text-[var(--text-muted)] mb-2">
                    Office billing key
                  </span>
                  <input
                    type="password"
                    autoComplete="off"
                    value={adminKey}
                    onChange={(e) => setAdminKey(e.target.value)}
                    placeholder="Enter office key to issue invoice"
                    className="h-10 w-full rounded-[8px] border border-[var(--border-hairline)] bg-[var(--surface-page)] px-3 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-strong)] focus:outline-none ui-transition"
                  />
                </label>
              )}

              <button
                type="submit"
                disabled={
                  submitting ||
                  finalBalance <= 0 ||
                  (runtime.invoiceAuthRequired && !adminKey.trim()) ||
                  (collectionMethod === "charge_automatically" &&
                    runtime.isLiveConfigured &&
                    !paymentMethodId.trim())
                }
                className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-[var(--brand-primary)] px-5 text-[14px] font-medium text-white hover:bg-[var(--brand-primary-hover)] active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed ui-transition cursor-pointer tabular-nums"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
                    <span>Issuing invoice…</span>
                  </>
                ) : collectionMethod === "charge_automatically" ? (
                  <span>Charge saved card · {formatUsd(finalBalance)}</span>
                ) : (
                  <span>Send Whop invoice · {formatUsd(finalBalance)}</span>
                )}
              </button>
            </div>

            {/* Issued invoice ledger */}
            {invoices.length > 0 && (
              <div className="rounded-[16px] border border-[var(--border-hairline)] bg-[var(--surface-card)] p-6 space-y-4">
                <div className="flex items-baseline justify-between">
                  <h4 className="text-[14px] font-medium text-[var(--text-primary)]">
                    Issued invoices
                  </h4>
                  <span className="font-mono text-[12px] text-[var(--text-muted)] tabular-nums">
                    {invoices.length}
                  </span>
                </div>

                <div className="divide-y divide-[var(--border-hairline)]">
                  {invoices.map((inv) => (
                    <div key={inv.id} className="py-4 first:pt-0 last:pb-0 space-y-2">
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="font-mono text-[13px] font-medium text-[var(--text-primary)] tabular-nums">
                          {inv.invoiceNumber} · {inv.jobNumber}
                        </span>
                        <span className="font-mono text-[15px] font-medium text-[var(--text-primary)] tabular-nums">
                          {formatUsd(inv.finalBalance)}
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between gap-4 text-[12px] leading-4 text-[var(--text-muted)]">
                        <span className="font-mono truncate">{inv.id}</span>
                        <span
                          className={
                            inv.status === "paid"
                              ? "font-mono text-[var(--status-positive)]"
                              : "font-mono text-[var(--text-secondary)]"
                          }
                        >
                          {inv.status} ·{" "}
                          {inv.collectionMethod === "charge_automatically"
                            ? "auto-charged"
                            : "sent"}
                        </span>
                      </div>

                      {inv.checkoutLink && (
                        <div className="flex items-center gap-4 pt-1 text-[12px]">
                          <a
                            href={inv.checkoutLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[var(--brand-primary)] hover:underline"
                          >
                            <span>Invoice link</span>
                            <ArrowUpRight size={14} strokeWidth={1.5} />
                          </a>
                          <button
                            type="button"
                            onClick={() => copyLink(inv.checkoutLink!, inv.id)}
                            className="inline-flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                          >
                            <Copy size={13} strokeWidth={1.5} />
                            <span>{copiedId === inv.id ? "Copied" : "Copy URL"}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}
