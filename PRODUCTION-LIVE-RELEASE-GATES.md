# BL Scripts production sales release gates

**Current state:** Stripe is approved for live payments and payouts. The live webhook exists and its signing secret is private in Render. The live site still uses a sandbox API key and an expiring free Postgres instance; it must not accept real charges until the actual digital products have been tested and the merchant has approved their distribution.

The backend now enforces three **independent conditions** before any live Checkout Session can be created:

1. Stripe account and webhook conditions already implemented: a valid `sk_live_` server key for the approved account, live signing secret, active card payments/payouts, verified support email, customer email provider, and `ALLOW_LIVE_SALES=1`.
2. Production database evidence: upgrade or migrate the existing Render `zebra-marketplace-test-db` from its free plan (expires **2026-12-21**) to a persistent managed database with backups, preserving accounts and purchases. Only **after checking the actual plan and backup** may the operator set `LIVE_DATABASE_CONFIRMED=1` in Render. Setting this flag alone does not upgrade a database.
3. Per-product runtime evidence: test each packaged Lua script in an authorized client environment, verify its stated behavior and make sure its sale/distribution complies with applicable rules. Set `LIVE_VERIFIED_SKUS` to a comma-separated list of individual SKUs that have actually passed (e.g. `str-grinder,end-grinder`). No script is on the approved list by default. Bundles are sellable only if *all* included SKUs are individually approved. The Class S external loader remains unavailable.

For the separate Windows ZFLAG package, an owner-approved sealed installer with verified SHA-256 is **also required**, along with real Windows installation/functional checks before setting `LIVE_ZFLAG_VERIFIED=1`. A file hash alone cannot verify that it works with current Roblox clients. Leave `LIVE_ZFLAG_VERIFIED=0` otherwise.

## Owner-only production setup

- Verify with Render that the purchase database is on a paid persistent plan and backups work. Avoid creating a new empty database without migrating users and orders.
- Create or reveal the **live** secret API key directly in Stripe Dashboard → Developers → API keys. Put it only in Render → the BL Scripts service → Environment as `STRIPE_SECRET_KEY`. Do not paste it in chat or GitHub. The server will verify the key belongs to account `acct_1Ue1MeFVyugLxZ21` and the separate `STRIPE_LIVE_WEBHOOK_SECRET`.
- Keep `ALLOW_LIVE_SALES=0` while verifying `/api/health`, `/api/store`, OTP sign-in, seller support, paid webhook, official receipt link, refunds, and buyer loadstring delivery.
- After database and runtime testing, set the reviewed environment flags, confirm payment readiness, and **only then** flip `ALLOW_LIVE_SALES=1` for the approved items.

A live-money test requires a deliberately authorized real card purchase, using at least Stripe's payment minimum. Verify the charge, confirmed receipt, private library, licensed script execution, refund revocation, and Stripe payout status. Never claim a payment or payout has happened until the account reflects it.

The store deliberately stays in sandbox or returns unavailable until every relevant prerequisite is satisfied. These flags are operational approvals, not substitutes for testing or rights review.
