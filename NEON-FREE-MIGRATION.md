# $0 monthly hosting: safe Render → Neon migration

The store's Render web service remains on its Free plan. The current Render Free PostgreSQL database expires **December 21, 2026**, and has no automatic logical backups. A Neon Free PostgreSQL database is a possible replacement with a limited restore history and strict usage caps. Free is not equivalent to paid high-availability database hosting or offsite backups. **Never call a payment system production-ready solely because it uses Neon.**

## Prerequisites

1. Connect the Neon plugin in ChatGPT or create a Neon Free project through Neon's console. Choose a Neon region reasonably close to the Render Oregon web service. Choose the *Free* plan without entering a paid subscription.
2. Keep the existing Render `DATABASE_URL` intact as the migration source. **Do not put database connection strings in chats, GitHub, frontend code or screenshots.**
3. Find the *direct, TLS-protected* Neon PostgreSQL connection string in Neon's dashboard. It should include `sslmode=require`. The destination must be a brand-new empty PostgreSQL database dedicated to BL Scripts.
4. Verify the target has capacity and the data can be restored. Neon Free has usage and restore-history limits; for long-term financial/customer records, implement periodic encrypted independent backups.

## Safe three-deploy sequence

**Deployment A — freeze writes on the old Render source.** In Render → BL Scripts → Environment set `STORE_MAINTENANCE=1`. Leave `DATABASE_URL` unchanged, `ALLOW_LIVE_SALES=0` and `NEON_MIGRATION_APPROVED=0`. Save and deploy, wait until the new revision is live. Maintenance locks *all* POST/PATCH/DELETE purchase, login and support write endpoints (including Stripe webhooks, which return retryable 503 responses), and pauses background receipt/reconciliation jobs. Verify `/api/store` says checkout unavailable.

**Deployment B — atomically copy and switch the running app to Neon.** Save the newly issued private Neon direct connection URL in Render's `NEON_DATABASE_URL` variable (NEVER in GitHub). Keep `DATABASE_URL` pointing at the existing Render source. Set `NEON_MIGRATION_APPROVED=1` while `STORE_MAINTENANCE=1`, then save and deploy. Before listening, the new instance will:
- Acquire a transaction-level Postgres migration lock.
- Reject preexisting customer data on the target, unless it contains this migration's committed completion marker.
- Read the Render source in a consistent **read-only** transaction.
- Create exactly the app's nine business tables on Neon and transfer users, sign-in codes/sessions, purchases, paid licenses, receipt notification state, promotions, and support chat messages.
- Validate every copied table's column schema and counts; commit all target records and the migration marker in one transaction. On any failure, roll back all destination changes and refuse to start; the source is **never deleted or modified**.
- On restart, detect the committed marker and use Neon without needing the expiring Render source online.

After Deployment B is **live**, check `/api/health`: `database_backend` should be `neon` and `neon_migration_status` should read `migrated` or `already_migrated`.

**Deployment C — resume writes only on Neon.** In Render set `STORE_MAINTENANCE=0`, keep `NEON_DATABASE_URL` and `NEON_MIGRATION_APPROVED=1`, then save/deploy and check the health endpoint again. Do **not** turn on `ALLOW_LIVE_SALES` until real product verification, receipt/email/license QA, reliable retention/backup, Stripe merchant/product eligibility review and a controlled authorized payment test have all passed.

## Safety details

- If the Neon URL is present but `NEON_MIGRATION_APPROVED` is not `1`, the app continues to use the original Render database.
- The first migration is refused unless the source is frozen with `STORE_MAINTENANCE=1`.
- Repeated deploys are idempotent after the target's completed marker is committed.
- If the destination contains *any* existing store record without that marker, the migration aborts instead of overwriting it.
- Passwords, OTP hashes, licenses and customer emails are copied privately between PostgreSQL instances; application logs emit no customer records or connection URLs.
- The Render free DB has an empty external IP allowlist, so an external Neon Import Wizard cannot reach it directly. Running this transfer inside the Render service avoids opening the source database to the internet.
- Never run the transfer and re-enable writes in the same deploy. The old instance must be made read-only first, before its data snapshot is taken.
- The free Neon instant-restore window is limited. **Independent encrypted offline backups still need to be configured.** No backup plan, runtime compatibility result or real purchase is certified by this migration tool.
