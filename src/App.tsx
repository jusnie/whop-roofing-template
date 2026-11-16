import { useCallback, useEffect, useState } from "react";
import { CheckoutReturnView } from "./components/CheckoutReturnView";
import { EstimateContactSection } from "./components/EstimateContactSection";
import { FinancingSection } from "./components/FinancingSection";
import { Footer } from "./components/Footer";
import { HeroSection } from "./components/HeroSection";
import { HomeOverviewSection } from "./components/HomeOverviewSection";
import { InvoiceWorkflowSection } from "./components/InvoiceWorkflowSection";
import { LegalModal, type LegalTab } from "./components/LegalModal";
import { Navbar } from "./components/Navbar";
import { PageHeaderBar } from "./components/PageHeaderBar";
import { PlansSection } from "./components/PlansSection";
import { ReviewsTrustSection } from "./components/ReviewsTrustSection";
import { ServiceAreaSection } from "./components/ServiceAreaSection";
import { ServicesSection } from "./components/ServicesSection";
import { WhopCheckoutModal } from "./components/WhopCheckoutModal";
import { WhopPixelInspector } from "./components/WhopPixelInspector";
import {
  COMPANY_CONFIG,
  getPlanByKey,
  getPlanBySlug,
  type PlanKey,
  type ServiceKey,
} from "./config/company.config";
import { getRouteMeta, normalizeRoute, type AppRoute } from "./lib/routes";
import {
  clearTrackedEvents,
  ensureDevPixelShim,
  generateEventId,
  getTrackedEvents,
  PIXEL_EVENT_CHANNEL,
  trackCheckoutOrDepositStarted,
} from "./lib/whop-pixel";
import type {
  EstimateLeadResponse,
  FinalInvoiceRecord,
  RuntimeConfigResponse,
  SavedCardSummary,
  TrackedPixelEvent,
} from "./types/whop";

const DEFAULT_RUNTIME: RuntimeConfigResponse = {
  accountId: COMPANY_CONFIG.whop.defaultAccountId,
  productId: COMPANY_CONFIG.whop.defaultProductId,
  environment: "production",
  mode: "preview",
  isLiveConfigured: false,
  plans: {
    inspection: getPlanByKey("inspection").defaultPlanId,
    deposit: getPlanByKey("deposit").defaultPlanId,
    flat_rate: getPlanByKey("flat_rate").defaultPlanId,
  },
  finalBalancePlanId: "",
  webhookConfigured: false,
  invoiceAuthRequired: false,
};

function resolveInitialRoute(): AppRoute {
  if (typeof window === "undefined") return "/";
  const { pathname, hash } = window.location;
  if (pathname.startsWith("/checkout/") && pathname !== "/checkout/return") {
    return "/";
  }
  return normalizeRoute(pathname, hash);
}

export function App() {
  const [runtime, setRuntime] = useState<RuntimeConfigResponse>(DEFAULT_RUNTIME);
  const [activeRoute, setActiveRoute] = useState<AppRoute>(resolveInitialRoute);
  const [lastPageRoute, setLastPageRoute] = useState<AppRoute>(() => {
    const initial = resolveInitialRoute();
    return initial === "/checkout/return" ? "/" : initial;
  });
  const [checkoutState, setCheckoutState] = useState<{
    planKey: PlanKey;
    orderId: string;
  } | null>(null);

  const [savedCard, setSavedCard] = useState<SavedCardSummary | null>(null);
  const [latestMemberId, setLatestMemberId] = useState<string | null>(null);
  const [leads, setLeads] = useState<EstimateLeadResponse[]>([]);
  const [invoices, setInvoices] = useState<FinalInvoiceRecord[]>([]);
  const [prefilledService, setPrefilledService] = useState<string | null>(null);
  const [prefilledZip, setPrefilledZip] = useState<string | null>(null);
  const [legalTab, setLegalTab] = useState<LegalTab | null>(null);
  const [pixelEvents, setPixelEvents] = useState<TrackedPixelEvent[]>(() => getTrackedEvents());
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("inspector") === "1";
  });

  useEffect(() => {
    document.documentElement.style.setProperty("--brand-primary", COMPANY_CONFIG.brand.accentHex);
    document.documentElement.style.setProperty(
      "--brand-primary-hover",
      COMPANY_CONFIG.brand.accentHoverHex,
    );
    ensureDevPixelShim();
  }, []);

  useEffect(() => {
    if (activeRoute === "/") {
      document.title = `${COMPANY_CONFIG.brand.name} — Roof Replacement, Repair & Inspection`;
    } else if (activeRoute === "/checkout/return") {
      document.title = `Payment Status — ${COMPANY_CONFIG.brand.name}`;
    } else {
      const meta = getRouteMeta(activeRoute);
      document.title = `${meta.title} — ${COMPANY_CONFIG.brand.name}`;
    }
  }, [activeRoute]);

  useEffect(() => {
    function handleEvent() {
      setPixelEvents(getTrackedEvents());
    }
    window.addEventListener(PIXEL_EVENT_CHANNEL, handleEvent);
    return () => window.removeEventListener(PIXEL_EVENT_CHANNEL, handleEvent);
  }, []);

  useEffect(() => {
    fetch("/api/config")
      .then((res) => (res.ok ? res.json() : null))
      .then((cfg: RuntimeConfigResponse | null) => {
        if (cfg) setRuntime(cfg);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function syncFromLocation() {
      const currentPath = window.location.pathname;
      const currentHash = window.location.hash;

      if (currentPath.startsWith("/checkout/") && currentPath !== "/checkout/return") {
        const slug = currentPath.replace("/checkout/", "").split("/")[0];
        const plan = getPlanBySlug(slug);
        if (plan) {
          const orderId = generateEventId("ord");
          setCheckoutState({ planKey: plan.key, orderId });
          return;
        }
      }

      const normalized = normalizeRoute(currentPath, currentHash);
      setCheckoutState(null);
      setActiveRoute(normalized);
      if (normalized !== "/checkout/return") {
        setLastPageRoute(normalized);
      }

      if (currentHash && normalized !== "/" && currentPath === "/") {
        window.history.replaceState({}, "", normalized);
      }
    }

    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, []);

  const navigateRoute = useCallback(
    (route: AppRoute) => {
      setCheckoutState(null);
      setActiveRoute(route);
      if (route !== "/checkout/return") {
        setLastPageRoute(route);
      }

      if (typeof window !== "undefined") {
        if (window.location.pathname !== route || window.location.hash) {
          window.history.pushState({}, "", route);
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [],
  );

  const openCheckout = useCallback(
    (planKey: PlanKey) => {
      const plan = getPlanByKey(planKey);
      const orderId = generateEventId("ord");
      setCheckoutState({ planKey, orderId });

      if (typeof window !== "undefined") {
        if (!window.location.pathname.startsWith("/checkout/")) {
          setLastPageRoute(normalizeRoute(window.location.pathname, window.location.hash));
        }
        window.history.pushState({}, "", `/checkout/${plan.slug}`);
      }

      trackCheckoutOrDepositStarted({
        planKey: plan.key,
        planName: plan.name,
        variantId: runtime.plans[plan.key] || undefined,
        productId: runtime.productId || undefined,
        value: plan.price,
        savesCardOnFile: plan.savesCardOnFile,
        orderId,
      });
    },
    [runtime.plans, runtime.productId],
  );

  const closeCheckout = useCallback(() => {
    setCheckoutState(null);
    const targetRoute = lastPageRoute === "/checkout/return" ? "/" : lastPageRoute;
    setActiveRoute(targetRoute);
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/checkout")) {
      window.history.pushState({}, "", targetRoute);
    }
  }, [lastPageRoute]);

  const handleRequestEstimateForService = useCallback(
    (serviceKey: ServiceKey) => {
      setPrefilledService(serviceKey);
      navigateRoute("/estimate");
    },
    [navigateRoute],
  );

  const handlePrefillEstimateZip = useCallback(
    (zip: string) => {
      setPrefilledZip(zip);
      navigateRoute("/estimate");
    },
    [navigateRoute],
  );

  const handleSavedCard = useCallback((card: SavedCardSummary) => {
    setSavedCard(card);
    if (card.memberId) setLatestMemberId(card.memberId);
  }, []);

  const isReturnPage = activeRoute === "/checkout/return";

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface-page)] text-[var(--text-primary)]">
      <Navbar
        currentRoute={activeRoute}
        onOpenCheckout={openCheckout}
        onNavigateRoute={navigateRoute}
        hasSavedCard={Boolean(savedCard)}
      />

      {isReturnPage ? (
        <CheckoutReturnView
          onBackToSite={() => navigateRoute("/")}
          onJumpToInvoice={() => navigateRoute("/invoice")}
          onSavedCard={handleSavedCard}
        />
      ) : (
        <main className="flex-1">
          {activeRoute === "/" && (
            <>
              <HeroSection onOpenCheckout={openCheckout} onNavigateRoute={navigateRoute} />
              <HomeOverviewSection
                runtime={runtime}
                onNavigateRoute={navigateRoute}
                onOpenCheckout={openCheckout}
              />
            </>
          )}

          {activeRoute !== "/" && (
            <PageHeaderBar
              route={activeRoute}
              onNavigateRoute={navigateRoute}
              onOpenCheckout={openCheckout}
            />
          )}

          {activeRoute === "/services" && (
            <ServicesSection
              runtime={runtime}
              onOpenCheckout={openCheckout}
              onRequestEstimateForService={handleRequestEstimateForService}
            />
          )}

          {activeRoute === "/pricing" && (
            <PlansSection runtime={runtime} onOpenCheckout={openCheckout} />
          )}

          {activeRoute === "/financing" && (
            <FinancingSection onOpenCheckout={openCheckout} onNavigateRoute={navigateRoute} />
          )}

          {activeRoute === "/invoice" && (
            <InvoiceWorkflowSection
              runtime={runtime}
              savedCard={savedCard}
              latestMemberId={latestMemberId}
              onOpenCheckout={openCheckout}
              onInvoiceCreated={(inv) => setInvoices((prev) => [inv, ...prev])}
            />
          )}

          {activeRoute === "/service-area" && (
            <ServiceAreaSection
              onOpenCheckout={openCheckout}
              onPrefillEstimateZip={handlePrefillEstimateZip}
            />
          )}

          {activeRoute === "/reviews" && <ReviewsTrustSection />}

          {activeRoute === "/estimate" && (
            <EstimateContactSection
              runtime={runtime}
              prefilledService={prefilledService}
              prefilledZip={prefilledZip}
              onOpenCheckout={openCheckout}
              onLeadCreated={(lead) => {
                setLeads((prev) => [lead, ...prev]);
                if (lead.memberId) setLatestMemberId(lead.memberId);
              }}
            />
          )}
        </main>
      )}

      <Footer
        onOpenCheckout={openCheckout}
        onNavigateRoute={navigateRoute}
        onOpenLegal={(tab) => setLegalTab(tab)}
        onToggleInspector={() => setInspectorOpen((v) => !v)}
        pixelEventCount={pixelEvents.length}
      />

      {legalTab && (
        <LegalModal
          activeTab={legalTab}
          onSelectTab={setLegalTab}
          onClose={() => setLegalTab(null)}
        />
      )}

      {checkoutState && (
        <WhopCheckoutModal
          planKey={checkoutState.planKey}
          orderId={checkoutState.orderId}
          runtime={runtime}
          onClose={closeCheckout}
          onSelectPlan={openCheckout}
          onCheckoutSuccess={(res) => {
            if (res.savedCard) setSavedCard(res.savedCard);
            if (res.memberId) setLatestMemberId(res.memberId);
          }}
          onJumpToInvoice={() => navigateRoute("/invoice")}
        />
      )}

      <WhopPixelInspector
        open={inspectorOpen}
        onToggle={() => setInspectorOpen((v) => !v)}
        events={pixelEvents}
        onClear={clearTrackedEvents}
        runtime={runtime}
        savedCard={savedCard}
        latestLead={leads[0] ?? null}
        latestInvoice={invoices[0] ?? null}
      />
    </div>
  );
}
