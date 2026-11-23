CREATE TABLE IF NOT EXISTS admin_totp (
    admin_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    encrypted_secret VARCHAR(128) CHARACTER SET ascii NOT NULL,
    last_step BIGINT NOT NULL,
    recovery_hashes TEXT NOT NULL,
    CONSTRAINT fk_totp_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
