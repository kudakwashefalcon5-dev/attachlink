<?php
declare(strict_types=1);

function migration_files(): array {
    $root=dirname(__DIR__,2);
    $directory=basename($root)==='public' && is_dir(dirname($root).'/database')
        ? dirname($root).'/database' : $root.'/database';
    $files=glob($directory.'/upgrade-*.sql');
    if (!$files) throw new ConfigException('No database migration files found.');
    sort($files,SORT_NATURAL);
    return array_combine(array_map(static fn($file)=>basename($file,'.sql'),$files),$files);
}

function pending_migrations(PDO $pdo): array {
    $files=migration_files();
    try {
        $recorded=$pdo->query('SELECT version FROM schema_migrations')->fetchAll(PDO::FETCH_COLUMN);
    } catch (PDOException $error) {
        if ($error->getCode()!=='42S02') throw $error;
        $recorded=[];
    }
    return array_diff_key($files,array_fill_keys($recorded,true));
}

function detect_unversioned_migrations(PDO $pdo): array {
    $columns=[];
    foreach ($pdo->query('SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()') as $column) {
        $columns[$column['TABLE_NAME']][$column['COLUMN_NAME']]=$column['COLUMN_TYPE'];
    }
    $indexes=$pdo->query("SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='messages'")->fetchAll(PDO::FETCH_COLUMN);
    $applied=[
        'upgrade-02'=>isset($columns['student_cvs']),
        'upgrade-03'=>isset($columns['student_skills'],$columns['login_attempts'],$columns['company_verification_decisions'],$columns['system_settings'],$columns['company_files']),
        'upgrade-04'=>isset($columns['company_verification_decisions']['reason']),
        'upgrade-05'=>isset($columns['openings']['stipend_usd']) && str_contains($columns['openings']['status']??'',"'archived'"),
        'upgrade-06'=>isset($columns['student_interview_plans']),
        'upgrade-07'=>isset($columns['application_status_events'],$columns['student_preferences'],$columns['admin_setting_entries']),
        'upgrade-08'=>isset($columns['openings']['available_positions'],$columns['openings']['required_skills']),
        'upgrade-09'=>isset($columns['users']['email_verified_at'],$columns['users']['password_changed_at'],$columns['student_preferences']['email_notifications'],$columns['employer_preferences'],$columns['email_outbox'],$columns['password_resets'],$columns['email_verifications'],$columns['admin_audit_log']),
        'upgrade-10'=>isset($columns['email_outbox']['html_body'],$columns['email_outbox']['message_id'],$columns['message_email_limits']) && in_array('ix_message_unread',$indexes,true),
        'upgrade-11'=>isset($columns['users']['consent_at'],$columns['users']['consent_version'],$columns['document_purge_queue']),
        'upgrade-12'=>str_contains($columns['application_documents']['document_type']??'',"'academic_certificates','birth_certificate'"),
        'upgrade-13'=>isset($columns['student_document_vault']['stored_name']),
        'upgrade-14'=>isset($columns['admin_totp']['encrypted_secret'],$columns['admin_totp']['recovery_hashes']),
        'upgrade-15'=>isset($columns['messages']['support_status']) && in_array('ix_message_support',$indexes,true),
        'upgrade-16'=>isset($columns['student_document_vault']['slot']),
        'upgrade-17'=>isset($columns['openings']['intake_start_month'],$columns['openings']['intake_end_month']),
        'upgrade-18'=>isset($columns['student_cvs']['layout']),
    ];
    return array_keys(array_filter($applied));
}
