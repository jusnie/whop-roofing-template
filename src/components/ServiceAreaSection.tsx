import { useState } from "react";
import { COMPANY_CONFIG, formatUsd, getPlanByKey, type PlanKey, type ServiceCountyConfig } from "../config/company.config";

interface ServiceAreaSectionProps {
  onOpenCheckout: (planKey: PlanKey) => void;
  onPrefillEstimateZip: (zip: string) => void;
}

export function ServiceAreaSection({
  onOpenCheckout,
  onPrefillEstimateZip,
}: ServiceAreaSectionProps) {
  const { serviceArea } = COMPANY_CONFIG;
  const inspectionPlan = getPlanByKey("inspection");
  const [zipInput, setZipInput] = useState("");
  const [checkedZip, setCheckedZip] = useState<{
    zip: string;
    matchedCounty: ServiceCountyConfig | null;
  } | null>(null);

  function checkZip(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = zipInput.replace(/\D/g, "").slice(0, 5);
    if (cleaned.length !== 5) return;

    const exact = serviceArea.counties.find((c) =>
      (c.exactZips as readonly string[]).includes(cleaned),
    );
    const matchedCounty =
      exact ??
      serviceArea.counties.find((c) => c.zipPrefixes.some((p) => cleaned.startsWith(p))) ??
      null;

    setCheckedZip({ zip: cleaned, matchedCounty });
  }

  return (
    <section
      id="service-area"
      className="py-20 lg:py-28 bg-[var(--surface-card)] border-b border-[var(--border-hairline)]"
    >
      <div className="mx-auto max-w-[1360px] px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 items-start">
          {/* Left: Area header + ZIP lookup + dispatch radius diagram */}
          <div className="lg:col-span-5 space-y-6">
            <div>
              <p className="font-mono text-[12px] leading-4 text-[var(--text-muted)] tabular-nums">
                05 · Service area · {serviceArea.radiusMiles}-mile radius
              </p>
              <h2 className="mt-3 font-display text-[36px] sm:text-[44px] leading-[1.08] text-[var(--text-primary)]">
                {serviceArea.headline}
              </h2>
              <p className="mt-4 text-[15px] leading-[24px] text-[var(--text-secondary)]">
                {serviceArea.description}
              </p>
            </div>

            {/* ZIP lookup */}
            <div className="rounded-[12px] border border-[var(--border-hairline)] bg-[var(--surface-page)] p-5">
              <label
                htmlFor="zip-coverage-input"
                className="block text-[12px] leading-4 text-[var(--text-muted)] mb-2"
              >
                Check ZIP coverage
              </label>
              <form onSubmit={checkZip} className="flex gap-2">
                <input
                  id="zip-coverage-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  value={zipInput}
                  onChange={(e) => setZipInput(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  placeholder="78704"
                  className="h-10 flex-1 rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-card)] px-3 font-mono text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--text-primary)] focus:outline-none tabular-nums"
                />
                <button
                  type="submit"
                  className="h-10 rounded-[8px] bg-[var(--text-primary)] px-4 text-[14px] font-medium text-[#fdfbf7] hover:bg-[#332d25] active:scale-[0.98] ui-transition cursor-pointer"
                >
                  Check
                </button>
              </form>

              {checkedZip && (
                <div className="mt-4 pt-4 border-t border-[var(--border-hairline)] text-[13px] leading-5">
                  {checkedZip.matchedCounty ? (
                    <div className="space-y-3">
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="inline-flex items-center gap-2 font-medium text-[var(--text-primary)]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-positive)]" />
                          {checkedZip.zip} · {checkedZip.matchedCounty.county}
                        </span>
                        <span className="font-mono text-[12px] text-[var(--text-muted)]">
                          {checkedZip.matchedCounty.responseTime}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onPrefillEstimateZip(checkedZip.zip)}
                          className="h-9 rounded-[8px] bg-[var(--brand-primary)] px-3 text-[13px] font-medium text-white hover:bg-[var(--brand-primary-hover)] ui-transition cursor-pointer tabular-nums"
                        >
                          Estimate for {checkedZip.zip}
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenCheckout("inspection")}
                          className="h-9 rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-card)] px-3 text-[13px] text-[var(--text-primary)] hover:bg-[var(--surface-raised)] ui-transition cursor-pointer tabular-nums"
                        >
                          Book {formatUsd(inspectionPlan.price)} inspection
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 text-[var(--text-secondary)]">
                      <p className="tabular-nums">
                        {checkedZip.zip} falls outside the standard {serviceArea.radiusMiles}-mile
                        dispatch ring, though full replacements can be scheduled on request.
                      </p>
                      <button
                        type="button"
                        onClick={() => onPrefillEstimateZip(checkedZip.zip)}
                        className="text-[13px] font-medium text-[var(--brand-primary)] hover:underline cursor-pointer"
                      >
                        Send address for review →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quiet monochrome dispatch diagram on the warm ramp */}
            <div className="rounded-[12px] border border-[var(--border-hairline)] bg-[var(--surface-page)] p-5">
              <svg
                viewBox="0 0 360 200"
                className="w-full h-auto"
                role="img"
                aria-label="65-mile dispatch radius centered on Austin, Texas"
              >
                <circle
                  cx="180"
                  cy="104"
                  r="86"
                  fill="none"
                  stroke="rgba(31,27,22,0.12)"
                  strokeDasharray="3 4"
                />
                <circle
                  cx="180"
                  cy="104"
                  r="52"
                  fill="rgba(31,27,22,0.025)"
                  stroke="rgba(31,27,22,0.14)"
                />
                <line x1="20" y1="104" x2="340" y2="104" stroke="rgba(31,27,22,0.06)" />
                <line x1="180" y1="12" x2="180" y2="192" stroke="rgba(31,27,22,0.06)" />

                {[
                  { x: 184, y: 52, label: "Georgetown" },
                  { x: 112, y: 66, label: "Marble Falls" },
                  { x: 124, y: 124, label: "Dripping Springs" },
                  { x: 244, y: 118, label: "Bastrop" },
                  { x: 150, y: 168, label: "New Braunfels" },
                ].map((pt) => (
                  <g key={pt.label}>
                    <circle cx={pt.x} cy={pt.y} r="2.5" fill="#72695e" />
                    <text x={pt.x + 7} y={pt.y + 3.5} fill="#5e554a" fontSize="10">
                      {pt.label}
                    </text>
                  </g>
                ))}

                <circle cx="180" cy="104" r="4.5" fill="#b8431b" />
                <text x="190" y="101" fill="#1f1b16" fontSize="11" fontWeight="500">
                  Austin yard
                </text>
                <text x="270" y="188" fill="#72695e" fontSize="10" fontFamily="monospace">
                  65 mi
                </text>
              </svg>
            </div>
          </div>

          {/* Right: Ruled county dispatch schedule */}
          <div className="lg:col-span-7 rounded-[16px] border border-[var(--border-hairline)] bg-[var(--surface-page)] p-6 lg:p-8">
            <div className="flex items-baseline justify-between pb-4 border-b border-[var(--border-hairline)]">
              <h3 className="text-[16px] leading-6 font-medium text-[var(--text-primary)]">
                Counties and arrival windows
              </h3>
              <span className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
                HQ · {serviceArea.headquartersCity}
              </span>
            </div>

            <div className="divide-y divide-[var(--border-hairline)]">
              {serviceArea.counties.map((county) => {
                const isMatched = checkedZip?.matchedCounty?.county === county.county;
                return (
                  <div
                    key={county.county}
                    className={`py-5 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 ${
                      isMatched ? "bg-[var(--surface-card)] -mx-4 px-4 rounded-[8px]" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-[15px] leading-5 font-medium text-[var(--text-primary)]">
                        {county.county}
                      </p>
                      <p className="mt-1 text-[13px] leading-5 text-[var(--text-secondary)]">
                        {county.cities.join(" · ")}
                      </p>
                    </div>
                    <span
                      className={`font-mono text-[12px] leading-4 shrink-0 sm:text-right ${
                        isMatched ? "text-[var(--brand-primary)] font-medium" : "text-[var(--text-muted)]"
                      }`}
                    >
                      {county.responseTime}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
