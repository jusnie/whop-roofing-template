import { useState } from "react";
import { COMPANY_CONFIG, formatUsd, getPlanByKey, type PlanKey } from "../config/company.config";
import type { AppRoute } from "../lib/routes";

interface NavbarProps {
  currentRoute: AppRoute;
  onOpenCheckout: (planKey: PlanKey) => void;
  onNavigateRoute: (route: AppRoute) => void;
  hasSavedCard: boolean;
}

const NAV_LINKS: Array<{ label: string; route: AppRoute }> = [
  { label: "Services", route: "/services" },
  { label: "Pricing", route: "/pricing" },
  { label: "Financing", route: "/financing" },
  { label: "Final invoice", route: "/invoice" },
  { label: "Service area", route: "/service-area" },
  { label: "Reviews", route: "/reviews" },
  { label: "Contact", route: "/estimate" },
];

export function Navbar({
  currentRoute,
  onOpenCheckout,
  onNavigateRoute,
  hasSavedCard,
}: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const inspectionPlan = getPlanByKey("inspection");

  function handleNav(e: React.MouseEvent, route: AppRoute) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    setMobileOpen(false);
    onNavigateRoute(route);
  }

  return (
    <header className="sticky top-0 z-40 w-full bg-[#f7f4ee]/95 backdrop-blur-sm border-b border-[var(--border-hairline)]">
      <div className="mx-auto flex h-16 max-w-[1360px] items-center justify-between px-6 lg:px-8">
        {/* Flat solid glyph + calm wordmark */}
        <a
          href="/"
          onClick={(e) => handleNav(e, "/")}
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
        </a>

        {/* Primary navigation */}
        <nav className="hidden lg:flex items-center gap-5 xl:gap-6" aria-label="Primary">
          {NAV_LINKS.map((item) => {
            const isActive = currentRoute === item.route;
            return (
              <a
                key={item.route}
                href={item.route}
                aria-current={isActive ? "page" : undefined}
                onClick={(e) => handleNav(e, item.route)}
                className={`inline-flex items-center gap-2 whitespace-nowrap text-[14px] leading-5 transition-colors duration-150 ease-[var(--ease-out)] cursor-pointer ${
                  isActive
                    ? "font-medium text-[var(--brand-primary)]"
                    : "font-normal text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span>{item.label}</span>
                {item.route === "/invoice" && hasSavedCard && (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-[var(--status-positive)]"
                    title="Card saved on file"
                  />
                )}
              </a>
            );
          })}
        </nav>

        {/* Quiet text action + primary button + responsive menu toggle */}
        <div className="flex items-center gap-3 sm:gap-5">
          <button
            type="button"
            onClick={() => onOpenCheckout("inspection")}
            className="hidden sm:inline-flex items-center whitespace-nowrap text-[14px] leading-5 font-normal text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-150 ease-[var(--ease-out)] cursor-pointer tabular-nums"
          >
            Inspection ·&nbsp;<span className="font-mono">{formatUsd(inspectionPlan.price)}</span>
          </button>
          <a
            href="/estimate"
            onClick={(e) => handleNav(e, "/estimate")}
            className="hidden sm:inline-flex h-9 items-center justify-center whitespace-nowrap rounded-[8px] bg-[var(--text-primary)] px-4 text-[14px] leading-5 font-medium text-[#fdfbf7] hover:bg-[#332d25] active:scale-[0.98] ui-transition cursor-pointer"
          >
            Request estimate
          </a>

          {/* Mobile & tablet icon-only animated menu button */}
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex lg:hidden h-9 w-9 items-center justify-center rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:bg-[var(--surface-raised)] active:scale-[0.94] ui-transition cursor-pointer"
            aria-expanded={mobileOpen}
            aria-label="Toggle menu"
          >
            <span className="relative h-4 w-4" aria-hidden="true">
              <span
                className={`absolute left-0 block h-[1.5px] w-4 rounded-full bg-current transition-all duration-200 ease-[var(--ease-out)] ${
                  mobileOpen ? "top-[7px] rotate-45" : "top-[2px] rotate-0"
                }`}
              />
              <span
                className={`absolute left-0 top-[7px] block h-[1.5px] w-4 rounded-full bg-current transition-all duration-150 ease-[var(--ease-out)] ${
                  mobileOpen ? "opacity-0 scale-x-0" : "opacity-100 scale-x-100"
                }`}
              />
              <span
                className={`absolute left-0 block h-[1.5px] w-4 rounded-full bg-current transition-all duration-200 ease-[var(--ease-out)] ${
                  mobileOpen ? "top-[7px] -rotate-45" : "top-[12px] rotate-0"
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      {/* Animated mobile & tablet navigation sheet */}
      <div
        aria-hidden={!mobileOpen}
        className={`lg:hidden grid transition-[grid-template-rows,opacity] duration-200 ease-[var(--ease-out)] ${
          mobileOpen
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0 pointer-events-none"
        }`}
      >
        <div className="overflow-hidden">
          <div
            className={`border-t border-[var(--border-hairline)] bg-[var(--surface-page)] px-6 py-4 space-y-4 transition-transform duration-200 ease-[var(--ease-out)] ${
              mobileOpen ? "translate-y-0" : "-translate-y-2"
            }`}
          >
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              <a
                href="/"
                tabIndex={mobileOpen ? 0 : -1}
                aria-current={currentRoute === "/" ? "page" : undefined}
                onClick={(e) => handleNav(e, "/")}
                className={`flex h-9 items-center justify-between rounded-[8px] px-2 text-left text-[15px] transition-colors duration-150 ${
                  currentRoute === "/"
                    ? "bg-[var(--surface-raised)] font-medium text-[var(--brand-primary)]"
                    : "font-normal text-[var(--text-primary)] hover:bg-[var(--surface-raised)]"
                }`}
              >
                <span>Home</span>
              </a>
              {NAV_LINKS.map((item) => {
                const isActive = currentRoute === item.route;
                return (
                  <a
                    key={item.route}
                    href={item.route}
                    tabIndex={mobileOpen ? 0 : -1}
                    aria-current={isActive ? "page" : undefined}
                    onClick={(e) => handleNav(e, item.route)}
                    className={`flex h-9 items-center justify-between rounded-[8px] px-2 text-left text-[15px] transition-colors duration-150 ${
                      isActive
                        ? "bg-[var(--surface-raised)] font-medium text-[var(--brand-primary)]"
                        : "font-normal text-[var(--text-primary)] hover:bg-[var(--surface-raised)]"
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.route === "/invoice" && hasSavedCard && (
                      <span className="font-mono text-[12px] text-[var(--status-positive)]">
                        Card on file
                      </span>
                    )}
                  </a>
                );
              })}
            </nav>

            <div className="flex flex-col gap-2 pt-3 border-t border-[var(--border-hairline)] sm:hidden">
              <a
                href="/estimate"
                tabIndex={mobileOpen ? 0 : -1}
                onClick={(e) => handleNav(e, "/estimate")}
                className="inline-flex h-11 w-full items-center justify-center rounded-[8px] bg-[var(--text-primary)] px-4 text-[14px] font-medium text-[#fdfbf7]"
              >
                Request estimate
              </a>
              <button
                type="button"
                tabIndex={mobileOpen ? 0 : -1}
                onClick={() => {
                  setMobileOpen(false);
                  onOpenCheckout("inspection");
                }}
                className="inline-flex h-11 w-full items-center justify-center rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-card)] px-4 text-[14px] font-normal text-[var(--text-primary)] tabular-nums"
              >
                Book inspection · {formatUsd(inspectionPlan.price)}
              </button>
            </div>
            <a
              href={COMPANY_CONFIG.contact.phoneHref}
              tabIndex={mobileOpen ? 0 : -1}
              className="flex h-9 items-center justify-center font-mono text-[13px] text-[var(--text-secondary)] tabular-nums sm:pt-2 sm:border-t sm:border-[var(--border-hairline)]"
            >
              {COMPANY_CONFIG.contact.phone} · {COMPANY_CONFIG.contact.licenseNumber}
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
