# AttachLink operations

## Administrators

Create the initial administrator with php backend/create-admin.php EMAIL PASSWORD FIRST_NAME LAST_NAME. Use a unique password and share it through an approved secure channel. Administrators can create and deactivate other administrators from System settings, Admin audit log. Deactivation invalidates sessions and is audit logged. An administrator cannot deactivate their own account.

For password recovery, use the normal reset link. If the daily per-email reset quota was exhausted, confirm the user's identity independently and use Clear daily reset quota on the audit page. IP and email/IP limits continue to apply. Inspect the outbox and mail worker logs if the link does not arrive. Avoid editing password hashes or session records directly.

### Development mail log

Use SMTP for production delivery. The log transport is development-only; it cannot be enabled on a remote web host, and check-config.php rejects unsafe settings. The mail log is outside the application/document roots, uses private directory/file permissions (0700/0600 on POSIX), and redacts links and tokens by default. It can still contain recipient addresses and message content, so limit access and do not send the log to users or support tickets. Entries older than 24 hours are pruned on the next write.

### Administrator authenticator recovery

Production administrator accounts require TOTP after password sign-in. At initial enrollment, save all ten single-use recovery codes offline. If the authenticator device is unavailable, enter one unused recovery code in the authenticator-code field; it is consumed on use and the event is recorded. Do not reuse codes or put them in email, tickets or chat.

There is no self-service authenticator replacement screen. If the administrator can still sign in but needs a replacement device, or has lost both the device and all recovery codes:

1. Verify the administrator's identity through the organization's approved out-of-band process, open an incident/change record, and take a protected database backup.
2. A trusted database operator selects and verifies the active administrator's exact numeric ID:

   ```sql
   SELECT id FROM users
   WHERE email='admin@example.org' AND role='admin' AND is_active=1;
   ```

3. Substitute the verified ID and run this in the correct production database, keeping the same database session open. Updating `password_changed_at` invalidates existing sessions; deleting the TOTP row forces fresh enrollment:

   ```sql
   START TRANSACTION;
   UPDATE users SET password_changed_at=CURRENT_TIMESTAMP(6)
   WHERE id=123 AND role='admin' AND is_active=1;
   SELECT ROW_COUNT();
   ```

   Continue only if `ROW_COUNT()` is exactly one:

   ```sql
   DELETE FROM admin_totp WHERE admin_id=123;
   COMMIT;
   ```

   Otherwise run `ROLLBACK` and re-check the account. Record the operator and outcome in the incident/change record.
4. The administrator signs in with their existing password, enrolls the replacement authenticator, verifies a current code, and stores the newly issued ten recovery codes offline. Confirm the old device and all previous recovery codes no longer work.

`ATTACHLINK_ADMIN_TOTP_KEY` encrypts the database's authenticator secrets. If that key is missing or changed, restore the original key from its protected recovery copy; do not generate a replacement key to repair existing records. If the password may also be compromised, use the approved password-reset process as part of the incident response.

## Employer verification and retention

The retention report includes saved student vault documents. Replacing a vault file queues the old file for removal. Account deletion queues both current vault files and application copies. The audit page has action filters for document downloads and retention-report views.

Review company evidence in Verification before approving an employer. Use Mark email verified only after confirming control of the account outside the portal. Both actions are recorded in the audit log.

Students can delete their accounts and submitted data in Account. Database records are removed transactionally and file removal retries through backend/jobs/purge-documents.php. Investigate persistent pending deletions. The retention report shows aged reset, mail and audit records and accounts that predate recorded consent.

### Scheduled jobs and data retention

Run `backend/jobs/purge-retention.php` daily as described in DEPLOYMENT.md. The admin overview shows last-successful-run heartbeats and a stale alert when email delivery has not succeeded for 5 minutes, document purge for 15 minutes, backup for 36 hours, or retention purge for 72 hours. Investigate repeated failures from the service-account job logs; a failed job does not update its success heartbeat.

The scheduled retention policy is:

| Data | Purge period |
|---|---|
| Password-reset records | Delete 30 days after `expires_at`. |
| Raw password-reset request IP | Set to NULL 7 days after `expires_at`; the reset row remains until its 30-day deletion. |
| Email-verification tokens | Delete 30 days after `expires_at`. |
| Login-attempt buckets | Delete after their own stored window expires; the database stores each bucket's window length so hourly, 15-minute and daily limits are not confused. |
| Email outbox text and HTML bodies | Clear when `expires_at` is over 30 days old or the sent/terminal-failure time is over 30 days old, whichever cutoff occurs first. The outbox metadata is retained. The mail worker clears bodies immediately on delivery or terminal failure. |
| Document-download audit events (`document.download`) | Delete after 365 days. Other audit actions are not removed by this job. |

These are operational defaults, not a substitute for legal review. Confirm the retention periods with the privacy owner before production use. Backups have their separate ATTACHLINK_BACKUP_DAYS retention and can contain records that have since been purged from the live database; protect and expire them under the backup policy.

### Backups and restore drills

Each successful backup is a single atomically published directory containing a matching encrypted database dump and recursively archived files. Its manifest records counts and SHA-256 checksums for application documents, vault files, company files, logos, avatars and unclassified storage, as well as the database dump. Transfer complete pairs to an access-controlled off-server host; see DEPLOYMENT.md for the transfer commands and age-key handling.

Run and record a restore drill at least quarterly in an isolated environment. Decrypt the pair off-server, restore the SQL into a staging database, extract the file archive to private staging storage, and run `php backend/jobs/verify-restore.php <extracted-files-directory> <decrypted-database-dump.sql>` while configured to connect to the restored database. Investigate any count, checksum or reference mismatch before considering the backup valid. Then test authorized sign-in and document access, record recovery time and findings, and securely remove temporary plaintext.
