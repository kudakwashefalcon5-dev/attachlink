ALTER TABLE login_attempts
 ADD COLUMN IF NOT EXISTS window_seconds INT UNSIGNED NOT NULL DEFAULT 900;

UPDATE login_attempts SET window_seconds=86400
 WHERE window_id=FLOOR(UNIX_TIMESTAMP()/86400);
UPDATE login_attempts SET window_seconds=3600
 WHERE window_id=FLOOR(UNIX_TIMESTAMP()/3600);

ALTER TABLE password_resets
 MODIFY requested_ip VARCHAR(45) NULL;
