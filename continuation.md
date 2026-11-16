# Continuation: Whop roofing website template

## Goal
Finish and submit a standalone Whop Roofing Website Template. The owner wants the source in the public repository https://github.com/jusnie/whop-roofing-template, followed by Whop Sandbox setup and plan provisioning, a hosted deployment, end-to-end verification, a phone-recorded walkthrough, and submission to Whop.

## How to help the owner
- The owner has **no computer** and uses a phone. Give phone-friendly instructions one step at a time; do not require a local terminal or desktop.
- Never ask for GitHub, Whop, or other tokens or passwords in chat. Configure any required secrets privately using the relevant service's secret settings.
- Do not merge into `Tools-Skills` or change another repository without permission. The owner requested a Drive handoff instead.
- Confirm the capabilities and branch rules of the new chat before writing to the destination repo. The previous session was restricted to its original branch and could not push directly to the new repo.

## Current status
- Source snapshot: `jusnie/Tools-Skills`, branch `arena/9617bdc0-tools-skills`, commit `68451eb` (the archive also includes this continuation file). URL: https://github.com/jusnie/Tools-Skills/tree/arena/9617bdc0-tools-skills
- Target https://github.com/jusnie/whop-roofing-template was public and empty when checked on 2026-11-16. Nothing has been transferred there yet, and the source branch has not been merged into `Tools-Skills` main.
- The site is implemented with React, TypeScript, Vite, Cloudflare Workers and Whop. Includes Whop payment elements, card-on-file SetupIntent flow, deposits, final invoices, lead capture, pixel events, and contractor legal/deposit/privacy disclosures. Optional `WHOP_ADMIN_KEY` protects billing/admin endpoints when configured.
- `npm run typecheck`, `npm run build`, and `npm test` passed locally at commit `68451eb`. Tests use mocks; they do **not** establish that a real Whop deployment, checkout, domain claim, provisioning, webhook, or GitHub Actions run has worked.
- A manual GitHub Actions workflow and CI script were added for a possible phone-friendly deployment, but have not been tested end-to-end against live Whop. Verify current Whop requirements, the workflow and script before relying on them. Real credentials and plan IDs are not supplied.
- Hosting/sandbox were understood to be free, and public GitHub repositories typically have free GitHub Actions usage, but verify current pricing, limits, eligibility and account requirements before promising zero cost.

## Next steps
1. Get the archived source into the owner's new GitHub repo, using capabilities permitted in the new chat. Preserve all hidden files and folders such as `.github/workflows` and `.env.example`, plus the directory structure. Ask before overwriting existing files. Do not rely on GitHub importing directly into an existing repo without verifying it supports that.
2. Review `README.md`, `SUBMISSION.md`, `.github/workflows/deploy-whop.yml`, and `scripts/ci-deploy.mjs`; confirm secrets and current Whop API/CLI requirements. `WHOP_SANDBOX_ACCOUNT_ID` and `WHOP_SANDBOX_API_KEY` are supported in code and workflow, even though `.env.example` does not yet document them.
3. Guide the owner through Whop setup and private secrets on their phone; configure and provision sandbox plans, and deploy. Don't expose secrets or claim deployment succeeded without checking it.
4. Test live in sandbox: payments using Whop's documented test card, deposits, saved-card flow, leads, invoices, webhook signatures and tracking; confirm production admin protection as appropriate. Fix any failures.
5. Help record a phone walkthrough and submit to Whop. Explain any costs or restrictions that arise.

## What's in the archive
The ZIP contains the tracked source tree, including hidden configuration files, plus this continuation file. It deliberately excludes `node_modules`, `dist` build output, Git history, and secret environment files. Rebuild from source; no real secrets are included intentionally.

- `README.md` — setup and project documentation.
- `SUBMISSION.md` — walkthrough and submission notes.
- `.env.example` — example configuration; no actual credentials.
- `.github/workflows/deploy-whop.yml` — manual deployment workflow (not yet live-tested).
- `scripts/ci-deploy.mjs`, `deploy.sh`, `provision-plans.mjs` — deployment and plan provisioning.
- `scripts/verify-template.mjs` — automated template/API checks.
- `src/worker/index.ts` — server/API and Whop webhook handler.
- `src/components/` — site sections, legal modal, checkout and invoice UI.
- `src/config/company.config.ts`, `src/lib/whop-pixel.ts`, `src/types/whop.ts` — branding/configuration, tracking and shared types.
- `src/App.tsx`, `src/main.tsx`, `src/styles.css` — app assembly, entry point and styling.
- `public/` — favicon and generated roofing photos.
- `package.json`, `package-lock.json`, `vite.config.ts`, `wrangler.jsonc`, `tsconfig.json`, `index.html`, `.gitignore` — dependencies and build/runtime configuration.
