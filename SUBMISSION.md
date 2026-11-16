# Whop Roofing Website Template — Submission Pack

## 1. One-Paragraph Whop Features Summary (Ready to Submit)

> Built and deployed natively on **Whop Websites** via the Whop CLI (`@whop/cli/vite` on Whop's Cloudflare Workers runtime), this US roofing contractor template implements the full high-ticket residential roofing lifecycle exclusively on Whop. We provisioned three live one-time Whop plans—a $149 21-Point Drone Inspection, a $500 Project Deposit, and a $349 Flat-Rate Roof & Gutter Tune-Up—and embedded **Whop Payment Elements** (`@whop/elements-react`) combining `ExpressCheckoutElement` (Apple Pay and Google Pay), `PaymentElement`, `EmailElement`, `AddressElement`, `CheckoutElement`, and the required `BrandingElement` with zero custom card forms so BNPL financing options (Klarna, Splitit, and Afterpay) surface automatically for approved merchants. At deposit checkout, the template vaults the homeowner's payment method on file using **Whop Setup Intents** (`setupFutureUsage: "off_session"` plus standalone `mode="setup"` via `client.setupIntents.create`), then bills the remaining contract balance—net of paid deposit and inspection credits—through the **Whop Invoices API** (`client.invoices.create`, `issue`/`charge` to auto-charge the stored `payt_` card off-session, or `send` to email a hosted manual payment link), alongside verified webhook fulfillment via `unwrapWebhook` (`@whop/sdk/helpers`). Finally, the "Request an Estimate" form writes homeowner quote requests and full roof metadata directly to the account via the **Whop Leads API** (`POST /api/v1/leads`) with deduplicated server-side conversion mirroring, while **Whop Pixel** captures automatic page views and purchases plus custom `whop.track` events (`service_viewed`, `deposit_started`, `estimate_requested`, `financing_estimated`, and `final_invoice_created`) paired with `data-whop-*` product attributes across every service and plan card.

---

## 2. Publish Your Live Whop Website URL

Run these commands locally where your Whop account is authenticated:

```bash
git clone <your-repo-url> && cd Tools-Skills
npm install

# 1. Authenticate with Whop CLI & pick your business
npx whop login
npx whop quickstart

# 2. Provision the 3 real plans ($149 Inspection, $500 Deposit, $349 Flat-Rate Tune-Up)
#    Use WHOP_ENVIRONMENT=sandbox with your sandbox.whop.com credentials for test-card checkout,
#    or WHOP_ENVIRONMENT=production for live charges:
WHOP_ENVIRONMENT=sandbox \
WHOP_ACCOUNT_ID=biz_xxxxxxxxxxxxxx \
WHOP_API_KEY=apik_xxxxxxxxxxxxxxxx \
npm run whop:provision

# 3. Create & deploy to your live Whop Website URL (or pass an existing app_xxx from Whop AI/Dashboard)
APP_NAME="RidgeLine Roofing" DOMAIN_SLUG="ridgeline-roofing" npm run whop:ship

# Sync the printed plan IDs into the hosted runtime & promote:
WHOP_ENVIRONMENT=sandbox \
WHOP_ACCOUNT_ID=biz_xxxxxxxxxxxxxx \
WHOP_API_KEY=apik_xxxxxxxxxxxxxxxx \
npm run whop:provision -- --apply-secrets

npm run deploy
```

---

## 3. 3–5 Minute Screen Recording Walkthrough Script

| Timestamp | What to Show | Verification Point |
| --- | --- | --- |
| **0:00 – 0:45** | Open the live Whop Website URL on desktop and resize briefly to mobile. Scroll through Hero, Services (Inspection, Repair, Replacement), 3 Plans (`$149`, `$500`, `$349`), Financing Estimator (drag slider), Service Area (test ZIP `78704`), Reviews & Certifications, and Contact. Briefly show `src/config/company.config.ts` to highlight 1-file template reusability. | Live URL in address bar + responsive layout + all required roofing sections. |
| **0:45 – 1:25** | Open DevTools Console/Network **and** click the bottom-right `whop.track` verifier pill. Click **Storm, Leak & Flashing Repair** and **Full Architectural Replacement** in the Services section. | `whop.track("service_viewed", ...)` fires live with `variant_id`, `product_id`, `value`, `currency: "USD"`, and `event_id` (1/3 checked). |
| **1:25 – 2:35** | Click **Pay $500 Deposit & Lock Date**. Point out `whop.track("deposit_started")` firing (2/3 checked), plus `ExpressCheckoutElement` (Apple Pay / Google Pay), `EmailElement`, `AddressElement`, `PaymentElement` (`setupFutureUsage="off_session"`), the `CheckoutElement` and `SetupIntent` tabs, and the required **Powered by Whop `BrandingElement`**. Complete sandbox checkout with `4242 4242 4242 4242`, future exp, CVC `123`. | Completed test payment (`pay_...`) + vaulted card on file (`payt_...` / `sint_...`) + visible in Whop Sandbox Dashboard → Payments. |
| **2:35 – 3:25** | Scroll to **Request an Estimate**, fill in homeowner details + roof type + storm claim checkbox, and submit. Switch tab to Whop Dashboard → Leads / Members. | Returns live `lead_...` & `mber_...` IDs, fires `whop.track("estimate_requested")` (3/3 custom events verified), and lead appears on the Whop account. |
| **3:25 – 4:25** | Click **Bill Final Balance via Whop Invoices** (auto-populated with the customer's `mber_...` and vaulted `payt_...` card, and deducting the `$500` deposit + `$149` inspection credit). Issue an **Auto-Charge Card** invoice, then switch to **Send Invoice Link** and issue a manual invoice; show both in Whop Dashboard → Invoices and Pixel Dashboard → Events. | Final balance billed via Whop Invoices API (both auto-charge and manual hosted link with BNPL options) + all custom pixel events verified. |
