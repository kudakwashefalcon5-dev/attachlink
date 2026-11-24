# AttachLink decisions

## Phase 1

- Existing accounts are grandfathered into email verification. The migration applies the verified default when adding the column and switches it to NULL for later accounts.
- Registration, reset and resend enqueue transactionally. Notification messages omit private message bodies and application documents. Verified student and employer accounts can opt out of notification email while continuing to receive account mail and in-app notices.
- Account links use URL fragments so tokens stay out of web server request logs. Authenticated and anonymous account forms submit with the session CSRF token.
- The credential version uses a microsecond database timestamp. A signed-in password change maintains the initiating session and invalidates other existing sessions. A password reset invalidates every existing session.
- Login limits apply to wrong credentials. A correct password submitted to the wrong portal or a disabled account returns the existing access error. Existing accounts share one bucket across email and phone. Proxy trust uses exact IP matches.
- Capacity is enforced when a decision enters accepted status. NULL available_positions preserves unlimited capacity for legacy openings.
- An eligible application with the company authorizes messaging. Withdrawal of the last eligible application closes the thread. Thread and audit history use descending ID cursors.
- The log mail worker and SMTP adapter use only PHP extensions and the database. Delivery is at least once across a job interruption. The database stores active reset and verification URLs only until delivery, expiry or terminal failure.

## Phase 1 follow-ups

- Wrong-password checks perform a runtime default hash and one verification for known and unknown accounts. Legacy accounts with a different hash cost can have different timings.
- Login limits are 10 failures per account/IP and 50 per account globally per 15 minutes. A reset clears all login buckets for the account. Recovery permits three requests per email/IP per UTC day, ten per email per UTC day and thirty per IP per hour.
- Closed student-employer threads with message history stay readable and can be marked read. A current eligible application is required to send or start a thread. Recipient-level cooldown suppresses another notification email within 15 minutes while unread messages remain.
- Password changes generate account-security mail regardless of the notification preference. Pending older messages without HTML remain deliverable as plain text.
- SMTP requires an explicit EHLO hostname. The worker uses SKIP LOCKED so independent workers can claim separate rows and exit status 1 signals a send failure.

## Phase 2

- The student portal uses attachlink-common.js for shared account and navigation state, openings.js for discovery, details, uploads and the saved list, bookmarks.js for bookmark state, applications.js for application cards and withdrawal, application-layout.js for the shared layout, profile.js for preferences, skills and activity, plus messages.js and notifications.js. CV, interview planner and data settings retain their feature scripts.
- The employer portal uses app.js for company and opening workflows and employer account identity. Its inbox and document workflows retain employer-messages.js and applicant-documents.js. The messages page retains the portal navigation bridge. The admin portal uses app.js for its dashboard, queues, directory, placements and settings, with dedicated messages.js and audit-log.js.
- Shared sign-in, account actions, verification banner, overview, branding and message pagination live in assets. The dedicated application list is the sole renderer on My Applications.
- Removed database badges and development copy from account, listing, application, messaging, notification, employer and admin screens. Removed demo-title handling from opening and application cards, unsupported sample controls from the opening editor, and preset audit text, sample rows and inactive compliance controls from admin settings. The design-reference and release archives remain available for Phase 3 cleanup.
- Upload progress uses multipart XHR and retains PHP MIME and ownership checks. Client validation reports unsupported extensions, MIME types and per-file size. Browser verification uses Edge with a throttled five-file upload and dashboard screenshots at both requested widths.

## Release decisions

- Login checks existing throttle counters without locks, verifies credentials, then atomically rechecks and updates throttle counters. New password hashes and the runtime dummy use bcrypt cost 11. Existing hashes remain usable at their stored cost. On the QA Windows PHP host, 15 standalone verifications had a 154.0 ms median and 156.9 ms p95. One hundred simultaneous successful logins from one loopback IP across eight PHP workers had a 5,994.2 ms median and 10,709.8 ms p95, including queue time. No lock waits or deadlocks were observed. Use staging load results to set worker capacity.
- A global daily recovery cap emits a server-side event keyed by an email bucket. An administrator can clear that bucket after an identity check. The per-IP and per-email/IP limits are preserved.
- The complete fresh schema is derived from the original baseline and all upgrades. A migration ledger and advisory lock coordinate upgrades. Consent is required for new registrations. Existing consent values remain null.
- Student deletion removes records transactionally and queues failed filesystem removals for retry. Retention counts are operational review thresholds. Backup copies age out under the operator's retention schedule.
- The release archive contains only the documented allowlist and bundled Composer runtime. Inline template JavaScript and CSS remain enabled by CSP. Runtime assets are same-origin. Privacy and terms are drafts pending legal review.

## Staging follow-up decisions

- Unknown-account dummy hashes use the same bcrypt generator and cost 11 as new passwords. After an eligible successful login, a lower-cost bcrypt hash is replaced conditionally using the old hash as the update guard. This keeps rehashing separate from password resets and preserves concurrently changed passwords and stronger hashes.
- Database dumps and document archives stream directly into age. The backup host takes the public recipient only. Operators use an off-server identity for recovery and retain older keys until the matching ciphertext expires.
- The login benchmark can require the Apache server header and the fpm-fcgi SAPI before it starts timing requests. This keeps PHP-FPM measurements distinct from development servers.
## Company location, Stage 1

- Use additive migration `upgrade-19` because `upgrade-13` already belongs to the document vault. Existing free-text addresses and already published openings keep their current values.
- Use GeoNames Zimbabwe reference records for the ten provinces and 46 selected populated places. The stored points are approximate town references. They have not been field-verified and do not identify individual businesses. The source is the GeoNames country extract under CC BY 4.0.
- Registration prepares an optional draft in the current browser tab. It is tied to the new account ID, sent to no registration or authentication endpoint, and saved to the server only by an explicit Company Profile action. Closing the tab can discard it.
- Verified company proposals are stored separately from the effective location. Admin approval applies the proposal, and an approval timestamp preserves the verified state of the effective location while another proposal is pending. The audit log records the actor and before/after snapshots, including an employer actor role when applicable.
- The self-hosted map picker can work without external tiles. When tiles are configured, previewing the map sends tile requests to the configured provider, which can infer the displayed area. Stage 1 stores no student location data.
- Routing and drawn directions would require a routing service and traffic assumptions. Live tracking would create unnecessary privacy exposure. Geocoding search would require another provider and an address-matching review workflow.
