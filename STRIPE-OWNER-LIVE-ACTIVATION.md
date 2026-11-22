# BL Scripts — real-money activation (owner actions)
Updated 2026-11-21. The storefront is functional for preview and restricted testing, **not yet authorized to collect real money**.

## Stripe account requirements
Stripe currently returns charges_enabled=false, payouts_enabled=false, details_submitted=false, card_payments=inactive, disabled_reason=requirements.past_due. This is an account restriction, not a JavaScript checkout bug.

The Stripe account owner should sign in at https://dashboard.stripe.com/account/onboarding and complete the requested legal business type, classification (MCC), *truthful* description of the actual BL Scripts/ZFLAG products, store URL, support telephone, representative name/email/date of birth, bank payout details, card statement descriptor, and accept Stripe's terms from their own session. Do not put identity documents, bank numbers or payment keys into GitHub or ChatGPT.

**Product review:** Disclose the actual categories (third-party Roblox game automation/utility and any injector/executor capabilities), rights to distribute the code, compatibility claims and game-rule risks. Ask Stripe to confirm eligibility for the **actual products** before enabling charges. Do not relabel prohibited tools as innocuous software to evade review. Stripe may decline to support a category.

## Site and delivery preconditions
- The Stripe server account, secret key and live webhook must be from the same live environment. Create the live webhook at `https://zebra-bl-marketplace.onrender.com/api/stripe/webhook`; subscribe to checkout.session.completed, checkout.session.async_payment_succeeded, charge.refunded, charge.dispute.created. Keep the matching `whsec_` secret in Render environment settings only.
- Keep `ALLOW_LIVE_SALES=0` until the account reports charges_enabled=true, payouts_enabled=true, card_payments=active, and disabled_reason=null, Stripe has accepted the product category, and live receipts/email are tested.
- Move from temporary trial Postgres to a persistent backed-up database before real orders (previous deployment notes report the free database expires 2026-12-21).
- Verify a buyer from two email providers can receive sign-in code and confirmation/receipt. Test a signed webhook and duplicate retry.
- Verify actual current Roblox-client execution of each product you plan to sell; SHA-256 integrity alone does **not** prove scripts work in-game. Do not offer unverified ZFLAG Windows installers.
- Verify an unpaid/random/expired/rotated license returns HTTP 403; test refund/dispute revocation.
- After Stripe approval and operational checks, install a live `sk_live_` key and corresponding live webhook secret in Render, then explicitly turn on `ALLOW_LIVE_SALES=1` with `DISABLE_CHECKOUT=0`.
- Use a consented real card payment of at least Stripe's applicable minimum (do not try $0.01) and verify checkout redirect, paid webhook, Stripe Dashboard transaction, receipt email, license, runtime delivery, refund revocation, and bank payout. No live payment has been attempted by this checklist.

## Verification
- Repository CI includes the core integration suite and a separate hosted no-charge smoke check on pushes to `main`.
- Public `/api/health` reports mode, Stripe key readiness, webhook configured, Postgres configured, and Lua vault integrity; `/api/store` exposes the public available/unavailable catalog without secrets.
- Do not confuse passing GitHub/HTTP tests with real funds settled in Stripe or a working in-game payload.

Until the owner completes Stripe verification and hosting/payload approvals, the safe result is: **browse enabled, purchases disabled**.
