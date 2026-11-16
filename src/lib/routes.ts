export type AppRoute =
  | "/"
  | "/services"
  | "/pricing"
  | "/financing"
  | "/invoice"
  | "/service-area"
  | "/reviews"
  | "/estimate"
  | "/checkout/return";

export interface RouteMeta {
  route: Exclude<AppRoute, "/checkout/return">;
  label: string;
  title: string;
  eyebrow: string;
  description: string;
}

export const SITE_ROUTES: RouteMeta[] = [
  {
    route: "/",
    label: "Home",
    title: "Home",
    eyebrow: "Overview",
    description: "Residential and light commercial roofing across Central Texas, hosted and billed on Whop.",
  },
  {
    route: "/services",
    label: "Services",
    title: "Roofing Services",
    eyebrow: "01 · Scope & warranties",
    description: "21-point drone inspections, storm & flashing repairs, and Class 4 roof replacements.",
  },
  {
    route: "/pricing",
    label: "Pricing",
    title: "Online Plans & Deposits",
    eyebrow: "02 · Whop checkout",
    description: "Fixed-fee inspection, $500 project deposit with card-on-file, and flat-rate roof tune-up.",
  },
  {
    route: "/financing",
    label: "Financing",
    title: "Monthly Financing",
    eyebrow: "03 · Payment estimator",
    description: "Calculate monthly payments across Klarna, Splitit, and Afterpay after deposit credits.",
  },
  {
    route: "/invoice",
    label: "Final invoice",
    title: "Final Balance Invoice",
    eyebrow: "04 · Whop Invoices API",
    description: "Auto-charge a vaulted card on file or email a hosted invoice link after final walkthrough.",
  },
  {
    route: "/service-area",
    label: "Service area",
    title: "Service Area & ZIP Check",
    eyebrow: "05 · Central Texas dispatch",
    description: "Check 65-mile dispatch coverage by ZIP code and county arrival windows.",
  },
  {
    route: "/reviews",
    label: "Reviews",
    title: "Reviews & Credentials",
    eyebrow: "06 · Certifications",
    description: "Manufacturer certifications, licensing details, and completed homeowner projects.",
  },
  {
    route: "/estimate",
    label: "Estimate",
    title: "Request an Estimate",
    eyebrow: "07 · Whop Leads API",
    description: "Submit roof material, urgency, and insurance details for a written quote and FAQ answers.",
  },
];

const HASH_TO_ROUTE: Record<string, AppRoute> = {
  "#top": "/",
  "#services": "/services",
  "#pricing": "/pricing",
  "#financing": "/financing",
  "#invoice-flow": "/invoice",
  "#invoice": "/invoice",
  "#service-area": "/service-area",
  "#reviews": "/reviews",
  "#estimate": "/estimate",
  "#contact": "/estimate",
};

const PATH_ALIASES: Record<string, AppRoute> = {
  "/": "/",
  "/services": "/services",
  "/pricing": "/pricing",
  "/plans": "/pricing",
  "/financing": "/financing",
  "/invoice": "/invoice",
  "/invoices": "/invoice",
  "/invoice-flow": "/invoice",
  "/service-area": "/service-area",
  "/reviews": "/reviews",
  "/estimate": "/estimate",
  "/contact": "/estimate",
  "/checkout/return": "/checkout/return",
};

export function normalizeRoute(pathname: string, hash = ""): AppRoute {
  const cleanPath = pathname.replace(/\/+$/, "") || "/";
  if (cleanPath === "/" && hash && HASH_TO_ROUTE[hash.toLowerCase()]) {
    return HASH_TO_ROUTE[hash.toLowerCase()];
  }
  return PATH_ALIASES[cleanPath] ?? "/";
}

export function getRouteMeta(route: AppRoute): RouteMeta {
  return SITE_ROUTES.find((item) => item.route === route) ?? SITE_ROUTES[0];
}
