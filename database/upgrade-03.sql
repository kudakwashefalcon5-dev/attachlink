CREATE TABLE IF NOT EXISTS student_skills (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 student_id BIGINT UNSIGNED NOT NULL,
 name VARCHAR(100) NOT NULL,
 category VARCHAR(80) NOT NULL,
 FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS login_attempts (
 bucket CHAR(64) CHARACTER SET ascii PRIMARY KEY,
 window_id BIGINT UNSIGNED NOT NULL,
 attempts INT UNSIGNED NOT NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS company_verification_decisions (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT UNSIGNED NOT NULL,
 admin_id BIGINT UNSIGNED NOT NULL,
 status ENUM('pending','verified','rejected') NOT NULL,
 decided_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (company_id) REFERENCES companies(id),
 FOREIGN KEY (admin_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS system_settings (
 id TINYINT UNSIGNED PRIMARY KEY,
 attachment_months TINYINT UNSIGNED NULL,
 registration_grace DATE NULL,
 logbook_cadence ENUM('weekly','fortnightly','monthly') NULL,
 minimum_stipend DECIMAL(10,2) NULL,
 updated_by BIGINT UNSIGNED NOT NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS company_files (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT UNSIGNED NOT NULL,
 purpose ENUM('logo','verification') NOT NULL,
 original_name VARCHAR(255) NOT NULL,
 stored_name VARCHAR(120) NOT NULL UNIQUE,
 mime_type VARCHAR(80) NOT NULL,
 uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_company_files (company_id,purpose,id),
 FOREIGN KEY (company_id) REFERENCES companies(id)
) ENGINE=InnoDB;
