# BL Scripts production sales release gates

**Current verified state (2026-11-22):** Live Stripe account, restricted live API key, webhook and bank payouts are activated. PostgreSQL records have been migrated to Neon Free and restored on a separate branch successfully. The protected Lua archives pass SHA-256 checks; real Roblox execution, offsite backups, live buyer mail deliverability and real purchase/refund are not yet verified. Public checkout is intentionally OFF.

The server requires all of these conditions before initiating a live payment:

1. An authorized `rk_live_` or `sk_live_` server API key for the expected Stripe account; merchant `charges_enabled`, `payouts_enabled` and `card_payments=active`; a separate `STRIPE_LIVE_WEBHOOK_SECRET`; Brevo mail settings; owner support contact; `ALLOW_LIVE_SALES=1`.
2. `LIVE_DATABASE_CONFIRMED=1`, set **only after** real database durability, ongoing backup and restore are established. Neon Free has six-hour instant restore history, and one manual snapshot was restored successfully, but scheduled snapshots are not enabled on this account. Free hosting is not a substitute for independent offsite backup of financial records.
3. `LIVE_VERIFIED_SKUS` containing only individual scripts that were actually executed and approved on a current authorized Roblox client, with rights/compliance checked. An encrypted payload hash does not establish that a script works; bundles are only sellable when every included SKU is approved.
4. `LIVE_ZFLAG_VERIFIED=1` is reserved for a newer, owner-reviewed, SHA-pinned Windows installer **and** successful Windows/Roblox integration testing. There is currently no approved installer; leave this false. Class S Joiner remains unavailable.
5. Stripe's actual permitted-product policy and any applicable rights or service terms must be reviewed for the real Roblox training automation and FastFlag software, notwithstanding accurate business profile disclosures.

## Evidence and next steps

- A non-paying live Checkout preflight successfully created and expired an unpublished session. It verified permission to read Checkout Sessions, PaymentIntents and charges, and got a provider-accepted Brevo test email. No actual purchase, buyer receipt, settlement, or webhook delivery was proven by the preflight.
- Verify sender inbox delivery with two independently controlled mailboxes; confirm sign-in OTP works end to end and purchase confirmation arrives after a paid test.
- Test each product on a **current permitted client** and attach private test evidence; only then populate `LIVE_VERIFIED_SKUS`.
- Configure an independent encrypted offsite backup and rehearse a restore; never claim recurring backups succeeded just because a future scheduled ChatGPT task exists.
- On a verified and approved product, conduct a seller-authorized live card purchase above Stripe's minimum, confirm paid webhook, My Library, licensed loadstring delivery and real runtime execution, check official receipt email/URL, and refund or dispute with revocation verification.
- Only after all release gates pass, switch `ALLOW_LIVE_SALES=1` for the approved SKUs. Do **not** bypass the gate by editing environment flags without the evidence.

See [Product runtime and payment release evidence](./PRODUCT-RUNTIME-RELEASE-EVIDENCE.md) for the per-SKU matrix.
