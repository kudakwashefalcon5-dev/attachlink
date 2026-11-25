CREATE TABLE IF NOT EXISTS job_heartbeats (
    job_name VARCHAR(64) CHARACTER SET ascii NOT NULL,
    last_successful_at DATETIME NOT NULL,
    PRIMARY KEY (job_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
