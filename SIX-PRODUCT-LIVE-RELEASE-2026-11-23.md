# BL Scripts multi-product live storefront rollout — 2026-11-23

## Owner release direction and evidence boundaries

The seller has stated that the scripts are self-created, that redistribution rights are held, and that the scripts, paid checkout, receipt and delivery workflow function. The only independently evidenced **real-card buyer purchase and game execution** available to this rollout is FPS Optimizer on 2026-11-22 ($1.99); the other five products have not each received a separate production card purchase and external game-runtime audit. Do not represent the shared automated security suite as an independent live-client test of each script.

Production startup verifies AES-GCM sealed assets and expected SHA-256 bytes for all six products (6/6). CI checks payment entitlement, OTP ownership, Stripe webhook grant/refund/dispute, bundle mapping, legacy-license recovery, in-game activation bootstraps, installation matching, and one-time runtime tickets without charging another card.

## Six eligible individual products

| SKU | Price (USD) | Delivery | Special requirements |
| --- | ---: | --- | --- |
| `control-center` | $19.99 | Account-bound Lua | Desktop; Roblox fully loaded |
| `str-grinder` | $9.99 | Account-bound Lua | Class A only; enter Class A before starting |
| `end-grinder` | $9.99 | Account-bound Lua | Class A only; enter Class A before starting |
| `dex-desktop` | $7.99 | Account-bound Lua | Desktop; BOX1/2/3 options |
| `dex-mobile` | $7.99 | Account-bound Lua | Compatible mobile client and persistent file APIs |
| `fps-optimizer` | $1.99 | Account-bound Lua | Graphics simplification; FPS improvement not guaranteed |

## Three eligible bundles

- Class A Training Pack (`class-a-duo`) — $17.98, delivers STR + END
- DEX Cross-Platform Pack (`dex-pair`) — $14.38, delivers DEX Desktop + DEX Mobile
- BL Complete Collection (`complete-collection`) — $52.15, delivers all six individual licenses

Each bundle requires ALL component SKUs to satisfy live verification, payload and merchant gates, and each entitlement is separately retrievable from the purchasing account. Never issue a fake entitlement or bypass purchase confirmation.

## Buyer workflow and protection

1. Email one-time-password login and Stripe Checkout verify the specific purchaser and actual payment.
2. Personal Lua command is server-derived, never stored raw in the database; buy once and view the current command again any time.
3. On the **first installation only**, run the current command to get a ten-character activation code in a monochrome in-game popup, F9 Client log or compatible executor output.
4. Approve the code while signed into the purchasing account, then use the SAME command on the approved installation, including permitted Roblox alts and supported auto-execute.
5. The loader checks a paid active license AND approved local installation before sending sealed Lua. Execution tickets prevent replays of unchanged captures but cannot guarantee that all client-side Lua is impossible to modify or redistribute.
6. Key replacement is rate-limited. Viewing an active key is not a replacement. Legacy hashed-only command recovery preserves the approved installation and does not consume another weekly key reset.
7. Refunds/disputes must continue to revoke access. Nothing about this rollout creates a free public payload.

## Explicitly not in live sale

- `zflag-injector` — Requires a separately built, owner-reviewed, checksum-pinned and functionally verified Windows binary. `LIVE_ZFLAG_VERIFIED=0`.
- `class-s-joiner` — Third-party source rights and independent distribution not established; remains `unavailable:true`.
- `checkout-test` — Test-only SKU excluded in live mode.

## Release configuration

For the first rollout on the **existing** Render service, all six products are enabled in the seller-only **live** test pilot. Do not expose public Checkout until Stripe's own customer-facing business contact information is corrected and the seller accepts the remaining per-product release risks. No product or purchaser data needs to be migrated:

```ini
LIVE_VERIFIED_SKUS=control-center,str-grinder,end-grinder,dex-desktop,dex-mobile,fps-optimizer
LIVE_ZFLAG_VERIFIED=0
LIVE_BUYER_TEST_ONLY=1
LIVE_PUBLIC_SALES_APPROVED=0
```

After the seller updates Stripe Dashboard → Settings → Public business information to set the official BL Scripts support email, reviews the support phone/address, and checks a new Stripe receipt, public rollout can be authorized by explicitly changing LIVE_BUYER_TEST_ONLY=0 and LIVE_PUBLIC_SALES_APPROVED=1. None of those changes can be inferred from successfully buying FPS Optimizer with the seller's own card. Maintain all existing payment, webhook, database, licensing, email, and payload secrets/keys. Production readiness must continue to require `ALLOW_LIVE_SALES=1`, `LIVE_DATABASE_CONFIRMED=1`, a ready Stripe merchant account, approved sender, valid signed webhook, and six verified sealed script payloads. Do not turn off any server-side gate.

## Post-release checks

- Confirm production log includes authorized live Stripe, merchant ready, six of six protected payload integrity, and checkout READY.
- During the seller-only pilot, `/api/store` can advertise the six product and three bundle items, but non-allowlisted users must be blocked from initiating live Stripe Checkout. ZFLAG and Class S must remain unavailable.
- Confirm a seller allowlisted account can see all six individual items and three bundles, with payments requiring Stripe. A non-allowlisted user must be blocked from launching live Stripe checkout. No unauthorized card transactions should be initiated by operators to prove this.
- Track purchases, missing order confirmations, refunds, and support requests. New client compatibility failures must be reflected in catalog gating promptly.
