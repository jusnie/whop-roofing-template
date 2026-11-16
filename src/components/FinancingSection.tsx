import { useState } from "react";
import { COMPANY_CONFIG, formatUsd, getPlanByKey, type PlanKey } from "../config/company.config";
import { trackWhopEvent } from "../lib/whop-pixel";

interface FinancingSectionProps {
  onOpenCheckout: (planKey: PlanKey) => void;
  onNavigateSection: (sectionId: string) => void;
}

export function FinancingSection({ onOpenCheckout, onNavigateSection }: FinancingSectionProps) {
  const { financing } = COMPANY_CONFIG;
  const depositPlan = getPlanByKey("deposit");
  const inspectionPlan = getPlanByKey("inspection");

  const [projectTotal, setProjectTotal] = useState<number>(financing.defaultAmount);
  const [applyInspectionCredit, setApplyInspectionCredit] = useState<boolean>(true);

  const credits = depositPlan.price + (applyInspectionCredit ? inspectionPlan.price : 0);
  const financedBalance = Math.max(0, projectTotal - credits);

  function handleCommitEstimate() {
    trackWhopEvent("financing_estimated", {
      project_total: projectTotal,
      financed_balance: financedBalance,
      value: financedBalance,
      currency: "USD",
    });
  }

  return (
    <section
      id="financing"
      className="py-20 lg:py-28 bg-[var(--dark-page)] text-[var(--dark-primary)]"
    >
      <div className="mx-auto max-w-[1360px] px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 items-start">
          {/* Left narrative */}
          <div className="lg:col-span-5">
            <p className="font-mono text-[12px] leading-4 text-[var(--dark-muted)]">
              03 · {financing.eyebrow}
            </p>
            <h2 className="mt-3 font-display text-[36px] sm:text-[44px] leading-[1.08] text-[var(--dark-primary)]">
              {financing.headline}
            </h2>
            <p className="mt-4 text-[15px] leading-[24px] text-[var(--dark-secondary)]">
              {financing.description}
            </p>

            <ul className="mt-6 pt-6 border-t border-[var(--dark-hairline)] space-y-3">
              {financing.benefits.map((benefit) => (
                <li
                  key={benefit}
                  className="text-[14px] leading-5 text-[var(--dark-secondary)] flex items-baseline gap-3"
                >
                  <span className="font-mono text-[12px] text-[var(--dark-muted)]">—</span>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  handleCommitEstimate();
                  onOpenCheckout("deposit");
                }}
                className="inline-flex h-11 items-center justify-center rounded-[8px] bg-[var(--dark-primary)] px-5 text-[14px] font-medium text-[var(--dark-page)] hover:bg-white active:scale-[0.98] btn-dark-surface ui-transition cursor-pointer tabular-nums"
              >
                Start with {formatUsd(depositPlan.price)} deposit
              </button>
              <button
                type="button"
                onClick={() => {
                  handleCommitEstimate();
                  onNavigateSection("estimate");
                }}
                className="inline-flex h-11 items-center justify-center rounded-[8px] border border-[var(--dark-control)] bg-transparent px-5 text-[14px] font-normal text-[var(--dark-primary)] hover:bg-[var(--dark-raised)] active:scale-[0.98] ui-transition cursor-pointer"
              >
                Request written quote
              </button>
            </div>
          </div>

          {/* Right monthly payment schedule */}
          <div className="lg:col-span-7">
            <div className="rounded-[16px] border border-[var(--dark-hairline)] bg-[var(--dark-card)] p-6 lg:p-8">
              <div className="flex flex-wrap items-end justify-between gap-6">
                <div>
                  <label
                    htmlFor="roof-project-slider"
                    className="block text-[12px] leading-4 text-[var(--dark-muted)]"
                  >
                    Estimated contract total
                  </label>
                  <p className="mt-2 font-mono text-[32px] leading-none font-medium text-[var(--dark-primary)] tabular-nums">
                    {formatUsd(projectTotal)}
                  </p>
                </div>

                <div className="sm:text-right">
                  <p className="text-[12px] leading-4 text-[var(--dark-muted)]">
                    Balance after {formatUsd(credits)} credits
                  </p>
                  <p className="mt-2 font-mono text-[24px] leading-none font-medium text-[var(--dark-primary)] tabular-nums">
                    {formatUsd(financedBalance)}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <input
                  id="roof-project-slider"
                  type="range"
                  min={financing.minAmount}
                  max={financing.maxAmount}
                  step={financing.step}
                  value={projectTotal}
                  onChange={(e) => setProjectTotal(Number(e.target.value))}
                  onMouseUp={handleCommitEstimate}
                  onTouchEnd={handleCommitEstimate}
                  className="roof-slider w-full"
                />
                <div className="mt-2 flex justify-between font-mono text-[12px] leading-4 text-[var(--dark-muted)] tabular-nums">
                  <span>{formatUsd(financing.minAmount)}</span>
                  <span>$12,800 shingle</span>
                  <span>{formatUsd(financing.maxAmount)} metal</span>
                </div>
              </div>

              <label className="mt-5 flex items-center gap-3 text-[13px] leading-5 text-[var(--dark-secondary)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={applyInspectionCredit}
                  onChange={(e) => setApplyInspectionCredit(e.target.checked)}
                  className="h-4 w-4 rounded-[4px] accent-[var(--brand-primary)]"
                />
                <span className="tabular-nums">
                  Include {formatUsd(inspectionPlan.price)} credited inspection alongside{" "}
                  {formatUsd(depositPlan.price)} deposit
                </span>
              </label>

              {/* Provider schedule */}
              <div className="mt-6 pt-6 border-t border-[var(--dark-hairline)] space-y-2">
                {financing.providers.map((provider) => {
                  const perPayment = Math.ceil(financedBalance / provider.months);
                  return (
                    <div
                      key={provider.name}
                      className={`flex items-center justify-between gap-4 rounded-[8px] px-4 py-3 ${
                        provider.primary
                          ? "bg-[var(--dark-raised)] border border-[var(--dark-hairline)] btn-dark-surface"
                          : "border border-transparent"
                      }`}
                    >
                      <div>
                        <p className="text-[15px] leading-5 font-medium text-[var(--dark-primary)]">
                          {provider.name}
                        </p>
                        <p className="mt-1 text-[13px] leading-5 text-[var(--dark-muted)]">
                          {provider.termLabel} · {provider.aprNote}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-[18px] leading-6 font-medium text-[var(--dark-primary)] tabular-nums">
                          {formatUsd(perPayment)}
                          <span className="text-[12px] font-normal text-[var(--dark-muted)]">
                            {provider.months === 4 ? " / pmt" : " / mo"}
                          </span>
                        </p>
                        <p className="font-mono text-[12px] leading-4 text-[var(--dark-muted)] tabular-nums">
                          {provider.months} payments
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="mt-6 text-[12px] leading-5 text-[var(--dark-muted)]">
                {financing.disclaimer}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
