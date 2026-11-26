# Deploy AttachLink

## Local development setup

1. Install XAMPP with PHP 8, MariaDB 10.6 or newer, PDO MySQL, Mbstring and Fileinfo. Place the project in the Apache web root for local development. Keep Apache rewrite and headers enabled and honor the shipped .htaccess files. The source checkout is not the production document root.
2. Import database/schema.sql on a fresh database. It creates all current tables and records the included migrations. For an existing database, take a backup and run php backend/jobs/migrate.php with a migration account. Review the printed migrations and rerun the checker.
3. Copy backend/env.example to backend/.env if the defaults need changing. Existing environment variables take precedence. Copy the file using local permissions and keep it out of version control and release archives.
4. Run php backend/check-config.php, then php backend/create-admin.php EMAIL PASSWORD FIRST_NAME LAST_NAME. Open the local URL. Run php backend/jobs/send-emails.php manually for a log delivery check.

For standalone QA, install the locked application dependencies with composer install and npm ci. Build CSS with npm run build:css. Run npm run test:e2e to execute the three-role workflow and the full portal smoke and axe sweep. Use an isolated migrated database, ATTACHLINK_ENV=development, ATTACHLINK_MAIL_LOG, ATTACHLINK_BASE_URL, and ATTACHLINK_QA_ADMIN_PASSWORD. Run PHP on loopback port 18745 with tests/e2e/router.php and writable session, upload temporary and document directories. The suite creates synthetic accounts and sends only to the log transport. Set ATTACHLINK_E2E_URL or ATTACHLINK_E2E_CHANNEL to override the base URL or Edge channel.

## Production configuration

Use a VPS with Apache and PHP, TLS certificates, an application-specific database account and private storage. Apache with the shipped .htaccess rules is the only supported web server; nginx and Caddy are unsupported. Direct HTTP traffic to HTTPS before handing it to PHP. Pass a trusted HTTPS indication to PHP when terminating TLS at a reverse proxy. Keep ATTACHLINK_TRUSTED_PROXIES empty for direct Apache access or list the exact managed proxy addresses. Campus NAT users share the IP login bucket.

- Set ATTACHLINK_ENV=production and ATTACHLINK_BASE_URL to the canonical HTTPS URL including the installation path. Development mode is accepted for CLI or HTTP requests whose peer and Host are loopback only; a remote host fails closed. Production admin accounts must complete TOTP, and production session cookies always have the Secure attribute.
- ATTACHLINK_DB_USER must be non-root and ATTACHLINK_DB_PASS non-empty. Configure ATTACHLINK_DB_HOST, ATTACHLINK_DB_PORT and ATTACHLINK_DB_NAME as appropriate.
- Set ATTACHLINK_DOCUMENT_STORAGE to a writable private absolute path outside the Apache DocumentRoot. In development, the default is a per-machine temporary directory; production must configure persistent storage. The checker rejects storage inside the document root. Deny direct access to backend/storage, which contains avatars. Set writable PHP session and upload temporary directories, `session.gc_maxlifetime` to at least 43200 seconds, `upload_max_filesize` to at least 5 MB, `post_max_size` above 45 MB, and `max_file_uploads` to at least nine.
- ATTACHLINK_TRUSTED_PROXIES accepts only comma-separated exact IPv4 or IPv6 addresses. Leave it empty unless the service is behind an explicitly trusted proxy. AI provider settings are optional; when configured, the URL must use HTTPS and URL, model and key must be complete. Set ATTACHLINK_SUPPORT_AI=1 only when those provider settings are ready.
- Production check-config requires ATTACHLINK_BACKUP_DIR and a valid age public ATTACHLINK_BACKUP_RECIPIENT. The backup directory must already exist, be private/writable and be outside the application and document roots. Set ATTACHLINK_BACKUP_DAYS from 1 to 3650.
- Set ATTACHLINK_MAIL_TRANSPORT=smtp for real delivery. Set ATTACHLINK_SMTP_HOST, ATTACHLINK_SMTP_EHLO and ATTACHLINK_SMTP_FROM. STARTTLS defaults to port 587 and implicit TLS to 465. Set the relay's LOGIN or PLAIN mechanism and both credentials if required. The PHP CLI needs OpenSSL and the locked PHPMailer dependencies.
- For Brevo, use `smtp-relay.brevo.com` on port `587` with `starttls` and `LOGIN`. Set `ATTACHLINK_SMTP_USERNAME` to the SMTP login shown in Brevo and `ATTACHLINK_SMTP_PASSWORD` to an SMTP key. Set `ATTACHLINK_SMTP_FROM` to a sender verified in Brevo and `ATTACHLINK_SMTP_EHLO` to your fully qualified application hostname. Set `ATTACHLINK_BASE_URL` to the HTTPS address recipients can open. The existing `send-emails.php` worker delivers verification, recovery, and notification emails from the outbox. [Brevo SMTP setup](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP)
- Run php backend/check-config.php as the service account. It checks DB/schema readiness and pending migrations; exact trusted-proxy IPs; AI URL, model, key and HTTPS consistency; map tile URL/origin; backup directory, recipient and retention; document/avatar storage outside the document root; PHP upload limits, session path and lifetime; mail transport; and the production TOTP key. It never prints secrets and exits non-zero on any failure.
- Set ATTACHLINK_ADMIN_TOTP_KEY to a secret 32-byte key encoded as 64 hexadecimal characters. Keep it in the deployment secret store and retain a protected recovery copy apart from database backups. Administrators enroll an authenticator on their first production sign-in and should store the ten single-use recovery codes offline. Restoring database records requires the same key; see OPERATIONS.md for the lost-device recovery procedure.
- Use ATTACHLINK_MAIL_TRANSPORT=smtp for production. The development-only log transport is rejected outside development; web startup returns a generic 503 and logs the configuration reason, and check-config.php fails. In development, mail-log directories/files are private (0700/0600 on POSIX), outside the application and document roots; links and tokens are redacted by default, with only a token's final six characters shown. Entries older than 24 hours are removed on the next log write. On Windows, restrict the directory and file with an ACL to the development account.

The CSP restricts scripts, styles, fonts and connections to the application origin. `script-src 'unsafe-inline'` remains temporarily because the templates below still contain inline scripts and event-handler attributes. The removal plan is to move these scripts and handlers to same-origin JavaScript files, use a cryptographically random per-response nonce only for any unavoidable dynamic script, and then remove `unsafe-inline` from both the PHP and Apache policies. A static/reusable nonce is not acceptable. Re-run the inventory and browser checks before removing the directive. `style-src 'unsafe-inline'` is a separate remaining style migration.

Remaining inline script blocks (relative paths, 1-based source lines):

| File | Line | Purpose |
|---|---:|---|
| `backend/admin-login.html` | 1 | Administrator login redirect |
| `designs/admin/attachees-directory.html` | 832 | Drawer and directory micro-interactions |
| `designs/admin/placements-registry.html` | 788 | Placement bulk-selection behavior |
| `designs/admin/verification-queue.html` | 431 | Verification queue demo state and interactions |
| `designs/employers/register.html` | 33 | Company registration and optional location behavior |
| `designs/students/account.html` | 80 | Student account loading and editing |
| `designs/students/dashboard.html` | 139 | Dashboard tab interaction |
| `designs/students/dashboard.html` | 154 | Authenticated student identity hydration |
| `designs/students/register.html` | 277 | Student registration validation and submission |

Inline JavaScript event-handler attributes also remain: 40 in `designs/admin/attachees-directory.html` (lines 201, 202, 253, 255, 261, 268, 269, 320, 322, 328, 335, 336, 387, 389, 395, 402, 403, 454, 456, 463, 470, 471, 522, 524, 530, 537, 538, 589, 591, 594, 598, 605, 606, 657, 659, 665, 725, 811, 815, 818), 21 in `designs/admin/verification-queue.html` (lines 52, 55, 58, 66, 75, 77, 101, 125, 152, 176, 200, 224, 277, 280, 380, 383, 386, 389, 398, 402, 408), and one in `designs/admin/system-settings.html` (line 22). These must be replaced with registered event listeners; nonces do not authorize inline event-handler attributes.

Apache adds `X-Content-Type-Options: nosniff`, one-hour public caching for static assets, and `Cache-Control: no-store` for HTML and PHP responses. Authenticated portal pages, API responses and downloads remain non-cacheable. `tests/http-smoke.ps1` checks these response classes. PHP emits HSTS on production HTTPS responses. For HSTS on static files, configure ATTACHLINK_ENV=production in Apache's TLS virtual host or set the header at the TLS terminator. Confirm the entire installation is HTTPS before enabling HSTS.

Run all scheduled commands as the application service account with the deployment environment available. The migration runner is manual: run it once during a deployment/maintenance window; it refuses concurrent runs and records each completed migration step. The document and retention purge jobs also refuse overlapping runs. Email delivery returns non-zero and emits a structured failure count when a send fails. A worker crash after relay acceptance can result in duplicate delivery with the same Message-ID. The admin overview shows each job's last successful run and alerts when it is stale or has never succeeded: email after 5 minutes, document purge after 15 minutes, backup after 36 hours, and retention purge after 72 hours. Repeated failures should be investigated from the job logs and the corresponding outbox, purge queue, or backup directory. See OPERATIONS.md for the retention periods and records affected by the daily purge.

Example Linux crontab entries (replace `/srv/attachlink/current` and `/usr/bin/php` with the installed release and PHP CLI paths; create `/var/log/attachlink` writable by the service account):

```cron
* * * * * /usr/bin/php /srv/attachlink/current/public/backend/jobs/send-emails.php >> /var/log/attachlink/send-emails.log 2>&1
*/5 * * * * /usr/bin/php /srv/attachlink/current/public/backend/jobs/purge-documents.php >> /var/log/attachlink/purge-documents.log 2>&1
15 2 * * * /usr/bin/php /srv/attachlink/current/public/backend/jobs/purge-retention.php >> /var/log/attachlink/purge-retention.log 2>&1
45 2 * * * /usr/bin/php /srv/attachlink/current/public/backend/jobs/backup.php all >> /var/log/attachlink/backup.log 2>&1
```

On Windows, create equivalent tasks under the service account (set its environment/secrets and configure each task to run whether or not the account is logged on). These PowerShell examples use `C:\AttachLink\current\public` and `C:\xampp\php\php.exe`; substitute the installed paths and account:

```powershell
schtasks.exe /Create /TN "AttachLink Send Emails" /SC MINUTE /MO 1 /TR "C:\xampp\php\php.exe C:\AttachLink\current\public\backend\jobs\send-emails.php" /RU "DOMAIN\attachlink" /F
schtasks.exe /Create /TN "AttachLink Purge Documents" /SC MINUTE /MO 5 /TR "C:\xampp\php\php.exe C:\AttachLink\current\public\backend\jobs\purge-documents.php" /RU "DOMAIN\attachlink" /F
schtasks.exe /Create /TN "AttachLink Purge Retention" /SC DAILY /ST 02:15 /TR "C:\xampp\php\php.exe C:\AttachLink\current\public\backend\jobs\purge-retention.php" /RU "DOMAIN\attachlink" /F
schtasks.exe /Create /TN "AttachLink Backup" /SC DAILY /ST 02:45 /TR "C:\xampp\php\php.exe C:\AttachLink\current\public\backend\jobs\backup.php all" /RU "DOMAIN\attachlink" /F
```

Publish the relay's SPF record, enable provider DKIM signing, and publish DMARC for the From domain. Verify alignment on delivered test messages. Begin with a monitoring DMARC policy before considering enforcement. [Sender authentication guidance](https://support.google.com/mail/answer/81126)

## Release and backups

Extract the release into a versioned deployment directory and point Apache's DocumentRoot only at `public/`. The release archive layout is:

```text
attachlink-release/
|-- public/                 Apache DocumentRoot; the only web-reachable tree
|   |-- backend/            Runtime and API; only backend/api/ has HTTP entry points
|   |   |-- jobs/           CLI only; direct HTTP access denied
|   |   |-- lib/            PHP runtime; direct HTTP access denied
|   |   `-- storage/        Private runtime area; direct HTTP access denied
|   |-- vendor/             Composer runtime; direct HTTP access denied
|   |-- composer.json       Direct HTTP access denied
|   |-- composer.lock       Direct HTTP access denied
|   `-- .htaccess           Required access-control and response-header rules
|-- database/               Schema and migrations; outside DocumentRoot
|-- docs/                   Operations documentation; outside DocumentRoot
`-- *.md                    Release documentation; outside DocumentRoot
```

Only `public/` is web-reachable. The release intentionally places backend runtime files, `vendor/`, and Composer metadata below `public/` for PHP loading, so Apache must honor the shipped access rules; only `backend/api/` is an intended backend HTTP entry point. Keep document/avatar storage, backups, sessions and deployment secrets out of the web tree where possible. Before release, `python tests/deployment-layout.py` requests `/database/schema.sql`, `/docs/`, `/vendor/autoload.php`, `/composer.lock`, `/backend/.env`, `/backend/storage/`, `/dist/`, `/test-results/`, `/node_modules/`, `/.git/` and `/dev-router.php` against both the release layout and repository layout; every request must return 403 or 404. The source checkout is not an acceptable production DocumentRoot. Run PHP jobs and the configuration checker from the extracted `public/` directory. In the production TLS virtual host, add `Header always set Strict-Transport-Security "max-age=31536000"` to cover static responses and Apache-generated errors.

Run composer install --no-dev --optimize-autoloader, npm ci, and npm run build:css from the source checkout. Run scripts/build-release.ps1 on Windows or sh scripts/build-release.sh on Linux to create dist/attachlink.zip. The builder and verifier use scripts/release-allowlist.txt and scripts/release-excludes.txt. Use -Verify path on PowerShell or --verify path on Linux to check an existing ZIP.

### Dependency audits

Before every release, with network access from the repository root, run `composer audit --locked` and `npm audit`. Do not publish if either command reports an advisory or cannot complete; review and resolve advisories, update the relevant lockfile, then rerun both audits. This project has no dependency-audit CI workflow, so release operators must run and record these checks locally.

The release vendors Leaflet 1.9.4 in `assets/vendor/leaflet/leaflet.js`. It is licensed under the BSD 2-Clause License; retain `assets/vendor/leaflet/LICENSE.txt` in the release.

### Encrypted backups and key handling

Install age on the backup host and set ATTACHLINK_AGE if it is outside PATH. On an offline or otherwise restricted restore workstation, run age-keygen to generate the identity. Put only the printed public age1 recipient in ATTACHLINK_BACKUP_RECIPIENT on the backup host. Store the private identity off the server, with a second protected recovery copy and access limited to authorized restore operators. Record the recipient and key version in the backup runbook. When rotating, keep old identities available until every backup encrypted to them has expired.

Set ATTACHLINK_BACKUP_DIR to a private existing directory outside the application, document and file-storage roots. ATTACHLINK_MYSQLDUMP selects a compatible dump utility. ATTACHLINK_BACKUP_DAYS defaults to 30. Run `php backend/jobs/backup.php all`; the job recursively archives application documents, student vault files, company verification files, logos, avatars and otherwise-unclassified storage files, including nested paths. Symbolic links and missing database-referenced files cause the run to fail.

Each successful run publishes one directory named `attachlink-backup-<UTC timestamp>-<random id>/` containing matching encrypted `attachlink-db-<id>.sql.age` and `attachlink-files-<id>.tar.age` artifacts. Both artifacts are first written to a private staging directory and made visible together by a directory rename; do not treat files from different directories as a pair. The encrypted tar contains `manifest.json` with per-kind file counts and checksums; it also records the plaintext database dump size and checksum. The backup heartbeat is updated only after the pair is published. The job removes expired pair directories according to ATTACHLINK_BACKUP_DAYS.

Transfer complete pairs off-server into an incoming directory on the backup host, then rename there after transfer completes. For example, with `PAIR=/srv/attachlink-backups/attachlink-backup-YYYYMMDD-HHMMSS-xxxxxxxx`:

```sh
NAME=$(basename "$PAIR")
ssh backup-user@backup.example 'mkdir -p /srv/backups/attachlink/.incoming'
rsync -a -- "$PAIR/" "backup-user@backup.example:/srv/backups/attachlink/.incoming/$NAME/"
(
  cd "$PAIR" &&
  sha256sum *.age
) | ssh backup-user@backup.example "cd /srv/backups/attachlink/.incoming/$NAME && sha256sum -c -"
ssh backup-user@backup.example "mv -- /srv/backups/attachlink/.incoming/$NAME /srv/backups/attachlink/$NAME"
```

Restrict the remote directory to restore operators, retain the encrypted pair under the off-server retention policy, and verify transferred artifact checksums before deleting the source copy. Keep the private age identity off the application and backup servers.

### Restore drill

Perform a restore drill at least quarterly, and after backup-format or key-rotation changes:

1. Copy one complete encrypted pair to an isolated restore workstation and verify both artifact checksums. Retrieve the matching private age identity through the approved recovery process; never place it on the application or backup server.
2. Decrypt both files into an encrypted, access-controlled temporary volume, preserving the database dump's exact filename:

   ```sh
   age -d -i /secure/restore-identity -o /secure/restore/attachlink-db-ID.sql /secure/pair/attachlink-db-ID.sql.age
   age -d -i /secure/restore-identity -o /secure/restore/attachlink-files-ID.tar /secure/pair/attachlink-files-ID.tar.age
   tar -tf /secure/restore/attachlink-files-ID.tar
   mkdir -p /secure/restore/files
   tar -xf /secure/restore/attachlink-files-ID.tar -C /secure/restore/files
   ```

3. Import the SQL dump into an empty isolated staging database, configure the verifier's database environment to use it, and run from the release `public/` directory:

   ```sh
   mysql --database=attachlink_restore < /secure/restore/attachlink-db-ID.sql
   php backend/jobs/verify-restore.php /secure/restore/files /secure/restore/attachlink-db-ID.sql
   ```

   The verifier checks the database dump checksum, every kind's manifest count and checksum, the actual extracted file hashes, the restored database references, and inventory completeness. Do not reopen service if verification fails.
4. Copy the verified `documents/` and `avatars/` trees into the configured private storage locations, apply service-account permissions, run `php backend/check-config.php`, and test sign-in, an existing application, its authorized download and document purge. Review deletion requests made after the snapshot before reopening service. Record recovery time and findings, then securely remove temporary decrypted copies.

See STAGING_CHECKLIST.md for the pilot launch gates and OPERATIONS.md for administrator procedures.

New passwords and unknown-account dummy hashes use bcrypt cost 11. Successful eligible logins upgrade lower-cost bcrypt hashes without changing the password-change timestamp. Higher-cost hashes remain intact. The production setting is defined in backend/config.php. The isolated PHP verification median was 154 ms. Re-benchmark under the staging worker and CPU configuration before the 50-user drill.


To benchmark an Apache and PHP-FPM staging fixture, keep the QA checkout reachable only on loopback, with the tests directory available in that checkout. Set ATTACHLINK_QA_LOGIN_EMAIL and ATTACHLINK_QA_LOGIN_PASSWORD for a disposable student, then run `python tests/login-concurrency.py --require-fpm http://127.0.0.1:PORT`. Use the Apache listener configured for PHP-FPM. The test probes the actual SAPI, submits 100 simultaneous requests from one IP, and reports median and p95. The production ZIP excludes the probe.
