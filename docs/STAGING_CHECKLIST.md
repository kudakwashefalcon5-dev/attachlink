# Pilot staging checklist

Record the date, operator, evidence and PASSED, FAILED or NOT TESTED status beside each item before launch.

- [ ] Deliver a real verification and reset message to Gmail and to a university email address. Confirm the intended canonical HTTPS links, expiry and text/HTML rendering.
- [ ] Inspect Authentication-Results on delivered mail. Document passing SPF, DKIM and DMARC alignment for the pilot From domain.
- [ ] Confirm the mail worker and document purge jobs run under the service account. Observe retry and recovery in staging and set alerts for failures or a growing queue.
- [ ] Create a paired age-encrypted database and file backup. Retrieve the identity off-server, decrypt the backups on the restore workstation, and restore them to an isolated instance. Verify sign-in, company access, application records, private downloads and retention settings.
- [ ] Run the HTTPS and security-header scan against production-like Apache, including static pages and protected portal responses. Check redirects, TLS, CSP, HSTS, framing, referrer and permissions policies, and direct denial for backend/.env and storage.
- [ ] Run a 50-user load test across student, employer and admin activity. Capture median and p95 latency, error rate, database lock waits, resource usage and outbox backlog.
- [ ] Obtain legal review of the privacy notice, terms, consent version and retention procedures before use by real students.
