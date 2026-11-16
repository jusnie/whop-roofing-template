import { ArrowUpRight } from "lucide-react";
import { formatUsd, getPlanByKey, type PlanKey } from "../config/company.config";
import { whopProductDataAttrs } from "../lib/whop-pixel";
import type { RuntimeConfigResponse } from "../types/whop";

interface PlansSectionProps {
  runtime: RuntimeConfigResponse;
  onOpenCheckout: (planKey: PlanKey) => void;
}

export function PlansSection({ runtime, onOpenCheckout }: PlansSectionProps) {
  const depositPlan = getPlanByKey("deposit");
  const secondaryPlans = [getPlanByKey("inspection"), getPlanByKey("flat_rate")];

  const depositVariant = runtime.plans[depositPlan.key];
  const depositAttrs = whopProductDataAttrs({
    productId: runtime.productId,
    variantId: depositVariant,
    price: depositPlan.price,
    currency: depositPlan.currency,
  });

  return (
    <section
      id="pricing"
      className="py-20 lg:py-28 bg-[var(--surface-card)] border-y border-[var(--border-hairline)]"
    >
      <div className="mx-auto max-w-[1360px] px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="max-w-[620px]">
            <p className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
              02 · Online booking on Whop
            </p>
            <h2 className="mt-3 font-display text-[36px] sm:text-[44px] leading-[1.08] text-[var(--text-primary)]">
              Pay a deposit now, settle the balance at walkthrough
            </h2>
          </div>
          <p className="max-w-[400px] text-[14px] leading-5 text-[var(--text-secondary)]">
            Fixed-fee bookings run through Whop Payment Elements with Apple Pay, Google Pay, cards,
            US bank transfer, and eligible monthly financing
          </p>
        </div>

        {/* Varied layout: tall project deposit anchor on left, two stacked flat-fee plans on right */}
        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch">
          {/* Primary deposit + Setup Intent plan */}
          <article
            {...depositAttrs}
            className="lg:col-span-6 flex flex-col justify-between rounded-[16px] border border-[var(--dark-hairline)] bg-[var(--dark-page)] p-6 lg:p-8 text-[var(--dark-primary)]"
          >
            <div>
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-mono text-[12px] leading-4 text-[var(--dark-muted)]">
                  {depositPlan.badge}
                </span>
                <span className="font-mono text-[12px] leading-4 text-[var(--dark-muted)]">
                  {depositPlan.turnaround}
                </span>
              </div>

              <h3 className="mt-4 text-[22px] leading-7 font-medium text-[var(--dark-primary)]">
                {depositPlan.name}
              </h3>

              <div className="mt-6 flex items-baseline gap-3">
                <span className="font-mono text-[44px] leading-none font-medium text-[var(--dark-primary)] tabular-nums">
                  {formatUsd(depositPlan.price)}
                </span>
                <span className="text-[13px] leading-5 text-[var(--dark-muted)]">
                  one-time · deducted from contract
                </span>
              </div>

              <p className="mt-5 text-[15px] leading-[24px] text-[var(--dark-secondary)]">
                {depositPlan.description}
              </p>

              <ul className="mt-6 pt-6 border-t border-[var(--dark-hairline)] space-y-3">
                {depositPlan.deliverables.map((line) => (
                  <li
                    key={line}
                    className="text-[14px] leading-5 text-[var(--dark-primary)]/90 flex items-baseline gap-3"
                  >
                    <span className="font-mono text-[12px] text-[var(--dark-muted)]">—</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 pt-6 border-t border-[var(--dark-hairline)] space-y-4">
              <div className="flex items-baseline justify-between gap-4 text-[12px] leading-4 text-[var(--dark-muted)]">
                <span>Card on file</span>
                <span className="font-mono text-[var(--dark-secondary)]">
                  Whop Setup Intent (off_session)
                </span>
              </div>

              <button
                type="button"
                onClick={() => onOpenCheckout(depositPlan.key)}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-[var(--brand-primary)] px-5 text-[15px] font-medium text-white hover:bg-[var(--brand-primary-hover)] active:scale-[0.98] btn-dark-surface ui-transition cursor-pointer tabular-nums"
              >
                <span>{depositPlan.ctaLabel}</span>
                <ArrowUpRight size={16} strokeWidth={1.5} />
              </button>
            </div>
          </article>

          {/* Secondary flat-fee plans stacked */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            {secondaryPlans.map((plan) => {
              const variantId = runtime.plans[plan.key];
              const dataAttrs = whopProductDataAttrs({
                productId: runtime.productId,
                variantId,
                price: plan.price,
                currency: plan.currency,
              });

              return (
                <article
                  key={plan.key}
                  {...dataAttrs}
                  className="flex flex-1 flex-col justify-between rounded-[16px] border border-[var(--border-hairline)] bg-[var(--surface-page)] p-6 lg:p-8"
                >
                  <div>
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
                        {plan.badge}
                      </span>
                      <span className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
                        {plan.turnaround}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-baseline justify-between gap-4">
                      <h3 className="text-[20px] leading-7 font-medium text-[var(--text-primary)]">
                        {plan.name}
                      </h3>
                      <span className="font-mono text-[32px] leading-none font-medium text-[var(--text-primary)] tabular-nums">
                        {formatUsd(plan.price)}
                      </span>
                    </div>

                    <p className="mt-2 text-[13px] leading-5 text-[var(--text-muted)]">
                      {plan.priceNote}
                    </p>

                    <p className="mt-3 text-[14px] leading-[22px] text-[var(--text-secondary)]">
                      {plan.description}
                    </p>

                    <ul className="mt-5 pt-5 border-t border-[var(--border-hairline)] grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                      {plan.deliverables.map((line) => (
                        <li
                          key={line}
                          className="text-[13px] leading-5 text-[var(--text-secondary)]"
                        >
                          — {line}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6 flex items-center justify-between gap-4 pt-4 border-t border-[var(--border-hairline)]">
                    <span className="font-mono text-[12px] leading-4 text-[var(--text-muted)] tabular-nums">
                      {variantId ? variantId : "One-time USD"}
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenCheckout(plan.key)}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-card)] px-4 text-[14px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-raised)] active:scale-[0.98] ui-transition cursor-pointer tabular-nums"
                    >
                      <span>{plan.ctaLabel}</span>
                      <ArrowUpRight size={16} strokeWidth={1.5} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        {/* Quiet single-line payment disclosure */}
        <p className="mt-8 text-[13px] leading-5 text-[var(--text-muted)]">
          Checkout powered by Whop Payments — Apple Pay, Google Pay, major cards, US bank transfer,
          and eligible Klarna, Splitit, and Afterpay monthly financing
        </p>
      </div>
    </section>
  );
}
