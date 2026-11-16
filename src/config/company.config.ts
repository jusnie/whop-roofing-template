/**
 * SINGLE-FILE ROOFING CONTRACTOR TEMPLATE CONFIGURATION
 * =====================================================
 * Swap company name, service area, services, plan pricing, financing terms,
 * customer projects, credentials, and colors in this one file. Every component
 * and Worker route reads from `COMPANY_CONFIG` without structural changes.
 */

export type PlanKey = "inspection" | "deposit" | "flat_rate";
export type ServiceKey = "inspection" | "repair" | "replacement";

export interface RoofingPlanConfig {
  key: PlanKey;
  slug: string;
  name: string;
  shortName: string;
  badge: string;
  price: number;
  currency: "USD";
  billingType: "one_time";
  priceNote: string;
  description: string;
  deliverables: string[];
  ctaLabel: string;
  savesCardOnFile: boolean;
  featured?: boolean;
  turnaround: string;
  /** Env var name containing the live Whop plan ID (`plan_xxxxxxxx`) */
  envVarName: "WHOP_PLAN_INSPECTION" | "WHOP_PLAN_DEPOSIT" | "WHOP_PLAN_FLAT_RATE";
  /** Optional fallback plan ID if hardcoded instead of stored in env */
  defaultPlanId: string;
}

export interface RoofingServiceConfig {
  key: ServiceKey;
  title: string;
  eyebrow: string;
  tagline: string;
  description: string;
  image: string;
  imageAlt: string;
  priceRangeLabel: string;
  warranty: string;
  timeline: string;
  highlights: string[];
  idealFor: string[];
  linkedPlanKey: PlanKey;
  primaryCta: string;
}

export interface ServiceCountyConfig {
  county: string;
  cities: string[];
  zipPrefixes: string[];
  exactZips: string[];
  responseTime: string;
}

export interface CustomerReviewConfig {
  id: string;
  author: string;
  neighborhood: string;
  cityState: string;
  date: string;
  projectType: string;
  projectAmount: string;
  quote: string;
  paidVia: string;
}

export interface InvoiceLineItemTemplate {
  id: string;
  label: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export const COMPANY_CONFIG = {
  brand: {
    name: "RidgeLine Roofing & Exteriors",
    shortName: "RidgeLine",
    tagline: "Architectural shingle and standing-seam roofs across Central Texas",
    heroHeadline: "Architectural shingle and metal roofs built for Texas weather",
    heroSubheadline:
      "Book a credited drone inspection, lock your installation date with a $500 deposit, and settle the remaining contract balance after the final walkthrough",
    foundedYear: 2014,
    accentHex: "#B8431B",
    accentHoverHex: "#9E3816",
    /** Whop Elements theme accent token */
    whopAccentColor: "tomato" as const,
    heroImage: "/images/hero-roofing.jpg",
    heroImageAlt:
      "Limestone and cedar Texas home with charcoal architectural shingle roof and standing-seam bronze porch roof at late afternoon light",
  },

  contact: {
    phone: "(512) 555-0194",
    phoneHref: "tel:+15125550194",
    emergencyPhone: "(512) 555-0199",
    email: "estimates@ridgelineroofing.example",
    streetAddress: "4820 Burnet Rd, Suite 210",
    city: "Austin",
    state: "TX",
    zip: "78756",
    hours: "Mon–Sat 7:00 AM – 7:00 PM",
    emergencyNote: "24/7 emergency storm tarp dispatch",
    licenseNumber: "RCAT #03-084912",
    insuranceCoverage: "$2M general liability and workers' comp",
  },

  /** Verifiable contract figures only — no unverified aggregate review or job counts */
  stats: [
    { value: "$149", label: "Drone and attic inspection", sublabel: "Credited in full toward project" },
    { value: "$500", label: "Project deposit", sublabel: "Locks crew date and permit filing" },
    { value: "10 yr", label: "Workmanship warranty", sublabel: "Transferable once at home sale" },
    { value: "65 mi", label: "Dispatch radius", sublabel: "Six Central Texas counties" },
  ],

  whop: {
    defaultAccountId: "",
    defaultProductId: "",
    currency: "USD" as const,
  },

  services: [
    {
      key: "replacement" as const,
      title: "Full roof replacement",
      eyebrow: "Class 4 shingle and standing-seam metal",
      tagline:
        "Tear-off to bare decking, synthetic underlayment, ice-and-water barrier, and balanced ridge ventilation",
      description:
        "Every replacement includes deck inspection and rotted sheathing replacement, double-row valley protection, color-matched drip edge, new lead or neoprene pipe boots, and a two-pass magnetic nail sweep across driveways and beds. Reserve your crew date with a $500 deposit and pay the net balance after walkthrough.",
      image: "/images/service-replacement.jpg",
      imageAlt:
        "Harnessed roofing crew installing synthetic underlayment and charcoal architectural shingles on a pitched residence",
      priceRangeLabel: "$9,800 – $26,500",
      warranty: "50-year manufacturer material · 10-year workmanship",
      timeline: "1–2 days for most single-family homes",
      highlights: [
        "UL 2218 Class 4 impact-rated shingles",
        "24-gauge Kynar 500 standing-seam metal option",
        "City permit filing and HOA submittal packet",
        "$500 deposit locks crew date and material order",
      ],
      idealFor: [
        "Roofs 15–25 years old or widespread hail impact",
        "Homeowners upgrading to Class 4 hail protection",
        "Standing-seam metal and mixed porch roofs",
      ],
      linkedPlanKey: "deposit" as const,
      primaryCta: "Lock date · $500 deposit",
    },
    {
      key: "repair" as const,
      title: "Storm, leak, and flashing repair",
      eyebrow: "Targeted structural repair",
      tagline:
        "Same-week repair for wind-creased shingles, chimney counter-flashing, valleys, skylights, and pipe boots",
      description:
        "Active roof leaks rarely need a full tear-off. Our crews match existing shingle profiles and manufacturer color blends, step and reglet-cut new gauge metal chimney flashing into brick mortar, replace cracked pipe collars, and seal deck penetrations with documented before-and-after photos.",
      image: "/images/service-repair.jpg",
      imageAlt:
        "Matte black metal step flashing set cleanly into brick chimney mortar joints beside dark architectural shingles",
      priceRangeLabel: "$349 flat-rate tune-up",
      warranty: "5-year leak-free workmanship warranty",
      timeline: "Same-day emergency tarping · 24–72 hr repair",
      highlights: [
        "Color-matched architectural shingle replacement",
        "Reglet-cut chimney step and counter-flashing",
        "Neoprene and lead pipe boot replacement",
        "24/7 emergency storm tarping before rain",
      ],
      idealFor: [
        "Ceiling water stains after wind or hail",
        "Missing ridge caps or lifted shingle tabs",
        "Preventive whole-roof maintenance and gutter flush",
      ],
      linkedPlanKey: "flat_rate" as const,
      primaryCta: "Order tune-up · $349",
    },
    {
      key: "inspection" as const,
      title: "21-point drone and attic inspection",
      eyebrow: "Diagnostic report",
      tagline:
        "Aerial roof survey, attic moisture check, hail-bruise photo grid, and itemized repair scope in 24 hours",
      description:
        "A Haag-trained inspector photographs every slope, valley, ridge vent, pipe boot, and flashing joint, then checks attic decking and insulation with thermal imaging. You receive a signed PDF report suited for storm claims, real estate closings, or maintenance planning, and the $149 fee credits toward any contracted job within 90 days.",
      image: "/images/service-inspection.jpg",
      imageAlt:
        "Roofing inspector in hard hat and fall harness reviewing a slope measurement diagram on a tablet atop a residential roof",
      priceRangeLabel: "$149 one-time",
      warranty: "Credited in full toward any contract within 90 days",
      timeline: "60 minutes on site · PDF report within 24 hours",
      highlights: [
        "Slope-by-slope drone photography and hail chalk grid",
        "Attic moisture and thermal decking check",
        "Flashing, pipe boot, chimney, and skylight audit",
        "Claim-ready packet with line-item repair pricing",
      ],
      idealFor: [
        "Post-hail or high-wind damage verification",
        "Home buyers and pre-listing inspections",
        "Annual checkups on roofs over 10 years old",
      ],
      linkedPlanKey: "inspection" as const,
      primaryCta: "Book inspection · $149",
    },
  ] satisfies RoofingServiceConfig[],

  /**
   * THREE REQUIRED REAL WHOP PLANS
   * 1. One-time inspection fee ($149)
   * 2. Project deposit ($500) — saves card on file via Whop Setup Intent for final balance invoice
   * 3. Flat-rate service ($349) — whole-roof flashing, pipe boot & gutter tune-up
   */
  plans: [
    {
      key: "deposit" as const,
      slug: "project-deposit",
      name: "Project deposit and crew lock",
      shortName: "Project deposit",
      badge: "Deposit + card on file",
      price: 500,
      currency: "USD" as const,
      billingType: "one_time" as const,
      priceNote: "Deducted from final invoice · Card saved via Whop Setup Intent",
      description:
        "Secures your installation window, starts municipal permitting, and stages shingle and underlayment delivery. Saves your payment method on file so the remaining balance is billed only after final walkthrough sign-off.",
      deliverables: [
        "Reserved crew installation date on our calendar",
        "City permit filing and HOA architectural submittal",
        "Shingle, underlayment, and dumpster staging",
        "Card vaulted via Whop Setup Intent for post-job billing",
        "$500 deducted on your itemized final balance invoice",
      ],
      ctaLabel: "Pay $500 deposit",
      savesCardOnFile: true,
      featured: true,
      turnaround: "Locks install date",
      envVarName: "WHOP_PLAN_DEPOSIT" as const,
      defaultPlanId: "",
    },
    {
      key: "inspection" as const,
      slug: "roof-inspection",
      name: "21-point drone and attic inspection",
      shortName: "21-point inspection",
      badge: "Inspection fee",
      price: 149,
      currency: "USD" as const,
      billingType: "one_time" as const,
      priceNote: "Credited toward any repair or replacement within 90 days",
      description:
        "60-minute residential inspection covering shingles, flashing, valleys, gutters, vents, and attic moisture, with a signed photo report delivered in 24 hours.",
      deliverables: [
        "Annotated drone photography of every roof slope",
        "Thermal moisture and attic ventilation reading",
        "Insurance-compatible hail and wind assessment",
        "Written repair or replacement line-item scope",
      ],
      ctaLabel: "Book inspection · $149",
      savesCardOnFile: false,
      turnaround: "24–48 hr slot",
      envVarName: "WHOP_PLAN_INSPECTION" as const,
      defaultPlanId: "",
    },
    {
      key: "flat_rate" as const,
      slug: "roof-tune-up",
      name: "Whole-roof flashing and gutter tune-up",
      shortName: "Roof and gutter tune-up",
      badge: "Flat-rate service",
      price: 349,
      currency: "USD" as const,
      billingType: "one_time" as const,
      priceNote: "Fixed price for homes up to 3,200 sq ft",
      description:
        "Preventive service visit that seals common leak entry points, replaces damaged shingles and pipe boots, and clears gutters before storm season.",
      deliverables: [
        "Replace up to 10 wind-damaged or cracked shingles",
        "Reseal all pipe boots, vents, and chimney counter-flashing",
        "Re-drive popped nails and tighten loose ridge caps",
        "Clear and flush up to 200 linear feet of gutters",
      ],
      ctaLabel: "Order tune-up · $349",
      savesCardOnFile: false,
      turnaround: "Completed in 1 visit",
      envVarName: "WHOP_PLAN_FLAT_RATE" as const,
      defaultPlanId: "",
    },
  ] satisfies RoofingPlanConfig[],

  financing: {
    eyebrow: "Flexible monthly payments",
    headline: "Replace your roof now and split the balance over time",
    description:
      "Because deposits and final balance invoices run directly through Whop Payments, approved financing providers including Klarna, Splitit, and Afterpay surface automatically at checkout with no separate contractor paperwork.",
    defaultAmount: 12800,
    minAmount: 3500,
    maxAmount: 28000,
    step: 500,
    providers: [
      {
        name: "Klarna",
        termLabel: "Monthly financing up to 24 mo",
        months: 24,
        aprNote: "Terms set by provider",
        primary: true,
      },
      {
        name: "Splitit",
        termLabel: "12 monthly card installments",
        months: 12,
        aprNote: "Uses existing credit line",
        primary: false,
      },
      {
        name: "Afterpay",
        termLabel: "4 interest-free payments",
        months: 4,
        aprNote: "For inspections and repairs",
        primary: false,
      },
    ],
    benefits: [
      "Options appear automatically inside Whop checkout for approved merchants",
      "Works on deposits, flat-rate repairs, and final balance invoice links",
      "Apple Pay, Google Pay, cards, and US bank transfer accepted alongside BNPL",
    ],
    disclaimer:
      "Illustrative payment schedule shown before tax and provider terms. Actual eligibility, installment counts, and APR are presented inside Whop checkout by Klarna, Splitit, Afterpay, or participating providers.",
  },

  serviceArea: {
    regionName: "Greater Austin & Central Texas",
    headquartersCity: "Austin, TX",
    radiusMiles: 65,
    headline: "Local crews dispatched across six Central Texas counties",
    description:
      "Our trucks stage out of North Austin off Burnet Road, keeping inspection appointments within 48 hours and emergency storm tarping on site the same day across the Hill Country corridor.",
    counties: [
      {
        county: "Travis County",
        cities: ["Austin", "West Lake Hills", "Lakeway", "Pflugerville", "Bee Cave", "Manor"],
        zipPrefixes: ["787", "78660", "78653"],
        exactZips: ["78701", "78702", "78703", "78704", "78731", "78734", "78738", "78745", "78746", "78749", "78756", "78757", "78758", "78759", "78660"],
        responseTime: "Same day",
      },
      {
        county: "Williamson County",
        cities: ["Round Rock", "Cedar Park", "Georgetown", "Leander", "Hutto", "Liberty Hill"],
        zipPrefixes: ["78613", "78626", "78628", "78633", "78634", "78641", "78642", "78664", "78665", "78681"],
        exactZips: ["78613", "78626", "78628", "78634", "78641", "78664", "78665", "78681"],
        responseTime: "Same day",
      },
      {
        county: "Hays County",
        cities: ["Dripping Springs", "Buda", "Kyle", "San Marcos", "Wimberley"],
        zipPrefixes: ["78610", "78620", "78640", "78666", "78676"],
        exactZips: ["78610", "78620", "78640", "78666", "78676"],
        responseTime: "Within 24 hrs",
      },
      {
        county: "Bastrop County",
        cities: ["Bastrop", "Elgin", "Cedar Creek", "Smithville"],
        zipPrefixes: ["78602", "78612", "78621", "78957"],
        exactZips: ["78602", "78612", "78621", "78957"],
        responseTime: "Within 24 hrs",
      },
      {
        county: "Comal County",
        cities: ["New Braunfels", "Canyon Lake", "Bulverde"],
        zipPrefixes: ["78130", "78132", "78133", "78163"],
        exactZips: ["78130", "78132", "78133", "78163"],
        responseTime: "24–48 hrs",
      },
      {
        county: "Burnet County",
        cities: ["Marble Falls", "Burnet", "Horseshoe Bay", "Spicewood"],
        zipPrefixes: ["78611", "78654", "78657", "78669"],
        exactZips: ["78611", "78654", "78657", "78669"],
        responseTime: "24–48 hrs",
      },
    ] satisfies ServiceCountyConfig[],
  },

  reviews: {
    items: [
      {
        id: "rev-1",
        author: "Marcus & Elena Delgado",
        neighborhood: "Circle C Ranch",
        cityState: "Austin, TX",
        date: "October 2026",
        projectType: "28-square Class 4 shingle replacement",
        projectAmount: "$13,020",
        quote:
          "After the May hailstorm we booked the $149 drone inspection online, had a 26-photo packet for our adjuster the next morning, and locked our install date with the $500 deposit. The crew stripped and re-roofed the whole house in a day and a half, credited both payments on the final Whop invoice, and swept every nail out of the driveway before charging our balance.",
        paidVia: "$500 deposit + final invoice",
      },
      {
        id: "rev-2",
        author: "Hannah Whitaker",
        neighborhood: "Brushy Creek",
        cityState: "Round Rock, TX",
        date: "September 2026",
        projectType: "Standing-seam metal porch and main roof",
        projectAmount: "$19,200",
        quote:
          "Paid our $500 deposit with Apple Pay in under a minute, picked Klarna on the final invoice link, and received our registered warranty packet the same afternoon.",
        paidVia: "Apple Pay + Klarna",
      },
      {
        id: "rev-3",
        author: "Devon & Priya Patel",
        neighborhood: "Belterra",
        cityState: "Dripping Springs, TX",
        date: "August 2026",
        projectType: "Chimney counter-flashing and tune-up",
        projectAmount: "$349",
        quote:
          "Two companies tried to sell us a full replacement for a leak around the chimney. RidgeLine cut new black counter-flashing, replaced three cracked pipe boots, and flushed our gutters on the flat-rate visit.",
        paidVia: "Flat-rate checkout",
      },
    ] satisfies CustomerReviewConfig[],
  },

  certifications: [
    {
      title: "Platinum Preferred Contractor",
      issuer: "Owens Corning",
      detail: "Eligible to register extended system warranties",
    },
    {
      title: "Master Elite Certified",
      issuer: "GAF Residential",
      detail: "Factory-audited installation and flashing standards",
    },
    {
      title: "Licensed Texas Contractor",
      issuer: "RCAT #03-084912",
      detail: "$2M commercial general liability coverage",
    },
    {
      title: "Certified Roof Inspectors",
      issuer: "Haag Engineering",
      detail: "Forensic hail, wind, and slope assessment",
    },
  ],

  sampleCompletedJob: {
    jobNumber: "JOB-2026-0847",
    customerName: "Marcus Delgado",
    customerEmail: "marcus.delgado@example.com",
    propertyAddress: "6412 Escarpment Blvd, Austin, TX 78749",
    projectTitle: "Class 4 architectural roof replacement",
    roofSquares: 28,
    lineItems: [
      {
        id: "li-1",
        label: "Owens Corning Duration Storm Class 4 shingles (28 sq)",
        description: "Full tear-off, synthetic underlayment, drip edge, and starter strip",
        quantity: 28,
        unitPrice: 410,
      },
      {
        id: "li-2",
        label: "Ice-and-water valley shield and ridge vent system",
        description: "StormGuard valley membrane and 68 LF continuous ridge vent",
        quantity: 1,
        unitPrice: 980,
      },
      {
        id: "li-3",
        label: "CDX plywood decking replacement (4 sheets) and permit",
        description: "Replaced moisture-damaged north valley decking plus Austin permit",
        quantity: 1,
        unitPrice: 560,
      },
    ] satisfies InvoiceLineItemTemplate[],
    depositPaid: 500,
    inspectionCredit: 149,
    defaultMemo:
      "Thank you for choosing RidgeLine Roofing. Final magnet sweep and walkthrough signed off. Reflects $500 project deposit and $149 drone inspection credit. Includes 10-year workmanship warranty.",
  },

  estimateForm: {
    serviceOptions: [
      { value: "replacement", label: "Full roof replacement (shingle or metal)", estimatedValue: 13500 },
      { value: "repair", label: "Leak, flashing, or storm repair", estimatedValue: 1250 },
      { value: "inspection", label: "21-point drone and hail inspection", estimatedValue: 149 },
      { value: "tune_up", label: "Whole-roof flashing and gutter tune-up", estimatedValue: 349 },
      { value: "insurance", label: "Insurance hail or wind claim assessment", estimatedValue: 14800 },
    ],
    roofMaterials: [
      "Architectural asphalt shingle",
      "3-tab asphalt shingle",
      "Standing-seam metal",
      "Clay or concrete tile",
      "TPO or modified bitumen flat roof",
      "Not sure — inspect on site",
    ],
    urgencyOptions: [
      "Active leak or emergency tarp needed",
      "Within 1–2 weeks (recent storm)",
      "Planning within 30–60 days",
      "Comparing quotes and financing",
    ],
  },

  faqs: [
    {
      question: "How does deposit-to-final-invoice billing work?",
      answer:
        "You pay a $500 project deposit through Whop checkout to lock your installation date and permit filing. During checkout, a Whop Setup Intent stores your payment method on file. Once installation and the final walkthrough are signed off, we issue an itemized Whop invoice for the net balance — either charging your saved card or sending a hosted invoice link where you can pay by card, bank transfer, Apple Pay, or financing.",
    },
    {
      question: "Is the $149 drone inspection credited toward my roof?",
      answer:
        "Yes. If you move forward with a repair or full replacement within 90 days, the $149 inspection fee is deducted directly on your final contract invoice alongside your $500 deposit.",
    },
    {
      question: "How do Klarna, Splitit, and Afterpay work at checkout?",
      answer:
        "All payments and invoice links run through Whop Payments. Approved financing providers appear directly inside checkout alongside Apple Pay, Google Pay, cards, and US bank transfer, so you can compare monthly schedules before confirming.",
    },
    {
      question: "Do you provide documentation for hail and wind insurance claims?",
      answer:
        "Yes. Every inspection includes slope-by-slope drone photography, hail-bruise chalk counts, and line-item scope notes ready for your adjuster, and an inspector can meet your adjuster on site.",
    },
  ],
} as const;

export function getPlanByKey(key: PlanKey): RoofingPlanConfig {
  const plan = COMPANY_CONFIG.plans.find((p) => p.key === key);
  if (!plan) {
    throw new Error(`Unknown plan key: ${key}`);
  }
  return plan;
}

export function getPlanBySlug(slug: string): RoofingPlanConfig | undefined {
  return COMPANY_CONFIG.plans.find((p) => p.slug === slug || p.key === slug);
}

/** Single consistent currency format across the interface ($12,371, tabular-nums) */
export function formatUsd(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const isWhole = Number.isInteger(rounded);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: isWhole ? 0 : 2,
  }).format(rounded);
}
