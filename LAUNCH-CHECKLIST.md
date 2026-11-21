# Zebra / ZFLAG / BL Scripts — remaining launch work

## What exists right now

- ZFLAG homepage in `MadeByZebra/zflag-site` has updated grayscale styling, cross-links, smoother hover transitions and navigation to `/zebra/injector/` from the download buttons.
- Live-source GitHub paths created: `/zebra/` (main project hub), `/zebra/scripts/` (public marketplace showcase), `/zebra/injector/` (pre-launch protected access explanation).
- The ZIP includes a complete Node/Express store backend with email-code routes, Postgres schema, Stripe Checkout + webhook handlers, paid-entitlement checks, private Lua loadstring routes, guarded Windows installer download, refund/dispute access revocation and test-only $0.50 checkout.
- Locally encoded seller payloads are in `protected-payloads/` and original sources are in `private-scripts/`. These are excluded from deploy-safe ZIP.
- Videos are placeholders. No actual payment has been processed. The injector source and updated installer were not attached.

## Required before first end-to-end test

1. **Updated ZFLAG injector build.** Supply the signed installer (`ZFLAG_Setup.exe` / `zflag-setup.exe`) and its SHA-256, version, supported Windows platforms and runtime requirements. An old publicly available GitHub release cannot be protected by changing website buttons. Decide whether to retire old public releases without disrupting existing users. Never ship the paid binary under the public web root.
2. **Render Node web service and persistent Postgres.** Deploy the `bl-scripts-marketplace/` application as a web service (Node >=22, `npm install`, `npm start`). Set `DATABASE_URL` to persistent Postgres and `PUBLIC_URL` to the exact HTTPS origin. Free Render Postgres may expire; do not use ephemeral SQLite for accounts/orders in production.
3. **Private payload storage.** Set `SCRIPT_STORAGE_DIR` to a private path accessible to the application at runtime, containing encoded `.lua` payloads and `zflag-setup.exe`. Never commit these to public GitHub or serve with `express.static`. Use a private deployment channel or private authenticated object storage. Public bootstrap scripts contain no paid source and are optional; personal direct loadstrings are preferable.
4. **Email sign-in.** Set up Resend (or equivalent provider) and verify the sender domain; add `RESEND_API_KEY`, `MAIL_FROM`, a random >=32-character `OTP_SECRET`, and `SUPPORT_EMAIL` in Render environment variables. Email verification refuses requests until properly configured. Test expired code, reuse, invalid codes and rate limits.
5. **Stripe test mode.** On your Stripe account select Test/Sandbox mode. Set `STRIPE_SECRET_KEY=sk_test_...`, create a webhook destination pointing to `https://YOUR-APP/api/stripe/webhook`, and set its corresponding `STRIPE_WEBHOOK_SECRET=whsec_...`. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, and `charge.dispute.created`. For test only, set `DISABLE_CHECKOUT=0` and `ENABLE_TEST_CHECKOUT=1`. Use the displayed **$0.50 TEST** product. Use the Stripe test card 4242 4242 4242 4242 with a future expiry and any valid CVC. **No money moves in test mode.** A real $0.01 USD Stripe charge is below Stripe's standard $0.50 minimum. Do not add real card numbers to ChatGPT.
6. **Critical negative tests.** Check anonymous and invalid-key attempts to `/api/loader/:sku` and `/api/injector/download` return 401/403. Confirm a valid login with no purchase gets no paid payload. Verify only the purchased SKU/bundle unlocks, a used/rotated key is rejected, and refund/dispute removes access. Inspect response headers for `Cache-Control: no-store` and absence of public source.
7. **Before live money.** Confirm Stripe's approval/merchant eligibility for the specific Roblox/Boxing League scripts (some are gameplay automation/exploit utilities), and confirm distribution rights for the programs. Add tested terms, privacy policy, refunds, contact/support, actual walkthrough videos, compatibility/version details, malware scanning/code signing, backups/monitoring, and restore procedures. Keep `ALLOW_LIVE_SALES=0` until every step is done. When ready, set `sk_live_...` and its distinct live `whsec_...` only after full review; use `ALLOW_LIVE_SALES=1` and `DISABLE_CHECKOUT=0` deliberately.

## Showcase videos to provide

- BL Control Center — overview, working features, safety/compatibility limitations, desktop view.
- STR + END Class A — joining Class A, starting/stopping, UI controls, and actual behavior.
- DEX Desktop + Mobile — bag selection, pause detection, controls and the mobile layout.
- Optional FPS Optimizer — visual comparison in a controlled, labeled test scene with honest FPS results.

Do not imply that old build components, future classes, or permanent compatibility are included in a paid product.

## Product and branding review

- Name: **Zebra's BL Scripts**; cross-linked with ZFLAG and the Zebra hub.
- Icon-free navigation and favicon.
- Provisional ZFLAG injector price: **$9.99**; update before enabling checkout.
- BL control center: **$19.99**, STR/END **$9.99 each**, DEX **$7.99 each**, FPS **$1.99**, bundles ~10% off.
- Optional public GitHub loader repo uses only bootstrap stubs; the private authenticated server URL and actual runtime file are not public raw links.

## Security reality

The code shipped to the client is always potentially recoverable by the person executing it, even if XOR/base64 encoded or obfuscated. Disabling selection, right-click or developer tools does not protect it. Your paywall is the server-side ownership check before sending a file; obfuscation is additional friction, never an absolute guarantee.
