import { useCallback, useEffect, useState } from "react";
import { CheckoutReturnView } from "./components/CheckoutReturnView";
import { EstimateContactSection } from "./components/EstimateContactSection";
import { FinancingSection } from "./components/FinancingSection";
import { Footer } from "./components/Footer";
import { HeroSection } from "./components/HeroSection";
import { InvoiceWorkflowSection } from "./components/InvoiceWorkflowSection";
import { LegalModal, type LegalTab } from "./components/LegalModal";
import { Navbar } from "./components/Navbar";
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

export function App() {
  const [runtime, setRuntime] = useState<RuntimeConfigResponse>(DEFAULT_RUNTIME);
  const [pathname, setPathname] = useState<string>(() =>
    typeof window !== "undefined" ? window.location.pathname : "/",
  );
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
    document.title = `${COMPANY_CONFIG.brand.name} — Roof Replacement, Repair & Inspection`;
    ensureDevPixelShim();
  }, []);

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
      setPathname(currentPath);

      if (currentPath.startsWith("/checkout/") && currentPath !== "/checkout/return") {
        const slug = currentPath.replace("/checkout/", "").split("/")[0];
        const plan = getPlanBySlug(slug);
        if (plan) {
          const orderId = generateEventId("ord");
          setCheckoutState({ planKey: plan.key, orderId });
        }
      }
    }

    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, []);

  const openCheckout = useCallback(
    (planKey: PlanKey) => {
      const plan = getPlanByKey(planKey);
      const orderId = generateEventId("ord");
      setCheckoutState({ planKey, orderId });

      if (typeof window !== "undefined") {
        window.history.pushState({}, "", `/checkout/${plan.slug}`);
        setPathname(`/checkout/${plan.slug}`);
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
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/checkout")) {
      window.history.pushState({}, "", "/");
      setPathname("/");
    }
  }, []);

  const navigateSection = useCallback((sectionId: string) => {
    setCheckoutState(null);
    if (typeof window !== "undefined" && window.location.pathname !== "/") {
      window.history.pushState({}, "", "/");
      setPathname("/");
    }
    requestAnimationFrame(() => {
      if (sectionId === "top") {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }, []);

  const handleRequestEstimateForService = useCallback(
    (serviceKey: ServiceKey) => {
      setPrefilledService(serviceKey);
      navigateSection("estimate");
    },
    [navigateSection],
  );

  const handlePrefillEstimateZip = useCallback(
    (zip: string) => {
      setPrefilledZip(zip);
      navigateSection("estimate");
    },
    [navigateSection],
  );

  const handleSavedCard = useCallback((card: SavedCardSummary) => {
    setSavedCard(card);
    if (card.memberId) setLatestMemberId(card.memberId);
  }, []);

  const isReturnPage = pathname === "/checkout/return";

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface-page)] text-[var(--text-primary)]">
      <Navbar
        onOpenCheckout={openCheckout}
        onNavigateSection={navigateSection}
        hasSavedCard={Boolean(savedCard)}
      />

      {isReturnPage ? (
        <CheckoutReturnView
          onBackToSite={() => navigateSection("top")}
          onJumpToInvoice={() => navigateSection("invoice-flow")}
          onSavedCard={handleSavedCard}
        />
      ) : (
        <main className="flex-1">
          <HeroSection onOpenCheckout={openCheckout} onNavigateSection={navigateSection} />

          <ServicesSection
            runtime={runtime}
            onOpenCheckout={openCheckout}
            onRequestEstimateForService={handleRequestEstimateForService}
          />

          <PlansSection runtime={runtime} onOpenCheckout={openCheckout} />

          <FinancingSection onOpenCheckout={openCheckout} onNavigateSection={navigateSection} />

          <InvoiceWorkflowSection
            runtime={runtime}
            savedCard={savedCard}
            latestMemberId={latestMemberId}
            onOpenCheckout={openCheckout}
            onInvoiceCreated={(inv) => setInvoices((prev) => [inv, ...prev])}
          />

          <ServiceAreaSection
            onOpenCheckout={openCheckout}
            onPrefillEstimateZip={handlePrefillEstimateZip}
          />

          <ReviewsTrustSection />

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
        </main>
      )}

      <Footer
        onOpenCheckout={openCheckout}
        onNavigateSection={navigateSection}
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
          onJumpToInvoice={() => navigateSection("invoice-flow")}
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
