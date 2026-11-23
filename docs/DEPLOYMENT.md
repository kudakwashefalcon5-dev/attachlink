# Deploy AttachLink

## Local development setup

1. Install XAMPP with PHP 8, MariaDB 10.6 or newer, PDO MySQL, Mbstring and Fileinfo. Place the project in the Apache web root. Keep Apache rewrite and headers enabled and honor the shipped .htaccess files.
2. Import database/schema.sql on a fresh database. It creates all current tables and records the included migrations. For an existing database, take a backup and run php backend/jobs/migrate.php with a migration account. Review the printed migrations and rerun the checker.
3. Copy backend/.env.example to backend/.env if the defaults need changing. Existing environment variables take precedence. Copy the file using local permissions and keep it out of version control and release archives.
4. Run php backend/check-config.php, then php backend/create-admin.php EMAIL PASSWORD FIRST_NAME LAST_NAME. Open the local URL. Run php backend/jobs/send-emails.php manually for a log delivery check.

For standalone QA, install the locked application dependencies with composer install and npm ci. Build CSS with npm run build:css. Run npm run test:e2e to execute the three-role workflow and the full portal smoke and axe sweep. Use an isolated migrated database, ATTACHLINK_ENV=development, ATTACHLINK_MAIL_LOG, ATTACHLINK_BASE_URL, and ATTACHLINK_QA_ADMIN_PASSWORD. Run PHP on loopback port 18745 with tests/e2e/router.php and writable session, upload temporary and document directories. The suite creates synthetic accounts and sends only to the log transport. Set ATTACHLINK_E2E_URL or ATTACHLINK_E2E_CHANNEL to override the base URL or Edge channel.

## Production configuration

Use a VPS with Apache and PHP, TLS certificates, an application-specific database account and private storage. Direct HTTP traffic to HTTPS before handing it to PHP. Pass a trusted HTTPS indication to PHP when terminating TLS at a reverse proxy. Keep ATTACHLINK_TRUSTED_PROXIES empty for direct Apache access or list the exact managed proxy addresses. Campus NAT users share the IP login bucket.

- ATTACHLINK_ENV=production and ATTACHLINK_BASE_URL must be the canonical HTTPS URL including the installation path.
- ATTACHLINK_DB_USER must be non-root and ATTACHLINK_DB_PASS non-empty. Configure ATTACHLINK_DB_HOST, ATTACHLINK_DB_PORT and ATTACHLINK_DB_NAME as appropriate.
- ATTACHLINK_DOCUMENT_STORAGE should resolve to a private directory where the service can write. Deny direct access to backend/storage, which contains avatars. Set a writable PHP session directory and upload temporary directory. Set upload_max_filesize to at least 5 MB, post_max_size above 45 MB and max_file_uploads to at least nine.
- Set ATTACHLINK_MAIL_TRANSPORT=smtp for real delivery. Set ATTACHLINK_SMTP_HOST, ATTACHLINK_SMTP_EHLO and ATTACHLINK_SMTP_FROM. STARTTLS defaults to port 587 and implicit TLS to 465. Set the relay's LOGIN or PLAIN mechanism and both credentials if required. The PHP CLI needs OpenSSL and the locked PHPMailer dependencies.
- Run php backend/check-config.php as the service account. It checks configuration, DB and schema readiness, document writability and mail transport settings without sending mail or printing secrets.
- Set ATTACHLINK_ADMIN_TOTP_KEY to a secret 32-byte key encoded as 64 hexadecimal characters. Keep it in the deployment secret store and retain a protected recovery copy apart from database backups. Administrators enroll an authenticator on their first production sign-in and should store the ten single-use recovery codes offline. Restoring database records requires the same key.

The CSP restricts scripts, styles, fonts and connections to the application origin. Inline scripts and styles are still used by the current portal templates. Apache applies framing, referrer and permissions restrictions. PHP emits HSTS on production HTTPS responses. For HSTS on static files, configure ATTACHLINK_ENV=production in Apache's TLS virtual host or set the header at the TLS terminator. Confirm the entire installation is HTTPS before enabling HSTS.

Run the mail job every minute and the document purge job every five minutes as the service account. Use absolute PHP and script paths and collect stderr. The mail job retries and returns exit 1 if any send fails. A worker crash after relay acceptance can result in duplicate delivery with the same Message-ID. Review the outbox and document purge queue if a job repeatedly fails.

Publish the relay's SPF record, enable provider DKIM signing, and publish DMARC for the From domain. Verify alignment on delivered test messages. Begin with a monitoring DMARC policy before considering enforcement. [Sender authentication guidance](https://support.google.com/mail/answer/81126)

## Release and backups

Extract the release into a deployment directory and set the Apache DocumentRoot to its public/ subdirectory. Keep database/, docs/ and the top-level Markdown files beside public/. Run PHP jobs and the configuration checker from public/. In the production TLS virtual host, add `Header always set Strict-Transport-Security "max-age=31536000"` to cover static responses and Apache-generated errors.

Run composer install --no-dev --optimize-autoloader, npm ci, and npm run build:css from the source checkout. Run scripts/build-release.ps1 on Windows or sh scripts/build-release.sh on Linux to create dist/attachlink.zip. The builder and verifier use scripts/release-allowlist.txt and scripts/release-excludes.txt. Use -Verify path on PowerShell or --verify path on Linux to check an existing ZIP.

### Encrypted backups and key handling

Install age on the backup host and set ATTACHLINK_AGE if it is outside PATH. On an offline or otherwise restricted restore workstation, run age-keygen to generate the identity. Put only the printed public age1 recipient in ATTACHLINK_BACKUP_RECIPIENT on the backup host. Store the private identity off the server, with a second protected recovery copy and access limited to authorized restore operators. Record the recipient and key version in the backup runbook. When rotating, keep old identities available until every backup encrypted to them has expired.

Set ATTACHLINK_BACKUP_DIR to a private existing directory outside the document root. ATTACHLINK_MYSQLDUMP selects a compatible dump utility. ATTACHLINK_BACKUP_DAYS defaults to 30. Run php backend/jobs/backup.php all during maintenance for a consistent pair. The job streams plaintext directly into age and publishes .sql.age and .tar.age files. The tar includes application and company documents and student avatars. Database-only and document-only modes are also available. Each artifact is published only after encryption succeeds. Treat matching successful database and file snapshots as a pair. Retention removes matching encrypted backups only. Move any legacy plaintext backups into restricted storage and encrypt or dispose of them under the agreed retention policy.

### Restore drill

1. Copy the encrypted pair to an isolated restore workstation and verify it belongs to the same snapshot. Retrieve the private identity there using the approved recovery process.
2. Decrypt before importing or extracting. Run `age -d -i /secure/restore-identity -o snapshot.sql attachlink-db-SNAPSHOT.sql.age` and `age -d -i /secure/restore-identity -o snapshot.tar attachlink-files-SNAPSHOT.tar.age`. Stage decrypted data only in an encrypted, access-controlled temporary volume. Keep the identity off the web and backup servers.
3. Inspect the tar member paths and extract documents and avatars into separate private directories. Import the SQL into an empty staging database with the MariaDB client. Copy documents to ATTACHLINK_DOCUMENT_STORAGE and avatars to backend/storage/avatars.
4. Match permissions, run the checker and migrations, then test sign-in, an existing application, its authorized download and document purge. Record recovery time and findings. Review deletion requests made after the snapshot before reopening service. Remove temporary decrypted copies after the drill.

See STAGING_CHECKLIST.md for the pilot launch gates and OPERATIONS.md for administrator procedures.

New passwords and unknown-account dummy hashes use bcrypt cost 11. Successful eligible logins upgrade lower-cost bcrypt hashes without changing the password-change timestamp. Higher-cost hashes remain intact. The production setting is defined in backend/config.php. The isolated PHP verification median was 154 ms. Re-benchmark under the staging worker and CPU configuration before the 50-user drill.


To benchmark an Apache and PHP-FPM staging fixture, keep the QA checkout reachable only on loopback, with the tests directory available in that checkout. Set ATTACHLINK_QA_LOGIN_EMAIL and ATTACHLINK_QA_LOGIN_PASSWORD for a disposable student, then run `python tests/login-concurrency.py --require-fpm http://127.0.0.1:PORT`. Use the Apache listener configured for PHP-FPM. The test probes the actual SAPI, submits 100 simultaneous requests from one IP, and reports median and p95. The production ZIP excludes the probe.
