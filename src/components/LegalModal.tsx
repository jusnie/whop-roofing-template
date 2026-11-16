import { useEffect } from "react";
import { X } from "lucide-react";
import { COMPANY_CONFIG, formatUsd, getPlanByKey } from "../config/company.config";

export type LegalTab = "terms" | "privacy" | "refunds";

interface LegalModalProps {
  activeTab: LegalTab;
  onSelectTab: (tab: LegalTab) => void;
  onClose: () => void;
}

const TABS: { id: LegalTab; label: string }[] = [
  { id: "terms", label: "Terms of service" },
  { id: "refunds", label: "Deposit and refund policy" },
  { id: "privacy", label: "Privacy policy" },
];

export function LegalModal({ activeTab, onSelectTab, onClose }: LegalModalProps) {
  const inspectionPlan = getPlanByKey("inspection");
  const depositPlan = getPlanByKey("deposit");
  const flatRatePlan = getPlanByKey("flat_rate");
  const { brand, contact, serviceArea } = COMPANY_CONFIG;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-[720px] max-h-[88vh] flex flex-col rounded-[16px] border border-[var(--border-hairline)] bg-[var(--surface-card)] shadow-float overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-hairline)] px-6 py-5 sm:px-8">
          <div>
            <p className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
              {brand.name} · {contact.licenseNumber}
            </p>
            <h2
              id="legal-modal-title"
              className="mt-2 font-display text-[28px] sm:text-[32px] leading-[1.1] text-[var(--text-primary)]"
            >
              Customer terms and policies
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close policies dialog"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] ui-transition cursor-pointer"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Policy sections"
          className="flex flex-wrap gap-2 border-b border-[var(--border-hairline)] bg-[var(--surface-page)] px-6 py-3 sm:px-8"
        >
          {TABS.map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onSelectTab(tab.id)}
                className={`inline-flex h-9 items-center rounded-[8px] px-3 text-[13px] font-medium ui-transition cursor-pointer ${
                  selected
                    ? "bg-[var(--surface-card)] text-[var(--text-primary)] border border-[var(--border-strong)] shadow-subtle"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8 space-y-6 text-[14px] leading-[22px] text-[var(--text-secondary)]">
          {activeTab === "terms" && (
            <>
              <section className="space-y-2">
                <h3 className="text-[15px] leading-6 font-medium text-[var(--text-primary)]">
                  1. Scope of residential roofing services
                </h3>
                <p>
                  {brand.name} provides roof inspections, preventative maintenance, leak and storm
                  repairs, and full roof replacements across {serviceArea.regionName}. Online
                  bookings cover fixed-scope items ({formatUsd(inspectionPlan.price)} inspection and{" "}
                  {formatUsd(flatRatePlan.price)} maintenance tune-up) and the{" "}
                  {formatUsd(depositPlan.price)} project scheduling deposit. Full replacement and
                  structural repair scopes are governed by the written line-item proposal signed
                  prior to material delivery.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-[15px] leading-6 font-medium text-[var(--text-primary)]">
                  2. Checkout, saved payment methods, and final balance billing
                </h3>
                <p>
                  All online payments, deposits, financing plans, and completion invoices are
                  processed through Whop Payments and are also subject to Whop buyer terms linked at
                  checkout. When you book a {formatUsd(depositPlan.price)} project deposit or place
                  a payment method on file, you authorize {brand.name} to store that payment method
                  via Whop for final contract balance billing after installation and final
                  walkthrough sign-off, less any credited deposit and inspection fee. Hidden
                  decking, fascia, or code upgrades discovered during tear-off require written
                  change-order approval before being added to a final invoice.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-[15px] leading-6 font-medium text-[var(--text-primary)]">
                  3. Site access, weather delays, and workmanship warranty
                </h3>
                <p>
                  Homeowners agree to provide clear driveway access for crew vehicles and material
                  drop-off on scheduled work dates. Exterior roofing schedules remain subject to
                  safe wind and precipitation conditions. Completed full roof replacements include a
                  written 10-year workmanship warranty alongside applicable manufacturer shingle or
                  metal panel warranties, backed by {contact.insuranceCoverage}.
                </p>
              </section>
            </>
          )}

          {activeTab === "refunds" && (
            <>
              <section className="space-y-2">
                <h3 className="text-[15px] leading-6 font-medium text-[var(--text-primary)]">
                  1. Project deposit ({formatUsd(depositPlan.price)})
                </h3>
                <p>
                  Your {formatUsd(depositPlan.price)} project deposit is applied in full toward your
                  final contract invoice. Deposits are refundable in full if canceled in writing at
                  least 3 business days before scheduled material ordering or municipal permit
                  submission. After special-order materials are placed or permits are filed, actual
                  documented permit or supplier restocking costs may be deducted.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-[15px] leading-6 font-medium text-[var(--text-primary)]">
                  2. Drone roof inspection ({formatUsd(inspectionPlan.price)}) and tune-up (
                  {formatUsd(flatRatePlan.price)})
                </h3>
                <p>
                  Fixed-fee inspections and maintenance visits may be rescheduled or canceled for a
                  full refund up to 24 hours before the scheduled arrival window. Once an inspection
                  report is delivered, the {formatUsd(inspectionPlan.price)} fee is non-refundable
                  as a standalone service and remains 100% creditable toward any repair or full roof
                  replacement contracted with {brand.name} within 90 calendar days.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-[15px] leading-6 font-medium text-[var(--text-primary)]">
                  3. Final invoice adjustments and punch-list resolution
                </h3>
                <p>
                  Before any saved payment method is charged for a final contract balance, our
                  project lead completes a magnetic nail sweep and walkthrough review. If you have a
                  billing question or workmanship punch-list item, contact {contact.email} or{" "}
                  {contact.phone} within 7 days of invoice issuance so our office can inspect and
                  resolve it promptly.
                </p>
              </section>
            </>
          )}

          {activeTab === "privacy" && (
            <>
              <section className="space-y-2">
                <h3 className="text-[15px] leading-6 font-medium text-[var(--text-primary)]">
                  1. Information we collect
                </h3>
                <p>
                  When you request an estimate, check service-area coverage, or book a service, we
                  collect your name, email address, phone number, property address, roof details,
                  and project notes so our estimators and crews can prepare quotes, schedule work,
                  and issue warranties.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-[15px] leading-6 font-medium text-[var(--text-primary)]">
                  2. Payment isolation and analytics
                </h3>
                <p>
                  Card numbers, bank credentials, and financing applications are entered directly
                  inside Whop payment frames and never pass through or sit on {brand.name} servers.
                  This website uses Whop analytics events (such as service views, deposit starts,
                  and estimate requests) to measure booking performance and coordinate customer
                  follow-up. We do not sell homeowner contact records to third-party lead brokers.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-[15px] leading-6 font-medium text-[var(--text-primary)]">
                  3. Contact and record requests
                </h3>
                <p>
                  To update your contact information, revoke a stored payment method prior to final
                  billing, or request deletion of an estimate record, email {contact.email}, call{" "}
                  {contact.phone}, or write to {brand.name}, {contact.streetAddress}, {contact.city}
                  , {contact.state} {contact.zip}.
                </p>
              </section>
            </>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-[var(--border-hairline)] bg-[var(--surface-page)] px-6 py-4 sm:px-8 text-[12px] leading-4 text-[var(--text-muted)]">
          <span>
            Questions before booking: {contact.phone} · {contact.email}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="self-start sm:self-auto inline-flex h-9 items-center rounded-[8px] border border-[var(--border-hairline)] bg-[var(--surface-card)] px-4 text-[13px] font-medium text-[var(--text-primary)] hover:border-[var(--border-strong)] ui-transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
