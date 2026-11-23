ALTER TABLE email_outbox
 ADD COLUMN IF NOT EXISTS html_body MEDIUMTEXT NULL,
 ADD COLUMN IF NOT EXISTS message_id VARCHAR(255) CHARACTER SET ascii NULL;
CREATE TABLE IF NOT EXISTS message_email_limits (
 recipient_id BIGINT UNSIGNED PRIMARY KEY,
 queued_at DATETIME NULL,
 FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
ALTER TABLE messages ADD INDEX IF NOT EXISTS ix_message_unread(recipient_id,is_read,id);
