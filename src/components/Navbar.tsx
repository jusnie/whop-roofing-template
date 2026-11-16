import { useState } from "react";
import { Menu, X } from "lucide-react";
import { COMPANY_CONFIG, formatUsd, getPlanByKey, type PlanKey } from "../config/company.config";

interface NavbarProps {
  onOpenCheckout: (planKey: PlanKey) => void;
  onNavigateSection: (sectionId: string) => void;
  hasSavedCard: boolean;
}

const NAV_LINKS = [
  { label: "Services", id: "services" },
  { label: "Pricing", id: "pricing" },
  { label: "Financing", id: "financing" },
  { label: "Final invoice", id: "invoice-flow" },
  { label: "Service area", id: "service-area" },
  { label: "Reviews", id: "reviews" },
  { label: "Contact", id: "contact" },
];

export function Navbar({ onOpenCheckout, onNavigateSection, hasSavedCard }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const inspectionPlan = getPlanByKey("inspection");

  function handleNav(id: string) {
    setMobileOpen(false);
    onNavigateSection(id);
  }

  return (
    <header className="sticky top-0 z-40 w-full bg-[#f7f4ee]/95 backdrop-blur-sm border-b border-[var(--border-hairline)]">
      <div className="mx-auto flex h-16 max-w-[1360px] items-center justify-between px-6 lg:px-8">
        {/* Flat solid glyph + calm wordmark */}
        <button
          type="button"
          onClick={() => handleNav("top")}
          className="inline-flex items-center gap-2 text-left cursor-pointer"
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            className="text-[var(--text-primary)] shrink-0"
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
          <span className="text-[17px] leading-none font-semibold text-[var(--text-primary)]">
            {COMPANY_CONFIG.brand.shortName}
          </span>
        </button>

        {/* Primary navigation */}
        <nav className="hidden lg:flex items-center gap-6" aria-label="Primary">
          {NAV_LINKS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNav(item.id)}
              className="inline-flex items-center gap-2 text-[14px] leading-5 font-normal text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-150 ease-[var(--ease-out)] cursor-pointer"
            >
              <span>{item.label}</span>
              {item.id === "invoice-flow" && hasSavedCard && (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[var(--status-positive)]"
                  title="Card saved on file"
                />
              )}
            </button>
          ))}
        </nav>

        {/* Quiet text action + single primary button */}
        <div className="hidden sm:flex items-center gap-5">
          <button
            type="button"
            onClick={() => onOpenCheckout("inspection")}
            className="text-[14px] leading-5 font-normal text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-150 ease-[var(--ease-out)] cursor-pointer tabular-nums"
          >
            Inspection · <span className="font-mono">{formatUsd(inspectionPlan.price)}</span>
          </button>
          <button
            type="button"
            onClick={() => handleNav("estimate")}
            className="inline-flex h-9 items-center justify-center rounded-[8px] bg-[var(--text-primary)] px-4 text-[14px] leading-5 font-medium text-[#fdfbf7] hover:bg-[#332d25] active:scale-[0.98] ui-transition cursor-pointer"
          >
            Request estimate
          </button>
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          className="inline-flex sm:hidden h-9 w-9 items-center justify-center rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-card)] text-[var(--text-primary)] transition-colors duration-150 ease-[var(--ease-out)]"
          aria-expanded={mobileOpen}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={18} strokeWidth={1.5} /> : <Menu size={18} strokeWidth={1.5} />}
        </button>
      </div>

      {/* Mobile navigation sheet */}
      {mobileOpen && (
        <div className="sm:hidden border-t border-[var(--border-hairline)] bg-[var(--surface-page)] px-6 py-4 space-y-4">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {NAV_LINKS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className="flex h-9 items-center justify-between rounded-[8px] px-2 text-left text-[15px] font-normal text-[var(--text-primary)] hover:bg-[var(--surface-raised)] transition-colors duration-150"
              >
                <span>{item.label}</span>
                {item.id === "invoice-flow" && hasSavedCard && (
                  <span className="font-mono text-[12px] text-[var(--status-positive)]">
                    Card on file
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="flex flex-col gap-2 pt-3 border-t border-[var(--border-hairline)]">
            <button
              type="button"
              onClick={() => handleNav("estimate")}
              className="inline-flex h-11 w-full items-center justify-center rounded-[8px] bg-[var(--text-primary)] px-4 text-[14px] font-medium text-[#fdfbf7]"
            >
              Request estimate
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onOpenCheckout("inspection");
              }}
              className="inline-flex h-11 w-full items-center justify-center rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-card)] px-4 text-[14px] font-normal text-[var(--text-primary)] tabular-nums"
            >
              Book inspection · {formatUsd(inspectionPlan.price)}
            </button>
            <a
              href={COMPANY_CONFIG.contact.phoneHref}
              className="flex h-9 items-center justify-center font-mono text-[13px] text-[var(--text-secondary)] tabular-nums"
            >
              {COMPANY_CONFIG.contact.phone} · {COMPANY_CONFIG.contact.licenseNumber}
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
