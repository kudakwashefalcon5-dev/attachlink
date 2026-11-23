<?php
require_once __DIR__.'/../../bootstrap.php';
method('GET');
user('admin');
out(['ok'=>true,'status'=>getrow("SELECT
 (SELECT COUNT(*) FROM document_purge_queue) AS pending_file_removals,
 (SELECT COUNT(*) FROM password_resets WHERE expires_at<NOW()-INTERVAL 30 DAY) AS expired_resets_over_30_days,
 (SELECT COUNT(*) FROM email_outbox WHERE COALESCE(sent_at,failed_at)<NOW()-INTERVAL 90 DAY) AS mail_over_90_days,
 (SELECT COUNT(*) FROM admin_audit_log WHERE created_at<NOW()-INTERVAL 365 DAY) AS audit_over_365_days,
 (SELECT COUNT(*) FROM users WHERE role='student' AND consent_at IS NULL) AS students_without_recorded_consent")]);
