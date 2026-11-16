import { ArrowLeft } from "lucide-react";
import type { PlanKey } from "../config/company.config";
import { getRouteMeta, type AppRoute } from "../lib/routes";

interface PageHeaderBarProps {
  route: Exclude<AppRoute, "/" | "/checkout/return">;
  onNavigateRoute: (route: AppRoute) => void;
  onOpenCheckout: (planKey: PlanKey) => void;
}

export function PageHeaderBar({
  route,
  onNavigateRoute,
  onOpenCheckout,
}: PageHeaderBarProps) {
  const meta = getRouteMeta(route);

  return (
    <div className="border-b border-[var(--border-hairline)] bg-[var(--surface-card)]">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-4 px-6 py-4 lg:px-8">
        <div className="flex items-center gap-3 text-[13px] leading-5">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigateRoute("/");
            }}
            className="inline-flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] ui-transition"
          >
            <ArrowLeft size={14} strokeWidth={1.75} />
            <span>Home</span>
          </a>
          <span className="text-[var(--text-muted)]" aria-hidden="true">
            /
          </span>
          <span className="font-medium text-[var(--text-primary)]">{meta.title}</span>
        </div>

        <div className="flex items-center gap-3">
          {route !== "/pricing" && (
            <button
              type="button"
              onClick={() => onOpenCheckout("deposit")}
              className="text-[13px] leading-5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] ui-transition cursor-pointer"
            >
              Pay $500 deposit
            </button>
          )}
          {route !== "/estimate" && (
            <a
              href="/estimate"
              onClick={(e) => {
                e.preventDefault();
                onNavigateRoute("/estimate");
              }}
              className="inline-flex h-8 items-center justify-center rounded-[8px] border border-[var(--border-control)] bg-[var(--surface-page)] px-3 text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-raised)] ui-transition"
            >
              Request estimate
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
