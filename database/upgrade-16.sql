ALTER TABLE student_document_vault
    ADD COLUMN IF NOT EXISTS slot TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER document_type,
    DROP PRIMARY KEY,
    ADD PRIMARY KEY (student_id,document_type,slot);
