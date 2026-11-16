import { ArrowUpRight } from "lucide-react";
import { COMPANY_CONFIG, formatUsd, type PlanKey } from "../config/company.config";
import { SITE_ROUTES, type AppRoute } from "../lib/routes";
import { whopProductDataAttrs } from "../lib/whop-pixel";
import type { RuntimeConfigResponse } from "../types/whop";

interface HomeOverviewSectionProps {
  runtime: RuntimeConfigResponse;
  onNavigateRoute: (route: AppRoute) => void;
  onOpenCheckout: (planKey: PlanKey) => void;
}

export function HomeOverviewSection({
  runtime,
  onNavigateRoute,
  onOpenCheckout,
}: HomeOverviewSectionProps) {
  const pageCards = SITE_ROUTES.filter((r) => r.route !== "/");

  return (
    <section className="py-16 lg:py-24 bg-[var(--surface-page)]">
      <div className="mx-auto max-w-[1360px] px-6 lg:px-8 space-y-16">
        {/* Quick Online Booking Plans Strip */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="max-w-[580px]">
              <p className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
                Online booking on Whop
              </p>
              <h2 className="mt-2 font-display text-[32px] sm:text-[40px] leading-[1.08] text-[var(--text-primary)]">
                Book an inspection, lock your crew date, or schedule a tune-up
              </h2>
            </div>
            <a
              href="/pricing"
              onClick={(e) => {
                e.preventDefault();
                onNavigateRoute("/pricing");
              }}
              className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[var(--brand-primary)] hover:underline shrink-0"
            >
              <span>Compare all plans</span>
              <ArrowUpRight size={15} strokeWidth={1.75} />
            </a>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
            {COMPANY_CONFIG.plans.map((plan) => {
              const variantId = runtime.plans[plan.key];
              const attrs = whopProductDataAttrs({
                productId: runtime.productId,
                variantId,
                price: plan.price,
                currency: plan.currency,
              });
              const isDeposit = plan.key === "deposit";

              return (
                <article
                  key={plan.key}
                  {...attrs}
                  className={`flex flex-col justify-between rounded-[16px] border p-6 shadow-subtle ${
                    isDeposit
                      ? "border-[var(--dark-hairline)] bg-[var(--dark-page)] text-[var(--dark-primary)]"
                      : "border-[var(--border-hairline)] bg-[var(--surface-card)] text-[var(--text-primary)]"
                  }`}
                >
                  <div>
                    <div className="flex items-baseline justify-between gap-3">
                      <span
                        className={`font-mono text-[12px] leading-4 ${
                          isDeposit ? "text-[var(--dark-muted)]" : "text-[var(--text-muted)]"
                        }`}
                      >
                        {plan.badge}
                      </span>
                      <span
                        className={`font-mono text-[22px] leading-none font-medium tabular-nums ${
                          isDeposit ? "text-[var(--dark-primary)]" : "text-[var(--text-primary)]"
                        }`}
                      >
                        {formatUsd(plan.price)}
                      </span>
                    </div>

                    <h3 className="mt-3 text-[18px] leading-6 font-medium">{plan.shortName}</h3>
                    <p
                      className={`mt-2 text-[14px] leading-5 ${
                        isDeposit ? "text-[var(--dark-secondary)]" : "text-[var(--text-secondary)]"
                      }`}
                    >
                      {plan.priceNote}
                    </p>
                  </div>

                  <div
                    className={`mt-6 pt-4 border-t flex items-center justify-between gap-3 ${
                      isDeposit ? "border-[var(--dark-hairline)]" : "border-[var(--border-hairline)]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenCheckout(plan.key)}
                      className={`inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[8px] px-4 text-[14px] font-medium ui-transition cursor-pointer ${
                        isDeposit
                          ? "bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover)]"
                          : "border border-[var(--border-control)] bg-[var(--surface-page)] text-[var(--text-primary)] hover:bg-[var(--surface-raised)]"
                      }`}
                    >
                      <span>{plan.ctaLabel}</span>
                      <ArrowUpRight size={15} strokeWidth={1.5} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        {/* Dedicated Pages Directory */}
        <div className="pt-12 border-t border-[var(--border-hairline)]">
          <div className="max-w-[580px]">
            <p className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
              Explore dedicated pages
            </p>
            <h2 className="mt-2 font-display text-[32px] sm:text-[38px] leading-[1.08] text-[var(--text-primary)]">
              Every step of the project in its own section
            </h2>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pageCards.map((item) => (
              <a
                key={item.route}
                href={item.route}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigateRoute(item.route);
                }}
                className="group flex flex-col justify-between rounded-[14px] border border-[var(--border-hairline)] bg-[var(--surface-card)] p-6 shadow-subtle hover:border-[var(--text-primary)]/25 ui-transition"
              >
                <div>
                  <p className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
                    {item.eyebrow}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <h3 className="text-[18px] leading-6 font-medium text-[var(--text-primary)]">
                      {item.title}
                    </h3>
                    <ArrowUpRight
                      size={16}
                      strokeWidth={1.5}
                      className="text-[var(--text-muted)] group-hover:text-[var(--brand-primary)] transition-colors shrink-0"
                    />
                  </div>
                  <p className="mt-2 text-[14px] leading-5 text-[var(--text-secondary)]">
                    {item.description}
                  </p>
                </div>

                <p className="mt-5 font-mono text-[12px] text-[var(--brand-primary)]">
                  Open {item.route}
                </p>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
