# Zebra's BL Scripts

A **Node 22+ / Express / Stripe Checkout / PostgreSQL** storefront project with a redesigned frontend based on the owner's actual `MadeByZebra/zflag-site` styling. Includes account registration, a private purchase library, and server-checked paid downloads.

**Current delivery:** Complete source project, **not a live payment deployment**. By design, checkout is disabled until required keys, private scripts, and support details are configured. This avoids charging customers for a product that cannot be delivered.

## ZFLAG Edition visual rebuild (Nov 20, 2026)

- The visual layout takes its typography, rounded glass navigation, panel structure, spacing, subtle background grid, dark/light variables, and scroll reveals from the owner's **actual ZFLAG public repository**, rather than guessing the aesthetic.
- Smooth scrolling uses a standalone local script (`public/smooth-scroll.js`) modeled on ZFLAG's wheel and trackpad easing. Touch, nested scrolling, dialogs, keyboard navigation, and reduced-motion preferences remain native.
- IntersectionObserver-based section fade/blur reveals and animated product-card arrivals; motion is disabled when reduced motion is requested.
- Interactive control-center preview tabs and selectable video placeholder cards, with all real Lua assets still excluded from public code.
- The seller's legacy published ZFLAG site is **not overwritten**. This update is a new downloadable marketplace project, not a deployed live website.
- CSS is layered: `public/style.css` is the original functioning UI styling; `public/zflag-rework.css` applies the refreshed ZFLAG aesthetic. `public/app.js` includes the new UI interactions.
- Stripe checkout, private download authorization, and account routes are unchanged apart from allowing Google Fonts under the server's Content Security Policy.

## Catalog and prices (editable in `catalog.js`)

| Item | Price |
|---|---:|
| BL Control Center V7.5 | $19.99 |
| STR Grinder — Class A | $9.99 |
| END Grinder — Class A | $9.99 |
| DEX Grinder Desktop | $7.99 |
| DEX Grinder Mobile | $7.99 |
| FPS Optimizer | $1.99 |
| Class A Training Pack (STR + END) | $17.98 |
| DEX Cross-Platform Pack | $14.38 |
| BL Complete Collection (all six sellable files) | $52.15 |

Bundles apply an approximately 10% discount from the listed component prices. Class S Joiner appears as **ON HOLD** because the supplied file only calls a public third-party loader, and ownership/exclusivity was not established.

STR and END **only support Class A** based on the seller's instructions. Class B and C support is listed as planned, not included in these products. The performance script simplifies graphics; it is not guaranteed to improve frames per second. Script compatibility is unverified in a live game.

## Install and preview locally

1. Install Node.js v22 or later.
2. Extract the *deploy-safe site ZIP* into a folder.
3. Extract the separate **SELLER-ONLY** package into the project folder so the files land in `private-scripts/`. **Never push this folder to a public GitHub repository.**
4. Copy `.env.example` to `.env` and set `PUBLIC_URL=http://localhost:3000`.
5. Run `npm install`, then `npm start` in the project folder.
6. Open `http://localhost:3000`.

The public storefront runs without a Stripe account; payments correctly show as not configured. For immediate visual and interaction testing, **double-click `BL-Scripts-ZFLAG-Edition-Interactive-Preview.html`** included alongside / inside the ZIP. It contains demo catalog data only, makes no requests to a live payment backend, and never contains the private scripts.

## Configure Stripe TEST payments before accepting real money

1. Create your own Stripe account at https://dashboard.stripe.com/ and check merchant/product eligibility with Stripe first.
2. Create a **test-mode secret key**; store it as `STRIPE_SECRET_KEY=sk_test_...` in `.env` or Render environment secrets. Never put the secret key into the frontend, GitHub, or chat.
3. Configure a webhook for `https://YOUR_DOMAIN/api/stripe/webhook` and subscribe to:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `charge.refunded`
   - `charge.dispute.created`
4. Copy its signing secret to `STRIPE_WEBHOOK_SECRET=whsec_...`.
5. Set a real `SUPPORT_EMAIL=you@yourdomain.com` and make sure all six sellable Lua files exist under `SCRIPT_STORAGE_DIR`.
6. Set `PUBLIC_URL` to the actual HTTPS origin in production.
7. Create an account on the site, click Buy, and complete a **test-mode** purchase (Stripe's test cards; no real charge). Check that your Library unlocks only the purchased file(s).
8. Confirm that unsigned webhook requests fail, direct protected downloads fail when signed out, and paid orders that were refunded are no longer downloadable.
9. After testing and reviewing terms, change to Stripe live credentials and create a new live webhook/signing secret. Make sure the store clearly displays support and refund terms.

**Don't attempt a real $0.01 charge.** Stripe lists **$0.50 USD** as its minimum payment amount for typical USD charges, and test-mode card payments are designed for no-cost testing: https://docs.stripe.com/currencies

## Deploy on Render — recommended production configuration

1. Create a **new private GitHub repository** for the site files (do **not** upload the seller-only package or `.env`). Keep the provided `.gitignore`.
2. In Render, create a **Postgres database** and a **Node Web Service** linked to that repository.
3. Web service settings: Node 22+, build command `npm install`, start command `npm start`, health check path `/api/health`. Production requires a reliable Postgres instance; Render's default application filesystem is ephemeral. For a real shop, plan for a persistent database and backup/recovery.
4. Set Render environment variables:

   ```env
   NODE_ENV=production
   PUBLIC_URL=https://YOUR-RENDER-DOMAIN.onrender.com
   DATABASE_URL=YOUR_RENDER_POSTGRES_INTERNAL_URL
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   SUPPORT_EMAIL=your-real-support-email@example.com
   SCRIPT_STORAGE_DIR=/etc/secrets
   ```

5. In the Render service's **Secret Files** settings, upload each Lua asset as a private file with precisely these names, available inside `/etc/secrets`: `control-center.lua`, `str-grinder.lua`, `end-grinder.lua`, `dex-desktop.lua`, `dex-mobile.lua`, `fps-optimizer.lua`. Keep these files OUT of `public/`, git, Docker images, and public CDNs. Follow your current Render dashboard's secret file upload instructions.
6. Set your Stripe webhook endpoint to the final Render URL, copy its secret, deploy, and run checkout/download tests in **test mode first**.

Checkout automatically stays OFF if Stripe credentials, support email, any sellable script file, or a production database is missing. This is intentional fail-closed behavior.

## How the paywall works

- Real source code is not embedded in HTML/JS, previews, downloadable sample URLs, or the static/public directory.
- The backend controls all prices, bundle membership and entitlements; browsers never supply the payment amount.
- New customers register and sign in; passwords use `scrypt` with unique salts, and server-managed sessions use HttpOnly SameSite cookies.
- Purchase creation is rate limited. Stripe hosts card entry. Webhooks verify Stripe's signature using the unmodified request body.
- A purchase is granted only after matching a stored order with a paid Stripe Checkout Session, including product ID, customer reference, amount and successful, nonrefunded charge.
- Each private download checks logged-in ownership **and revalidates payment with Stripe**, including refund/dispute state. Files are read only from `SCRIPT_STORAGE_DIR`.
- Refund/dispute webhooks mark purchases revoked. A revoked order stays revoked, even if its previous Checkout Session was paid.
- API responses deny caching. The public UI contains only fake, blurred *sample* code, never the real Lua.

**No client-side copy protection is absolute.** A paying buyer who receives Lua to execute can save and redistribute it. Disabling Inspect Element, selecting text or right-clicking cannot prevent that. Obfuscation, revocable licenses, watermarking and private server logic may reduce copying, but cannot guarantee the raw source can never be recovered. Do not claim 'unbypassable' protection.

## Video showcases

Each catalog record has a `video: null` field. Once the actual footage is provided, replace it with a `https://www.youtube-nocookie.com/embed/VIDEO_ID` or `https://player.vimeo.com/video/VIDEO_ID` URL. The product-detail modal then loads that video. Other URL schemes are blocked.

## Operations, limitations and next improvements

- Check script ownership and redistribution rights **before selling** any uploaded file; the Join Class S loader references a public third-party repository, and the FPS script includes a ScriptBlox unverified-script header.
- Selling or using third-party game exploits may violate the game's platform terms and may expose users to moderation or account bans. Check Stripe's restricted-business rules before enabling live payments.
- Email verification, password reset, transactional receipts, accessible account recovery, device-bound licensing, creator analytics, support ticket tooling, anti-abuse limits and backups are good production upgrades.
- Password recovery is **not included** in this starter; sellers must have a support process before taking money. Stripe sends payment emails according to the Stripe account's receipt settings.
- A refund processed in Stripe is caught by the download-time charge check even if its webhook is delayed; database revocation needs webhook delivery.
- Tests verify catalog consistency and public/private separation, but **live Stripe settlement and hosting have not been tested** without credentials.

## Where code belongs

`public/` — public HTML/CSS/JS and metadata; safe for git.

`catalog.js` — public product descriptions and server-side prices; safe for git.

`server.js` — private order processing, login and protected download routes; safe for git **only if environment secrets are not embedded**.

`private-scripts/` — actual Lua assets; **not public and .gitignored**.

`marketplace.sqlite` — local-development sessions/orders; **.gitignored**. Use Postgres in production.

## Zebra unified email login and ZFLAG access
Both ZFLAG and paid BL scripts use the same email-code-based session and library under one backend domain. Configure Postgres, RESEND_API_KEY, MAIL_FROM (verified sender), OTP_SECRET (32+ random bytes), SUPPORT_EMAIL, PUBLIC_URL, and Stripe test secret + signed webhook secret on the Render service. Run with DISABLE_CHECKOUT=1 initially. The ZFLAG installer must be privately stored as `zflag-setup.exe`, never under `public/`; it cannot be sold until the replacement binary is supplied and tested.

Stripe sandbox checkout: set `ENABLE_TEST_CHECKOUT=1` with sk_test key, whsec, and DISABLE_CHECKOUT=0 only after webhook setup. A test-only $0.50 item will appear for Stripe dummy-card testing, without unlocking software. Live checkout needs ALLOW_LIVE_SALES=1 in addition to a live key, and should remain off until merchant eligibility (including game automation scripts) is reviewed. Your connected Stripe account alone does not give this server API credentials.
