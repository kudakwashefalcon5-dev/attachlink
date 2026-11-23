CREATE TABLE IF NOT EXISTS student_document_vault (
    student_id BIGINT UNSIGNED NOT NULL,
    document_type VARCHAR(32) CHARACTER SET ascii NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    PRIMARY KEY (student_id,document_type),
    CONSTRAINT fk_vault_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
