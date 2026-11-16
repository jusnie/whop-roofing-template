# RidgeLine Roofing & Exteriors — Whop Websites Template

A production-ready US residential & light-commercial roofing company website template built natively for **Whop Websites** (`@whop/cli`, `@whop/elements-react`, `@whop/sdk`, and Cloudflare Workers). Designed to pitch real high-ticket roofing contractors and demo Whop end-to-end:

**$149 Roof Inspection / Free Estimate (Lead) → $500 Project Deposit + SetupIntent Card-on-File → Roof Installation → Final Balance Invoice (Auto-Charge or Manual Link + BNPL Financing).**

---

## Implemented Whop Stack

| Feature | Implementation |
| --- | --- |
| **Whop Websites Hosting** | `vite.config.ts` (`whop()` from `@whop/cli/vite` + `@cloudflare/vite-plugin`), `wrangler.jsonc`, `src/worker/index.ts` → packs `dist/whop-build.zip` (`dist/client` + `dist/server/index.js`) for `whop apps deploy` |
| **3 Real Plans** | `$149` 21-Point Drone & Attic Inspection (`inspection`), `$500` Project Deposit & Crew Lock (`deposit`), `$349` Whole-Roof Flashing & Gutter Tune-Up (`flat_rate`) — provisioned via `npm run whop:provision` |
| **Whop Payment Elements** | `<PaymentElement />`, `<EmailElement />`, `<AddressElement />`, required `<BrandingElement />`, `<ExpressCheckoutElement />` (Apple Pay / Google Pay), and `<CheckoutElement />` — zero Stripe, PayPal (`payPal: "never"`), or custom card forms |
| **Automatic BNPL Financing** | Checkout and final invoice links run 100% on Whop so Klarna, Splitit, Afterpay, and Affirm surface automatically for approved merchants |
| **Setup Intent Card-on-File** | `<Payments setupFutureUsage="off_session">` at `$500` deposit checkout **plus** standalone `<Payments mode="setup">` + `POST /api/checkout/setup-intent` (`client.setupIntents.create`) storing `payt_…` |
| **Final Balance Invoices API** | `POST /api/invoices` (`client.invoices.create` + `issue`/`charge` to auto-charge stored `payt_…`, or `client.invoices.send` to email manual payment link after deducting `$500` deposit & `$149` inspection credits) |
| **Whop Leads API** | "Request an Estimate" form → `POST /api/leads` → creates account Member + Lead (`POST /api/v1/leads`) + deduplicated server event (`POST /api/v1/events`) |
| **Custom Pixel Tracking** | `window.whop.track` fires `service_viewed`, `deposit_started`, and `estimate_requested` (plus `financing_estimated`, `final_invoice_created`, `view_content`, `initiate_checkout`, `lead`, and `data-whop-*` DOM attributes); page views and purchase events fire automatically on Whop hosting |
| **Verified Webhooks** | `POST /api/webhooks/whop` verifies Standard Webhooks signatures with `unwrapWebhook` (`@whop/sdk/helpers`) for `payment.succeeded`, `payment.failed`, `setup_intent.succeeded`, and `invoice.*` |
| **Single-File Reusability** | Swap contractor name, colors, phone, license, service area counties/ZIPs, services, plan pricing, reviews, FAQs, and sample job items in **`src/config/company.config.ts`** with zero layout changes |

---

## Deploy Live to Whop Websites (4 Commands)

### Prerequisites
- Node.js 22+
- A [Whop](https://whop.com/dashboard) account (and optionally a [Whop Sandbox](https://sandbox.whop.com/dashboard/developer) account for test card checkouts)

### 1. Install & Authenticate the Whop CLI
```bash
npm install
npx whop login
npx whop quickstart
```

### 2. Register the Whop Website & Claim Your Subdomain
```bash
# Option A: One-command automated script
APP_NAME="RidgeLine Roofing" DOMAIN_SLUG="ridgeline-roofing" npm run whop:ship

# Option B: Explicit CLI steps
npx whop apps create --app_type website --name "RidgeLine Roofing"
# Note the returned app_xxxxxxxx ID, claim your Whop subdomain, and deploy:
npx whop domains create --domain ridgeline-roofing --website '{"app_id":"app_xxxxxxxx"}'
npx whop apps deploy --app app_xxxxxxxx
```
*(Already created a website in Whop AI / Dashboard? Simply run `npx whop apps deploy --app app_xxxxxxxx` from this repo root — it links `whop.app.json`, builds `dist/whop-build.zip`, type-checks, uploads, and promotes it live.)*

### 3. Provision the 3 Real Roofing Plans (`$149`, `$500`, `$349`)

**For Sandbox test checkouts on your live deployed site** (test card `4242 4242 4242 4242`, any future expiry, CVC `123`, 3DS card `5385 3083 6013 5181` with password `Checkout1!`):
```bash
WHOP_ENVIRONMENT=sandbox \
WHOP_ACCOUNT_ID=biz_your_sandbox_id \
WHOP_API_KEY=apik_your_sandbox_key \
npm run whop:provision -- --apply-secrets

npm run deploy
```

**For Live Production merchant catalog** (outbound API key & `WHOP_ACCOUNT_ID` are injected automatically by Whop Hosting):
```bash
WHOP_ENVIRONMENT=production \
WHOP_ACCOUNT_ID=biz_your_live_id \
WHOP_API_KEY=apik_your_live_key \
npm run whop:provision -- --apply-secrets

npm run deploy
```

### 4. Configure Webhooks (Recommended)
1. In your Whop Dashboard → **Developer → Webhooks**, add endpoint: `https://<your-site-domain>/api/webhooks/whop`
2. Enable events: `payment.succeeded`, `payment.failed`, `setup_intent.succeeded`, `invoice.created`, `invoice.paid`, `invoice.past_due`.
3. Store the signing secret:
   ```bash
   npx whop apps secrets set --secret WHOP_WEBHOOK_SECRET=ws_xxxxxxxx
   npm run deploy
   ```

---

## Local Development & Verification

```bash
# Run with Whop CLI injected runtime credentials:
npm run whop:dev

# Or run standalone local dev server (includes interactive template preview mode):
npm run dev

# Run TypeScript check, production Whop build archive, and full compliance/API test suite:
npm run typecheck
npm run build
npm test
```

### Verifying `whop.track` Custom Pixel Events
1. Open the deployed site and open **Browser DevTools → Console & Network** (or click **`Pixel log`** in the footer / append `?inspector=1`).
2. Click any service card in **Services** → fires `whop.track("service_viewed", { service_id, variant_id, product_id, value, currency: "USD", event_id })`.
3. Click **Pay $500 deposit** → fires `whop.track("deposit_started", { variant_id, product_id, value: 500, currency: "USD", card_on_file: true, event_id })`.
4. Submit **Request an estimate** → creates the Lead via `POST /api/leads` (`POST /api/v1/leads`) and fires `whop.track("estimate_requested", { lead_id, service_type, roof_material, postal_code, value, currency: "USD", event_id })`.
5. Events also inspectable via `window.__whopTrackedEvents` in DevTools and in **Whop Dashboard → Websites / Pixel** (~60s after visit).

### Optional Office Lock for Live Contractor Deploys
- Leave `WHOP_ADMIN_KEY` unset during sandbox review so reviewers can run the on-page final balance invoice workflow directly.
- Set `npx whop apps secrets set --secret WHOP_ADMIN_KEY=<strong-passphrase>` on a live roofing client site to lock `POST/GET /api/invoices`, `GET /api/leads`, and `GET /api/payment-methods` behind an office billing key.

---

## Rebranding for Another Roofing Company (1 File)

Open **`src/config/company.config.ts`** and edit `COMPANY_CONFIG`:
- `brand` — Company name, headline, accent color (`accentHex` + `whopAccentColor`), hero photo
- `contact` — Phone, 24/7 storm line, email, street address, state license & insurance
- `services` — Inspection, Repair, Replacement specs, warranties, turnaround, photos
- `plans` — Pricing, deliverables, and badges for the inspection fee, project deposit, and flat-rate service
- `financing` — Slider range, BNPL providers, and terms callout
- `serviceArea` — Dispatch radius, counties, cities, and exact/prefix ZIP codes for the instant ZIP checker
- `reviews`, `certifications`, `faqs`, `sampleCompletedJob` — Social proof and default invoice builder line items

Re-run `npm run deploy` — zero JSX or server changes required.

---

## Project Structure

```text
├── src/
│   ├── config/company.config.ts           # Single-file contractor brand, services & pricing config
│   ├── lib/whop-pixel.ts                  # whop.track helpers + data-whop-* product attributes
│   ├── types/whop.ts                      # Shared client/worker TypeScript contracts
│   ├── worker/index.ts                    # Whop Hosting Worker (Payments, SetupIntents, Leads, Invoices, Webhooks)
│   ├── components/
│   │   ├── Navbar.tsx                     # Emergency utility bar + responsive header
│   │   ├── HeroSection.tsx                # Full-bleed architectural hero + proof metrics
│   │   ├── ServicesSection.tsx            # Inspection, Repair & Replacement + service_viewed tracking
│   │   ├── PlansSection.tsx               # $149 Inspection, $500 Deposit, $349 Flat-Rate plans
│   │   ├── WhopCheckoutModal.tsx          # PaymentElement + ExpressCheckoutElement + CheckoutElement + SetupIntent + BrandingElement
│   │   ├── CheckoutReturnView.tsx         # /checkout/return status handler (3DS / bank / BNPL)
│   │   ├── FinancingSection.tsx           # Interactive BNPL monthly roof payment estimator
│   │   ├── InvoiceWorkflowSection.tsx     # Deposit → Job → Final Balance Invoice builder (Whop Invoices API)
│   │   ├── ServiceAreaSection.tsx         # County dispatch map + instant ZIP code coverage checker
│   │   ├── ReviewsTrustSection.tsx        # Verified homeowner reviews + manufacturer certifications
│   │   ├── EstimateContactSection.tsx     # Estimate form → Whop Leads API + estimate_requested pixel event
│   │   ├── WhopPixelInspector.tsx         # Live whop.track & API verification drawer for pitch demos
│   │   ├── LegalModal.tsx                 # Dynamic contractor Terms, Deposit & Refund Policy, and Privacy
│   │   └── Footer.tsx                     # Contractor licensing & legal policy footer
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css
├── public/images/                         # Original high-resolution residential roofing photography
├── scripts/
│   ├── provision-plans.mjs                # Creates Whop Product + 3 required plans (Sandbox or Production)
│   ├── deploy.sh                          # One-command Whop CLI init + deploy script
│   └── verify-template.mjs                # Automated compliance & API verification suite
├── vite.config.ts                         # @cloudflare/vite-plugin + @whop/cli/vite (`whop()`)
├── wrangler.jsonc                         # Cloudflare Workers config for Whop Websites runtime
└── SUBMISSION.md                          # Submission summary paragraph & 3–5 min recording guide
```
