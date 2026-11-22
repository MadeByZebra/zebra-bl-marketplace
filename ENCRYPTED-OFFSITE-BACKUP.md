# Encrypted Neon offsite backups (no fixed hosting bill)

**Status: backup workflow prepared; NOT active until the owner adds a private GitHub Actions secret.** Neon-only snapshots do not qualify as independent offsite backups.

## How it works

The scheduled GitHub workflow [encrypted-neon-backup.yml](./.github/workflows/encrypted-neon-backup.yml) runs daily on the public repository's standard GitHub-hosted Ubuntu runner. It uses a PostgreSQL **18** container to run a full-format `pg_dump` from the dedicated **Neon production** database and immediately encrypts it with OpenSSL CMS, AES-256-GCM, and the public certificate under `backups/`. It uploads **only the encrypted** `.cms` file as a GitHub Actions artifact with 30-day retention. Logs never include a connection string, private key, buyer data, or unencrypted archive. The source database is read-only to `pg_dump` and is never modified.

Because this is a **public** repository, its artifacts may be obtainable by other people. Encryption is therefore mandatory; do not upload decrypted snapshots or add the private key to GitHub. GitHub Actions/retention plans and quotas can change, and scheduled jobs can be delayed or skipped. Monitor each run. Never claim a backup exists until the workflow completes with a downloadable artifact.

## One required owner configuration

1. **Download your private backup key from the ChatGPT conversation where this backup workflow was created** and save two secure **offline** copies, outside GitHub and Neon. The private key is not committed to the repository, and the assistant cannot recover a lost private key. Do not send the private key to support or into chat.
2. Open the GitHub repository's **Settings → Secrets and variables → Actions → New repository secret**.
3. Create a secret named exactly `BL_SCRIPTS_NEON_BACKUP_URL`. Paste the **direct TLS-enabled Neon connection string** for the production `neondb`, generated privately in the [Neon console](https://console.neon.tech/). It should begin with `postgresql://` and include `sslmode=require` or `sslmode=verify-full`. Prefer a dedicated read-only backup role with sufficient privileges to read all user tables, rather than the database owner, if one has been safely provisioned. **Never** put the connection string in this public repo, a workflow file, a screenshot or a chat.
4. Open **Actions → Encrypted offsite Neon backup → Run workflow**. Require the run to be **green** and confirm it has an artifact named `bl-scripts-neon-encrypted-<run ID>`. Check that the artifact contains exactly `bl-scripts-database.pgcustom.cms`, not a `.sql` or `.pgcustom` plaintext file.
5. Only after the first backup succeeds may you count encrypted offsite backups as operating. The daily schedule is 14:17 UTC; daylight saving changes its local Central clock time.

## Restore rehearsal (safe; use a new empty DB, never production)

1. Download a GitHub Actions encrypted `.cms` artifact to a trusted computer.
2. Place the offline private key `bl_scripts_backup_PRIVATE_KEY.pem` and the PUBLIC cert in a private folder on that computer.
3. Decrypt:

```bash
openssl cms -decrypt -binary -inform DER \
  -in bl-scripts-database.pgcustom.cms \
  -recip bl_scripts_backup_PUBLIC_CERT.pem \
  -inkey bl_scripts_backup_PRIVATE_KEY.pem \
  -out restored-bl-scripts.pgcustom
```

4. Inspect the archive with PostgreSQL 18 `pg_restore --list restored-bl-scripts.pgcustom`. Create a **separate, new, empty** Neon branch/database for testing, and restore into that destination with `pg_restore --no-owner --no-acl --exit-on-error --dbname="$RESTORE_TEST_DATABASE_URL" restored-bl-scripts.pgcustom`. Verify row counts, sign-in rows, purchase and license records. Never restore into the existing live branch. Delete decrypted local copies securely after checking.
5. The live site's own verification flags are NOT automatically changed by a successful restore. Real paid sales require additional functional, merchant-product, delivery and controlled transaction approval.

## Failure modes

- No GitHub secret → workflow fails visibly and **creates no backup**.
- Invalid credentials, quota, TLS, network, encryption or artifact upload failure → run is red; no backup can be claimed.
- Lost private key → all existing ciphertext backups are unrecoverable. Save it offline.
- Expired GitHub artifact → it is deleted at end of retention (currently configured 30 days).
- AES-256-GCM cryptographically protects backup contents, but **never upload the private key or plaintext to a public repository**.
- Keep the separate ChatGPT daily Neon snapshot check and the Neon restore history as complementary—not offsite—recovery tools.

Costs: Standard GitHub-hosted Actions runners in public repos are generally included at no charge, subject to plan and usage policy changes. This implementation starts no paid database tier or new billable service.
