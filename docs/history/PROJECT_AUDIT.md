# AttachLink project audit

XAMPP responded over Apache 2.4.65 with PHP 8.5.12. MariaDB exposes all eleven tables defined by `database/schema.sql`. The live database contains one account per role and one pending company. Account counts alone do not establish which records are fixtures.

| Component | Existing implementation | Problems | Required action | Priority |
|---|---|---|---|---|
| Authentication | PHP sessions, password hashes, role checks and CSRF | Login has no persistent rate limit. Employer page access and legacy routes need review. | Harden login and gate portal pages. | Critical |
| Student portal | Account, listings, saved openings, CV, notifications and application APIs | Stitch scripts request absent listings, skills and avatar APIs. The original application route accepts submissions without attachments. | Restore contracts and require documents in one transaction. | High |
| Employer portal | Company, openings, applicants and documents APIs | Stitch bridge requests absent overview, listing and application routes. Multiple scripts handle the same controls. | Connect the original controls to the supported API. | High |
| Administrator portal | Apache auth gate, counts, verification, directory and placements | The dashboard expects a different response schema. Settings explicitly disable writes. | Repair data bindings and persist validated settings. | High |
| Messaging | Shared MySQL endpoint and three frontend clients | Missing legacy communications routes, no message notifications and a global contact limit. | Use shared contracts, recipient-scoped queries and polling. | High |
| Notifications | Account-scoped list and read endpoint | Submission and message notifications are missing. | Write notifications in the same transaction as their source event. | High |
| Document management | MIME validation, generated filenames and Apache storage denial | Missing document-pack endpoint. Downloads trust the stored filename. | Validate the pack before persisting and constrain download paths. | High |
| Database | InnoDB, foreign keys, application and placement uniqueness, CV upgrade | No durable login throttle, settings or company decision history. | Add non-destructive migrations where needed. | Critical |

The repository contains three portal trees under `designs`, shared integration under `assets`, the PHP API and storage under `backend`, and SQL under `database`. `dashboard-backup.html` and `dashboard1.html` duplicate the student dashboard layout. The portals reference missing branding assets and overlapping integration scripts. The settings page and several portal templates include design examples. Some career tools still store data in the browser.
