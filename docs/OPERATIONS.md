# AttachLink operations

## Administrators

Create the initial administrator with php backend/create-admin.php EMAIL PASSWORD FIRST_NAME LAST_NAME. Use a unique password and share it through an approved secure channel. Administrators can create and deactivate other administrators from System settings, Admin audit log. Deactivation invalidates sessions and is audit logged. An administrator cannot deactivate their own account.

For password recovery, use the normal reset link. If the daily per-email reset quota was exhausted, confirm the user's identity independently and use Clear daily reset quota on the audit page. IP and email/IP limits continue to apply. Inspect the outbox and mail worker logs if the link does not arrive. Avoid editing password hashes or session records directly.

## Employer verification and retention

Review company evidence in Verification before approving an employer. Use Mark email verified only after confirming control of the account outside the portal. Both actions are recorded in the audit log.

Students can delete their accounts and submitted data in Account. Database records are removed transactionally and file removal retries through backend/jobs/purge-documents.php. Investigate persistent pending deletions. The retention report shows aged reset, mail and audit records and accounts that predate recorded consent. Report thresholds are review markers. Agree on retention and legal requirements before deleting audit information. Existing backups expire according to the operator's backup policy.

For restoration, follow DEPLOYMENT.md using an isolated staging instance. Validate the restored account access and document privacy before reopening service.
