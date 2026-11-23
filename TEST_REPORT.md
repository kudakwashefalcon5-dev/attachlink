# Test report

Run on 20 November 2026. XAMPP Apache 2.4.65 and PHP 8.5.12 served the HTTP smoke suite. The authenticated API suite used PHP 8.5.12's loopback server and a separate MariaDB database, `attachlink_qa_20261120`. It created clearly named QA accounts and files outside the live database and document storage.

| Check | Result |
|---|---|
| PHP syntax | 49 PHP files passed `php -l`. |
| JavaScript syntax | 17 changed standalone scripts parsed successfully in V8. |
| HTTP smoke suite | 21 checks passed, including all three portal gates, private storage access, anonymous API access, invalid CSRF, method restrictions, invalid login and a SQL-shaped identifier. |
| Authenticated account workflow | Student and employer registration, all three role logins, wrong portal rejection, student denial of administrator access and logout passed. |
| Student API workflow | Profile update, skills, CV and interview persistence, saved openings, multipart application, invalid MIME rejection and duplicate rejection passed. |
| Employer API workflow | Company update, verification evidence upload, publishing denied before verification, publish/close/reopen/archive, authorized download and application acceptance passed. |
| Administrator API workflow | Evidence download, company approval/rejection, overview, invalid placement dates, placement creation and update, and settings save passed. |
| Messaging and notifications | Message delivery and read, Support and company display names, placement notification, announcement, and notification read actions passed. |
| Cross-company access | A second employer was denied access to the first company's verification file, application detail, submitted document, applicant decision and applicant conversation. |
| Migration | Additive migrations ran against the live database and the isolated QA database. No live users or companies were removed. |

The first Apache smoke run returned 500 for invalid CSRF because the API used status 419. The API now returns 403, and the smoke suite passed. The CLI server needed writable session and upload temp paths. Both were directed to the QA temp directory for the authenticated run.

## Reproduce the tests

Run the Apache smoke suite from the repository root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/http-smoke.ps1
```

Use a separate database for the authenticated workflow. Replace `attachlink_db` with a new QA database name when importing the baseline, apply upgrades 02 through 06 to that database, and create the CLI administrator `qa-admin@example.invalid` with a QA-only password. Set `ATTACHLINK_DB_NAME` to the QA database and `ATTACHLINK_DOCUMENT_STORAGE` to a private QA-only directory. Use an existing writable directory for both PHP temp settings.

```powershell
& C:/xampp/php/php.exe -d "session.save_path=C:/path/to/qa-temp" -d "upload_tmp_dir=C:/path/to/qa-temp" -S 127.0.0.1:18743 -t backend/api
```

From a second PowerShell terminal, run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/api-workflow.ps1 -AdminPassword "<QA-only password>"
```

## Pending browser checks

Use a dedicated staging database and three separate browser profiles. Start Apache and MySQL, open the app from [localhost](http://localhost/attachlink/), and follow this order:

1. Register a student and employer. Try the student credentials under the Company tab, then sign in under the proper role. Check logout and session timeout. Sign in to the administrator portal separately.
2. As the student, edit the profile and upload, crop, replace and remove a photo. Search openings, apply the filters, bookmark and share an opening, and submit five harmless PDF fixtures. Reopen the application page and check status and notifications.
3. As the employer, edit the company, upload a logo and company evidence, and draft an opening. As the administrator, inspect the evidence and approve the company. Publish the opening and repeat the student application step. Review the applicant, download a document, reject a separate application and accept the application intended for placement.
4. As the administrator, verify dashboard totals, search and filter the student directory, save the settings, and record and update a placement. Confirm the student receives the placement notification.
5. Exchange messages between student and employer, then between each role and Support. Check that threads refresh, read badges clear, and message content is displayed as text. Test access with a second employer and student account.
6. Check layouts, controls and console errors at desktop and mobile widths. Exercise an expired session and invalid/oversized uploads.

Browser rendering, crop interaction, session timeout, company logo upload and persistent login throttle saturation were outside the executed cases.

## Stages 14–19 verification

| Test | Result | Evidence | Remaining issue |
|---|---|---|---|
| Student login | Pass | Registered and authenticated a QA student. Wrong portal rejected with 403. Edge rendered the protected route's login redirect. | Authenticated browser controls and session timeout remain unverified. |
| Employer login | Pass | Registered and authenticated an employer and a second employer. Edge rendered the shared sign-in from the employer route. | Browser account-menu controls remain unverified. |
| Administrator login | Pass | Authenticated QA admin and blocked student settings access. Edge rendered the admin sign-in redirect. | Authenticated browser navigation remains unverified. |
| Opening workflow | Pass | Verification gate, publish, close, reopen and archive through isolated PHP/MariaDB. | Editor and responsive layout need browser testing. |
| Application workflow | Pass | Required uploads, invalid MIME rejection, duplicates, private downloads, decision history and recruiter-hidden contact fields. | File picker and crop interactions need browser testing. |
| Placement workflow | Pass | Invalid dates rejected, accepted application placed and updated, student notification delivered. | Registry edit controls need browser testing. |
| Messaging workflow | Pass | All six sender/recipient directions and both Support threads passed. Cross-company access denied. | Browser refresh and multi-tab unread counts remain unverified. |
| Company files | Pass | Logo uploaded, replaced and removed. Verification file remained accessible to the authorized administrator. | Browser file picker remains unverified. |
| Settings | Pass / unverified | Campus write and non-admin denial passed. | Programme and intake controls require authenticated browser verification. |
| Browser | Partial | Escalated headless Edge rendered all three anonymous login redirects after the sandboxed run crashed. | No authenticated browser workflow, desktop/mobile review or browser-side security result. |

The XAMPP HTTP smoke suite passed all 21 checks again. PHP lint passed for 51 files. The live database retained its three accounts and one company and contains 20 tables after upgrade 07.

## Final release verification on 23 November 2026

| Area | Result | Evidence and scope |
|---|---|---|
| PHP lint | PASSED | 51 PHP files, zero failures. |
| JavaScript syntax | PASSED | Six changed standalone scripts parsed in V8. |
| XAMPP Apache smoke | PASSED | 21 HTTP checks, including portal access, private storage, missing/invalid authentication and CSRF. |
| Headless Edge | PASSED | Rendered all three protected dashboard login redirects on Apache. |
| Fresh QA installation | PASSED | Imported schema and migrations 02 through 08 into attachlink_qa_20261123, provisioned its administrator and used PHP 8.5.12 on loopback with separate upload and session paths. |
| Cross-portal workflow | PASSED | 178 assertions, including company verification, publication, authenticated profile persistence, required uploads, My Applications, review and placement, six message directions, settings, and logout for all three roles. |
| Defensive access checks | PASSED | Cross-company mutation and document isolation, invalid upload MIME, duplicate applications, wrong roles, direct storage and CSRF checks in the executed suites. |
| Browser end-to-end | NOT TESTED | Authenticated workflows, crop, responsive layouts, polling, notifications in multiple tabs and every intended frontend control require browser acceptance testing. |
| Additional security | NOT TESTED | Session fixation and timeout, rate-limit saturation and browser XSS were outside this run. |
| AI and SMS delivery | BLOCKED | Provider implementations and credentials are unavailable. |

## Pre-Phase 1 UI and authentication verification

- PASSED. 196 isolated API assertions, including every selected-role/credential combination, wrong password, invalid/missing login fields, public administrator registration denial, and the existing cross-portal workflow.
- PASSED. 21 Apache HTTP smoke checks. 51 PHP files passed lint, with both subsequently updated portal gate files linted again.
- PASSED. Eight JavaScript or inline script groups parsed. The changed employer messaging bridge was also checked separately.
- PASSED. Headless Edge through Apache ran tests/browser-auth.html. All 18 assertions passed at 1,200, 768 and 375 px and on protected dashboard redirects.
- PASSED. A loopback PHP server using isolated QA accounts and a temporary browser harness signed into the three actual dashboard pages in Edge. Student and admin stats rendered, employer dashboard loaded and the student cards fit at 375 px. The first attempt triggered a native form submit before the deferred script loaded. The submit control now starts disabled, and the rerun passed.
- NOT TESTED in this UI pass. Every registration form interaction, all protected pages at mobile widths, all dashboard action links, session expiration, and complete visual/interactive acceptance.
- BLOCKED. Self-service forgotten-password recovery, AI feedback and SMS delivery lack the necessary provider or recovery implementation.

## Phase 1 accounts, trust and core workflow

This run used an isolated MariaDB 10.11.16 instance, XAMPP PHP on loopback, private QA session and upload directories, and the log mail transport.

| Check | Result | Evidence |
| --- | --- | --- |
| Extended API workflow | PASSED | 372 assertions. Includes account reset and session revocation, expired and reused tokens, verification and resend limits, login bucket reset and throttle, notification delivery and opt-out, withdrawal ownership and status history, opening field preservation and capacity, cross-company isolation, thread eligibility and pagination, logo MIME and nosniff, and filtered admin audit events. |
| Upgrade 09 and rerun | PASSED | Existing account was backfilled. An account added after the first run remained unverified after the second run. |
| Mail worker retry and backoff | PASSED | An unwritable log target deferred delivery, a second immediate run skipped the deferred row, and a later retry delivered the mail and cleared the body. |
| Proxy IP resolution | PASSED | Four CLI cases covered direct peers, trusted proxy chains, invalid forwarded addresses and IPv6. |
| PHP and JavaScript syntax | PASSED | 34 touched PHP files passed php -l. 13 touched JavaScript files passed node --check. |
| Thread-history UI merge | PASSED | Node harness verified the older-page cursor and preservation of older messages when newer messages arrive. |
| Live SMTP delivery and scheduled production job | NOT TESTED | QA used the log adapter. No SMTP service credentials were configured. |
| Authenticated browser and concurrent load | NOT TESTED | API and JavaScript checks ran without real browser interaction or parallel traffic. |

The initial QA run exposed local PHP session and upload directory configuration issues and a PowerShell singleton mail-count assertion. The final run used private directory overrides and explicit array counting and exited successfully.

## Phase 1 follow-up verification

| Check | Result | Evidence |
| --- | --- | --- |
| API workflow including real parallel decisions | PASSED | 431 assertions against isolated MariaDB 10.11.16 and two PHP listeners. Concurrent acceptance returned 200 and 409, with one accepted row. The suite also covered reset clearing an exhausted login bucket, forged host headers, untrusted forwarded IP, security emails, cooldown, administrator verification and closed-thread history. |
| Recovery quota | PASSED | Four trusted QA client IPs received 3, 3, 3 and 1 links for the same account. Every response stayed generic and the daily total was 10. |
| Password timing | PASSED | Local default-hash medians were 623.1 ms for a known account and 618.9 ms for an unknown account. This measures the PHP password check, not network timing or legacy hash costs. |
| Migration and mail worker | PASSED | Applied and reran upgrade 10. An unwritable log returned exit 1 and a retry schedule. A locked outbox row was skipped while the next row delivered. |
| Composer platform check | PASSED | PHPMailer 7.2.0 was installed from composer.lock. PHP 8.5.12 met its dependencies. |
| Base URL configuration | PASSED | Missing environment and missing URL failed. Explicit development permitted the localhost default. |
| Live SMTP and production scheduler | NOT TESTED | Local validation used the log transport. No provider credentials or DNS were configured. |

## Phase 2 verification

| Check | Result | Evidence |
| --- | --- | --- |
| Offline asset build and syntax | PASSED | Tailwind CLI built minified CSS. Portal HTML checked for local stylesheet, font and image references. Lint passed on 18 touched PHP files, 18 standalone JS files and 13 inline script blocks. |
| Authenticated browser workflow | PASSED | The final Playwright run passed in Edge. It registered and signed in students and employers, signed in the QA administrator, covered both verification paths, changed an admin setting, published an opening, submitted documents, accepted an application, exchanged a message, withdrew a second application, and reset and re-entered the student account using the mail log. |
| Upload and dashboard layout | PASSED | Five-file upload used 24 KB/s uplink and 150 ms latency. The browser observed progress and validated size and type rejection. Dashboard screenshots at 375 and 1280 px are in tests/e2e/screenshots. |
| Full cross-browser and assistive-technology coverage | NOT TESTED | The automated browser workflow used Edge and sampled the key portal flows. |

During browser testing, a duplicated CSRF URL suffix broke recovery form submission, and the admin header overflowed at 375 px. The fixes were verified on subsequent runs. Phase 2 retained the archived design references and release copies for Phase 3.

## Local configuration regression

| Check | Result | Evidence |
| --- | --- | --- |
| Fresh loopback setup | PASSED | Registration returned 201 and sign-in returned 200 on loopback with no ATTACHLINK_* variables and no backend/.env. The test used a disposable, migrated MariaDB database and a PHP MySQL port override to keep the active XAMPP database separate. |
| Fail-closed and sanitized HTTP responses | PASSED | Non-loopback Host without an explicit environment returned generic 503. Missing or HTTP production base URLs blocked registration, recovery and resend while sign-in returned 200. Failed registration rolled back. Invalid SMTP, missing transport and an unavailable database returned the same generic 503. Production cases used a loopback fixture for the server-side HTTPS flag. |
| Environment file and canonical links | PASSED | Process variables overrode backend/.env, quoted values were parsed literally, and Apache refused a present sentinel file with HTTP 403. Forged Host and X-Forwarded-Host left queued links unchanged. |
| Configuration checker | PASSED | Successful checks covered the database, document write probe and log transport. The missing production URL reported MISSING and exit 1 without exposing credentials. |
| Existing regressions and syntax | PASSED | Apache smoke passed 23 checks, the API workflow passed 431 assertions against isolated MariaDB, and all 14 touched PHP files passed php -l. Each login page had one recovery link. |
| Active XAMPP database schema | FAILED | Read-only diagnosis connected to the configured database but found that it lacks the Phase 1 account and outbox columns from upgrades 09 and 10. The active database was left intact. |
| Live production TLS and SMTP | NOT TESTED | No live production endpoint or SMTP relay was used. |

## Pre-release and Phase 3 verification

| Check | Result | Evidence |
| --- | --- | --- |
| Parallel login | PASSED | 100 simultaneous successful logins from one loopback IP across eight local PHP listeners. Median 5,994.2 ms, p95 10,709.8 ms. No lock-wait or deadlock errors. |
| Password verification | PASSED | Production bcrypt cost 11. Fifteen isolated password_verify calls measured 154.0 ms median and 156.9 ms p95. Existing hashes retain their stored cost. |
| Portal browser smoke and axe | PASSED | 31 pages across the correct role sessions at 375 and 1280 px, 62 checks. No console errors, failed requests, external requests, horizontal overflow, or serious and critical axe findings on the final sweep. |
| Three-role workflow and API | PASSED | The browser workflow passed. The final PowerShell API regression passed 431 assertions. The separate Phase 3 API suite verified consent, reset cap logging and clearing, admin creation/deactivation, and deletion of application records and five uploaded files. |
| Config and Apache headers | PASSED | The configuration regression passed on the migrated isolated DB. Local Apache returned CSP, frame denial, referrer and permissions headers. |
| Schema parity | PASSED | Fresh schema and original baseline upgraded through 11 produced identical MariaDB DDL dumps and migration version rows. The upgrade rerun made no changes. |
| Backup and restore | PASSED | Restored 155 application document rows into isolated MariaDB and checked 170 archived files byte-for-byte. Retention removed an expired matching backup and preserved an unrelated file. |
| Release ZIP | PASSED | PowerShell built and verified 215 allowlisted files. The verifier rejected six prohibited archive paths and a CDN injected into an allowlisted page. The extracted release loaded PHPMailer. |
| Syntax | PASSED | 22 touched PHP files, 11 standalone JS files, nine inline JS blocks and the Python tooling passed parse checks. |
| Native Linux wrapper and live staging gates | NOT TESTED | QA ran on Windows. Live production SMTP, DNS authentication, production HTTPS/HSTS scan, operational cron and the multi-role 50-user staging test require staging infrastructure. |

The final axe sweep reports 24 moderate rule findings across page-width checks. There are 18 landmark-region findings and two each for heading order, missing main landmark and missing page-level heading. The detailed report is test-results/portal-smoke-all-portal-pa-7f975-and-meet-serious-axe-checks/portal-audit.json. Earlier sweeps exposed missing logo requests, low-contrast secondary text, unlabeled controls and mobile overflow. Those issues were corrected and the sweep was rerun.

The release artifact is dist/attachlink.zip. The active XAMPP database was left intact.

## Staging follow-ups on 23 November 2026

| Check | Result | Evidence |
|---|---|---|
| Release allowlist | PASSED | The 225-file ZIP verified. Removing upgrade-12 or adding the retired admin login made verification fail. SQL and documentation are outside the public/ document root. |
| Web exposure | PASSED | The XAMPP HTTP smoke suite returned 403 or 404 for SQL, docs, vendor, Composer and npm metadata, Markdown, tests and scripts. |
| Environment detection | PASSED | An unset environment refused HTTPS, forwarded headers, external hosts and deployment base URLs. Loopback HTTP remained usable. |
| Migrations | PASSED | The local database recorded upgrades 12 through 14. A disposable unversioned upgrade-09 schema applied only upgrades 10 through 14. The checker reported pending names before migration, the login endpoint returned generic 503, and the migration rerun made no changes. |
| HSTS | PASSED | The production PHP fixture sent the header. A temporary XAMPP Apache TLS virtual host sent it on static HTTP 200 and Apache-generated 404 responses. |
| Employer preferences | PASSED | Employer detail omitted all three private preferences, returned them after opt-in, and omitted stipend in both cases. |
| Application documents and vault | PASSED | The API rejected submissions with each of the five required documents missing in turn. It attached all five saved files without a re-upload, rejected invalid MIME and employer vault access, and purged replaced files and deleted account files. |
| Audit | PASSED | The action filters returned application and company verification document downloads and retention-report views. |
| Production admin TOTP | PASSED | The API denied admin access before the second factor, issued ten recovery codes on enrollment, rejected TOTP replay and rejected a second use of a recovery code. |
| Companies and merged admin sign-in | PASSED | An authenticated admin received the Companies page. The retired admin login URL redirected to the shared sign-in form. |
| Browser interaction | NOT TESTED | The new vault and TOTP controls, the Companies menu click, and admin sign-out were verified through code or HTTP responses. A full browser interaction run remains outstanding. |

## Staging follow-ups

| Check | Result | Evidence |
| --- | --- | --- |
| Clean XAMPP fixture | PASSED | An isolated Apache instance and fresh migrated schema registered and signed in using only backend/.env. No ATTACHLINK_* process variables were set. Apache returned 403 for backend/.env and for Git metadata. |
| Bcrypt and rehash | PASSED | The unknown-account dummy and new hashes both use bcrypt cost 11. Wrong credentials and a wrong portal preserved a cost-8 hash. Successful login upgraded it to cost 11, retained the password-change timestamp, and left the cost-12 fixture intact. |
| Encrypted backup and restore | PASSED | Age encrypted both streams without plaintext backup files. A wrong identity failed, and a failed encryption left no published or partial backup. The encrypted SQL and tar were decrypted in the restore fixture. The drill restored 195 application-document rows and compared 212 archived files byte-for-byte. |
| Seeded layout and accessibility | PASSED | 31 portal pages per width, 62 checks in Edge. The active student had 50 applications; the fixtures included 85-character first and last names, a 1,000-character unbroken message, and one application with five 5 MiB PDFs. Maximum page widths were exactly 375 and 1280 px. Axe reported zero violations, and the suite found zero request, console or overflow failures. |
| Apache with PHP-FPM concurrency | NOT TESTED | This Windows XAMPP host provides mod_php, and the WSL install did not provision Debian. The FPM guard correctly refused the mod_php listener, so this follow-up contains no FPM median or p95 measurement. |

Checker output from the clean XAMPP fixture:

```text
OK ATTACHLINK_ENV - Detected development.
OK ATTACHLINK_BASE_URL - Valid URL or local default.
OK ATTACHLINK_DB_HOST - Database setting accepted.
OK ATTACHLINK_DB_PORT - Database setting accepted.
OK ATTACHLINK_DB_NAME - Database setting accepted.
OK ATTACHLINK_DB_USER - Database setting accepted.
OK ATTACHLINK_DB_PASS - Database setting accepted.
OK Database connection - Connected successfully.
OK Database schema - Account and outbox tables are ready.
OK ATTACHLINK_DOCUMENT_STORAGE - Directory is writable by this CLI user.
OK ATTACHLINK_MAIL_TRANSPORT - Transport selected.
OK ATTACHLINK_MAIL_LOG - Accepted. No email sent.
Exit code 0.
```

The seeded axe artifact is test-results/portal-smoke-seeded-portal-de384--widths-and-pass-axe-checks/portal-audit.json.
