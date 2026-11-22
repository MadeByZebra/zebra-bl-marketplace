# Stripe live webhook staged configuration

Live Stripe Checkout requires a dedicated live Stripe secret key and a **separate live webhook signing secret**. Sandbox and production signing secrets are not interchangeable.

- Current test mode keeps using `STRIPE_SECRET_KEY=sk_test_...` and `STRIPE_WEBHOOK_SECRET=whsec_...` (or `STRIPE_TEST_WEBHOOK_SECRET`) with the approved sandbox test emails.
- A production webhook can be registered in the connected Stripe live account for `https://zebra-bl-marketplace.onrender.com/api/stripe/webhook`, subscribing to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, and `charge.dispute.created`. Store its newly generated `whsec_...` only in Render's `STRIPE_LIVE_WEBHOOK_SECRET` environment variable; never expose it in logs, GitHub, support replies, or chats.
- Changing only the server's Stripe secret key to `sk_live_...` must NOT permit Checkout unless `STRIPE_LIVE_WEBHOOK_SECRET`, merchant authorization, email sender, PostgreSQL, a real public URL, and `ALLOW_LIVE_SALES=1` all pass the server's checkout readiness gate.
- Do not switch `ALLOW_LIVE_SALES=1` until this database is upgraded from Render's expiring free plan **with persistence/backup verified**, the actual in-game Lua scripts being sold have been tested and are distributable, Stripe product eligibility is confirmed, and test purchase/receipt/license/revocation/support checks succeed.
- Never add a production secret to the client-side JavaScript or GitHub Actions logs.

## Real money release procedure (authorized owner)
1. Verify Stripe still reports `charges_enabled=true`, `payouts_enabled=true`, `capabilities.card_payments=active`, and that your actual products comply with Stripe's terms.
2. Upgrade/migrate the free Render database and confirm it can survive restarts and has backups. Preserve buyers and orders.
3. Test the genuine signed Stripe live webhook connectivity and confirm any bad signature is rejected. Keep sandbox mode during the staging test.
4. Set `STRIPE_SECRET_KEY=sk_live_...` through **Render → Environment**. This secret is created/copied by the owner directly from Stripe's API keys screen, not supplied to an assistant.
5. Verify `ALLOW_LIVE_SALES=0` still refuses live checkout, while `/api/health` shows live Stripe authorization and webhook readiness; only then change `ALLOW_LIVE_SALES=1` and keep the $9.99 ZFLAG injector and unverified Class S Joiner on hold.
6. Use an explicitly authorized real purchase at or above payment minimum, check paid status in Stripe, seller settlement, email delivery, official receipt, My Library, license, script execution, webhook replay and revocation of any refunded license. Don't claim a payout until Stripe shows that payout paid.

A browser screenshot of a checkout screen marked `Sandbox` is a simulated payment, never a real earnings transaction.
