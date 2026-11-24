# API documentation

Paths are relative to `backend/api/`. JSON mutations accept `csrf_token` in the request object or `X-CSRF-Token` in the header. Multipart requests accept a form field or the header. Obtain a fresh token from `GET auth/csrf.php` after signing in. Send the PHP session cookie with portal requests.

| Path | Methods and input | Permission |
|---|---|---|
| auth/csrf.php | GET | Public |
| auth/register.php | POST role, first_name, last_name, email, phone, password, company_name for employers | Public with CSRF |
| auth/login.php | POST email or phone, password, role | Public with CSRF |
| auth/me.php | GET | Signed in |
| auth/logout.php | POST | Session with CSRF |
| auth/change-password.php | POST current_password, new_password | Signed in |
| openings.php | GET optional id or q | Public verified openings |
| listings/index.php, listings/detail.php | GET page/limit or id | Student |
| student/account.php | GET, POST student name, contact and study fields | Student owner |
| student/avatar.php | GET status or image, POST multipart avatar, DELETE | Student owner |
| student/skills.php | GET, POST action add/update/delete, id for existing item, name/category on write | Student owner |
| student/applications.php | GET | Student owner |
| student/apply-with-documents.php | POST multipart listing_id and optional cover_letter. Copies the six required categories, including every saved academic certificate, into the application. Returns 422 with missing_documents if the packet is incomplete | Student |
| student/documents.php | GET application_id, POST application_id/document_type/file | Student application owner |
| student/document-vault.php | GET saved file names, slot numbers and required document checklist. POST multipart document_type, file and optional slot (default 1). Academic certificates support slots 1–4 and action=remove. Each category requires at least one file. Accepted formats are PDF, PNG, JPG, DOC and DOCX, up to 5 MB each | Student owner |
| student/saved.php | GET, POST or DELETE opening_id | Student owner |
| student/saved-listings.php | GET, POST listing_id and action save/remove | Student owner |
| student/interviews.php | GET, POST interview details or DELETE id | Student owner |
| student/interview-ai.php | GET configuration status and CSRF token, POST practice message | Student |
| student/preferences.php | GET, POST recruiter_visible (boolean), sectors, stipend, work_model, relocation | Student owner. SMS capability is reported separately. |
| student/cv.php | GET, POST CV fields and optional layout (classic, modern, executive) | Student owner |
| employer/company.php | GET, POST name, description, website, industry and city | Employer company |
| employer/profile.php | GET, POST representative name and company location/description | Employer company |
| employer/alerts.php | GET inbox and applicant summaries | Employer company |
| employer/applicant-contact.php | GET application_id | Employer company |
| company-files.php | GET list or id, POST multipart purpose and file, DELETE current logo | Employer company; administrator reads selected company |
| employer/overview.php | GET | Employer company |
| employer/openings.php, employer/listings.php | GET, POST listing fields or listing_id with action submit/close/reopen/archive | Employer company |
| employer/applications.php | GET optional application_id with decision history | Employer company |
| employer/applicants.php | GET optional opening_id, POST application_id, status and optional review note | Employer company |
| employer/documents.php | GET application_id | Employer company |
| admin/overview.php | GET | Administrator |
| admin/companies.php | GET, POST company_id, status and optional note | Administrator |
| admin/users.php | GET, POST user_id and is_active | Administrator |
| admin/placements.php | GET, POST application_id, start_date, end_date and notes | Administrator |
| admin/announcements.php | POST title, message, audience | Administrator |
| admin/setting-entries.php | GET records, POST campus, programme or intake record, POST programme id and is_active | Administrator |
| admin/settings.php | GET, POST attachment_months, registration_grace, logbook_cadence, minimum_stipend | Administrator |
| messages.php | GET contacts or with user ID, POST recipient_id/body or action read/peer_id/through_id | Signed-in permitted users |
| notifications.php | GET, POST id to mark read or action read_all | Signed-in owner |
| documents/download.php | GET id | Student owner, employer company or administrator |

Example request to save a skill:

```json
{"action":"add","name":"Technical drawing","category":"Design","csrf_token":"TOKEN"}
```

Example success and error bodies:

```json
{"ok":true,"skills":[{"id":1,"name":"Technical drawing","category":"Design"}]}
{"ok":false,"message":"Authentication required."}
```

Errors include 400 for invalid input, 401 for missing authentication, 403 for forbidden access or invalid CSRF, 404 for unavailable records, 405 for method mismatch, 409 for conflicts, 413 for file size, 415 for rejected media types, 422 for missing uploads and 429 for login throttling. Downloads and avatar image responses return binary content on success.

Employer opening saves accept `available_positions` (integer 1 through 1,000) and `required_skills` (array of up to 30 strings with at most 90 characters per skill). Opening detail responses include capacity and newline-delimited skills.

## Pilot accounts and core workflow

All POSTs below require a CSRF token. Account recovery requests use the anonymous session CSRF token. Verification and reset mail use links whose token is in the URL fragment.

| Endpoint under backend/api | Behaviour |
| --- | --- |
| POST auth/forgot-password.php | Accepts email. Returns the same HTTP 200 payload for eligible, unknown, disabled and rate-limited requests. Queues up to three links per email/IP per UTC day, ten links per email per UTC day and thirty requests per IP per hour. |
| POST auth/reset-password.php | Accepts token and new_password (10 to 72 bytes). Consumes the one-hour token, revokes outstanding reset tokens and invalidates all existing sessions. Expired, malformed and used tokens return 422. |
| POST auth/verify-email.php | Accepts token. Verification links last 24 hours. A successful verification consumes outstanding verification links. |
| POST auth/resend-verification.php | Requires an authenticated account. Queues up to three resends per hour, then returns 429. |
| GET/POST email-preferences.php | Student and employer self-service. GET returns email_notifications. POST accepts the boolean email_notifications. |
| POST student/withdraw-application.php | Accepts application_id. Requires ownership. Submitted and reviewing applications can be withdrawn. Returns 404 outside the owner scope and 409 for an ineligible status. |
| GET student/company-logo.php | Requires a student session and company_id. Returns only the verified company's PNG or JPEG logo, with nosniff, or 404. |
| GET admin/audit-log.php | Optional action, target_type, target_id, admin_id and before filters. Returns up to 100 newest events and next_before for the next page. |

Registration queues email verification. Authenticated accounts expose email_verified_at through auth/me.php. Student application submission and employer publication (including reopening) return 403 until the account verifies. Changing a student email starts verification again and invalidates outstanding recovery links for the old address.

Login counts invalid credentials in 15-minute buckets and returns 429 with Retry-After once a bucket is full. Account/IP pairs have ten attempts, accounts have fifty across IPs, and IPs have one hundred. Successful login clears the current account/IP bucket and the global account bucket. Password reset clears all buckets for that account. Email and phone sign-ins share these limits.

Employer saves preserve city and requirements when omitted. A decision that would exceed available_positions returns 409. NULL capacity remains unlimited. Messaging checks for a submitted, reviewing or accepted application with the employer's company. A closed thread with message history remains readable and can be marked read. Contacts and thread responses expose can_send. Admin conversations are available with active accounts. For thread history, GET messages.php?with=ID returns up to 100 messages newest first. Pass next_before as before to load older messages. A null cursor marks the end.

POST admin/verify-user-email.php accepts user_id and requires administrator authentication and CSRF. It marks an unverified address verified, invalidates pending verification tokens, and records user.email_verified in the audit log.


## Pilot release account operations

Registration requires consent=true and consent_version=pilot-2026-11. The account records the accepted version and timestamp. POST student/delete-account.php accepts current_password and confirm=true and requires a student session and CSRF token. It deletes the student's records and invalidates sessions. Any file that could not be removed immediately enters the private purge queue.

POST admin/clear-reset-quota.php takes user_id and clears the global daily reset limit with an audit event. IP limits remain. POST admin/admin-accounts.php takes action=create with first_name, last_name, email and password, or action=deactivate with user_id. Both actions require an active administrator and CSRF. GET admin/retention.php returns aggregate counts.

## Student interview coaching

Set `ATTACHLINK_INTERVIEW_AI_URL=https://api.groq.com/openai/v1/chat/completions`, `ATTACHLINK_INTERVIEW_AI_MODEL=openai/gpt-oss-20b` and `ATTACHLINK_INTERVIEW_AI_KEY` to your Groq API key in the server environment or local `backend/.env`. PHP must have cURL or HTTPS streams enabled. With the settings absent or the placeholder key in place, the student page offers sample questions. [Groq API reference](https://console.groq.com/docs/api-reference) · [Free plan limits](https://console.groq.com/docs/rate-limits)

GET `student/interview-ai.php` returns `configured` and a `csrf_token` when configured. The configuration check does not contact the provider. POST accepts `csrf_token`, `message` (up to 1,400 characters), `track` (`general`, `technical`, `software` or `behavioural`) and optional `history` (up to eight entries with `role` equal to `user` or `assistant` and `text` up to 1,400 characters). A successful response contains `reply`. The endpoint allows six attempts per minute per session and returns 429 with `Retry-After` when the limit is reached. Provider failures return 502 or 503.

The student page keeps the conversation in memory and sends the latest message and recent turns to the configured provider. AttachLink does not store the practice transcript.

## Student Support Assistant

Apply `upgrade-15` and set `ATTACHLINK_SUPPORT_AI=1` to enable automated replies using the configured chat provider. The student contacts response exposes `support_ai` when available. Student sends to Support can include `allow_support_ai: true`. The assistant handles greetings and acknowledgements locally, uses approved answers for common portal tasks, and sends eligible message text to the provider for general answers or human routing.

Support sends return `support_result` as `ai_answered` or `needs_human`. When the assistant is enabled, questions that need a person get a handoff acknowledgement in the thread, including when the provider is unavailable. The original question stays pending for an administrator. Admin contacts include a `needs_human` count and appear first when review is pending. Admin thread messages expose their `support_status`. An admin reply clears pending review for earlier student messages in that thread. The student thread labels automated replies through `support_status: "ai_reply"`.
