# Zebra's BL Scripts — v3 build, security, and launch status

Build: 2026-11-20 local (Central time) / 2026-11-21 UTC

## Completed and verified locally
- Six provided obfuscated Lua scripts preserved **exactly** and sealed with AES-256-GCM authenticated encryption, then verified byte-for-byte after decryption.
- Public/deploy package includes **ciphertext only**, not the original Lua or readable obfuscated Lua.
- Decryption key is separate and **not** in the deploy ZIP. It is in the private seller archive and separate private key file.
- Server routes require verified Stripe purchase, valid account entitlement and personal license before returning a script.
- License rotation revokes previously issued loadstring URLs; refund/dispute gates are implemented.
- Dedicated ZFLAG binary route requires verified paid ownership, but **no verified new ZFLAG installer supplied**. A past user ZIP contains `launcher.exe`, not ZFLAG source.
- Shared brand and visual style retain the ZFLAG grayscale + Geist + glass UI. Offline interactive HTML preview included.
- 14 Node test cases passed; `node --check` passed for backend/client modules.
- Sandbox-only checkout SKU is $0.50. No real payment has been made or processed.

## What is NOT yet proven / must be finished before selling
- A deployed, reachable Node storefront backend (not yet published to GitHub or Render).
- Production-grade persistent Postgres with backups. A **temporary free Render PostgreSQL database** has been created for testing (expires 2026-12-21).
- Stripe sandbox `sk_test_...` secret key and a corresponding signed `whsec_...` webhook; only a live Stripe account is connected in ChatGPT, and no test-mode secrets were provided.
- Verified transactional email sender (Resend key and MAIL_FROM) and SUPPORT_EMAIL.
- End-to-end email, webhook, payment, refund, purchase ownership and download tests against hosted instances; the current 14 checks are local structural/crypto unit checks, not hosted E2E.
- Windows ZFLAG injector artifact (verified, digitally signed where feasible, tested on Windows).
- Script compatibility in live Roblox clients; not tested in Roblox. Roblox prohibits exploits/cheating and platform account sanctions are possible.
- Payment processor/platform acceptance of the precise product category; request written authorization before live sales.
- Seller's product showcase footage and accurate support/refund terms.
- No guarantee prevents a paying client from capturing executed Lua; obfuscation and encryption at rest reduce leakage but are not copy-proof DRM.

## Exact files sealed
- `control-center.lua` — 590273 bytes of obfuscated Lua, SHA-256 `6f97e5bfebeb1097ba764457cef7c5d432021c7746d931b54bc1ef494095aa2c`
- `str-grinder.lua` — 21694 bytes of obfuscated Lua, SHA-256 `5d0d470d09d3579d843db40ba0e83a00093f190d08573d1480ef8a2dd533428b`
- `end-grinder.lua` — 35152 bytes of obfuscated Lua, SHA-256 `076b81cd2fec60422ef601ca824749cf085d936b280d37c5cf47f0b2bec1ff86`
- `dex-desktop.lua` — 47738 bytes of obfuscated Lua, SHA-256 `0c8c8247bcdc5de3adf02005d9ce0bb2e1e99ac9ae9549c5b1a164ca2184b51c`
- `dex-mobile.lua` — 34900 bytes of obfuscated Lua, SHA-256 `1dfaeb06661ad285ad846e12ac4613d77ef2e358986a5e811a49430e4c845eb9`
- `fps-optimizer.lua` — 8149 bytes of obfuscated Lua, SHA-256 `a6820d53cf41ea3ef98132ecf27f05b4c61647832052a650601d03f8653aacd0`

## Keep these separate
- `Zebra-v3-DEPLOY-SAFE.zip`: safe to commit to a public repository **only if the AES key is never committed**. Contains ciphertext sealed payloads and public backend code.
- `Zebra-v3-SELLER-PRIVATE.zip`: must stay private. Contains the key, original scripts, obfuscated Lua and deploy package.

## Sandbox test sequence once connected
1. Configure secrets on Render and email sender; checkout remains disabled while incomplete.
2. Request a six-digit code and confirm the same code cannot be reused, and wrong/expired codes fail.
3. Open Stripe TEST Checkout for $0.50; never use a real card for test mode.
4. Confirm a signed webhook creates an owned test receipt but does not unlock software.
5. Buy an actual script in test mode; verify license issue and authorized fetch work.
6. Try unpaid and random keys; expect HTTP 403. Rotate license; old key fails.
7. Simulate refund or dispute; license fetch fails afterward.
8. After all checks, evaluate whether the products can legally and contractually be sold, then enable live payments only with explicit authorization.
