# Zebra's Shop — live payments release and acceptance checklist
**Updated 2026-11-22. Real customer checkout is still intentionally disabled.**

## Confirmed
- Stripe live account `acct_1Ue1MeFVyugLxZ21` reports charges/payouts enabled and `card_payments=active`. Its live restricted server key is authorized in Render; the dedicated webhook is configured for completed Checkout, successful async payment, charge refunds and disputes.
- The Render server's unpaid, owner-only live preflight created and expired a Checkout Session, read Checkout Sessions, PaymentIntents and charges, and did not perform a card charge.
- The website's purchase backend computes the Stripe Checkout amount from server-owned catalog prices and free coupon rules. A signed raw webhook must match the account, SKU, exact amount, mode and resulting PaymentIntent/charge before Neon records paid status.
- The core grant/revoke code was tested on temporary PostgreSQL in CI for successful and forged purchases, 100%-discount reservations, event replay, duplicate receipt prevention, refunds/disputes, and revoked license protection. A separate hosted smoke test checks unauthorized order and license access. **These tests do not represent a completed real card purchase.**
- Neon Free production migration, separate-branch snapshot restore, encrypted offsite backup artifact creation/decryption and archive-header validation were verified. The operator now sets `LIVE_DATABASE_CONFIRMED=1`; monitor backup runs and retain the private offline restore key.
- Brevo sent a fresh owner diagnostic and the recipient Gmail inbox received it. Only this destination is confirmed.

## Unresolved and blocked
- **Product distribution / Roblox terms:** The seller reports all six Lua scripts work, but permitted current-client evidence per SKU has not been supplied or checked. Roblox prohibits cheating/exploiting and distributing exploits. Merchant payment activation is not permission to distribute content that violates a platform's rules or Stripe terms. Confirm rights and suitability before exposing any specific SKU to buyers.
- **ZFLAG:** no approved, current, checksum-pinned Windows installer for paid delivery.
- **Second email provider + real buyer receipt:** not yet tested.
- **Genuine transaction:** there has been **no authorized live card charge**, no real receipt/entitlement confirmation, and no live refund. Such tests need a real customer payment method and explicit payment approval; a 1-cent charge is below Stripe's normal card minimum.
- **Release flags:** `ALLOW_LIVE_SALES=0`, `LIVE_VERIFIED_SKUS=`, `LIVE_ZFLAG_VERIFIED=0` remain in force. Do not bypass them just to show an enabled Buy button.

## Controlled launch procedure when a compliant product is ready
1. Privately record owner rights/permission, SKU, tested client version, platform, date, steps, outcome, and a hash/recording. Never publish actual license keys or decrypted source files.
2. Limit `LIVE_VERIFIED_SKUS` to **only** verified and permitted SKUs. Never include ZFLAG or the Class S Joiner without separate verification. Current Stripe account and webhook must both remain authorized.
3. On Render, deliberately enable `ALLOW_LIVE_SALES=1` only for a controlled window once approvals, backups, and products are ready. Monitor `/api/health` and `/api/store`; catalog availability must match the approved SKU list.
4. With explicit cardholder consent, complete a low-value real Stripe Checkout (not less than the provider's minimum), then check: paid Stripe Session and PaymentIntent → signed webhook → paid Neon order → email receipt → owner's My Library → personal loadstring and accepted loader in authorized game → official receipt URL.
5. Confirm replaying the same webhook does not duplicate paid order, license or email notification. Refund the test purchase via Stripe; verify Neon order is revoked, prior license stops working, and no refund can restore access.
6. If any step fails, set `ALLOW_LIVE_SALES=0` immediately and reconcile pending orders using Stripe and Neon logs. A database backup should not be restored over production as an ordinary rollback.

Security truth: a bearer license can be forwarded. Signed URLs, obfuscation and browser copy blocking cannot guarantee that a purchaser will never redistribute a working script. Buyer accounts, server-side ownership checks, license rotation, and refund gating reduce unauthorized use but do not create perfect DRM.

See [product runtime release evidence](./PRODUCT-RUNTIME-RELEASE-EVIDENCE.md), [current launch status](./LAUNCH-STATUS.md), and [encrypted backups](./ENCRYPTED-OFFSITE-BACKUP.md).
