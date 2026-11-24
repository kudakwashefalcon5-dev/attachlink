ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS support_status ENUM('needs_human','ai_answered','human_answered','ai_reply') NULL,
    ADD INDEX IF NOT EXISTS ix_message_support (recipient_id,support_status,sender_id,id);
