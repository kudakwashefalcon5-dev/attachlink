-- Import only if upgrading an existing AttachLink database. Existing users remain untouched.
USE `attachlink_db`;
CREATE TABLE IF NOT EXISTS student_cvs (
 student_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 full_name VARCHAR(200) NULL, email VARCHAR(190) NULL, phone VARCHAR(40) NULL,
 location VARCHAR(180) NULL, summary TEXT NULL, education TEXT NULL,
 skills TEXT NULL, experience TEXT NULL, projects TEXT NULL, awards TEXT NULL,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_cv_student FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
