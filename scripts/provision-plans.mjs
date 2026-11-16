#!/usr/bin/env node
/**
 * Whop Roofing Catalog Provisioner (`scripts/provision-plans.mjs`)
 * ================================================================
 * Creates the roofing Product and all three required one-time Whop Plans
 * (variants) on your Whop business account (Sandbox or Production):
 *
 *   1. $149 — 21-Point Drone & Attic Inspection   (WHOP_PLAN_INSPECTION)
 *   2. $500 — Project Deposit & Crew Lock         (WHOP_PLAN_DEPOSIT)
 *   3. $349 — Whole-Roof Flashing & Gutter Tune-Up (WHOP_PLAN_FLAT_RATE)
 *
 * Usage:
 *   # Sandbox (for test checkout with 4242 4242 4242 4242):
 *   WHOP_ENVIRONMENT=sandbox WHOP_ACCOUNT_ID=biz_xxx WHOP_API_KEY=apik_xxx npm run whop:provision
 *
 *   # Production (live merchant catalog):
 *   WHOP_ENVIRONMENT=production WHOP_ACCOUNT_ID=biz_xxx WHOP_API_KEY=apik_xxx npm run whop:provision
 *
 *   # Optional flags:
 *   --apply-secrets    Automatically push generated IDs into `whop apps secrets set`
 *   --write-dev-vars   Write generated IDs into local `.dev.vars` (gitignored)
 */

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { WhopClient } from "@whop/sdk";

const args = new Set(process.argv.slice(2));
const applySecrets = args.has("--apply-secrets");
const writeDevVars = args.has("--write-dev-vars");

const environment =
  (process.env.WHOP_ENVIRONMENT || "production").toLowerCase() === "sandbox"
    ? "sandbox"
    : "production";
const accountId = (process.env.WHOP_ACCOUNT_ID || "").trim();
const apiKey = (process.env.WHOP_API_KEY || "").trim();
const companyName = (process.env.COMPANY_NAME || "RidgeLine Roofing & Exteriors").trim();

if (!accountId.startsWith("biz_") || !apiKey) {
  console.error(
    [
      "Missing required environment variables: WHOP_ACCOUNT_ID (biz_xxx) and WHOP_API_KEY.",
      "",
      "Example (Sandbox):",
      "  WHOP_ENVIRONMENT=sandbox WHOP_ACCOUNT_ID=biz_xxx WHOP_API_KEY=apik_xxx npm run whop:provision",
      "",
      "Example (Production):",
      "  WHOP_ENVIRONMENT=production WHOP_ACCOUNT_ID=biz_xxx WHOP_API_KEY=apik_xxx npm run whop:provision -- --apply-secrets",
    ].join("\n"),
  );
  process.exit(1);
}

const baseUrl =
  environment === "sandbox"
    ? "https://sandbox-api.whop.com/api/v1"
    : "https://api.whop.com/api/v1";

const client = new WhopClient({ token: apiKey, baseUrl });

const REQUIRED_PLANS = [
  {
    envKey: "WHOP_PLAN_INSPECTION",
    marker: "plan_key:inspection",
    title: "21-Point Roof Inspection", // <= 30 chars (Whop variant title limit)
    description:
      "Certified 60-minute roof & attic inspection with 4K drone imagery, thermal scan, and written estimate. 100% credited toward any roofing project.",
    price: Number(process.env.INSPECTION_PRICE || 149),
  },
  {
    envKey: "WHOP_PLAN_DEPOSIT",
    marker: "plan_key:deposit",
    title: "Roofing Project Deposit", // <= 30 chars (Whop variant title limit)
    description:
      "Locks crew installation date, municipal permitting, and shingle material delivery. Deducted from final contract invoice; vaults card on file via Setup Intent.",
    price: Number(process.env.DEPOSIT_PRICE || 500),
  },
  {
    envKey: "WHOP_PLAN_FLAT_RATE",
    marker: "plan_key:flat_rate",
    title: "Roof & Gutter Tune-Up", // <= 30 chars (Whop variant title limit)
    description:
      "All-inclusive flat-rate service: replace up to 10 damaged shingles, reseal pipe boots & chimney flashing, and flush up to 200 LF of gutters.",
    price: Number(process.env.FLAT_RATE_PRICE || 349),
  },
];

async function main() {
  console.log(`\nProvisioning Whop roofing catalog in [${environment.toUpperCase()}] for ${accountId}…\n`);

  // 1. Reuse or create the Roofing Services product
  const productTitle = `${companyName} — Services & Deposits`;
  let productId = (process.env.WHOP_PRODUCT_ID || "").trim();

  if (!productId) {
    const existingProducts = await client.products.list({ account_id: accountId, first: 50 });
    const list = existingProducts?.data ?? [];
    const found = list.find(
      (p) => typeof p.title === "string" && p.title.toLowerCase() === productTitle.toLowerCase(),
    );
    if (found?.id) {
      productId = found.id;
      console.log(`✓ Reusing existing Product: ${productId} (${productTitle})`);
    } else {
      const created = await client.products.create({
        account_id: accountId,
        title: productTitle.slice(0, 80),
        headline: "Certified US Roofing Inspections, Deposits & Flat-Rate Services",
        description:
          "Online booking plans for certified drone roof inspections, high-ticket project deposits, flat-rate roof maintenance, and final balance invoices.",
        visibility: "visible",
      });
      productId = created.id;
      console.log(`✓ Created Product:          ${productId} (${productTitle})`);
    }
  }

  // 2. Reuse or create all 3 required one-time plans
  const existingVariantsPage = await client.variants.list({
    account_id: accountId,
    product_ids: [productId],
    first: 50,
  });
  const existingVariants = existingVariantsPage?.data ?? [];

  const createdIds = {
    WHOP_ENVIRONMENT: environment,
    WHOP_ACCOUNT_ID: accountId,
    WHOP_PRODUCT_ID: productId,
  };

  for (const spec of REQUIRED_PLANS) {
    const existing = existingVariants.find((v) =>
      `${v.internal_notes ?? ""} ${v.title ?? ""}`.includes(spec.marker),
    );
    if (existing?.id) {
      createdIds[spec.envKey] = existing.id;
      console.log(`✓ Reusing ${spec.envKey.padEnd(22)} ${existing.id} ($${spec.price})`);
      continue;
    }

    const variant = await client.variants.create({
      account_id: accountId,
      product_id: productId,
      title: spec.title.slice(0, 30),
      description: spec.description,
      billing_type: "one_time",
      currency: "usd",
      initial_price: spec.price,
      visibility: "visible",
      internal_notes: spec.marker,
    });

    createdIds[spec.envKey] = variant.id;
    console.log(
      `✓ Created ${spec.envKey.padEnd(22)} ${variant.id} ($${spec.price}) → ${variant.purchase_url ?? "ready"}`,
    );
  }

  // 3. Optional local .dev.vars output (gitignored)
  if (writeDevVars) {
    const lines = [
      ...Object.entries(createdIds).map(([k, v]) => `${k}=${v}`),
      `WHOP_API_KEY=${apiKey}`,
      "",
    ];
    writeFileSync(".dev.vars", lines.join("\n"), { mode: 0o600 });
    console.log("\n✓ Wrote gitignored .dev.vars for local development.");
  }

  // 4. Optional push into Whop Website runtime secrets
  if (applySecrets) {
    console.log("\nApplying runtime bindings via `whop apps secrets set`…");
    const secretsToPush = { ...createdIds };
    if (environment === "sandbox") {
      // Use dedicated WHOP_SANDBOX_* secret names so they never collide with
      // Whop Hosting's reserved production WHOP_ACCOUNT_ID binding.
      delete secretsToPush.WHOP_ACCOUNT_ID;
      secretsToPush.WHOP_SANDBOX_ACCOUNT_ID = accountId;
      secretsToPush.WHOP_SANDBOX_API_KEY = apiKey;
    } else {
      // WHOP_ACCOUNT_ID is reserved & automatically set on production hosting
      delete secretsToPush.WHOP_ACCOUNT_ID;
    }

    for (const [key, value] of Object.entries(secretsToPush)) {
      execFileSync("npx", ["whop", "apps", "secrets", "set", "--secret", `${key}=${value}`], {
        stdio: "inherit",
      });
    }
    console.log("✓ Secrets synced to linked Whop Website app.");
  } else {
    console.log("\nBind these IDs to your Whop Website app:");
    for (const [key, value] of Object.entries(createdIds)) {
      if (environment === "production" && key === "WHOP_ACCOUNT_ID") continue;
      console.log(`  npx whop apps secrets set --secret ${key}=${value}`);
    }
    if (environment === "sandbox") {
      console.log('  npx whop apps secrets set --secret WHOP_API_KEY="$WHOP_API_KEY"');
    }
    console.log("\nThen deploy live:\n  npm run deploy\n");
  }
}

main().catch((err) => {
  console.error("\nProvisioning failed:", err?.body ?? err?.message ?? err);
  process.exit(1);
});
