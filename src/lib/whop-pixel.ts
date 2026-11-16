/**
 * Whop Pixel Tracking Utility (`window.whop.track`)
 * =================================================
 * Reference: https://docs.whop.com/developer/websites/tracking
 *
 * On Whop Websites (`*.whop.app` / `*.whop.site`), Whop automatically injects
 * `window.whop` before app scripts execute and records page views, checkout
 * views, and completed purchases automatically.
 *
 * This module fires custom & standard events via `window.whop.track(name, data)`
 * without ever overwriting Whop's platform pixel:
 *   - `service_viewed`      (required custom event)
 *   - `deposit_started`     (required custom event)
 *   - `estimate_requested`  (required custom event)
 *   - `final_invoice_created` (bonus high-ticket workflow event)
 *   - `financing_estimated`   (bonus financing interaction event)
 *   - Standard commerce companions (`view_content`, `initiate_checkout`, `lead`)
 *
 * Every call carries a unique `event_id` for deduplication and emits a browser
 * `whop:pixel-event` CustomEvent + structured console log so events are
 * immediately verifiable in Whop Pixel Dashboard, DevTools Network/Console,
 * and the optional live Demo Inspector drawer.
 */

import type { TrackedPixelEvent } from "../types/whop";

export interface WhopPixelGlobal {
  track: (eventName: string, params?: Record<string, unknown>) => void;
  __isLocalDevShim?: boolean;
}

declare global {
  interface Window {
    whop?: WhopPixelGlobal;
    __whopTrackedEvents?: TrackedPixelEvent[];
  }
}

export const PIXEL_EVENT_CHANNEL = "whop:pixel-event";

const eventHistory: TrackedPixelEvent[] = [];

export function generateEventId(prefix = "evt"): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

/**
 * Ensures `window.whop.track` is also callable directly from the browser console
 * when developing locally outside `*.whop.app` / `*.whop.site`. Never touches
 * the real Whop pixel when injected by Whop Websites hosting.
 */
export function ensureDevPixelShim(): void {
  if (typeof window === "undefined") return;
  window.__whopTrackedEvents = eventHistory;

  if (typeof window.whop?.track === "function") {
    return;
  }

  // Only install fallback shim on non-Whop local/preview hosts after DOM load
  const host = window.location.hostname;
  const isHostedOnWhop =
    host.endsWith(".whop.app") ||
    host.endsWith(".whop.site") ||
    host === "whop.com" ||
    host.endsWith(".whop.com");

  if (!isHostedOnWhop) {
    window.whop = {
      __isLocalDevShim: true,
      track(eventName: string, params: Record<string, unknown> = {}) {
        console.debug("[whop.track local-shim]", eventName, params);
      },
    };
  }
}

export function isNativeWhopPixelActive(): boolean {
  if (typeof window === "undefined") return false;
  return typeof window.whop?.track === "function" && !window.whop.__isLocalDevShim;
}

export function trackWhopEvent(
  eventName: string,
  params: Record<string, unknown> = {},
): TrackedPixelEvent {
  const eventId =
    typeof params.event_id === "string" && params.event_id.length > 0
      ? params.event_id
      : generateEventId(eventName);

  const payload: Record<string, unknown> = {
    ...params,
    event_id: eventId,
  };

  let deliveredToWhopPixel = false;

  if (typeof window !== "undefined") {
    try {
      if (typeof window.whop?.track === "function") {
        window.whop.track(eventName, payload);
        deliveredToWhopPixel = !window.whop.__isLocalDevShim;
      }
    } catch (err) {
      console.warn(`[whop.track] Failed firing "${eventName}":`, err);
    }
  }

  const record: TrackedPixelEvent = {
    id: eventId,
    name: eventName,
    payload,
    timestamp: new Date().toISOString(),
    deliveredToWhopPixel,
  };

  eventHistory.unshift(record);
  if (eventHistory.length > 50) {
    eventHistory.length = 50;
  }

  if (typeof window !== "undefined") {
    window.__whopTrackedEvents = eventHistory;
    console.info(
      `%c[whop.track]%c ${eventName}`,
      "background:#C84B1F;color:#fff;padding:2px 6px;border-radius:4px;font-weight:700;",
      "color:#12161D;font-weight:600;",
      payload,
    );
    window.dispatchEvent(new CustomEvent<TrackedPixelEvent>(PIXEL_EVENT_CHANNEL, { detail: record }));
  }

  return record;
}

/**
 * Required custom event #1: `service_viewed`
 * Also sends Whop's standard `view_content` product attribution signal when
 * real `prod_` and `plan_` IDs are configured.
 */
export function trackServiceViewed(args: {
  serviceKey: string;
  serviceName: string;
  planKey: string;
  variantId?: string;
  productId?: string;
  value: number;
  source?: string;
}): TrackedPixelEvent {
  const event = trackWhopEvent("service_viewed", {
    service_id: args.serviceKey,
    service_name: args.serviceName,
    plan_key: args.planKey,
    ...(args.variantId ? { variant_id: args.variantId } : {}),
    ...(args.productId ? { product_id: args.productId } : {}),
    value: args.value,
    currency: "USD",
    source: args.source ?? "services_section",
  });

  if (args.variantId?.startsWith("plan_") && typeof window !== "undefined") {
    try {
      window.whop?.track("view_content", {
        variant_id: args.variantId,
        ...(args.productId?.startsWith("prod_") ? { product_id: args.productId } : {}),
        value: args.value,
        currency: "USD",
      });
    } catch {
      // Ignore secondary commerce signal failure
    }
  }

  return event;
}

/**
 * Required custom event #2: `deposit_started`
 * Fires when a homeowner opens the $500 Project Deposit / SetupIntent flow
 * (and sends `initiate_checkout` for any plan opening Whop Checkout).
 */
export function trackCheckoutOrDepositStarted(args: {
  planKey: string;
  planName: string;
  variantId?: string;
  productId?: string;
  value: number;
  savesCardOnFile: boolean;
  orderId: string;
}): TrackedPixelEvent | null {
  let primary: TrackedPixelEvent | null = null;

  if (args.planKey === "deposit" || args.savesCardOnFile) {
    primary = trackWhopEvent("deposit_started", {
      event_id: `dep_${args.orderId}`,
      plan_key: args.planKey,
      plan_name: args.planName,
      ...(args.variantId ? { variant_id: args.variantId } : {}),
      ...(args.productId ? { product_id: args.productId } : {}),
      value: args.value,
      currency: "USD",
      card_on_file: true,
    });
  }

  const checkoutPayload: Record<string, unknown> = {
    event_id: `chk_${args.orderId}`,
    plan_key: args.planKey,
    plan_name: args.planName,
    ...(args.variantId?.startsWith("plan_") ? { variant_id: args.variantId } : {}),
    ...(args.productId?.startsWith("prod_") ? { product_id: args.productId } : {}),
    value: args.value,
    currency: "USD",
  };

  if (!primary) {
    primary = trackWhopEvent("initiate_checkout", checkoutPayload);
  } else if (typeof window !== "undefined") {
    try {
      window.whop?.track("initiate_checkout", checkoutPayload);
    } catch {
      // Ignore secondary commerce signal failure
    }
  }

  return primary;
}

/**
 * Required custom event #3: `estimate_requested`
 * Fires once the "Request an Estimate" lead succeeds via POST /api/leads.
 * Uses the same `event_id` sent to the server for CAPI deduplication.
 */
export function trackEstimateRequested(args: {
  eventId: string;
  leadId: string;
  serviceType: string;
  roofMaterial: string;
  urgency: string;
  zip: string;
  insuranceClaim: boolean;
  value: number;
}): TrackedPixelEvent {
  const event = trackWhopEvent("estimate_requested", {
    event_id: args.eventId,
    lead_id: args.leadId,
    service_type: args.serviceType,
    roof_material: args.roofMaterial,
    urgency: args.urgency,
    postal_code: args.zip,
    insurance_claim: args.insuranceClaim,
    value: args.value,
    currency: "USD",
  });

  // Also emit Whop's standard `lead` conversion event with a linked ID for Ads ROAS reporting
  if (typeof window !== "undefined") {
    try {
      window.whop?.track("lead", {
        event_id: `lead_${args.eventId}`,
        value: args.value,
        currency: "USD",
      });
    } catch {
      // Ignore secondary signal failure
    }
  }

  return event;
}

export function getTrackedEvents(): TrackedPixelEvent[] {
  return [...eventHistory];
}

export function clearTrackedEvents(): void {
  eventHistory.length = 0;
  if (typeof window !== "undefined") {
    window.__whopTrackedEvents = eventHistory;
    window.dispatchEvent(new CustomEvent(PIXEL_EVENT_CHANNEL));
  }
}

/**
 * Returns the four `data-whop-*` product tracking attributes documented at
 * https://docs.whop.com/developer/websites/tracking#track-products-and-carts
 */
export function whopProductDataAttrs(args: {
  productId?: string;
  variantId?: string;
  price: number;
  currency?: string;
}): Record<string, string> {
  return {
    "data-whop-product-id": args.productId || "prod_unconfigured",
    "data-whop-variant-id": args.variantId || "plan_unconfigured",
    "data-whop-price": String(args.price),
    "data-whop-currency": (args.currency ?? "USD").toUpperCase(),
  };
}
