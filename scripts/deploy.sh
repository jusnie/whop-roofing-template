#!/usr/bin/env bash
# =============================================================================
# One-Command Whop Website Deploy (`scripts/deploy.sh`)
# =============================================================================
# Registers/links this roofing website template as a Whop Website app,
# optionally provisions the 3 required plans, builds `dist/whop-build.zip`,
# runs `tsc --noEmit`, uploads, and promotes it live to your whop.app / whop.site URL.
#
# Usage:
#   APP_NAME="RidgeLine Roofing" DOMAIN_SLUG="ridgeline-roofing" npm run whop:ship
#   # Or link an existing Whop website app:
#   WHOP_APP_ID="app_xxxxxxxx" npm run whop:ship
# =============================================================================
set -euo pipefail

APP_NAME="${APP_NAME:-RidgeLine Roofing}"
DOMAIN_SLUG="${DOMAIN_SLUG:-ridgeline-roofing}"

echo "==> Checking Whop CLI authentication..."
npx whop auth status

if [[ ! -f "whop.app.json" ]]; then
  if [[ -n "${WHOP_APP_ID:-}" ]]; then
    echo "==> Linking existing Whop Website app (${WHOP_APP_ID})..."
    npx whop apps deploy --app "${WHOP_APP_ID}"
  else
    echo "==> Creating Whop Website '${APP_NAME}' on subdomain '${DOMAIN_SLUG}'..."
    CREATED_JSON="$(npx whop apps create --app_type website --name "${APP_NAME}" --format json)"
    APP_ID="$(node -e 'const d = JSON.parse(process.argv[1]); console.log(d.id || d.data?.id || "");' "${CREATED_JSON}")"
    if [[ -z "${APP_ID}" ]]; then
      echo "Could not parse created app ID. Output: ${CREATED_JSON}" >&2
      exit 1
    fi
    echo "    Created App ID: ${APP_ID}"
    FULL_DOMAIN="${DOMAIN_SLUG}"
    if [[ "${FULL_DOMAIN}" != *.* ]]; then
      FULL_DOMAIN="${FULL_DOMAIN}.whop.site"
    fi
    echo "==> Claiming domain '${FULL_DOMAIN}'..."
    npx whop domains create --domain "${FULL_DOMAIN}" --website "{\"app_id\":\"${APP_ID}\"}" || true

    if [[ -n "${WHOP_ACCOUNT_ID:-}" && -n "${WHOP_API_KEY:-}" ]]; then
      echo "==> Provisioning 3 roofing plans & syncing secrets..."
      WHOP_APP_ID="${APP_ID}" node scripts/provision-plans.mjs
      for KEY in WHOP_ENVIRONMENT WHOP_PRODUCT_ID WHOP_PLAN_INSPECTION WHOP_PLAN_DEPOSIT WHOP_PLAN_FLAT_RATE; do
        if [[ -n "${!KEY:-}" ]]; then
          npx whop apps secrets set --app "${APP_ID}" --secret "${KEY}=${!KEY}"
        fi
      done
    fi

    echo "==> Deploying live to Whop Websites..."
    npx whop apps deploy --app "${APP_ID}"
  fi
else
  if [[ -n "${WHOP_ACCOUNT_ID:-}" && -n "${WHOP_API_KEY:-}" ]]; then
    echo "==> Provisioning/verifying 3 roofing plans & syncing secrets..."
    node scripts/provision-plans.mjs --apply-secrets
  fi
  echo "==> Deploying linked Whop Website..."
  npx whop apps deploy
fi

LINKED_ID="$(node -e 'const fs=require("fs"); if(fs.existsSync("whop.app.json")) console.log(JSON.parse(fs.readFileSync("whop.app.json","utf8")).app_id||"");')"
if [[ -n "${LINKED_ID}" ]]; then
  echo ""
  echo "==> Live Whop Website details:"
  npx whop apps get "${LINKED_ID}"
fi
