# BL Scripts launch status — verified 2026-11-22

**Store browsing and customer sign-in: online. Real-money checkout: LOCKED.**

- Render web service is on Free plan; latest production code supports restricted `rk_live_` Stripe server keys.
- Live Stripe merchant is active with payouts, truthful product description and enabled webhook. One **unpaid** private live Checkout Session was created/expired successfully using the actual Render server key. Stripe lists zero live charges at the time of the 2026-11-22 audit.
- The real server key could read Checkout Sessions, PaymentIntents and charges. Brevo accepted one diagnostic email, but destination inbox delivery wasn't verified.
- PostgreSQL migrated from Render's expiring Free database to Neon Free (Oregon); migration data and separate-branch restore were verified, but independent automatic offsite backups are **not** configured. A manual Neon snapshot exists and a ChatGPT daily snapshot task is scheduled; future task success is not guaranteed.
- Six sealed scripts pass cryptographic integrity, **not** real Roblox runtime execution. ZFLAG Windows installer absent.
- `ALLOW_LIVE_SALES=0`, `LIVE_DATABASE_CONFIRMED=0`, `LIVE_VERIFIED_SKUS=`, `LIVE_ZFLAG_VERIFIED=0` remain set.
- See [Product runtime and payment release evidence](./PRODUCT-RUNTIME-RELEASE-EVIDENCE.md) for exactly what is still required before the first charge.

**No customer payments, refund tests, or bank payout tests have been performed by this audit.**
