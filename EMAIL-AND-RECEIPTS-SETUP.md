# Zebra's Shop: all-customer email and payment receipts

The shop and its database remain hosted on Render. **Do not paste any secret into GitHub.**

## Deliver six-digit codes to any customer without owning a custom domain

The current Resend sender `onboarding@resend.dev` is limited to the account owner's email. Brevo offers a temporary alternative: if you verify an individual sender (including a personal Gmail address) and Brevo **activates transactional sending**, it may rewrite the from-domain to a Brevo-managed transactional domain. See Brevo's official [sender rules](https://help.brevo.com/hc/en-us/articles/14925263522578-Comply-with-Gmail-Yahoo-and-Microsoft-s-requirements-for-email-senders) and [activation troubleshooting](https://help.brevo.com/hc/en-us/articles/115000188150-Troubleshooting-Issues-with-Brevo-SMTP). This approach is a stopgap and must be tested for delivery.

1. Create/verify your Brevo account at https://app.brevo.com/.
2. In **Senders**, add a Gmail address you control and complete the sender verification email.
3. Ensure **Transactional email** service is activated (new accounts may have to request approval).
4. Generate a **Brevo API v3 key**, not an SMTP relay password.
5. Add the following **private** Render environment variables to zebra-bl-marketplace:
   - `BREVO_API_KEY` = Brevo API key
   - `BREVO_FROM_EMAIL` = the sender address verified in Brevo
   - `BREVO_FROM_NAME` = `Zebra's Shop`
6. Do not remove Resend secrets; the app automatically prefers Brevo when configured.
7. Test sign-in using **two distinct email addresses** you control. Confirm delivery, code expiry, and successful login. Check spam and Brevo Transactional logs.

## Receipts and purchase confirmations

Stripe can send the official payment receipt to the customer email prefilled at Checkout, without a shop-owned email domain. Once your Stripe sandbox is connected and you have tested a purchase, enable **Successful payments** under https://dashboard.stripe.com/settings/emails. Also configure Refund receipts if desired.

After a server-verified payment, Zebra's Shop:
- records the purchase and its actual discounted total,
- attempts one order-confirmation message through the configured transactional provider,
- shows each purchased item in My Account,
- provides an **authenticated link to the Stripe-hosted receipt** in My Account > Order history,
- revokes purchase entitlements following a refund or dispute.

Emails are sent only to verified purchasers. Test-mode Stripe payments may not send genuine receipt emails. Do not activate live sales until a complete test passes, policy compliance is reviewed, and durable PostgreSQL hosting is configured.

**Status:** Code deployment alone does not activate Brevo, verify delivery, turn on Stripe Dashboard receipts, or authorize live payments.

## Complimentary $0 Stripe Checkout

Configure the **private Render** `ZEBRA_FREE_PROMO_CODE` value to `ZEBRAFREE` if you want a limited complimentary promotion. It is one order per verified email account, capped at five completed redemptions in the Stripe coupon. Eligible: available Lua scripts and bundles; not an unavailable ZFLAG installer or test diagnostic. The code has no effect unless Stripe Checkout test mode is configured, the webhook signing secret is set and checkout is explicitly enabled. After Stripe verifies a completed zero-total Checkout Session, the license may be issued and the order appears as a free promotional order. Stripe does not charge a card or issue a card-payment receipt for a $0 order. Do not treat a quote as evidence of purchase.
