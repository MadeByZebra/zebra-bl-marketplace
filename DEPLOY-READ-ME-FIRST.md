# Zebra marketplace v3: encrypted payload deployment

**No payment is currently live.** The connected Stripe account has not provided test API credentials or signed webhook configuration. The storefront must remain disabled until tested and the seller confirms platform/processor policy compliance.

This project contains six **encrypted** payloads in `sealed-payloads/`, never the original or obfuscated source. The decryption key is separate, in the seller-only ZIP (`PRIVATE-KEY-DO-NOT-UPLOAD.txt`). NEVER commit or paste the key into GitHub or browser JavaScript.

## Deploy on Render
1. Deploy this Node service (`npm ci` then `npm start`) with `NODE_ENV=production`, `PUBLIC_URL=https://YOUR-RENDER-URL`, `SCRIPT_STORAGE_DIR=./sealed-payloads`, `ZEBRA_PAYLOAD_KEY` (as a Render secret).
2. Use durable PostgreSQL via `DATABASE_URL`. Render's free PostgreSQL databases are temporary; don't accept live payments until a persistent database and backups exist.
3. Configure a verified sender and Resend email API key, `MAIL_FROM`, and 32+ random character `OTP_SECRET`.
4. Configure **Stripe sandbox/test mode only**: `STRIPE_SECRET_KEY=sk_test_...`, `STRIPE_WEBHOOK_SECRET=whsec_...`, `ENABLE_TEST_CHECKOUT=1`, `ALLOW_LIVE_SALES=0`. Register webhook events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, and `charge.dispute.created`.
5. Confirm email one-time code, $0.50 test checkout, authorized library and loader, refund and denial paths.
6. Obtain permission from Stripe for your precise product category, verify platform rules and distribution rights, and only then consider live payments.

Customer loadstrings are **generated only after a verified purchase**. Public repo stubs do not provide a paywall. A determined paying customer can still capture code after loading; no obfuscation or licensing makes a local script impossible to extract.

**ZFLAG injector:** seller supplied a ZIP containing only `launcher.exe`, not verified ZFLAG source or a tested installer. It has NOT been rebranded, modified, or put behind a paid route. Supply a verified ZFLAG release before enabling product.
