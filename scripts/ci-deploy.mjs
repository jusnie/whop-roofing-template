#!/usr/bin/env node
/**
 * Phone / CI One-Tap Whop Website Deployer (`scripts/ci-deploy.mjs`)
 * ===================================================================
 * Runs unattended in GitHub Actions or GitHub Codespaces (no desktop needed):
 *   1. Reuses or creates a Whop Website app (`app_type: website`)
 *   2. Claims and attaches `<domain_slug>.whop.site`
 *   3. Provisions the Product + 3 required plans ($149, $500, $349) in Sandbox
 *      (if WHOP_SANDBOX_API_KEY + WHOP_SANDBOX_ACCOUNT_ID are set) or Production
 *   4. Syncs runtime secrets via `whop apps secrets set` (never logs secrets)
 *   5. Runs `whop apps deploy --app <app_id>` and writes a live URL summary
 */

import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { WhopClient } from "@whop/sdk";

const hostApiKey = (process.env.WHOP_API_KEY || "").trim();
const hostAccountId = (process.env.WHOP_ACCOUNT_ID || "").trim();
const sandboxApiKey = (process.env.WHOP_SANDBOX_API_KEY || "").trim();
const sandboxAccountId = (process.env.WHOP_SANDBOX_ACCOUNT_ID || "").trim();
const webhookSecret = (process.env.WHOP_WEBHOOK_SECRET || "").trim();
const adminKey = (process.env.WHOP_ADMIN_KEY || "").trim();

const appName = (process.env.APP_NAME || "RidgeLine Roofing").trim();
const rawDomain = (process.env.DOMAIN_SLUG || "ridgeline-roofing")
  .trim()
  .toLowerCase()
  .replace(/^https?:\/\//, "")
  .replace(/\/.*$/, "");
const fullDomain = rawDomain.includes(".") ? rawDomain : `${rawDomain}.whop.site`;
let appId = (process.env.WHOP_APP_ID || "").trim();

if (!hostApiKey) {
  console.error(
    "Missing WHOP_API_KEY secret. Create an Admin API key at https://whop.com/dashboard/developer and save it in GitHub Actions secrets as WHOP_API_KEY.",
  );
  process.exit(1);
}

const cliEnv = {
  ...process.env,
  WHOP_API_KEY: hostApiKey,
  WHOP_API_BASE_URL: "https://api.whop.com/api/v1",
};

function runWhopJson(args) {
  const stdout = execFileSync("npx", ["whop", ...args, "--format", "json"], {
    env: cliEnv,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(stdout);
}

function setAppSecret(targetAppId, key, value) {
  if (!value) return;
  execFileSync(
    "npx",
    ["whop", "apps", "secrets", "set", "--app", targetAppId, "--secret", `${key}=${value}`],
    {
      env: cliEnv,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  console.log(`✓ Synced runtime binding: ${key}`);
}

const REQUIRED_PLANS = [
  {
    envKey: "WHOP_PLAN_INSPECTION",
    marker: "plan_key:inspection",
    title: "21-Point Roof Inspection",
    description:
      "Certified 60-minute roof and attic inspection with 4K drone imagery, thermal scan, and written estimate. 100% credited toward any roofing project.",
    price: 149,
  },
  {
    envKey: "WHOP_PLAN_DEPOSIT",
    marker: "plan_key:deposit",
    title: "Roofing Project Deposit",
    description:
      "Locks crew installation date, municipal permitting, and shingle material delivery. Deducted from final contract invoice and saves card on file.",
    price: 500,
  },
  {
    envKey: "WHOP_PLAN_FLAT_RATE",
    marker: "plan_key:flat_rate",
    title: "Roof & Gutter Tune-Up",
    description:
      "Flat-rate service: replace up to 10 damaged shingles, reseal pipe boots and chimney flashing, and flush up to 200 LF of gutters.",
    price: 349,
  },
];

async function provisionCatalog(mode, token, accountId) {
  const baseUrl =
    mode === "sandbox" ? "https://sandbox-api.whop.com/api/v1" : "https://api.whop.com/api/v1";
  const client = new WhopClient({ token, baseUrl });
  const productTitle = `${appName} — Services & Deposits`;

  console.log(`\n==> Provisioning catalog in [${mode}] for ${accountId}...`);
  const existingProducts = await client.products.list({ account_id: accountId, first: 50 });
  const match = (existingProducts?.data ?? []).find(
    (p) => typeof p.title === "string" && p.title.toLowerCase() === productTitle.toLowerCase(),
  );

  let productId = match?.id;
  if (productId) {
    console.log(`✓ Reusing product: ${productId}`);
  } else {
    const created = await client.products.create({
      account_id: accountId,
      title: productTitle.slice(0, 80),
      headline: "Residential Roof Inspections, Project Deposits & Maintenance",
      description:
        "Online booking plans for drone roof inspections, project deposits, flat-rate roof maintenance, and final balance invoices.",
      visibility: "visible",
    });
    productId = created.id;
    console.log(`✓ Created product: ${productId}`);
  }

  const variantsPage = await client.variants.list({
    account_id: accountId,
    product_ids: [productId],
    first: 50,
  });
  const variants = variantsPage?.data ?? [];
  const planIds = {};

  for (const spec of REQUIRED_PLANS) {
    const found = variants.find((v) =>
      `${v.internal_notes ?? ""} ${v.title ?? ""}`.includes(spec.marker),
    );
    if (found?.id) {
      planIds[spec.envKey] = found.id;
      console.log(`✓ Reusing ${spec.envKey}: ${found.id} ($${spec.price})`);
      continue;
    }
    const created = await client.variants.create({
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
    planIds[spec.envKey] = created.id;
    console.log(`✓ Created ${spec.envKey}: ${created.id} ($${spec.price})`);
  }

  return { productId, planIds };
}

async function main() {
  // 1. Find or create Website app
  if (!appId) {
    console.log(`==> Checking existing Whop Website apps for "${appName}"...`);
    try {
      const listArgs = ["apps", "list", "--app_type", "website", "--first", "50"];
      if (hostAccountId.startsWith("biz_")) {
        listArgs.push("--account_id", hostAccountId);
      }
      const listed = runWhopJson(listArgs);
      const items = listed?.data ?? (Array.isArray(listed) ? listed : []);
      const existing = items.find(
        (a) => typeof a.name === "string" && a.name.toLowerCase() === appName.toLowerCase(),
      );
      if (existing?.id) {
        appId = existing.id;
        console.log(`✓ Found existing Website app: ${appId}`);
      }
    } catch (err) {
      console.warn("Could not list existing apps, proceeding to create:", err?.message ?? err);
    }
  }

  if (!appId) {
    console.log(`==> Creating Whop Website app "${appName}"...`);
    const createArgs = ["apps", "create", "--app_type", "website", "--name", appName];
    if (hostAccountId.startsWith("biz_")) {
      createArgs.push("--account_id", hostAccountId);
    }
    const created = runWhopJson(createArgs);
    appId = created?.id ?? created?.data?.id ?? "";
    if (!appId) {
      throw new Error(`Unexpected response from whop apps create: ${JSON.stringify(created)}`);
    }
    console.log(`✓ Created Website app: ${appId}`);
  }

  // 2. Attach domain if not already attached
  let liveDomain = fullDomain;
  try {
    const existingDomains = runWhopJson(["domains", "list", "--app_id", appId, "--first", "10"]);
    const domItems = existingDomains?.data ?? (Array.isArray(existingDomains) ? existingDomains : []);
    if (domItems.length > 0 && domItems[0]?.domain) {
      liveDomain = domItems[0].domain;
      console.log(`✓ Using linked domain: https://${liveDomain}`);
    } else {
      console.log(`==> Claiming domain "${fullDomain}" for ${appId}...`);
      const domArgs = [
        "domains",
        "create",
        "--domain",
        fullDomain,
        "--website",
        JSON.stringify({ app_id: appId }),
      ];
      if (hostAccountId.startsWith("biz_")) {
        domArgs.push("--account_id", hostAccountId);
      }
      const claimed = runWhopJson(domArgs);
      liveDomain = claimed?.domain ?? claimed?.data?.domain ?? fullDomain;
      console.log(`✓ Claimed domain: https://${liveDomain}`);
    }
  } catch (err) {
    console.warn(
      `Note: Could not auto-claim "${fullDomain}" (it may already be taken — try another domain slug):`,
      err?.stderr?.toString?.() || err?.message || err,
    );
  }

  // 3. Provision 3 roofing plans & sync runtime bindings
  let checkoutMode = "preview";
  let catalog = null;

  if (sandboxApiKey && sandboxAccountId.startsWith("biz_")) {
    checkoutMode = "sandbox";
    catalog = await provisionCatalog("sandbox", sandboxApiKey, sandboxAccountId);
    setAppSecret(appId, "WHOP_ENVIRONMENT", "sandbox");
    setAppSecret(appId, "WHOP_SANDBOX_ACCOUNT_ID", sandboxAccountId);
    setAppSecret(appId, "WHOP_SANDBOX_API_KEY", sandboxApiKey);
  } else if (hostAccountId.startsWith("biz_")) {
    checkoutMode = "production";
    catalog = await provisionCatalog("production", hostApiKey, hostAccountId);
    setAppSecret(appId, "WHOP_ENVIRONMENT", "production");
  } else {
    console.warn(
      "Note: Add WHOP_SANDBOX_ACCOUNT_ID + WHOP_SANDBOX_API_KEY (or WHOP_ACCOUNT_ID) in GitHub secrets to auto-provision the 3 plans.",
    );
  }

  if (catalog) {
    setAppSecret(appId, "WHOP_PRODUCT_ID", catalog.productId);
    for (const [key, value] of Object.entries(catalog.planIds)) {
      setAppSecret(appId, key, value);
    }
  }
  if (webhookSecret) setAppSecret(appId, "WHOP_WEBHOOK_SECRET", webhookSecret);
  if (adminKey) setAppSecret(appId, "WHOP_ADMIN_KEY", adminKey);

  // 4. Deploy build live to Whop Hosting
  console.log(`\n==> Deploying build to Whop Websites (${appId})...`);
  execFileSync("npx", ["whop", "apps", "deploy", "--app", appId], {
    env: cliEnv,
    stdio: "inherit",
  });

  // Re-check linked domain after deploy
  try {
    const afterDomains = runWhopJson(["domains", "list", "--app_id", appId, "--first", "10"]);
    const domItems = afterDomains?.data ?? (Array.isArray(afterDomains) ? afterDomains : []);
    if (domItems[0]?.domain) liveDomain = domItems[0].domain;
  } catch {
    // Keep previously resolved domain
  }

  const summary = [
    "## Whop Roofing Website Deployed",
    "",
    `- **Live URL:** https://${liveDomain}`,
    `- **Whop App ID:** \`${appId}\``,
    `- **Payment Mode:** \`${checkoutMode}\``,
    ...(catalog
      ? [
          `- **Product ID:** \`${catalog.productId}\``,
          `- **$149 Inspection Plan:** \`${catalog.planIds.WHOP_PLAN_INSPECTION}\``,
          `- **$500 Deposit Plan:** \`${catalog.planIds.WHOP_PLAN_DEPOSIT}\``,
          `- **$349 Flat-Rate Plan:** \`${catalog.planIds.WHOP_PLAN_FLAT_RATE}\``,
        ]
      : []),
    `- **Webhook URL:** \`https://${liveDomain}/api/webhooks/whop\``,
    "",
  ].join("\n");

  console.log(`\n${summary}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  }
}

main().catch((err) => {
  console.error("\nDeploy failed:", err?.stderr?.toString?.() || err?.body || err?.message || err);
  process.exit(1);
});
