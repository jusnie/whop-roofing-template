import { Trash2, X } from "lucide-react";
import type {
  EstimateLeadResponse,
  FinalInvoiceRecord,
  RuntimeConfigResponse,
  SavedCardSummary,
  TrackedPixelEvent,
} from "../types/whop";

interface WhopPixelInspectorProps {
  open: boolean;
  onToggle: () => void;
  events: TrackedPixelEvent[];
  onClear: () => void;
  runtime: RuntimeConfigResponse;
  savedCard: SavedCardSummary | null;
  latestLead: EstimateLeadResponse | null;
  latestInvoice: FinalInvoiceRecord | null;
}

const REQUIRED_CUSTOM_EVENTS = [
  { name: "service_viewed", hint: "Select a service scope" },
  { name: "deposit_started", hint: "Open $500 deposit checkout" },
  { name: "estimate_requested", hint: "Submit estimate form" },
] as const;

export function WhopPixelInspector({
  open,
  onToggle,
  events,
  onClear,
  runtime,
  savedCard,
  latestLead,
  latestInvoice,
}: WhopPixelInspectorProps) {
  const firedNames = new Set(events.map((e) => e.name));
  const requiredFiredCount = REQUIRED_CUSTOM_EVENTS.filter((e) => firedNames.has(e.name)).length;

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {!open ? (
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-[var(--dark-control)] bg-[var(--dark-page)] px-3 font-mono text-[12px] leading-4 text-[var(--dark-primary)] shadow-float hover:bg-[var(--dark-raised)] ui-transition cursor-pointer tabular-nums"
          title="Inspect live whop.track pixel events"
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              requiredFiredCount === 3 ? "bg-[var(--status-positive-dark)]" : "bg-[var(--dark-muted)]"
            }`}
          />
          <span>whop.track</span>
          <span className="text-[var(--dark-muted)]">{requiredFiredCount}/3</span>
        </button>
      ) : (
        <aside
          aria-label="Whop Pixel event inspector"
          className="w-[calc(100vw-32px)] max-w-[400px] rounded-[16px] border border-[var(--dark-hairline)] bg-[var(--dark-page)] text-[var(--dark-primary)] shadow-float overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--dark-hairline)]">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[13px] font-medium text-[var(--dark-primary)]">
                whop.track
              </span>
              <span className="font-mono text-[12px] text-[var(--dark-muted)]">
                {runtime.mode}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {events.length > 0 && (
                <button
                  type="button"
                  onClick={onClear}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] text-[var(--dark-muted)] hover:bg-[var(--dark-raised)] hover:text-[var(--dark-primary)] cursor-pointer"
                  title="Clear event log"
                  aria-label="Clear event log"
                >
                  <Trash2 size={15} strokeWidth={1.5} />
                </button>
              )}
              <button
                type="button"
                onClick={onToggle}
                className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] text-[var(--dark-muted)] hover:bg-[var(--dark-raised)] hover:text-[var(--dark-primary)] cursor-pointer"
                title="Close inspector"
                aria-label="Close inspector"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          <div className="p-5 space-y-4 max-h-[68vh] overflow-y-auto">
            {/* Required custom events checklist */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between text-[12px] leading-4 text-[var(--dark-muted)]">
                <span>Custom pixel events</span>
                <span className="font-mono tabular-nums">{requiredFiredCount}/3</span>
              </div>
              <div className="divide-y divide-[var(--dark-hairline)] border-y border-[var(--dark-hairline)]">
                {REQUIRED_CUSTOM_EVENTS.map((req) => {
                  const fired = firedNames.has(req.name);
                  return (
                    <div key={req.name} className="py-2 flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 font-mono text-[12px]">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            fired ? "bg-[var(--status-positive-dark)]" : "bg-[var(--dark-muted)]/50"
                          }`}
                        />
                        <span
                          className={
                            fired ? "text-[var(--dark-primary)]" : "text-[var(--dark-secondary)]"
                          }
                        >
                          {req.name}
                        </span>
                      </span>
                      <span className="text-[11px] text-[var(--dark-muted)]">
                        {fired ? "fired" : req.hint}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Session API IDs */}
            <div className="space-y-2 font-mono text-[11px] leading-4 text-[var(--dark-muted)]">
              <div className="flex justify-between gap-2">
                <span>SetupIntent card</span>
                <span className="text-[var(--dark-secondary)] truncate">
                  {savedCard ? savedCard.paymentMethodId : "—"}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Latest lead</span>
                <span className="text-[var(--dark-secondary)] truncate">
                  {latestLead ? latestLead.id : "—"}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Final invoice</span>
                <span className="text-[var(--dark-secondary)] truncate">
                  {latestInvoice ? `${latestInvoice.invoiceNumber} (${latestInvoice.status})` : "—"}
                </span>
              </div>
            </div>

            {/* Live event stream */}
            <div className="space-y-2">
              <p className="text-[12px] leading-4 text-[var(--dark-muted)] tabular-nums">
                Recent calls ({events.length})
              </p>
              {events.length === 0 ? (
                <p className="text-[12px] leading-5 text-[var(--dark-muted)]">
                  Interact with any service, deposit button, or estimate form to log live
                  whop.track payloads
                </p>
              ) : (
                <div className="space-y-2">
                  {events.slice(0, 12).map((evt) => (
                    <div
                      key={evt.id}
                      className="rounded-[8px] border border-[var(--dark-hairline)] bg-[var(--dark-card)] p-3 text-[11px]"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-mono text-[var(--dark-primary)]">{evt.name}</span>
                        <span className="font-mono text-[var(--dark-muted)]">
                          {evt.deliveredToWhopPixel ? "live" : "dev"}
                        </span>
                      </div>
                      <pre className="mt-2 font-mono text-[10px] leading-4 text-[var(--dark-secondary)] overflow-x-auto whitespace-pre-wrap break-all">
                        {JSON.stringify(evt.payload, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
