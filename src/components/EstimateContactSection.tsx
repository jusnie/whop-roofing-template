/**
 * Request an Estimate + Contact & FAQ (`EstimateContactSection.tsx`)
 * ==================================================================
 * Submits homeowner quote requests to `POST /api/leads` (Whop Leads API
 * `POST /api/v1/leads`) and fires `whop.track("estimate_requested", ...)`
 * with a deduplicated `event_id`.
 */

import { useEffect, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { COMPANY_CONFIG, formatUsd, getPlanByKey, type PlanKey } from "../config/company.config";
import { generateEventId, trackEstimateRequested } from "../lib/whop-pixel";
import type { EstimateLeadResponse, RuntimeConfigResponse } from "../types/whop";

interface EstimateContactSectionProps {
  runtime: RuntimeConfigResponse;
  prefilledService: string | null;
  prefilledZip: string | null;
  onOpenCheckout: (planKey: PlanKey) => void;
  onLeadCreated: (lead: EstimateLeadResponse) => void;
}

export function EstimateContactSection({
  runtime: _runtime,
  prefilledService,
  prefilledZip,
  onOpenCheckout,
  onLeadCreated,
}: EstimateContactSectionProps) {
  const { contact, estimateForm, faqs } = COMPANY_CONFIG;
  const inspectionPlan = getPlanByKey("inspection");
  const depositPlan = getPlanByKey("deposit");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [zip, setZip] = useState("");
  const [serviceType, setServiceType] = useState<string>(estimateForm.serviceOptions[0].value);
  const [roofMaterial, setRoofMaterial] = useState<string>(estimateForm.roofMaterials[0]);
  const [urgency, setUrgency] = useState<string>(estimateForm.urgencyOptions[1]);
  const [insuranceClaim, setInsuranceClaim] = useState(false);
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdLead, setCreatedLead] = useState<EstimateLeadResponse | null>(null);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  useEffect(() => {
    if (prefilledService) {
      setServiceType(prefilledService);
      setCreatedLead(null);
    }
  }, [prefilledService]);

  useEffect(() => {
    if (prefilledZip) {
      setZip(prefilledZip);
      setCreatedLead(null);
    }
  }, [prefilledZip]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const eventId = generateEventId("estimate_requested");

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          address,
          zip,
          serviceType,
          roofMaterial,
          urgency,
          insuranceClaim,
          notes,
          eventId,
          referrer: typeof window !== "undefined" ? window.location.href : undefined,
        }),
      });

      const data = (await response.json()) as EstimateLeadResponse & { error?: string };
      if (!response.ok || data.error) {
        throw new Error(data.error ?? "Unable to submit estimate request");
      }

      trackEstimateRequested({
        eventId,
        leadId: data.id,
        serviceType: data.serviceType,
        roofMaterial,
        urgency,
        zip,
        insuranceClaim,
        value: data.estimatedValue,
      });

      setCreatedLead(data);
      onLeadCreated(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="estimate" className="py-20 lg:py-28 bg-[var(--surface-card)]">
      <div className="mx-auto max-w-[1360px] px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 items-start">
          {/* Left: Estimate form -> Whop Leads API */}
          <div className="lg:col-span-7">
            <p className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
              07 · Request an estimate
            </p>
            <h2 className="mt-3 font-display text-[36px] sm:text-[44px] leading-[1.08] text-[var(--text-primary)]">
              Request a written roof scope and line-item price
            </h2>
            <p className="mt-4 max-w-[540px] text-[15px] leading-[24px] text-[var(--text-secondary)]">
              Every submission records as a lead on our Whop account and routes to an Austin
              estimator for same-day follow-up
            </p>

            <div className="mt-8 rounded-[16px] border border-[var(--border-hairline)] bg-[var(--surface-page)] p-6 lg:p-8">
              {createdLead ? (
                <div className="space-y-6">
                  <div>
                    <p className="inline-flex items-center gap-2 font-mono text-[12px] leading-4 text-[var(--status-positive)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-positive)]" />
                      Recorded on Whop Leads
                    </p>
                    <h3 className="mt-2 text-[22px] leading-7 font-medium text-[var(--text-primary)]">
                      Estimate logged for {createdLead.customerName}
                    </h3>
                    <p className="mt-2 text-[14px] leading-5 text-[var(--text-secondary)]">
                      An estimator will reach out via {createdLead.customerEmail} with inspection
                      windows and written pricing.
                    </p>
                  </div>

                  <div className="border-t border-[var(--border-hairline)]">
                    <div className="spec-row">
                      <span className="text-[13px] text-[var(--text-muted)]">Whop lead ID</span>
                      <span className="font-mono text-[13px] text-[var(--text-primary)]">
                        {createdLead.id}
                      </span>
                    </div>
                    {createdLead.memberId && (
                      <div className="spec-row">
                        <span className="text-[13px] text-[var(--text-muted)]">Member ID</span>
                        <span className="font-mono text-[13px] text-[var(--text-primary)]">
                          {createdLead.memberId}
                        </span>
                      </div>
                    )}
                    <div className="spec-row">
                      <span className="text-[13px] text-[var(--text-muted)]">Requested scope</span>
                      <span className="text-[13px] text-[var(--text-primary)]">
                        {createdLead.serviceType}
                      </span>
                    </div>
                    <div className="spec-row">
                      <span className="text-[13px] text-[var(--text-muted)]">Estimated value</span>
                      <span className="font-mono text-[13px] text-[var(--text-primary)] tabular-nums">
                        {formatUsd(createdLead.estimatedValue)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => onOpenCheckout("inspection")}
                      className="inline-flex h-11 items-center justify-center rounded-[8px] bg-[var(--brand-primary)] px-5 text-[14px] font-medium text-white hover:bg-[var(--brand-primary-hover)] ui-transition cursor-pointer tabular-nums"
                    >
                      Book {formatUsd(inspectionPlan.price)} inspection now
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenCheckout("deposit")}
                      className="inline-flex h-11 items-center justify-center rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-card)] px-5 text-[14px] text-[var(--text-primary)] hover:bg-[var(--surface-raised)] ui-transition cursor-pointer tabular-nums"
                    >
                      Pay {formatUsd(depositPlan.price)} deposit
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreatedLead(null)}
                      className="inline-flex h-11 items-center justify-center px-3 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      New request
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="lead-name"
                        className="block text-[12px] leading-4 text-[var(--text-muted)] mb-2"
                      >
                        Full name
                      </label>
                      <input
                        id="lead-name"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Marcus Delgado"
                        className="h-11 w-full rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-card)] px-3 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--text-primary)] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="lead-email"
                        className="block text-[12px] leading-4 text-[var(--text-muted)] mb-2"
                      >
                        Email
                      </label>
                      <input
                        id="lead-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="marcus@example.com"
                        className="h-11 w-full rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-card)] px-3 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--text-primary)] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="lead-phone"
                        className="block text-[12px] leading-4 text-[var(--text-muted)] mb-2"
                      >
                        Phone
                      </label>
                      <input
                        id="lead-phone"
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(512) 555-0140"
                        className="h-11 w-full rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-card)] px-3 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--text-primary)] focus:outline-none tabular-nums"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="lead-zip"
                        className="block text-[12px] leading-4 text-[var(--text-muted)] mb-2"
                      >
                        ZIP code
                      </label>
                      <input
                        id="lead-zip"
                        type="text"
                        inputMode="numeric"
                        maxLength={10}
                        required
                        value={zip}
                        onChange={(e) => setZip(e.target.value)}
                        placeholder="78749"
                        className="h-11 w-full rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-card)] px-3 font-mono text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--text-primary)] focus:outline-none tabular-nums"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="lead-address"
                      className="block text-[12px] leading-4 text-[var(--text-muted)] mb-2"
                    >
                      Property address
                    </label>
                    <input
                      id="lead-address"
                      type="text"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="6412 Escarpment Blvd, Austin"
                      className="h-11 w-full rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-card)] px-3 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--text-primary)] focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label
                        htmlFor="lead-service"
                        className="block text-[12px] leading-4 text-[var(--text-muted)] mb-2"
                      >
                        Service needed
                      </label>
                      <select
                        id="lead-service"
                        value={serviceType}
                        onChange={(e) => setServiceType(e.target.value)}
                        className="h-11 w-full rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-card)] px-3 text-[14px] text-[var(--text-primary)] focus:border-[var(--text-primary)] focus:outline-none"
                      >
                        {estimateForm.serviceOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="lead-material"
                        className="block text-[12px] leading-4 text-[var(--text-muted)] mb-2"
                      >
                        Current material
                      </label>
                      <select
                        id="lead-material"
                        value={roofMaterial}
                        onChange={(e) => setRoofMaterial(e.target.value)}
                        className="h-11 w-full rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-card)] px-3 text-[14px] text-[var(--text-primary)] focus:border-[var(--text-primary)] focus:outline-none"
                      >
                        {estimateForm.roofMaterials.map((mat) => (
                          <option key={mat} value={mat}>
                            {mat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="lead-urgency"
                        className="block text-[12px] leading-4 text-[var(--text-muted)] mb-2"
                      >
                        Timeline
                      </label>
                      <select
                        id="lead-urgency"
                        value={urgency}
                        onChange={(e) => setUrgency(e.target.value)}
                        className="h-11 w-full rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-card)] px-3 text-[14px] text-[var(--text-primary)] focus:border-[var(--text-primary)] focus:outline-none"
                      >
                        {estimateForm.urgencyOptions.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="lead-notes"
                      className="block text-[12px] leading-4 text-[var(--text-muted)] mb-2"
                    >
                      Project notes (optional)
                    </label>
                    <textarea
                      id="lead-notes"
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Hail date, leak location, roof age, or adjuster visit"
                      className="w-full rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-card)] p-3 text-[14px] leading-5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--text-primary)] focus:outline-none"
                    />
                  </div>

                  <label className="flex items-center gap-3 text-[13px] leading-5 text-[var(--text-secondary)] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={insuranceClaim}
                      onChange={(e) => setInsuranceClaim(e.target.checked)}
                      className="h-4 w-4 rounded-[4px] accent-[var(--brand-primary)]"
                    />
                    <span>Filing or considering a homeowner storm insurance claim</span>
                  </label>

                  {error && (
                    <p
                      role="alert"
                      className="rounded-[8px] border border-[var(--status-negative)]/25 bg-[var(--status-negative)]/5 px-4 py-3 text-[13px] leading-5 text-[var(--status-negative)]"
                    >
                      {error}
                    </p>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-[var(--brand-primary)] px-6 text-[15px] font-medium text-white hover:bg-[var(--brand-primary-hover)] active:scale-[0.98] disabled:opacity-50 ui-transition cursor-pointer"
                    >
                      {submitting ? (
                        <>
                          <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
                          <span>Submitting…</span>
                        </>
                      ) : (
                        <span>Request an estimate</span>
                      )}
                    </button>
                    <span className="text-[12px] leading-4 text-[var(--text-muted)]">
                      Same-day estimator response · Mon–Sat
                    </span>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Right: Direct Austin yard contact + FAQ */}
          <div id="contact" className="lg:col-span-5 lg:pt-10 space-y-8">
            <div className="rounded-[16px] border border-[var(--border-hairline)] bg-[var(--surface-page)] p-6 lg:p-8">
              <h3 className="text-[18px] leading-6 font-medium text-[var(--text-primary)]">
                Dispatch and yard office
              </h3>

              <div className="mt-4 border-t border-[var(--border-hairline)]">
                <div className="spec-row">
                  <span className="text-[13px] text-[var(--text-muted)]">Estimates</span>
                  <a
                    href={contact.phoneHref}
                    className="font-mono text-[14px] text-[var(--text-primary)] hover:text-[var(--brand-primary)] transition-colors tabular-nums"
                  >
                    {contact.phone}
                  </a>
                </div>
                <div className="spec-row">
                  <span className="text-[13px] text-[var(--text-muted)]">24/7 storm line</span>
                  <a
                    href={`tel:${contact.emergencyPhone.replace(/\D/g, "")}`}
                    className="font-mono text-[14px] text-[var(--text-primary)] hover:text-[var(--brand-primary)] transition-colors tabular-nums"
                  >
                    {contact.emergencyPhone}
                  </a>
                </div>
                <div className="spec-row">
                  <span className="text-[13px] text-[var(--text-muted)]">Email</span>
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-[13px] text-[var(--text-primary)] hover:text-[var(--brand-primary)] transition-colors"
                  >
                    {contact.email}
                  </a>
                </div>
                <div className="spec-row">
                  <span className="text-[13px] text-[var(--text-muted)]">Address</span>
                  <span className="text-[13px] text-[var(--text-primary)] text-right">
                    {contact.streetAddress}, {contact.city}, {contact.state} {contact.zip}
                  </span>
                </div>
                <div className="spec-row">
                  <span className="text-[13px] text-[var(--text-muted)]">Hours</span>
                  <span className="text-[13px] text-[var(--text-primary)] text-right">
                    {contact.hours}
                  </span>
                </div>
                <div className="spec-row">
                  <span className="text-[13px] text-[var(--text-muted)]">License</span>
                  <span className="font-mono text-[12px] text-[var(--text-secondary)] text-right">
                    {contact.licenseNumber}
                  </span>
                </div>
              </div>
            </div>

            {/* Common questions */}
            <div>
              <h3 className="text-[18px] leading-6 font-medium text-[var(--text-primary)] mb-4">
                Common questions
              </h3>
              <div className="border-t border-[var(--border-hairline)] divide-y divide-[var(--border-hairline)]">
                {faqs.map((faq, idx) => {
                  const isOpen = openFaqIdx === idx;
                  return (
                    <div key={faq.question} className="py-4">
                      <button
                        type="button"
                        onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                        aria-expanded={isOpen}
                        className="flex w-full items-center justify-between gap-4 text-left cursor-pointer"
                      >
                        <span className="text-[14px] leading-5 font-medium text-[var(--text-primary)]">
                          {faq.question}
                        </span>
                        <ChevronDown
                          size={16}
                          strokeWidth={1.5}
                          className={`shrink-0 text-[var(--text-muted)] transition-transform duration-150 ease-[var(--ease-out)] ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <p className="mt-3 pr-6 text-[14px] leading-[22px] text-[var(--text-secondary)]">
                          {faq.answer}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
