# AttachLink

AttachLink connects Zimbabwean students seeking industrial attachments with employers and administrators.

## Local development setup

Install XAMPP with Apache, PHP and MariaDB. Place the checkout in the Apache web root. Import database/schema.sql for a fresh database. For an existing installation, back up the database and run php backend/jobs/migrate.php. Copy backend/env.example to backend/.env if local settings differ from the defaults. Run php backend/check-config.php, create the first administrator with php backend/create-admin.php, and run php backend/jobs/send-emails.php for a development mail check. [Local setup and browser tests](docs/DEPLOYMENT.md)

## Production configuration

Configure the production environment, canonical HTTPS URL, dedicated database credentials, private storage, SMTP and worker schedules. Build the release from the allowlist and verify the archive before deploying. [Deployment guide](docs/DEPLOYMENT.md) | [Operations](docs/OPERATIONS.md) | [Staging checklist](docs/STAGING_CHECKLIST.md)

[API](API_DOCUMENTATION.md) | [Database](DATABASE.md) | [Decisions](docs/DECISIONS.md) | [Test results](TEST_REPORT.md)
