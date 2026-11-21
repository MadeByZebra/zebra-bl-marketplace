# Stripe sandbox launch checklist — Zebra’s Shop

Verified November 21, 2026: public Render storefront and Brevo provider are running; Stripe Checkout remains disabled. Connected Stripe tools currently expose a live account only. The free Render database is due to expire December 21, 2026.

## Step A — Connect a Stripe test environment (do not use live credentials)

In the Stripe Dashboard, select test mode or create a sandbox. Open https://dashboard.stripe.com/test/apikeys and copy your own secret API key beginning sk_test_ privately into Render Environment as STRIPE_SECRET_KEY.

In the same Stripe test environment, create a webhook/Event destination with endpoint URL https://zebra-bl-marketplace.onrender.com/api/stripe/webhook. Subscribe to checkout.session.completed, checkout.session.async_payment_succeeded, charge.refunded and charge.dispute.created.

Copy that **specific Dashboard endpoint's** signing secret (whsec_...) into private Render Environment as STRIPE_WEBHOOK_SECRET. A local Stripe CLI webhook secret isn't interchangeable with the Dashboard one.

## Step B — Safety settings for a publicly accessible test website

Set in the private Render service Environment:

- PUBLIC_URL = https://zebra-bl-marketplace.onrender.com
- STRIPE_SECRET_KEY = your secret sk_test_... value, NEVER in GitHub or chat
- STRIPE_WEBHOOK_SECRET = this Dashboard destination's private whsec_...
- STRIPE_TEST_ALLOWED_EMAILS = one or more comma-separated email addresses you own and have verified for sign-in
- ENABLE_TEST_CHECKOUT = 1
- ENABLE_TEST_SOFTWARE_DELIVERY = 0
- DISABLE_CHECKOUT = 0 (only after the above sandbox credentials are ready)
- ALLOW_LIVE_SALES = 0

Render will deploy your environment changes. The server verifies the Stripe key on startup and refuses checkout for unauthorised testers. In this phase only the $0.50 test-only diagnostic can be checked out. No real money changes hands and no script licenses are issued.

## Step C — Prove sandbox checkout before software access

1. Sign in as an allowlisted tester at https://zebra-bl-marketplace.onrender.com/account/.
2. Open the shop's Payment verification test item.
3. Use a test card (Stripe's 4242 4242 4242 4242, future expiry, any CVC), not a real card.
4. Complete the Stripe-hosted Checkout and return to the account page.
5. Confirm the checkout.session.completed webhook delivery has a 2xx outcome in Stripe Workbench logs, and the diagnostic test order was recorded. Test an abandoned or declined checkout; those must NOT grant an entitlement.
6. Replay a webhook, verifying no duplicate order or license.
7. A passing API key check and webhook endpoint configuration do not by themselves prove actual webhook delivery.

## Step D — Controlled script and promo test

Only after the diagnostic passes, temporarily set ENABLE_TEST_SOFTWARE_DELIVERY=1 for allowlisted testers. Complete a sandbox script purchase. For the ZEBRAFREE 100%-off promo, Stripe must confirm a completed and fully discounted Checkout Session matching the account and SKU. The code has one free order per account and five Stripe coupon redemptions maximum. A $0 order produces no real card charge or card receipt.

Verify My Library, Generate loader, and protected API entitlement checks. Then test a simulated paid purchase and Stripe refund/dispute; access must be revoked. Return ENABLE_TEST_SOFTWARE_DELIVERY=0 afterward. Roblox runtime compatibility is NOT established by these HTTP tests.

## Step E — Separate live launch gate

Do not enable ALLOW_LIVE_SALES or replace sk_test_ with sk_live_ until the seller has arranged the receiving/payout account, Stripe has confirmed product eligibility (including game automation/cheats and distribution rights), a non-expiring backed-up Postgres plan is set up, customer policies are ready, and end-to-end test payments, webhooks, discounts, refunds, receipts and license delivery have passed. Do not sell the unverified ZFLAG installer.

Useful links: https://dashboard.render.com/web/srv-dc0f6m6k1f9s738vcv3g ; https://docs.stripe.com/payments/checkout ; https://docs.stripe.com/webhooks .
