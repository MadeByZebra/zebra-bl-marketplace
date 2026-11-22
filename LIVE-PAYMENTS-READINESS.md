# Zebra's Shop — live payment activation checklist

Status checked November 21, 2026 (Central Time). This is an operational audit, **not** Stripe approval or permission to start live sales. Public checkout remains in restricted sandbox mode.

## Confirmed Stripe account

- Live account: `acct_1Ue1MeFVyugLxZ21` (BL Scripts).
- Stripe API reported `charges_enabled=false`, `payouts_enabled=false`, `details_submitted=false`, and `capabilities.card_payments=inactive`.
- `requirements.disabled_reason=requirements.past_due`.
- No bank payout account was returned.
- Missing business requirements: business type, MCC, truthful product description, website URL, support phone, authorized representative's name, email and date of birth, statement descriptor, and Stripe Terms of Service acceptance.
- Supply actual legal information **inside Stripe only**. Never invent verification details, expose ID documents in GitHub, or accept TOS on behalf of somebody else.

## Safe website state

- Render service: `srv-dc0f6m6k1f9s738vcv3g`; live URL: https://zebra-bl-marketplace.onrender.com
- Server can validate Stripe's account status with `stripe.accounts.retrieve()`; the live checkout gate requires active `charges_enabled`, `payouts_enabled`, and `card_payments`, with no disabled reason.
- `STRIPE_LIVE_ACCOUNT_ID` is configured in Render to reject live credentials from another account.
- Live billing remains disabled using existing `ALLOW_LIVE_SALES=0` and test-mode key. **Do not change this until the checklist below is actually verified**.
- Six encrypted Lua payloads pass file-integrity checks, and license-gated download routes exist. Those checks do **not** prove the scripts work inside the actual game or can't be shared.
- ZFLAG paid installer is not approved or delivered. Do not offer paid delivery until an independently tested, versioned installer is privately stored and its SHA-256 is configured.
- Current free Render database expires December 21, 2026. Move accounts, orders, licenses, and chat to persistent backed-up Postgres before real money is enabled.
- The business-domain sender is not yet fully authenticated. Test code mail, paid receipts, and support messages with more than one receiving provider.

## Actions requiring the account owner or a service approval

1. Stripe Dashboard > Setup guide > Verify your account. Enter truthful business and owner details, accept terms as the account owner, submit any documents Stripe asks for, and connect an account to receive payouts.
2. Disclose the actual product categories including Roblox automation/third-party game utilities. Confirm Stripe permits those products before charging; do not mislabel them as unrelated software.
3. Obtain authorization/licenses to distribute all paid code and test each paid script in the supported Roblox runtime. Confirm the Windows ZFLAG build actually works in the supported current environment; provide signed or checksum-pinned files.
4. Migrate database to a persistent plan, establish backups and a restore rehearsal; authenticate a sender domain and run login/receipt deliverability checks.
5. Create the **live-mode** Stripe webhook at `https://zebra-bl-marketplace.onrender.com/api/stripe/webhook`. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, and `charge.dispute.created`. Use the signing secret for this distinct live endpoint.
6. Only after all of the above are verified, configure `sk_live_...` and the matching live `whsec_...` in Render secrets, retain `STRIPE_LIVE_ACCOUNT_ID`, then deliberately switch `ALLOW_LIVE_SALES=1` with `DISABLE_CHECKOUT=0`.
7. Perform a consented low-value **real** payment with a real card, verify the Stripe dashboard payment, signed webhook, receipt email, paid account entitlement, personalized loadstring, game operation, refund revocation, and first eligible bank payout. Fix any failed step before making public sales available.

## How to verify

- GitHub Action: Marketplace security and integration checks, plus the live checkout smoke test.
- Server: `/api/health` should report `live_merchant_ready=true`, `stripe_api_ready=true`, `webhook_configured=true`, `postgres_ready=true`, and `verified_script_count=6` **with mode `live`** before launch.
- The public `/api/store` should report `checkout_ready=true` and only verified, deliverable products as available. Do not treat a successful script-file hash as proof of Roblox functionality.

## Fraud and redistribution limitations

A personal loadstring embeds a bearer license. Anyone who obtains a valid key can potentially run the loader. Current server-side license verification rejects unpaid or revoked keys, and rotating a license invalidates the previous token, but it does **not** robustly bind a buyer to a Roblox identity or prevent decrypted code reuse. Account binding and abuse controls require separate design and legitimate Roblox testing. No client-side obfuscation can make shared code uncopyable.
