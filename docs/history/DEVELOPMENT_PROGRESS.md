# Development progress

| Stage | Delivered | Remaining |
|---|---|---|
| Audit | Repository and live database review in PROJECT_AUDIT.md. | Archive templates and obsolete scripts still exist on disk. |
| 5 Student | Account and biography edits, skills, initials and private photo endpoint, verified listings, bookmarks, document packs, application activity, CV and interview calendar persistence. | Browser layout and crop verification, institution notices and server-backed AI feedback. |
| 6 Employer | Portal role gate, company details and private files, opening lifecycle, applicant details, downloads and decisions. | Browser review of the editor and legacy controls. Programme eligibility, job title and review-history controls still need persistence. |
| 7 Administrator | Dynamics for dashboard, verification and decision audit, directory filtering, placement upsert and four existing settings. | Programme catalogue, campus directory, intake and policy prototype controls remain incomplete. Some registry controls still need browser integration. |
| 8 Messaging and support | Shared thread API, read tracking, in-app delivery and role-appropriate display names. | Browser polling and unread badge checks. Pending support uses unread conversations as its count. |
| 9 Security | Server-side role and session checks, throttling, CSRF, private documents, MIME/size validation, transactional uploads and automated cross-company denial checks. | Browser security checks and login-throttle saturation. |
| 10 Database | Additive upgrades 03 through 06 applied. Existing records were preserved. | Historical records have no reliable test-data marker. |
| 11 Frontend | Reconnected major routes and removed competing scripts on affected pages. | Full original-control inventory and browser acceptance remain open. |
| 12 QA | Two automated XAMPP/API suites and syntax checks executed. | Pending browser and security checks are listed in TEST_REPORT.md. |
| 13 Documentation | README, database and API reference, test report and progress log. | Hosted staging verification remains pending. |

Changes are concentrated in `backend/bootstrap.php`, `backend/api/`, `database/upgrade-03.sql` through `upgrade-06.sql`, the existing portal scripts and Apache guards under `designs/`, and the automated scripts under `tests/`.

The migrated live database remains `attachlink_db`. API fixtures are retained in the separate QA database. The original page templates remain in place, with existing portal classes used for new controls. Local CV and interview drafts from older browser storage were left intact and require an explicit import path if they are to be brought into the new database.

## Stages 14–19 checklist

- [ ] 14.1–14.7 Student demo cleanup, profile, document controls, phone link, dashboard, avatar and browser validation.
- [ ] 15.1–15.5 Company profile and logo, opening lifecycle, applicant history and documents, messaging and dashboard.
- [ ] 16.1–16.6 Live statistics, verification, placements, settings, directories and navigation.
- [ ] 17.1–17.5 Messaging delivery and privacy, notifications, recruiter visibility, SMS and AI setup.
- [ ] 18.1–18.6 Automated and browser tests, cross-portal workflow, defensive review, error handling and evidence.
- [ ] 19.1–19.6 Database and environment readiness, hosting protections, documents, cleanup and ZIP.

### Stages 14â€“19 work in this pass

| Stage | Changes and evidence | Next action |
|---|---|---|
| 14 | Removed active profile and dashboard demo handlers, fixed the phone link and routed document controls to application files. HTTP smoke passed. | Test authenticated student pages and replace remaining historical demo controls, especially Data & Settings. |
| 15 | Company logo upload, replace and removal passed. Applicant decision history persisted in the isolated workflow. | Test actual employer opening and applicant pages. Finish fields the legacy opening editor marks as visual only. |
| 16 | Added campus, programme and intake records to the existing settings page and showed live administrators. API campus save and authorization passed. | Verify programme and intake interaction in-browser, company directory filtering and remaining policy controls. Officer creation remains CLI-only. |
| 17 | Recruiter preference is stored in MySQL and gates email and location in recruiter application views. Placement preferences save in the same profile UI. All six message directions passed. | Test polling and unread counts in-browser. Choose providers before implementing real AI feedback or SMS. |
| 18 | HTTP, isolated API, PHP lint and anonymous Edge redirects executed. | Run the full authenticated browser matrix, session expiry and throttle saturation. |
| 19 | Applied additive upgrade 07. Added environment template, hosting guardrails, updated documentation and packaged a clean XAMPP ZIP. | Install the ZIP in a second staging environment and complete release sign-off. |

Modified files in this pass:

- Student templates and scripts: `designs/students/login.html`, `dashboard.html`, `profile.html`, `stage14-profile-preferences.js`, and `assets/attachlink-connect.js`.
- Employer and administrator frontend: `designs/employers/stage8-employer.js`, `designs/admin/admin-stage9b-bridge.js`.
- Backend: `backend/config.php`, `bootstrap.php`, `install-check.php`, `api/company-files.php`, `api/employer/applicants.php`, `api/employer/applications.php`, `api/student/preferences.php`, `api/admin/setting-entries.php`.
- Migration and checks: `database/upgrade-07.sql`, `tests/api-workflow.ps1`.
- Documentation and release: `README.md`, `DATABASE.md`, `API_DOCUMENTATION.md`, `TEST_REPORT.md`, `DEVELOPMENT_PROGRESS.md`, `DEPLOYMENT_GUIDE.md`, `environment.example`, and `release/AttachLink-XAMPP.zip`.

## Final release verification

The opening editor now uses its existing department, positions and skills controls to save through the employer API. Upgrade 08 adds nullable columns for older records. The student listing displays the saved values. The student message prototype was removed, obsolete banners were corrected, and employer/admin refresh guards were added. See FINAL_AUDIT.md and FIX_REPORT.md for issue-by-issue status and file inventory.

Next action is the authenticated Edge workflow on a separate Apache staging installation with the same PHP and MySQL configuration. Verify remaining employer preview fields, administrator policy actions, browser polling and multi-tab behavior. Pick and implement AI/SMS providers only when requested. The code and package are suitable for continued XAMPP QA. Production sign-off remains open.

## Modern portal interface and role-based sign-in

A shared authentication screen now selects Student, Company or Administrator. Role-specific protected URLs redirect to the shared screen and select the correct role. The student and administrator dashboards use a shared metric component, and a portal stylesheet standardizes cards, forms and keyboard focus while preserving page structures. No migration or live-account changes were required.

### Changed file inventory

- Shared assets: assets/attachlink-auth.css, assets/attachlink-portal.css, assets/attachlink-signin.js, assets/attachlink-overview.js, assets/attachlink-connect.js.
- Student HTML: designs/students/login.html, register.html, account.html, attachment-details.html, career-tools.html, cv-builder.html, dashboard.html, data-settings.html, interview-planner.html, messages.html, my-applications.html, notifications.html, profile.html, saved-openings.html.
- Employer HTML and scripts: designs/employers/login.html, register.html, applicant-profile.html, company-profile.html, dashboard.html, messages.html, opening-applicants.html, openings.html, post-edit-opening.html, auth-gate.php, stage8-employer.js, stitch-employer-bridge.js.
- Administrator HTML and scripts: designs/admin/login.html, dashboard.html, attachees-directory.html, messages.html, placements-registry.html, system-settings.html, verification-queue.html, auth-gate.php, admin-stage9b-bridge.js.
- Tests and reports: tests/api-workflow.ps1, tests/browser-auth.html, FINAL_AUDIT.md, FIX_REPORT.md, TEST_REPORT.md, DEVELOPMENT_PROGRESS.md.

The release acceptance follow-up is to audit remaining protected controls and layouts with occupied and empty data, validate actual recovery once a provider is implemented, and test session expiration and browser interaction regressions.
