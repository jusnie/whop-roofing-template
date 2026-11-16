import { COMPANY_CONFIG, formatUsd, type PlanKey } from "../config/company.config";
import type { LegalTab } from "./LegalModal";

interface FooterProps {
  onOpenCheckout: (planKey: PlanKey) => void;
  onNavigateSection: (sectionId: string) => void;
  onOpenLegal: (tab: LegalTab) => void;
  onToggleInspector: () => void;
  pixelEventCount: number;
}

export function Footer({
  onOpenCheckout,
  onNavigateSection,
  onOpenLegal,
  onToggleInspector,
  pixelEventCount,
}: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[var(--dark-deep)] text-[var(--dark-secondary)] border-t border-[var(--dark-hairline)]">
      <div className="mx-auto max-w-[1360px] px-6 py-16 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-5 space-y-4">
            <div className="inline-flex items-center gap-2">
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                className="text-[var(--dark-primary)] shrink-0"
                aria-hidden="true"
              >
                <path
                  d="M2.5 15.5L12 7L21.5 15.5"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M7 18.5L12 14L17 18.5"
                  stroke="var(--brand-primary)"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-[17px] leading-none font-semibold text-[var(--dark-primary)]">
                {COMPANY_CONFIG.brand.name}
              </span>
            </div>

            <p className="max-w-[380px] text-[14px] leading-[22px] text-[var(--dark-muted)]">
              Serving {COMPANY_CONFIG.serviceArea.regionName} since{" "}
              {COMPANY_CONFIG.brand.foundedYear}. {COMPANY_CONFIG.contact.licenseNumber} ·{" "}
              {COMPANY_CONFIG.contact.insuranceCoverage}.
            </p>
          </div>

          <div className="lg:col-span-3 space-y-3">
            <h3 className="text-[13px] leading-5 font-medium text-[var(--dark-primary)]">
              Online plans
            </h3>
            <ul className="space-y-2 text-[13px] leading-5">
              {COMPANY_CONFIG.plans.map((plan) => (
                <li key={plan.key}>
                  <button
                    type="button"
                    onClick={() => onOpenCheckout(plan.key)}
                    className="text-[var(--dark-muted)] hover:text-[var(--dark-primary)] transition-colors cursor-pointer tabular-nums"
                  >
                    {plan.shortName} · {formatUsd(plan.price)}
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateSection("invoice-flow")}
                  className="text-[var(--dark-muted)] hover:text-[var(--dark-primary)] transition-colors cursor-pointer"
                >
                  Final balance invoice
                </button>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-2 space-y-3">
            <h3 className="text-[13px] leading-5 font-medium text-[var(--dark-primary)]">
              Company
            </h3>
            <ul className="space-y-2 text-[13px] leading-5">
              {[
                { label: "Services", id: "services" },
                { label: "Financing", id: "financing" },
                { label: "Service area", id: "service-area" },
                { label: "Credentials", id: "reviews" },
                { label: "Request estimate", id: "estimate" },
              ].map((link) => (
                <li key={link.id}>
                  <button
                    type="button"
                    onClick={() => onNavigateSection(link.id)}
                    className="text-[var(--dark-muted)] hover:text-[var(--dark-primary)] transition-colors cursor-pointer"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2 space-y-3">
            <h3 className="text-[13px] leading-5 font-medium text-[var(--dark-primary)]">
              Austin yard
            </h3>
            <div className="space-y-2 text-[13px] leading-5 text-[var(--dark-muted)]">
              <p className="font-mono text-[var(--dark-secondary)] tabular-nums">
                {COMPANY_CONFIG.contact.phone}
              </p>
              <p>
                {COMPANY_CONFIG.contact.streetAddress}
                <br />
                {COMPANY_CONFIG.contact.city}, {COMPANY_CONFIG.contact.state}{" "}
                {COMPANY_CONFIG.contact.zip}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-[var(--dark-hairline)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-[12px] leading-4 text-[var(--dark-muted)]">
          <p>
            © {year} {COMPANY_CONFIG.brand.name} · Hosted and billed on Whop
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <button
              type="button"
              onClick={() => onOpenLegal("terms")}
              className="text-[var(--dark-muted)] hover:text-[var(--dark-primary)] transition-colors cursor-pointer"
            >
              Terms
            </button>
            <button
              type="button"
              onClick={() => onOpenLegal("refunds")}
              className="text-[var(--dark-muted)] hover:text-[var(--dark-primary)] transition-colors cursor-pointer"
            >
              Deposit &amp; refund policy
            </button>
            <button
              type="button"
              onClick={() => onOpenLegal("privacy")}
              className="text-[var(--dark-muted)] hover:text-[var(--dark-primary)] transition-colors cursor-pointer"
            >
              Privacy
            </button>
            <button
              type="button"
              onClick={onToggleInspector}
              className="font-mono text-[12px] text-[var(--dark-muted)] hover:text-[var(--dark-primary)] transition-colors cursor-pointer tabular-nums"
            >
              Pixel log ({pixelEventCount})
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
