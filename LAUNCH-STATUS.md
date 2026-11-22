# BL Scripts launch status — 2026-11-22

**Website and customer sign-in: online. Real-money checkout: LOCKED.**

## Verified systems
- Production Render service runs from the `main` branch of `MadeByZebra/zebra-bl-marketplace` and uses a live restricted Stripe server API key. The merchant account diagnostic reports card charges/payouts ready, and the signed **live** webhook exists.
- A no-charge live Stripe preflight successfully created and immediately expired an **unpaid** Checkout Session, read Checkout Sessions, PaymentIntents and charges, and confirmed the email provider accepted a diagnostic. A separate Brevo email was received in the connected owner's Gmail inbox. **Neither preflight represents a successful customer purchase.**
- Production business tables migrated to Neon Free PostgreSQL in Oregon. Migration marker, purchase and license counts verified; a manual recovery snapshot was restored successfully into a separate Neon test branch.
- The repository's daily encrypted GitHub Actions Neon backup completed successfully in run [45061677261](https://github.com/MadeByZebra/zebra-bl-marketplace/actions/runs/45061677261). Its ciphertext artifact was downloaded and decrypted with the offline recovery kit, and the PostgreSQL custom archive signature was verified. The source Neon database was not overwritten. **`LIVE_DATABASE_CONFIRMED=1`** is now justified by these storage and backup checks; backup retention is 30 days and scheduling must continue to be monitored.
- The paid-license grant and Stripe refund/dispute revocation logic was put into the shared production `stripe-fulfillment.js` module and tested against **disposable, real PostgreSQL** in CI. Tests cover correct payment, wrong buyer/SKU/amount/environment, payment failure, signed-event tampering, genuine 100%-off claims, receipt idempotency, and refund/dispute license revocation. No live money or real customer records were used for these tests.
- Six sealed Lua files pass decryption/hash integrity and all six public loaders route to the protected endpoints. **This is not evidence that the scripts are permitted or function correctly in the current Roblox client.** ZFLAG Windows installer is still absent/not approved.

## Still required before charging a real buyer
1. **Product-specific runtime evidence and rights:** The owner reports that all scripts work but has not supplied exact current-client logs/videos/version/platform, or documented distribution permission. The store cannot independently certify functionality from that statement. Roblox prohibits cheating and exploiting; selling unauthorized cheats may violate platform terms, and Stripe acceptance of the merchant account does not establish eligibility for every product category.
2. **Additional delivery testing:** Current Brevo-to-Gmail test passed; one independent second-provider inbox and a real buyer receipt have not been verified.
3. **One consented low-value genuine payment/refund:** After a specific product is eligible, complete Stripe's real payment → signed webhook → Neon paid purchase → customer email → library → personal loadstring → actual authorized runtime → official receipt → refund/dispute → rejected old key. This needs the buyer's payment method and affirmative participation. Never fabricate a successful charge.
4. **Product release flags:** `ALLOW_LIVE_SALES=0`, `LIVE_VERIFIED_SKUS=`, `LIVE_ZFLAG_VERIFIED=0` are deliberately enforced. Do not bypass them to make Buy appear active.

See [runtime release evidence](./PRODUCT-RUNTIME-RELEASE-EVIDENCE.md) and [live payment checklist](./LIVE-PAYMENTS-READINESS.md). No real charges have been made by the audit. Stripe takes transaction fees after real sales start.
