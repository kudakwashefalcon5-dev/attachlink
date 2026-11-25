# Database

The schema uses InnoDB and utf8mb4.

| Table | Key relationships and indexes |
|---|---|
| companies | Primary key id and verification-status index. Owner representatives link through users.company_id. |
| users | Primary key id, unique email and phone, role index and optional company reference. |
| student_profiles | One row per student through the user_id primary key and foreign key. |
| student_skills | One user to many skills through the indexed student foreign key. |
| openings | Company foreign key and composite status/deadline index. |
| applications | Opening and student foreign keys. Unique opening/student pair. |
| application_documents | Application foreign key. Metadata points to a private file in ATTACHLINK_DOCUMENT_STORAGE, outside the document root. |
| saved_openings | Student and opening foreign keys form a composite primary key. |
| notifications | User foreign key and composite user/read index. |
| messages | Sender and recipient foreign keys and composite recipient/sender/date index. |
| placements | Unique application foreign key. |
| student_cvs | One CV per student through the student_id primary key and foreign key. |
| login_attempts | Primary key hashed bucket. Stores fixed-window login counters. |
| company_verification_decisions | Company and administrator foreign keys, decision status, reason and timestamp. |
| company_files | Company foreign key, unique stored filename and company/purpose/id index. |
| student_interview_plans | Student foreign key and composite student/date/time index. |
| application_status_events | Application and reviewer foreign keys plus application/event index. |
| student_preferences | One row per student account through its primary key and foreign key. |
| admin_setting_entries | Administrator foreign key and unique category/name pair. |
| system_settings | Singleton row keyed by id. References the administrator who saved it. |

## Migrations

Import schema.sql on a fresh installation. It contains the complete schema and migration ledger. Existing installations use php backend/jobs/migrate.php after a backup. Upgrade files remain available for installations that started from the original baseline.

## Migration upgrade-09.sql

For upgrades from older installations, apply after upgrade-08.sql. Existing users receive email_verified_at when the column is created. The migration then sets its default to NULL for new users. Rerunning the migration preserves later unverified accounts. password_changed_at is a microsecond-resolution credential version checked by API and portal sessions. Existing sessions with a NULL version are compatible until the first password change.

password_resets holds SHA-256 token hashes, expiry, consumption time and requesting IP. email_verifications stores hashed tokens and expiry. email_outbox holds queued notification and account mail, expiry, attempt count and delivery state. Sent, expired and terminally failed rows have their bodies erased by the worker. Pending account mail contains active links, so database access and backups need protection. email_notifications defaults on in student_preferences and employer_preferences. login_attempts also stores hashed recovery and resend rate-limit buckets with independent namespaces.

admin_audit_log captures administrator, action, target and a JSON detail payload. Admin decisions, status changes, placement writes and settings writes record the audit event in the same transaction as the operation. Withdrawal uses the existing application_status_events table. Placement and acceptance checks retain existing records.


## Migration upgrade-10.sql

Apply after upgrade 09. Adds nullable HTML bodies and stable Message-IDs to the email outbox. Older pending rows still send as plain text. Adds message_email_limits to coordinate notification cooldowns per recipient and an unread-message index. Both queued bodies are erased after successful delivery, expiry or terminal failure.


## Release schema and upgrade 11

database/schema.sql is the complete fresh-install schema. The original baseline is retained as a test fixture. Run php backend/jobs/migrate.php on existing installs. The runner serializes migrations and records each successfully completed upgrade in schema_migrations. Back up before upgrading because MariaDB DDL can commit independently.

Upgrade 11 adds consent_at and consent_version for new registrants, plus the document_purge_queue used to finish account deletion if a file cannot be removed immediately. Older users retain null consent fields. The retention report counts old records and pending removals without printing personal data.
## Company location data

`upgrade-19` adds `provinces` and `towns`, effective location columns on `companies`, the `company_location_proposals` table, and accommodation, transport, meal and remote fields on `openings`. It preserves existing company address fields and does not backfill coordinates from free text. Fresh installs include the same GeoNames reference seed. Stage 1 adds no student coordinates or town fields.

To regenerate the reference INSERT statements from a source checkout, download the GeoNames Zimbabwe `ZW.zip` country extract and run `python scripts/geonames-zw-seed.py path/to/ZW.zip`. The generated SQL preserves the stable GeoNames IDs and includes GeoNames CC BY 4.0 attribution per town. The points are town references. Check local accuracy before relying on a point in a real deployment.
