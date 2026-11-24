-- Complete fresh-install schema. Existing installations should run backend/jobs/migrate.php.
CREATE DATABASE IF NOT EXISTS `attachlink_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `attachlink_db`;
SET @attachlink_old_fk=@@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS=0;
/*M!999999\- enable the sandbox mode */ 
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_audit_log` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `admin_id` bigint(20) unsigned NOT NULL,
  `action` varchar(64) NOT NULL,
  `target_type` varchar(64) NOT NULL,
  `target_id` bigint(20) unsigned DEFAULT NULL,
  `detail` text NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `action` (`action`,`id`),
  KEY `target_type` (`target_type`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_setting_entries` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `category` enum('campus','programme','intake') NOT NULL,
  `name` varchar(180) NOT NULL,
  `details` text NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` bigint(20) unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `category` (`category`,`name`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `admin_setting_entries_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `application_documents` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `application_id` bigint(20) unsigned NOT NULL,
  `document_type` enum('attachment_letter','cv','id','transcript','o_level','a_level','other_certificate','academic_certificates','birth_certificate') NOT NULL,
  `original_name` varchar(255) NOT NULL,
  `stored_name` varchar(120) NOT NULL,
  `mime_type` varchar(80) NOT NULL,
  `uploaded_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `application_id` (`application_id`),
  CONSTRAINT `application_documents_ibfk_1` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `application_status_events` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `application_id` bigint(20) unsigned NOT NULL,
  `changed_by` bigint(20) unsigned NOT NULL,
  `previous_status` varchar(20) NOT NULL,
  `new_status` varchar(20) NOT NULL,
  `note` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `application_id` (`application_id`,`id`),
  KEY `changed_by` (`changed_by`),
  CONSTRAINT `application_status_events_ibfk_1` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE,
  CONSTRAINT `application_status_events_ibfk_2` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `applications` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `opening_id` bigint(20) unsigned NOT NULL,
  `student_id` bigint(20) unsigned NOT NULL,
  `cover_letter` text DEFAULT NULL,
  `status` enum('submitted','reviewing','accepted','rejected','withdrawn') NOT NULL DEFAULT 'submitted',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_application` (`opening_id`,`student_id`),
  KEY `student_id` (`student_id`),
  CONSTRAINT `applications_ibfk_1` FOREIGN KEY (`opening_id`) REFERENCES `openings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `applications_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS provinces (
    id INT UNSIGNED NOT NULL PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS towns (
    id INT UNSIGNED NOT NULL PRIMARY KEY,
    province_id INT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    coordinate_source VARCHAR(30) NOT NULL,
    attribution VARCHAR(255) NOT NULL,
    UNIQUE KEY uq_town_province_name (province_id,name),
    CONSTRAINT fk_town_province FOREIGN KEY (province_id) REFERENCES provinces(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `companies` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(180) NOT NULL,
  `description` text DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `industry` varchar(100) DEFAULT NULL,
  `city` varchar(120) DEFAULT NULL,
  `verification_status` enum('pending','verified','rejected') NOT NULL DEFAULT 'pending',
  `verified_by` bigint(20) unsigned DEFAULT NULL,
  `verified_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  physical_address VARCHAR(255) DEFAULT NULL,
  town_id INT UNSIGNED DEFAULT NULL,
  latitude DECIMAL(9,6) DEFAULT NULL,
  longitude DECIMAL(9,6) DEFAULT NULL,
  accuracy_m DECIMAL(10,2) DEFAULT NULL,
  location_precision ENUM('town','exact') DEFAULT NULL,
  location_source ENUM('town_seed','employer_pin','employer_gps_once','admin','pasted_link') DEFAULT NULL,
  location_review_status ENUM('none','pending','approved','rejected') NOT NULL DEFAULT 'none',
  location_updated_at DATETIME DEFAULT NULL,
  location_approved_at DATETIME DEFAULT NULL,
  landmark_directions VARCHAR(300) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_companies_status` (`verification_status`),
  KEY ix_companies_town (town_id),
  KEY ix_companies_coordinates (latitude,longitude),
  CONSTRAINT fk_companies_town FOREIGN KEY (town_id) REFERENCES towns(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS company_location_proposals (
    company_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    details JSON NOT NULL,
    CONSTRAINT fk_company_location_proposal FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `company_files` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `company_id` bigint(20) unsigned NOT NULL,
  `purpose` enum('logo','verification') NOT NULL,
  `original_name` varchar(255) NOT NULL,
  `stored_name` varchar(120) NOT NULL,
  `mime_type` varchar(80) NOT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `stored_name` (`stored_name`),
  KEY `ix_company_files` (`company_id`,`purpose`,`id`),
  CONSTRAINT `company_files_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `company_verification_decisions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `company_id` bigint(20) unsigned NOT NULL,
  `admin_id` bigint(20) unsigned NOT NULL,
  `status` enum('pending','verified','rejected') NOT NULL,
  `decided_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `reason` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `company_id` (`company_id`),
  KEY `admin_id` (`admin_id`),
  CONSTRAINT `company_verification_decisions_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`),
  CONSTRAINT `company_verification_decisions_ibfk_2` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `document_purge_queue` (
  `storage_kind` enum('document','avatar') NOT NULL,
  `stored_name` varchar(120) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`storage_kind`,`stored_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `email_outbox` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `recipient` varchar(190) NOT NULL,
  `subject` varchar(255) NOT NULL,
  `body` text NOT NULL,
  `attempts` int(10) unsigned NOT NULL DEFAULT 0,
  `next_attempt_at` datetime NOT NULL DEFAULT current_timestamp(),
  `sent_at` datetime DEFAULT NULL,
  `failed_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `html_body` mediumtext DEFAULT NULL,
  `message_id` varchar(255) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `sent_at` (`sent_at`,`failed_at`,`next_attempt_at`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `email_verifications` (
  `token_hash` char(64) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `expires_at` datetime NOT NULL,
  PRIMARY KEY (`token_hash`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `email_verifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `employer_preferences` (
  `user_id` bigint(20) unsigned NOT NULL,
  `email_notifications` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `employer_preferences_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `login_attempts` (
  `bucket` char(64) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `window_id` bigint(20) unsigned NOT NULL,
  `attempts` int(10) unsigned NOT NULL,
  PRIMARY KEY (`bucket`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `message_email_limits` (
  `recipient_id` bigint(20) unsigned NOT NULL,
  `queued_at` datetime DEFAULT NULL,
  PRIMARY KEY (`recipient_id`),
  CONSTRAINT `message_email_limits_ibfk_1` FOREIGN KEY (`recipient_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `messages` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `sender_id` bigint(20) unsigned NOT NULL,
  `recipient_id` bigint(20) unsigned NOT NULL,
  `body` text NOT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `support_status` enum('needs_human','ai_answered','human_answered','ai_reply') DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `sender_id` (`sender_id`),
  KEY `ix_message_inbox` (`recipient_id`,`sender_id`,`created_at`),
  KEY `ix_message_unread` (`recipient_id`,`is_read`,`id`),
  KEY `ix_message_support` (`recipient_id`,`support_status`,`sender_id`,`id`),
  CONSTRAINT `messages_ibfk_1` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `messages_ibfk_2` FOREIGN KEY (`recipient_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `title` varchar(180) NOT NULL,
  `message` text NOT NULL,
  `type` varchar(40) NOT NULL DEFAULT 'info',
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `ix_notification_user` (`user_id`,`is_read`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `openings` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `company_id` bigint(20) unsigned NOT NULL,
  `title` varchar(180) NOT NULL,
  `department` varchar(140) DEFAULT NULL,
  `city` varchar(120) DEFAULT NULL,
  `work_mode` enum('onsite','hybrid','remote') DEFAULT 'onsite',
  `description` text NOT NULL,
  `requirements` text DEFAULT NULL,
  `deadline` date DEFAULT NULL,
  `status` enum('draft','published','closed','archived') NOT NULL DEFAULT 'draft',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `stipend_usd` decimal(10,2) DEFAULT NULL,
  `available_positions` smallint(5) unsigned DEFAULT NULL,
  `required_skills` text DEFAULT NULL,
  `intake_start_month` char(7) CHARACTER SET ascii DEFAULT NULL,
  `intake_end_month` char(7) CHARACTER SET ascii DEFAULT NULL,
  accommodation ENUM('yes','no','unknown') NOT NULL DEFAULT 'unknown',
  transport_allowance ENUM('yes','no','unknown') NOT NULL DEFAULT 'unknown',
  meal_allowance ENUM('yes','no','unknown') NOT NULL DEFAULT 'unknown',
  remote_option ENUM('no','hybrid','remote') NOT NULL DEFAULT 'no',
  PRIMARY KEY (`id`),
  KEY `company_id` (`company_id`),
  KEY `ix_openings_status` (`status`,`deadline`),
  CONSTRAINT `openings_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_resets` (
  `token_hash` char(64) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `requested_ip` varchar(45) NOT NULL,
  PRIMARY KEY (`token_hash`),
  KEY `user_id` (`user_id`,`used_at`),
  CONSTRAINT `password_resets_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `placements` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `application_id` bigint(20) unsigned NOT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `application_id` (`application_id`),
  CONSTRAINT `placements_ibfk_1` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `saved_openings` (
  `student_id` bigint(20) unsigned NOT NULL,
  `opening_id` bigint(20) unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`student_id`,`opening_id`),
  KEY `opening_id` (`opening_id`),
  CONSTRAINT `saved_openings_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `saved_openings_ibfk_2` FOREIGN KEY (`opening_id`) REFERENCES `openings` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `schema_migrations` (
  `version` varchar(32) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `applied_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_cvs` (
  `student_id` bigint(20) unsigned NOT NULL,
  `full_name` varchar(200) DEFAULT NULL,
  `email` varchar(190) DEFAULT NULL,
  `phone` varchar(40) DEFAULT NULL,
  `location` varchar(180) DEFAULT NULL,
  `summary` text DEFAULT NULL,
  `education` text DEFAULT NULL,
  `skills` text DEFAULT NULL,
  `experience` text DEFAULT NULL,
  `projects` text DEFAULT NULL,
  `awards` text DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `layout` varchar(16) CHARACTER SET ascii NOT NULL DEFAULT 'classic',
  PRIMARY KEY (`student_id`),
  CONSTRAINT `student_cvs_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_interview_plans` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `student_id` bigint(20) unsigned NOT NULL,
  `company` varchar(180) NOT NULL,
  `role_name` varchar(180) NOT NULL,
  `interview_date` date NOT NULL,
  `interview_time` time NOT NULL,
  `interview_type` varchar(40) NOT NULL,
  `duration` smallint(5) unsigned NOT NULL,
  `venue` varchar(255) NOT NULL DEFAULT '',
  `notes` text NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_interview_student_date` (`student_id`,`interview_date`,`interview_time`),
  CONSTRAINT `student_interview_plans_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_preferences` (
  `student_id` bigint(20) unsigned NOT NULL,
  `recruiter_visible` tinyint(1) NOT NULL DEFAULT 1,
  `sectors` varchar(255) NOT NULL DEFAULT '',
  `stipend` decimal(10,2) DEFAULT NULL,
  `work_model` varchar(80) NOT NULL DEFAULT '',
  `relocation` varchar(255) NOT NULL DEFAULT '',
  `email_notifications` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`student_id`),
  CONSTRAINT `student_preferences_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_profiles` (
  `user_id` bigint(20) unsigned NOT NULL,
  `date_of_birth` date DEFAULT NULL,
  `gender` varchar(40) DEFAULT NULL,
  `institution` varchar(180) DEFAULT NULL,
  `programme` varchar(180) DEFAULT NULL,
  `study_level` varchar(100) DEFAULT NULL,
  `city` varchar(120) DEFAULT NULL,
  `bio` text DEFAULT NULL,
  `skills` text DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `student_profiles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_skills` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `student_id` bigint(20) unsigned NOT NULL,
  `name` varchar(100) NOT NULL,
  `category` varchar(80) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `student_id` (`student_id`),
  CONSTRAINT `student_skills_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_settings` (
  `id` tinyint(3) unsigned NOT NULL,
  `attachment_months` tinyint(3) unsigned DEFAULT NULL,
  `registration_grace` date DEFAULT NULL,
  `logbook_cadence` enum('weekly','fortnightly','monthly') DEFAULT NULL,
  `minimum_stipend` decimal(10,2) DEFAULT NULL,
  `updated_by` bigint(20) unsigned NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `updated_by` (`updated_by`),
  CONSTRAINT `system_settings_ibfk_1` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `role` enum('student','employer','admin') NOT NULL,
  `company_id` bigint(20) unsigned DEFAULT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `email` varchar(190) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `email_verified_at` datetime DEFAULT NULL,
  `password_changed_at` datetime(6) DEFAULT NULL,
  `consent_at` datetime DEFAULT NULL,
  `consent_version` varchar(32) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `phone` (`phone`),
  KEY `fk_user_company` (`company_id`),
  KEY `ix_user_role` (`role`),
  CONSTRAINT `fk_user_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
CREATE TABLE IF NOT EXISTS student_document_vault (
    student_id BIGINT UNSIGNED NOT NULL,
    document_type VARCHAR(32) CHARACTER SET ascii NOT NULL,
    slot TINYINT UNSIGNED NOT NULL DEFAULT 1,
    original_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    PRIMARY KEY (student_id,document_type,slot),
    CONSTRAINT fk_vault_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS admin_totp (
    admin_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    encrypted_secret VARCHAR(128) CHARACTER SET ascii NOT NULL,
    last_step BIGINT NOT NULL,
    recovery_hashes TEXT NOT NULL,
    CONSTRAINT fk_totp_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
SET FOREIGN_KEY_CHECKS=@attachlink_old_fk;
-- GeoNames Zimbabwe extract, CC BY 4.0. https://www.geonames.org/export/
INSERT IGNORE INTO provinces (id,name) VALUES
(1105843,'Bulawayo'),
(1105844,'Harare'),
(887358,'Manicaland'),
(886843,'Mashonaland Central'),
(886842,'Mashonaland East'),
(886841,'Mashonaland West'),
(886761,'Masvingo'),
(886748,'Matabeleland North'),
(886747,'Matabeleland South'),
(886119,'Midlands');
INSERT IGNORE INTO towns (id,province_id,name,latitude,longitude,coordinate_source,attribution) VALUES
(893549,887358,'Chipinge',-20.188330,32.623650,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/893549/'),
(884979,887358,'Mutare',-18.970700,32.670860,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/884979/'),
(882955,887358,'Penhalonga',-18.891120,32.697810,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/882955/'),
(882100,887358,'Rusape',-18.527850,32.128430,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/882100/'),
(890983,886119,'Gokwe',-18.204760,28.934900,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/890983/'),
(890422,886119,'Gweru',-19.450000,29.816670,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/890422/'),
(888710,886119,'Kwekwe',-18.928090,29.814860,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/888710/'),
(882599,886119,'Redcliff',-19.033330,29.783330,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/882599/'),
(881164,886119,'Shurugwi',-19.670160,30.005890,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/881164/'),
(895061,886843,'Bindura',-17.301920,31.330560,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/895061/'),
(891099,886843,'Glendale',-17.355140,31.067180,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/891099/'),
(886384,886843,'Mazowe',-17.504040,30.973880,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/886384/'),
(885800,886843,'Mount Darwin',-16.772510,31.583810,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/885800/'),
(884798,886843,'Mvurwi',-17.033330,30.850000,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/884798/'),
(881345,886843,'Shamva',-17.311590,31.575610,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/881345/'),
(893172,886842,'Chivhu',-19.021120,30.892180,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/893172/'),
(886990,886842,'Marondera',-18.185270,31.551930,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/886990/'),
(885792,886842,'Mount Hampden',-17.741670,30.938890,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/885792/'),
(885159,886842,'Murewa',-17.643220,31.784000,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/885159/'),
(884927,886842,'Mutoko',-17.396990,32.226770,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/884927/'),
(882009,886842,'Ruwa',-17.889720,31.244720,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/882009/'),
(895417,886841,'Banket',-17.383330,30.400000,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/895417/'),
(894413,886841,'Chakari',-18.062940,29.892460,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/894413/'),
(894239,886841,'Chegutu',-18.130210,30.140740,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/894239/'),
(893697,886841,'Chinhoyi',-17.366670,30.200000,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/893697/'),
(13132735,886841,'Harare Western Suburbs',-17.841500,30.876740,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/13132735/'),
(889453,886841,'Kadoma',-18.333280,29.915340,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/889453/'),
(889215,886841,'Kariba',-16.516670,28.800000,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/889215/'),
(889191,886841,'Karoi',-16.809930,29.692470,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/889191/'),
(886146,886841,'Mhangura',-16.893870,30.168280,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/886146/'),
(884141,886841,'Norton',-17.883330,30.700000,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/884141/'),
(889942,886748,'Hwange',-18.364460,26.498770,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/889942/'),
(889723,886748,'Inyati',-19.675630,28.846870,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/889723/'),
(888225,886748,'Lupane',-18.931490,27.806960,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/888225/'),
(879431,886748,'Victoria Falls',-17.932850,25.830660,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/879431/'),
(895269,886747,'Beitbridge',-22.216670,30.000000,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/895269/'),
(890516,886747,'Gwanda',-20.936220,29.006980,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/890516/'),
(882859,886747,'Plumtree',-20.483330,27.816670,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/882859/'),
(893485,886761,'Chiredzi',-21.050000,31.666670,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/893485/'),
(886864,886761,'Mashava',-20.036650,30.482250,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/886864/'),
(886763,886761,'Masvingo',-20.063730,30.827660,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/886763/'),
(878549,886761,'Zvishavane',-20.326740,30.066480,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/878549/'),
(894701,1105843,'Bulawayo',-20.150000,28.583330,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/894701/'),
(1106542,1105844,'Chitungwiza',-18.012740,31.075550,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/1106542/'),
(1085510,1105844,'Epworth',-17.890000,31.147500,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/1085510/'),
(890299,1105844,'Harare',-17.827720,31.053370,'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/890299/');

INSERT IGNORE INTO schema_migrations(version) VALUES ('upgrade-02'),('upgrade-03'),('upgrade-04'),('upgrade-05'),('upgrade-06'),('upgrade-07'),('upgrade-08'),('upgrade-09'),('upgrade-10'),('upgrade-11'),('upgrade-12'),('upgrade-13'),('upgrade-14'),('upgrade-15'),('upgrade-16'),('upgrade-17'),('upgrade-18'),('upgrade-19');
