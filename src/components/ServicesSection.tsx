import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import {
  COMPANY_CONFIG,
  formatUsd,
  getPlanByKey,
  type PlanKey,
  type RoofingServiceConfig,
  type ServiceKey,
} from "../config/company.config";
import { trackServiceViewed, whopProductDataAttrs } from "../lib/whop-pixel";
import type { RuntimeConfigResponse } from "../types/whop";

interface ServicesSectionProps {
  runtime: RuntimeConfigResponse;
  onOpenCheckout: (planKey: PlanKey) => void;
  onRequestEstimateForService: (serviceKey: ServiceKey) => void;
}

export function ServicesSection({
  runtime,
  onOpenCheckout,
  onRequestEstimateForService,
}: ServicesSectionProps) {
  const [selectedKey, setSelectedKey] = useState<ServiceKey>("replacement");

  const activeService: RoofingServiceConfig =
    COMPANY_CONFIG.services.find((s) => s.key === selectedKey) ?? COMPANY_CONFIG.services[0];
  const activePlan = getPlanByKey(activeService.linkedPlanKey);
  const activeVariantId = runtime.plans[activeService.linkedPlanKey];

  function handleInspectService(service: RoofingServiceConfig, source: string) {
    setSelectedKey(service.key);
    const linkedPlan = getPlanByKey(service.linkedPlanKey);
    trackServiceViewed({
      serviceKey: service.key,
      serviceName: service.title,
      planKey: linkedPlan.key,
      variantId: runtime.plans[linkedPlan.key] || undefined,
      productId: runtime.productId || undefined,
      value: linkedPlan.price,
      source,
    });
  }

  return (
    <section id="services" className="py-20 lg:py-28 bg-[var(--surface-page)]">
      <div className="mx-auto max-w-[1360px] px-6 lg:px-8">
        {/* Section header */}
        <div className="max-w-[640px]">
          <p className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
            01 · Residential and light commercial scope
          </p>
          <h2 className="mt-3 font-display text-[36px] sm:text-[44px] leading-[1.08] text-[var(--text-primary)]">
            Inspections, storm repairs, and full roof replacements
          </h2>
          <p className="mt-4 text-[15px] leading-[22px] text-[var(--text-secondary)]">
            Select a scope to inspect materials, turnaround, warranty terms, and online booking
          </p>
        </div>

        {/* Asymmetric layout: aligned selector column + wide contractor specification sheet */}
        <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
          {/* Left selector list */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            {COMPANY_CONFIG.services.map((service, index) => {
              const isSelected = service.key === selectedKey;
              const plan = getPlanByKey(service.linkedPlanKey);
              const variantId = runtime.plans[service.linkedPlanKey];
              const dataAttrs = whopProductDataAttrs({
                productId: runtime.productId,
                variantId,
                price: plan.price,
                currency: plan.currency,
              });

              return (
                <button
                  key={service.key}
                  type="button"
                  {...dataAttrs}
                  onClick={() => handleInspectService(service, "service_card")}
                  className={`w-full rounded-[12px] border p-6 text-left ui-transition cursor-pointer ${
                    isSelected
                      ? "border-[var(--text-primary)]/20 bg-[var(--surface-card)] shadow-subtle"
                      : "border-[var(--border-hairline)] bg-transparent hover:bg-[var(--surface-card)]/60"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-mono text-[12px] leading-4 text-[var(--text-muted)] tabular-nums">
                      0{index + 1} · {service.eyebrow}
                    </span>
                    <span
                      className={`font-mono text-[12px] leading-4 tabular-nums shrink-0 ${
                        isSelected ? "text-[var(--brand-primary)] font-medium" : "text-[var(--text-muted)]"
                      }`}
                    >
                      {service.priceRangeLabel}
                    </span>
                  </div>

                  <h3 className="mt-2 text-[18px] leading-6 font-medium text-[var(--text-primary)]">
                    {service.title}
                  </h3>
                  <p className="mt-2 text-[14px] leading-5 text-[var(--text-secondary)]">
                    {service.tagline}
                  </p>
                </button>
              );
            })}

            {/* Quiet license & emergency line */}
            <div className="pt-2 px-1 flex flex-wrap items-center justify-between gap-2 text-[12px] leading-4 text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-positive)]" aria-hidden="true" />
                {COMPANY_CONFIG.contact.emergencyNote}
              </span>
              <a
                href={COMPANY_CONFIG.contact.phoneHref}
                className="font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors tabular-nums"
              >
                {COMPANY_CONFIG.contact.phone}
              </a>
            </div>
          </div>

          {/* Right contractor specification sheet */}
          <article
            {...whopProductDataAttrs({
              productId: runtime.productId,
              variantId: activeVariantId,
              price: activePlan.price,
              currency: activePlan.currency,
            })}
            className="lg:col-span-7 rounded-[16px] border border-[var(--border-hairline)] bg-[var(--surface-card)] p-6 lg:p-8 shadow-subtle"
          >
            <div className="overflow-hidden rounded-[8px] bg-[var(--surface-raised)] aspect-[16/9]">
              <img
                src={activeService.image}
                alt={activeService.imageAlt}
                width={1200}
                height={675}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>

            <div className="mt-6 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
              <h3 className="text-[24px] leading-8 font-medium text-[var(--text-primary)]">
                {activeService.title}
              </h3>
              <span className="font-mono text-[13px] leading-5 text-[var(--text-muted)] tabular-nums">
                {activeService.priceRangeLabel}
              </span>
            </div>

            <p className="mt-3 text-[15px] leading-[24px] text-[var(--text-secondary)]">
              {activeService.description}
            </p>

            {/* Signature contractor spec rows */}
            <div className="mt-6 border-t border-[var(--border-hairline)]">
              <div className="spec-row">
                <span className="text-[13px] text-[var(--text-muted)]">Turnaround</span>
                <span className="text-[14px] text-[var(--text-primary)] text-right">
                  {activeService.timeline}
                </span>
              </div>
              <div className="spec-row">
                <span className="text-[13px] text-[var(--text-muted)]">Warranty</span>
                <span className="text-[14px] text-[var(--text-primary)] text-right">
                  {activeService.warranty}
                </span>
              </div>
              <div className="spec-row">
                <span className="text-[13px] text-[var(--text-muted)]">Online plan</span>
                <span className="font-mono text-[13px] text-[var(--text-primary)] text-right tabular-nums">
                  {activePlan.shortName} · {formatUsd(activePlan.price)}
                </span>
              </div>
            </div>

            {/* Included items */}
            <div className="mt-6 pt-6 border-t border-[var(--border-hairline)] grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              {activeService.highlights.map((item) => (
                <div key={item} className="text-[14px] leading-5 text-[var(--text-secondary)]">
                  — {item}
                </div>
              ))}
            </div>

            {/* Two actions only */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  handleInspectService(activeService, "spec_panel_book");
                  onOpenCheckout(activeService.linkedPlanKey);
                }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[var(--brand-primary)] px-5 text-[14px] font-medium text-white hover:bg-[var(--brand-primary-hover)] active:scale-[0.98] ui-transition cursor-pointer tabular-nums"
              >
                <span>{activeService.primaryCta}</span>
                <ArrowUpRight size={16} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={() => {
                  handleInspectService(activeService, "spec_panel_estimate");
                  onRequestEstimateForService(activeService.key);
                }}
                className="inline-flex h-11 items-center justify-center rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-page)] px-5 text-[14px] font-normal text-[var(--text-primary)] hover:bg-[var(--surface-raised)] active:scale-[0.98] ui-transition cursor-pointer"
              >
                Request written estimate
              </button>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
