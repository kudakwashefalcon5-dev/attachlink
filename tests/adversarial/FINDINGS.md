# Adversarial Review Findings

Findings recorded during the read-only audit. No application code has been changed.
Planned fixes are deferred until the audit is complete.

| ID | Severity | Status | File | Lines | Summary | Planned fix |
|---|---|---|---|---|---|---|
| F-01 | LOW | SUSPECTED | `backend/api/student/interview-ai.php`; `backend/lib/ChatProvider.php` | `interview-ai.php:49-57`; `ChatProvider.php:18-26` | Interview AI has a six-call/60-second limit per PHP session, which can be reset by starting a new session. No daily or global provider spend accounting was found. | Add persistent account/IP/global rate limits and an explicit provider budget or spend cap; test session rotation and concurrent requests. |
| F-02 | HIGH | SUSPECTED | `backend/config.php`; `backend/api/auth/login.php`; `backend/bootstrap.php`; `backend/api/auth/admin-totp.php` | `config.php:36-50`; `login.php:39-51`; `bootstrap.php:79`; `admin-totp.php:9` | An explicit `ATTACHLINK_ENV=development` selects development mode even if deployment signals otherwise indicate production. Admin TOTP is only required when `APP_ENV==='production'`, so a valid admin password can establish an admin session in development mode. This combines with environment detection; the live deployment value is unknown. | Make environment selection fail closed on deployment signals and require admin MFA independently of the environment label; add tests for production hosts explicitly set to development and conflicting host/environment signals. |
| F-03 | MEDIUM | CONFIRMED | `designs/admin/attachees-directory.html`; `designs/admin/verification-queue.html`; `designs/admin/placements-registry.html`; `designs/admin/dashboard.html` | `attachees-directory.html:201-665,679-797`; `verification-queue.html:90-250,267-430,431-625`; `placements-registry.html:45-126,193-657,699-779`; `dashboard.html:5-447` | Hard-coded sample people, companies, placement rows and metrics are present in admin pages and can be visible to real admins before API hydration; placements samples may remain if loading fails. These are sample records, not evidence of real user data disclosure, but can mislead operational decisions. | Remove sample records from production HTML; show empty/loading states until API data arrives; ensure failures replace rather than retain sample data; test delayed and failed API responses. |
| F-04 | MEDIUM | CONFIRMED | `backend/api/messages.php` | `44-81`, especially `69-80` | There is no per-sender/IP message-send limit. Every send adds an in-app notification; the email gate can send another notification email as soon as the recipient has no unread message, even if a recent email was queued, enabling repeated message/email flooding between eligible peers. | Add persistent sender/recipient and IP quotas; enforce a minimum email interval independently of unread state; test repeated sends across read cycles and new sessions. |
| F-05 | LOW-MEDIUM | CONFIRMED | `backend/api/admin/announcements.php` | `3-12` | Admin bulk announcements insert notifications for the selected active audience but write no audit entry, reducing traceability of bulk user-impacting actions. | Audit actor, audience, timestamp and recipient count for each successful announcement; add tests for audience counts and audit rows. |
| F-06 | MEDIUM | CONFIRMED | `backend/api/messages.php` | `13-19,25-42` | Admins can read active-peer message threads, including message bodies and support status, but the read path does not create an audit event. | Audit admin thread access with actor, participants/thread identifier and timestamp; do not copy message bodies into the audit log; test the event. |
| F-07 | LOW-MEDIUM | CONFIRMED | `backend/api/openings.php`; `backend/api/listings/index.php` | `openings.php:4-5`; `listings/index.php:5-11` | Public opening search has no query-length cap; student listing pagination allows offsets up to 100,000. Neither path has a per-IP rate limit, creating avoidable expensive-query exposure. | Bound search length and maximum offset, add query indexes and per-IP/request throttling; test overlong searches and deep pagination. |
| F-08 | LOW | CONFIRMED | `backend/lib/CompanyLocation.php` | `19-24,52-68` | The pin-to-town distance limit can be configured up to 1,000 km, substantially weakening the intended distance validation. | Reduce/configure a defensible ceiling and test pins just below/above the accepted distance. |
| F-09 | MEDIUM | CONFIRMED | `backend/lib/Mailer.php`; `backend/api/auth/forgot-password.php`; `backend/lib/Accounts.php`; `backend/config.php` | `Mailer.php:14-15`; `forgot-password.php:22,25`; `Accounts.php:76,92`; `config.php:134-139,156-165` | The log mail transport records complete reset-email text and HTML, including one-hour bearer reset URLs, recipient addresses and bodies. Production configuration permits log transport; the default log path is the system temp directory, with no enforced private permissions or rotation. | Disallow log transport in production; redact secrets/security URLs and bodies; enforce private permissions and retention for development logs. |
| P7-01 | LOW | CONFIRMED | `.htaccess`; `dist/attachlink.zip` | root `.htaccess:16-22`; archive exists | The release ZIP is present under `dist/` and is not denied by root Apache rules when the repository root is the document root. It contains selected source/docs/runtime files, not `.env` or storage data. | Serve only the `public/` directory; explicitly deny `dist/` and release archives at the server. |
| P7-02 | LOW | SUSPECTED | `.htaccess`; `test-results/`; `node_modules/` | root `.htaccess:16-22`; `test-results/.last-run.json` exists | Root Apache rules do not deny `test-results/` or `node_modules/`; the former contains test-run metadata and source maps exist under the latter. Contents were not inspected, so sensitivity is unknown. | Keep these paths outside the document root or deny them explicitly; avoid storing test artifacts/dependency maps in the served tree. |
| P5-01 | LOW | SUSPECTED | `backend/api/employer/applications.php`; `backend/api/employer/applicants.php` | `applications.php:7-18`; `applicants.php:2-7` | Employer applicant responses suppress email, city and preferences when `recruiter_visible=false`, but still return student name/ID, education fields and cover letter. Whether that visibility preference should suppress these fields for an employer receiving an application is unclear. | Define the preference contract; if it applies to applicant views, suppress all covered fields server-side and add response-shape tests for both preference states. |
| P1-01 | MEDIUM | CONFIRMED | `backend/api/employer/applicants.php` | `12-20` | The employer status mutation has no opening-status or deadline guard, so an application can be accepted while its opening is closed, archived, draft, or expired if the other guards pass. Whether that transition is prohibited is a product-policy question. | Define the accept-after-close policy and enforce it in the transaction; test every opening state and deadline boundary. |
| P1-02 | LOW | SUSPECTED | `backend/api/openings.php`; `backend/api/listings/index.php` | `openings.php:3-5`; `listings/index.php:9` | The public openings query does not apply the active-employer predicate present in the student listing query; post-deactivation visibility depends on intended policy. | Confirm deactivation visibility policy; align the query and add a disabled-employer regression case if listings should be hidden. |
| P3-01 | MEDIUM | SUSPECTED | `backend/config.php`; `backend/check-config.php`; `backend/.htaccess`; `backend/storage/.htaccess` | `config.php:130-132`; `check-config.php:3,78-88`; `.htaccess:1-3`; `storage/.htaccess:1` | The default `backend/storage/documents` directory is inside the web root when deployed under the documented Apache document root, and is protected by the nested `.htaccess`. A custom `ATTACHLINK_DOCUMENT_STORAGE` path is not checked to be outside the web root or protected by equivalent rules; the checker validates writability, not location. Nginx/Caddy ignore `.htaccess`. | Reject document-storage paths within the document root, or require/verify equivalent server-level access denial; test direct HTTP access for default/custom paths on supported server configurations. |
| P3-02 | LOW | SUSPECTED | `backend/api/openings.php` | `3` | The public opening-detail query checks `published` and verified company status but not deadline, so an expired opening may remain directly readable even though the public list filters expired openings. Expected behavior is unconfirmed. | Confirm expired-detail policy; if expired openings should not be viewable, add the deadline predicate and test identical 404 behavior. |
| P3-03 | LOW | CONFIRMED | `backend/lib/Accounts.php`; `backend/api/documents/download.php`; `backend/api/company-files.php`; `backend/api/admin/audit-log.php` | `Accounts.php:111-113`; `download.php:8`; `company-files.php:19`; `audit-log.php:5-15` | Student/employer actor IDs can be written to `admin_audit_log.admin_id`; the admin view displays raw IDs without a user/role join. The column is semantically misleading for non-admin actions. | Use an actor-neutral user ID and role field (or rename/migrate the existing field), render actor identity explicitly, and test student/employer/admin audit records. |
| P3-04 | LOW | CONFIRMED | `backend/api/student/avatar.php`; `backend/api/company-files.php`; `backend/bootstrap.php` | `avatar.php:23-25,34`; `company-files.php:44-56`; `bootstrap.php:120-124` | Server-side image validation does not re-encode JPEG/PNG uploads or strip metadata. Directly uploaded avatars/logos can retain EXIF, including GPS if present; normal avatar UI canvas encoding is not a server-enforced guarantee. | Re-encode supported images server-side and strip metadata before storage; test with an image fixture containing EXIF/GPS and verify served output has none. |


## Status notes

- `CONFIRMED` describes observed source behavior, not a runtime exploit.
- `SUSPECTED` marks behavior whose security impact depends on deployment or product policy.
- All listed items remain open. No fixes have been implemented.
- Pass 4 source review reported no newly confirmed rendering/email issue in inspected sinks. Dynamic user/provider data was reported as escaped for HTML templates or rendered through text nodes; fixed local links used fixed routes/encoded IDs. Operator-configured map attribution reaches Leaflet `innerHTML`, but is not request/user input.
- Pass 4 was completed after the initial incomplete report: all 85 application-authored `.js`, `.php`, and `.html` files in the enumerated `designs/`, `assets/`, and `backend/lib/` inventory are REVIEWED. `assets/vendor/leaflet/leaflet.js` remains NOT REVIEWED; advisory status is NOT TESTED because no network or local advisory database was available.

## Pass 4 Coverage

The Pass 4 reviewer enumerated the following candidate files. All non-vendored application-authored files in this inventory are REVIEWED. The third-party Leaflet implementation remains NOT REVIEWED, and current advisory verification was NOT TESTED. Sink results do not cover Leaflet internals.

| File | Status |
|---|---|
| `designs/students/account.html` | REVIEWED |
| `designs/students/application-layout.js` | REVIEWED |
| `designs/students/applications.js` | REVIEWED |
| `designs/students/attachlink-common.js` | REVIEWED |
| `designs/students/attachment-details.html` | REVIEWED |
| `designs/students/auth-gate.php` | REVIEWED |
| `designs/students/bookmarks.js` | REVIEWED |
| `designs/students/career-tools.html` | REVIEWED |
| `designs/students/company-logo.js` | REVIEWED |
| `designs/students/cv-builder.html` | REVIEWED |
| `designs/students/cv-builder.js` | REVIEWED |
| `designs/students/dashboard.html` | REVIEWED |
| `designs/students/data-settings.html` | REVIEWED |
| `designs/students/data-settings.js` | REVIEWED |
| `designs/students/delete-account.js` | REVIEWED |
| `designs/students/interview-ai.js` | REVIEWED |
| `designs/students/interview-planner-chart.js` | REVIEWED |
| `designs/students/interview-planner.html` | REVIEWED |
| `designs/students/interview-planner.js` | REVIEWED |
| `designs/students/login.html` | REVIEWED |
| `designs/students/messages.html` | REVIEWED |
| `designs/students/messages.js` | REVIEWED |
| `designs/students/my-applications.html` | REVIEWED |
| `designs/students/notifications.html` | REVIEWED |
| `designs/students/notifications.js` | REVIEWED |
| `designs/students/openings.js` | REVIEWED |
| `designs/students/profile.html` | REVIEWED |
| `designs/students/profile.js` | REVIEWED |
| `designs/students/register.html` | REVIEWED |
| `designs/students/saved-openings.html` | REVIEWED |
| `designs/students/stage18-portal-role.js` | REVIEWED |
| `designs/students/stitch-local-icons.js` | REVIEWED |
| `designs/students/stitch-role-login.js` | REVIEWED |
| `designs/students/student-avatar.js` | REVIEWED |
| `designs/students/student-session-identity.js` | REVIEWED |
| `designs/employers/app.js` | REVIEWED |
| `designs/employers/applicant-documents.js` | REVIEWED |
| `designs/employers/applicant-profile.html` | REVIEWED |
| `designs/employers/auth-gate.php` | REVIEWED |
| `designs/employers/company-profile.html` | REVIEWED |
| `designs/employers/dashboard.html` | REVIEWED |
| `designs/employers/employer-help-admin.js` | REVIEWED |
| `designs/employers/employer-message-links.js` | REVIEWED |
| `designs/employers/employer-messages.js` | REVIEWED |
| `designs/employers/employer-stitch-icons.js` | REVIEWED |
| `designs/employers/login.html` | REVIEWED |
| `designs/employers/messages.html` | REVIEWED |
| `designs/employers/opening-applicants.html` | REVIEWED |
| `designs/employers/openings.html` | REVIEWED |
| `designs/employers/post-edit-opening.html` | REVIEWED |
| `designs/employers/register.html` | REVIEWED |
| `designs/employers/stitch-employer-bridge.js` | REVIEWED |
| `designs/admin/admin-stitch-icons.js` | REVIEWED |
| `designs/admin/app.js` | REVIEWED |
| `designs/admin/attachees-directory.html` | REVIEWED |
| `designs/admin/audit-log.js` | REVIEWED |
| `designs/admin/audit-log.php` | REVIEWED |
| `designs/admin/auth-gate.php` | REVIEWED |
| `designs/admin/companies.html` | REVIEWED |
| `designs/admin/dashboard.html` | REVIEWED |
| `designs/admin/messages.html` | REVIEWED |
| `designs/admin/messages.js` | REVIEWED |
| `designs/admin/placements-registry.html` | REVIEWED |
| `designs/admin/system-settings.html` | REVIEWED |
| `designs/admin/verification-queue.html` | REVIEWED |
| `assets/account-actions.js` | REVIEWED |
| `assets/attachlink-brand.js` | REVIEWED |
| `assets/attachlink-connect.js` | REVIEWED |
| `assets/attachlink-overview.js` | REVIEWED |
| `assets/attachlink-signin.js` | REVIEWED |
| `assets/company-location.js` | REVIEWED |
| `assets/thread-history.js` | REVIEWED |
| `assets/verify-email-banner.js` | REVIEWED |
| `assets/vendor/leaflet/leaflet.js` | NOT REVIEWED (third-party) |
| `backend/lib/Accounts.php` | REVIEWED |
| `backend/lib/AdminTotp.php` | REVIEWED |
| `backend/lib/ApplicationDocuments.php` | REVIEWED |
| `backend/lib/ChatProvider.php` | REVIEWED |
| `backend/lib/CompanyLocation.php` | REVIEWED |
| `backend/lib/Consent.php` | REVIEWED |
| `backend/lib/DocumentPurge.php` | REVIEWED |
| `backend/lib/Env.php` | REVIEWED |
| `backend/lib/Mailer.php` | REVIEWED |
| `backend/lib/MailTemplates.php` | REVIEWED |
| `backend/lib/Migrations.php` | REVIEWED |
| `backend/lib/SupportAssistant.php` | REVIEWED |

Pass 4 also enumerated all admin sample data and checked redirect, URL-scheme, DOM sink, inline data/CSS, and email-header vectors. The detailed trace is in the Pass 4 report in this review; no application code was changed.

The local Leaflet source identifies version 1.9.4. Its internals were not reviewed, and current advisory status is NOT TESTED because this audit used no network and no local vulnerability database. Admin sample records in the directory and verification queue are visible before successful API hydration; the placements registry's sample rows can remain visible if loading fails. Dashboard samples are hidden/replaced by the admin integration. These pages are admin-role gated, not development-only.

## Pass 5 Coverage

Source-only coverage for messaging/notifications, all admin APIs, company-location proposals, public/cross-role responses and rate/abuse paths. Tests listed below were inspected but not run.

| File | Status |
|---|---|
| `backend/api/messages.php` | REVIEWED |
| `backend/api/notifications.php` | REVIEWED |
| `backend/api/admin/admin-accounts.php` | REVIEWED |
| `backend/api/admin/announcements.php` | REVIEWED |
| `backend/api/admin/audit-log.php` | REVIEWED |
| `backend/api/admin/clear-reset-quota.php` | REVIEWED |
| `backend/api/admin/companies.php` | REVIEWED |
| `backend/api/admin/overview.php` | REVIEWED |
| `backend/api/admin/placements.php` | REVIEWED |
| `backend/api/admin/retention.php` | REVIEWED |
| `backend/api/admin/setting-entries.php` | REVIEWED |
| `backend/api/admin/settings.php` | REVIEWED |
| `backend/api/admin/users.php` | REVIEWED |
| `backend/api/admin/verify-user-email.php` | REVIEWED |
| `backend/api/company-location.php` | REVIEWED |
| `backend/lib/CompanyLocation.php` | REVIEWED |
| `backend/api/location-towns.php` | REVIEWED |
| `backend/api/openings.php` | REVIEWED |
| `backend/api/listings/index.php` | REVIEWED |
| `backend/api/listings/detail.php` | REVIEWED |
| `backend/api/student/company-logo.php` | REVIEWED |
| `backend/api/company-files.php` | REVIEWED |
| `backend/api/employer/applications.php` | REVIEWED |
| `backend/api/employer/applicants.php` | REVIEWED |
| `backend/api/employer/applicant-contact.php` | REVIEWED |
| `backend/api/employer/documents.php` | REVIEWED |
| `backend/api/employer/alerts.php` | REVIEWED |
| `backend/api/employer/overview.php` | REVIEWED |
| `backend/api/employer/listings.php` | REVIEWED |
| `backend/api/employer/openings.php` | REVIEWED |
| `backend/api/documents/download.php` | REVIEWED |
| `backend/api/student/applications.php` | REVIEWED |
| `backend/api/student/apply-with-documents.php` | REVIEWED |
| `backend/api/student/withdraw-application.php` | REVIEWED |
| `backend/api/student/account.php` | REVIEWED |
| `backend/api/student/delete-account.php` | REVIEWED |
| `backend/api/student/saved-listings.php` | REVIEWED |
| `backend/api/student/saved.php` | REVIEWED |
| `backend/api/student/interview-ai.php` | REVIEWED |
| `backend/api/auth/admin-totp.php` | REVIEWED |
| `backend/api/auth/login.php` | REVIEWED |
| `backend/api/auth/register.php` | REVIEWED |
| `backend/api/auth/forgot-password.php` | REVIEWED |
| `backend/api/auth/resend-verification.php` | REVIEWED |
| `backend/api/auth/change-password.php` | REVIEWED |
| `backend/api/auth/csrf.php` | REVIEWED |
| `backend/api/auth/verify-email.php` | REVIEWED |
| `backend/api/auth/reset-password.php` | REVIEWED |
| `backend/api/auth/logout.php` | REVIEWED |
| `backend/bootstrap.php` | REVIEWED |
| `backend/config.php` | REVIEWED (source only; `.env` not read) |
| `backend/lib/Accounts.php` | REVIEWED |
| `backend/lib/AdminTotp.php` | REVIEWED |
| `backend/lib/SupportAssistant.php` | REVIEWED |
| `backend/lib/ChatProvider.php` | REVIEWED |
| `backend/lib/MailTemplates.php` | REVIEWED |
| `backend/lib/Mailer.php` | REVIEWED |
| `database/schema.sql` | REVIEWED (relevant tables/constraints) |
| `database/upgrade-10.sql` | REVIEWED |
| `database/upgrade-19.sql` | REVIEWED |
| `tests/location-stage1-db.py` | REVIEWED (not run) |
| `tests/e2e/location-stage1.spec.js` | REVIEWED (not run) |
| `tests/adversarial/FINDINGS.md` | REVIEWED |
| `designs/students/notifications.js` | REVIEWED (rendering path) |
| `designs/students/messages.js` | REVIEWED (rendering path) |
| `designs/employers/employer-messages.js` | REVIEWED (rendering path) |
| `designs/admin/messages.js` | REVIEWED (rendering path) |

## Pass 7 Coverage

Pass 7 source/config review and local release verification. "REVIEWED" is limited to Pass 7 topics. Remaining UI/API source was searched for targeted patterns but not read line-by-line; `.env` and storage contents were intentionally not opened.

| File | Status |
|---|---|
| `.htaccess` | REVIEWED |
| `backend/.htaccess` | REVIEWED |
| `backend/storage/.htaccess` | REVIEWED |
| `designs/students/.htaccess` | REVIEWED |
| `designs/employers/.htaccess` | REVIEWED |
| `designs/admin/.htaccess` | REVIEWED |
| `backend/config.php` | REVIEWED |
| `backend/bootstrap.php` | REVIEWED |
| `backend/check-config.php` | REVIEWED |
| `backend/lib/Env.php` | REVIEWED |
| `backend/lib/Accounts.php` | REVIEWED |
| `backend/lib/Mailer.php` | REVIEWED |
| `backend/lib/MailTemplates.php` | REVIEWED |
| `backend/lib/ChatProvider.php` | REVIEWED |
| `backend/lib/SupportAssistant.php` | REVIEWED |
| `backend/lib/CompanyLocation.php` | REVIEWED |
| `backend/lib/AdminTotp.php` | REVIEWED |
| `backend/api/auth/forgot-password.php` | REVIEWED |
| `backend/api/documents/download.php` | REVIEWED |
| `backend/api/company-files.php` | REVIEWED |
| `backend/jobs/backup.php` | REVIEWED |
| `backend/jobs/migrate.php` | REVIEWED |
| `backend/jobs/purge-documents.php` | REVIEWED |
| `backend/jobs/send-emails.php` | REVIEWED |
| `backend/create-admin.php` | REVIEWED |
| `backend/dev-router.php` | REVIEWED |
| `scripts/build-release.py` | REVIEWED |
| `scripts/build-release.ps1` | REVIEWED |
| `scripts/build-release.sh` | REVIEWED |
| `scripts/release-allowlist.txt` | REVIEWED |
| `scripts/release-excludes.txt` | REVIEWED |
| `docs/DEPLOYMENT.md` | REVIEWED |
| `docs/OPERATIONS.md` | REVIEWED |
| `DEPLOYMENT_GUIDE.md` | REVIEWED |
| `backend/.env.example` | REVIEWED |
| `composer.json` | REVIEWED |
| `composer.lock` | REVIEWED |
| `package.json` | REVIEWED |
| `package-lock.json` | REVIEWED |
| `assets/company-location.js` | REVIEWED |
| `assets/vendor/leaflet/leaflet.js` | REVIEWED for version/source-map reference only |
| `assets/vendor/leaflet/LICENSE.txt` | REVIEWED |
| `designs/employers/app.js` | REVIEWED (working-tree diff examined) |
| `designs/employers/applicant-profile.html` | REVIEWED (working-tree diff examined) |
| `tests/adversarial/FINDINGS.md` | REVIEWED for carry-forward references |
| `backend/.env` | NOT REVIEWED; intentionally not opened |
| `backend/storage/` contents | NOT REVIEWED; document/avatar contents not read |
| Remaining UI/API source files | NOT REVIEWED line-by-line; targeted pattern search only |

## Pass 7 Configuration and Deployment Notes

### Application environment variables

`backend/lib/Env.php` loads `ATTACHLINK_*` assignments only when a process variable is not already set. Empty and absent values differ unless noted below. `backend/check-config.php` coverage is shown in the last column.

| Variable | Default / missing, empty, or malformed behavior | Checker |
|---|---|---|
| `ATTACHLINK_ENV` | No fixed default; absent/empty triggers detection; only `development`/`production` accepted explicitly; deployment signals may produce `unconfigured`. | Yes |
| `ATTACHLINK_BASE_URL` | Local development/CLI fallback `http://localhost/attachlink`; otherwise required; absolute HTTP(S), no credentials/query/fragment; production HTTPS. | Yes |
| `ATTACHLINK_DB_HOST` | `127.0.0.1`; empty or whitespace/control/semicolon invalid. | Yes |
| `ATTACHLINK_DB_PORT` | `mysqli.default_port`, fallback `3306`; integer 1-65535. | Yes |
| `ATTACHLINK_DB_NAME` | `attachlink_db`; empty or whitespace/control/semicolon invalid. | Yes |
| `ATTACHLINK_DB_USER` | `root` outside production; empty invalid; production rejects root. | Yes |
| `ATTACHLINK_DB_PASS` | Empty; accepted outside production, rejected in production; no other format validation. | Yes |
| `ATTACHLINK_DOCUMENT_STORAGE` | Empty → `backend/storage/documents`; checker tests writability/symlink, not web-root location. | Partial |
| `ATTACHLINK_TRUSTED_PROXIES` | Empty trusts none; comma-separated trimmed values; malformed values do not match. | No |
| `ATTACHLINK_MAIL_TRANSPORT` | `log` in development, empty otherwise; only `log`/`smtp` accepted; empty/other fails. | Yes |
| `ATTACHLINK_MAIL_LOG` | Empty → system-temp `attachlink-mail.jsonl`; checks usability/symlink, not restrictive permissions/retention. | Partial |
| `ATTACHLINK_SMTP_HOST` | Empty; required/valid hostname in SMTP mode. | SMTP mode |
| `ATTACHLINK_SMTP_EHLO` | Empty; SMTP requires fully qualified hostname. | SMTP mode |
| `ATTACHLINK_SMTP_TLS` | Empty → `starttls`; only `starttls`/`implicit`. | SMTP mode |
| `ATTACHLINK_SMTP_PORT` | Empty → 587 or 465 for implicit TLS; 1-65535. | SMTP mode |
| `ATTACHLINK_SMTP_AUTH` | Empty → `LOGIN`; only `LOGIN`/`PLAIN`. | SMTP mode |
| `ATTACHLINK_SMTP_FROM` | Empty; valid email required in SMTP mode. | SMTP mode |
| `ATTACHLINK_SMTP_USERNAME` | Empty; if password set, username must be non-empty. | SMTP mode |
| `ATTACHLINK_SMTP_PASSWORD` | Empty; if username set, password must be non-empty. | SMTP mode |
| `ATTACHLINK_ADMIN_TOTP_KEY` | No default; production requires 64 hex characters. | Production only |
| `ATTACHLINK_ZW_LOCATION_BOUNDS` | `-22.5,25,-15.5,33.5`; four valid ordered geographic bounds required. | Yes |
| `ATTACHLINK_LOCATION_MAX_KM` | `150`; numeric >0 and <=1000. | Yes |
| `ATTACHLINK_MAP_TILE_URL` | Empty disables tiles; if set, HTTPS URL with `{z}`, `{x}`, `{y}` and attribution required. | Map settings |
| `ATTACHLINK_MAP_ATTRIBUTION` | Empty; required with tile URL; otherwise ignored; validated non-empty only. | Map settings |
| `ATTACHLINK_MAP_TILE_ORIGIN` | Apache request environment variable; absent/malformed omits tile origin from static CSP, so tiles may be blocked. | No |
| `ATTACHLINK_INTERVIEW_AI_URL` | Empty disables provider; must be valid HTTPS; malformed/non-HTTPS disables provider. | No |
| `ATTACHLINK_INTERVIEW_AI_MODEL` | Empty disables provider; otherwise passed through. | No |
| `ATTACHLINK_INTERVIEW_AI_KEY` | Empty/placeholder/CR-LF disables provider; otherwise bearer key. | No |
| `ATTACHLINK_SUPPORT_AI` | Only exact `1` enables; other/missing disables. | No |
| `ATTACHLINK_BACKUP_DIR` | No default; must be existing writable directory outside app. | No |
| `ATTACHLINK_BACKUP_DAYS` | `30`; integer 1-3650. | No |
| `ATTACHLINK_MYSQLDUMP` | `mysqldump`; no config validation; launch/backup failure exits non-zero. | No |
| `ATTACHLINK_AGE` | `age`; no config validation; launch/encryption failure exits non-zero. | No |
| `ATTACHLINK_BACKUP_RECIPIENT` | No default; valid configured `age1…` recipient required. | No |

### Test/QA environment variables

These are read by test harnesses, not checked by `backend/check-config.php`: `ATTACHLINK_E2E_URL` (loopback:18745 default), `ATTACHLINK_E2E_CHANNEL` (`msedge` default), `ATTACHLINK_LOCATION_TEST_URL` (no default), `ATTACHLINK_QA_ADMIN_PASSWORD`, `ATTACHLINK_QA_LOGIN_EMAIL`, `ATTACHLINK_QA_LOGIN_PASSWORD` (no defaults), `ATTACHLINK_QA_PHP` (XAMPP PHP default), `ATTACHLINK_TEST_PHP` and `ATTACHLINK_TEST_MYSQL` (XAMPP path defaults), `ATTACHLINK_TEST_DB_PORT` (3306, parsed integer), `ATTACHLINK_TEST_DB_PASS` (no default), `ATTACHLINK_TEST_APACHE` (XAMPP Apache default), and `ATTACHLINK_TEST_SENTINEL` (no default). Some tests enumerate/copy process environment. The backup job calls `getenv()` with no key and passes inherited environment to `mysqldump`, overriding `MYSQL_PWD` with DB password.

### Headers and server exposure

- Apache `.htaccess` CSP: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob: [optional tile origin]; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`. Inline scripts/styles are allowed. `Referrer-Policy: no-referrer`; `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`. Static HSTS is conditional on Apache HTTPS and production request environment. PHP config emits production HSTS for non-CLI; APIs reject production requests PHP considers non-HTTPS.
- API bootstrap sets `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, CSP/referrer/permissions policies and JSON content type. Auth-gated HTML sets `private, no-store`; document responses set attachment disposition and nosniff.
- Static assets lack global cache-control and nosniff in supplied rules. No CORS configuration was found. No nginx/Caddy config exists; `.htaccess` does not apply there.
- Root `.htaccess:16-17` denies `.git`, top-level `database/`, `docs/`, `vendor/`, `tests/`, `scripts/` when rewrite is active; `:20-22` denies composer files, package JSON and Markdown. It does not deny `dist/`, `test-results/`, or `node_modules/`.
- Apache root-checkout exposure: SQL/docs/vendor/tests/scripts denied by root rules; Composer/package manifests/Markdown blocked by FilesMatch; backend `.env` and config denied by `backend/.htaccess`; storage denied by its `.htaccess`. `backend/lib` and `backend/jobs` have no dedicated deny rule; PHP handling prevents plain-source download, jobs are CLI-guarded. `dist/attachlink.zip`, `test-results/.last-run.json`, `node_modules` maps, and `backend/dev-router.php` are not denied by root rules. No phpinfo/install/test page was found; `check-config.php` and `create-admin.php` are CLI guarded.
- The release serves `public/` as document root. Nginx/Caddy have no supplied rules; all these protections require equivalent server configuration. The release archive itself is present under root `dist/`, outside `public/`.

### Release/dependencies/jobs/logging/backups

- The existing ZIP had 247 safe member names and was extracted only to a unique temporary directory after traversal/absolute-path/duplicate/symlink checks. `python scripts/build-release.py --verify dist/attachlink.zip` passed offline with 247 allowlisted files and no external CDN references. It includes all 18 migrations, runtime backend code, all 12 library files, four jobs, Composer manifests/vendor runtime, and selected public assets. It excludes actual `.env`, storage contents, backups, tests/results, `node_modules`, scripts, npm manifests, and `dev-router.php`. Root Markdown/docs are selected; `public/.htaccess` protects included Composer manifests and `/vendor/`.
- `composer audit`/`npm audit`: NOT TESTED (would require network; no local advisory database). Lockfile versions: PHPMailer 7.2.0; Playwright 1.65.1; axe-core 4.14.1; Tailwind 3.4.19. Leaflet 1.9.4, BSD 2-Clause (`assets/vendor/leaflet/LICENSE.txt`); advisory status NOT TESTED.
- External HTTP clients: backend `ChatProvider.php` uses configured HTTPS provider for interview/support AI; browser Leaflet may fetch the configured tile URL. No other external HTTP client was found in the targeted search.
- CLI jobs: migration uses a DB advisory lock (10-second wait), records migrations and exits non-zero on failure; SQL is not one transaction. Email worker claims with transactional `FOR UPDATE SKIP LOCKED`, max 50/run, retries five times, stderr row IDs, exits non-zero on failures; crash after mail relay acceptance may duplicate. Purge handles up to 200/run, has no job-wide lock, exits non-zero if removals remain. Backup uses a nonblocking file lock, encrypts separate SQL and file tar artifacts with `age`, and applies 30-day default retention (1-3650). No scheduler config is shipped; docs recommend email each minute and purge every five minutes. Unscheduled jobs leave email queued, purge files queued, or backups/retention stale.
- Backup dumps the configured database as a whole (not all databases; no table filters/routines/events flags) and separately tars one-level regular matching files from application document storage and `backend/storage/avatars/`. Filenames must match lowercase hex plus `.pdf/.jpg/.jpeg/.png`; symlinks, nested directories, and non-matching names are skipped. The private age key is not read on the backup host; recipient is public config and private key is documented off-server. `.env`, app source, release zip, logs/mail log, and files outside the selected paths are not included. Destination must pre-exist, be writable and outside the app; partial SQL/file artifact pairs are possible.
- PHP `error_log()` destination, permissions and rotation are host configuration and not defined. Source messages generally include exception class/source basename/line, SQLSTATE, provider status or generic diagnostics; quota bucket IDs are hashed. Reset IP is stored raw in database `password_resets.requested_ip`; location audit JSON stores old/new coordinates. Mail JSONL stores recipients, subjects, full text/HTML and reset bearer URLs (F-09). Server access logs are not configured in repo; their IP/path retention is unknown.
