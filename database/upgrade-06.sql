CREATE TABLE IF NOT EXISTS student_interview_plans (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 student_id BIGINT UNSIGNED NOT NULL,
 company VARCHAR(180) NOT NULL,
 role_name VARCHAR(180) NOT NULL,
 interview_date DATE NOT NULL,
 interview_time TIME NOT NULL,
 interview_type VARCHAR(40) NOT NULL,
 duration SMALLINT UNSIGNED NOT NULL,
 venue VARCHAR(255) NOT NULL DEFAULT '',
 notes TEXT NOT NULL,
 INDEX ix_interview_student_date (student_id,interview_date,interview_time),
 FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
