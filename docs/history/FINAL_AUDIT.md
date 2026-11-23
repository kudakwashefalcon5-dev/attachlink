# Final release audit

| Verified defect | Source | Status at inspection |
|---|---|---|
| Opening positions and skill chips are preview-only. The department input is missing from the save payload. | Employer editor and openings API | FAILED |
| Opening editor displays a claim about saved institution restrictions despite no server-side mapping. | Employer editor | FAILED |
| Employer and administrator polling can overlap and an older thread response can render after selection changes. | Portal message clients | FAILED |
| Active student messaging copy describes a prototype despite its MySQL thread API. | Student message client | FAILED |
| The interview assistant only exposes a GET capability response. SMS reports unavailable. | Student AI and preferences APIs | BLOCKED for provider delivery |
| Authenticated browser workflow and clean-install release checks have no current end-to-end evidence. | Existing test report | NOT TESTED |

## Authentication and portal redesign audit

| Area | Finding | Status |
|---|---|---|
| Role selection | Registration link did not switch consistently, and the old login page loaded multiple role controllers. | Fixed and browser verified. |
| Company and administrator entrances | Dashboard guards reached an intermediate HTML redirect. The first browser check found that the role was not immediately available. | Fixed with role-specific HTTP redirects. All three protected entries passed. |
| Student overview | Application statistics and activity were rendered as plain text. | Replaced with API-backed cards and verified after browser sign-in. |
| Administrator overview | Raw counts and placeholder charts appeared alongside the original overview. | Replaced with nine API-backed cards and a company queue. Browser verified for sign-in and card rendering. |
| Shared styling | Portal controls and navigation used inconsistent visual treatments. | Shared CSS connected to 25 active pages. Full authenticated responsive visual review remains open. |
| Password recovery | The existing PHP auth API has change-password for signed-in accounts but no recovery endpoint or delivery provider. | Administrator-assisted guidance in sign-in. Self-service recovery remains unavailable. |
