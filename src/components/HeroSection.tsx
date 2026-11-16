import { COMPANY_CONFIG, formatUsd, getPlanByKey, type PlanKey } from "../config/company.config";

interface HeroSectionProps {
  onOpenCheckout: (planKey: PlanKey) => void;
  onNavigateSection: (sectionId: string) => void;
}

export function HeroSection({ onOpenCheckout, onNavigateSection }: HeroSectionProps) {
  const depositPlan = getPlanByKey("deposit");

  return (
    <section id="top" className="relative bg-[var(--dark-page)] text-[var(--dark-primary)]">
      {/* Full-bleed architectural residence scene */}
      <div className="relative flex min-h-[560px] lg:min-h-[688px] items-center overflow-hidden">
        <img
          src={COMPANY_CONFIG.brand.heroImage}
          alt={COMPANY_CONFIG.brand.heroImageAlt}
          width={1600}
          height={900}
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover object-[62%_center]"
        />
        {/* Single-neutral tonal mask leaving calm reading space on the left and blending bottom edge */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(22,21,19,0.90) 0%, rgba(22,21,19,0.72) 44%, rgba(22,21,19,0.18) 100%)",
          }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-x-0 bottom-0 h-40"
          style={{
            background: "linear-gradient(0deg, #161513 0%, rgba(22,21,19,0) 100%)",
          }}
          aria-hidden="true"
        />

        <div className="relative z-10 mx-auto w-full max-w-[1360px] px-6 py-16 lg:px-8 lg:py-24">
          <div className="hero-enter max-w-[620px]">
            <h1 className="font-display text-[40px] sm:text-[56px] lg:text-[68px] leading-[1.03] text-[var(--dark-primary)]">
              {COMPANY_CONFIG.brand.heroHeadline}
            </h1>

            <p className="mt-6 max-w-[540px] text-[18px] leading-[28px] font-normal text-[#cfc8bc]">
              {COMPANY_CONFIG.brand.heroSubheadline}
            </p>

            {/* One primary action + one secondary action, nothing stacked beneath */}
            <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigateSection("estimate")}
                className="inline-flex h-12 items-center justify-center rounded-[8px] bg-[var(--dark-primary)] px-5 text-[15px] font-medium text-[var(--dark-page)] hover:bg-white active:scale-[0.98] btn-dark-surface ui-transition cursor-pointer"
              >
                Request an estimate
              </button>
              <button
                type="button"
                onClick={() => onOpenCheckout("deposit")}
                className="inline-flex h-12 items-center justify-center rounded-[8px] border border-[var(--dark-control)] bg-[#161513]/75 px-5 text-[15px] font-normal text-[var(--dark-primary)] hover:bg-[var(--dark-raised)] active:scale-[0.98] ui-transition cursor-pointer tabular-nums"
              >
                Lock install date · {formatUsd(depositPlan.price)} deposit
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Ruled contractor terms strip — numbers and labels only, hairline divided */}
      <div className="border-t border-[var(--dark-hairline)] bg-[var(--dark-page)]">
        <div className="mx-auto max-w-[1360px] px-6 lg:px-8">
          <dl className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[var(--dark-hairline)]">
            {COMPANY_CONFIG.stats.map((stat, idx) => (
              <div
                key={stat.label}
                className={`py-6 ${idx > 0 ? "lg:pl-8" : ""} ${idx < 3 ? "lg:pr-8" : ""} ${
                  idx % 2 === 1 ? "pl-4 lg:pl-8" : "pr-4 lg:pr-8"
                }`}
              >
                <dt className="text-[12px] leading-4 text-[var(--dark-muted)]">{stat.label}</dt>
                <dd className="mt-2 font-mono text-[28px] leading-none font-medium text-[var(--dark-primary)] tabular-nums">
                  {stat.value}
                </dd>
                <dd className="mt-2 text-[13px] leading-5 text-[var(--dark-secondary)]">
                  {stat.sublabel}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
