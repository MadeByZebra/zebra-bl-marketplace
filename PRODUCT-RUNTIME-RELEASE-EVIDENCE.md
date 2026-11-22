# BL Scripts: actual product runtime release evidence

> As of 2026-11-22 the owner reports the scripts work, but **no per-product authorized current-client runtime evidence has been independently accepted**. Decryption and SHA-256 checks passing for six scripts establish byte integrity only, not functionality. The owner's report is not a verified platform-version or game-permission record.

## Before changing `LIVE_VERIFIED_SKUS` from an empty list

Record seller-owned, permitted test-session evidence for **each individual SKU**, including tester, current Roblox/Boxing League client version, supported platform/executor, exact sealed-payload SHA-256 from the private manifest, test date, reproduction steps, a link to private screen recording or screenshots, and pass/fail notes. Never upload private decrypted scripts, API keys, license keys or buyer information to the public repo.

| SKU | Acceptance tests on an authorized current client | Live release |
| --- | --- | --- |
| `control-center` | Window loads correctly, tabs and toggles respond, supported controls work safely, no sustained errors; session rejoin checked | HOLD |
| `str-grinder` | Enter Class A, detect STR station, start actual training, pause/stop, no stuck loop and no functionality falsely promised for Class B/C | HOLD |
| `end-grinder` | Enter Class A, identify push mat, start END training, pause while mat occupied, change stations/rest timing and stop safely | HOLD |
| `dex-desktop` | Desktop interface, BOX1/2/3 selection, actual in-game progress, blocker pause and safe stop | HOLD |
| `dex-mobile` | Supported real mobile runtime, touch/floating UI, BOX1/2/3, blocker pause, screen rotation and stop | HOLD |
| `fps-optimizer` | Verify intended visual changes in current client, measured before/after FPS on same device and scene; don't promise FPS gains; no critical game breakage | HOLD |

**Important:** Publisher/distribution rights and game-service rules must be reviewed separately. The Stripe business profile describes Roblox automation truthfully, but merchant activation alone is **not** product-category approval. If any SDK, third-party game, or software license forbids the intended sale or distribution, leave that product unsellable.

## Payment/fulfillment QA on a reviewed product only

1. Verify the SKU's actual Lua bytes and local authorized runtime execution; a manifest hash alone does not qualify.
2. Confirm Neon Free has an appropriate recovery plan, a restore test, and independent offsite backup suitable for real customer purchase records; update the corresponding database approval only after evidence.
3. Confirm real Brevo deliverability to **two different recipient providers**, including OTP and buyer confirmation; an API success response isn't inbox delivery.
4. Use a consented **real card** only after live sales gates are ready; Stripe minimum amount rules apply, so a $0.01 card charge is not a usable test. Never fabricate a purchase or confuse an expired preflight Checkout Session with paid funds.
5. Verify signed `checkout.session.completed` webhook, My Library entitlement, buyer-specific loadstring from GitHub bootstrap, private loader execution in-game and official Stripe receipt link.
6. Replay the event and confirm idempotency/no duplicate receipt. Refund/dispute an **authorized** purchase and verify the license no longer obtains the script. Review retry/reconciliation on a controlled failed webhook.
7. Only enable `ALLOW_LIVE_SALES=1` with `LIVE_DATABASE_CONFIRMED=1` **and** the actual verified SKU list. Keep Class S Joiner paused. Keep ZFLAG unsellable until its updated Windows installer is built, checksum-pinned, owner-reviewed, and run on a current Windows/Roblox installation.

## Current verified evidence (2026-11-22)

- Stripe merchant activated: charges and payouts enabled; live webhook enabled for checkout, refund and dispute events.
- Render live restricted server key authorized; unpaid preflight successfully created and immediately expired one **live** Checkout Session, and read Checkout Sessions, PaymentIntents and charges. **No customer card was charged.**
- Brevo accepted a labeled test email and **one newly sent email was confirmed in the connected Gmail inbox on 2026-11-22**; second-provider deliverability and official buyer receipt remain **not tested**.
- Database moved from Render Free (expiration 2026-12-21) to Neon Free Oregon with 9 tables copied; 1 user, 6 historical purchases (test-mode records), 1 license, 2 notification records, 3 support threads and 10 messages were verified immediately after migration.
- Neon production is live, the prior Render database was migrated without deleting the source, and the migration marker plus purchaser/license counts were verified. A manual Neon snapshot was restored to an isolated branch with matching counts. GitHub Actions run [45061677261](https://github.com/MadeByZebra/zebra-bl-marketplace/actions/runs/45061677261) created an **encrypted offsite backup** with 30-day retention; the artifact decrypted and had a valid PostgreSQL archive header. The first backup worked, but scheduled future backups still need monitoring; the offline recovery kit must remain safely stored.
- A new **real PostgreSQL payment fulfillment test suite** passed without contacting live Stripe or creating a charge: paid entitlement, mismatched metadata, wrong amount/mode, incomplete payment, valid coupon reservation, replayed receipt claims, refund/dispute revocation and no resurrection. This is stronger than file-integrity testing, but does not prove a real payment.

- Six protected script payloads passed decryption/hash checks on Render, but **none is runtime-certified** and ZFLAG's approved installer is missing.
- `LIVE_DATABASE_CONFIRMED=1` following verified migration, snapshot restore, and encrypted offsite backup. `ALLOW_LIVE_SALES=0`, `LIVE_VERIFIED_SKUS=`, and `LIVE_ZFLAG_VERIFIED=0` remain enforced. Seller-reported functionality has not been independently runtime-certified.

Don't remove these gates just to make a Buy button look active. The system must genuinely be able to fulfill what it charges for.
