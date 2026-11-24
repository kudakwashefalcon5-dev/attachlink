<?php
declare(strict_types=1);
if (PHP_SAPI!=='cli') { http_response_code(404); exit; }

$failed=false;
function report_setting(string $key, ?string $issue, string $value, string $ok): void {
    global $failed;
    $status=$issue===null?'OK':($value===''?'MISSING':'INVALID');
    $failed=$failed || $issue!==null;
    printf("%s %s - %s\n",$status,$key,$issue??$ok);
}

try {
    require_once __DIR__.'/config.php';
} catch (Throwable $error) {
    report_setting('backend/.env',$error instanceof ConfigException?$error->getMessage():'Could not read configuration.','invalid','');
    exit(1);
}
report_setting('ATTACHLINK_ENV',app_environment_issue(),config_env('ATTACHLINK_ENV'),'Detected '.APP_ENV.'.');
report_setting('Web server',null,'','Apache only; nginx and Caddy are unsupported.');
require_once __DIR__.'/lib/CompanyLocation.php';
foreach (['ATTACHLINK_ZW_LOCATION_BOUNDS'=>'location_bounds','ATTACHLINK_LOCATION_MAX_KM'=>'location_distance_limit','ATTACHLINK_MAP_TILE_URL'=>'map_tile_settings'] as $key=>$check) {
    try { $check(); report_setting($key,null,'','Valid location setting.'); }
    catch (ConfigException $error) { report_setting($key,$error->getMessage(),'invalid',''); }
}
if (APP_ENV==='production') {
    require_once __DIR__.'/lib/AdminTotp.php';
    try {
        admin_totp_key();
        if (!extension_loaded('openssl')) throw new ConfigException('OpenSSL is required for admin authenticator encryption.');
        report_setting('ATTACHLINK_ADMIN_TOTP_KEY',null,'','Authenticator encryption is configured.');
    } catch (ConfigException $error) {
        report_setting('ATTACHLINK_ADMIN_TOTP_KEY',$error->getMessage(),config_env('ATTACHLINK_ADMIN_TOTP_KEY'),'');
    }
}
try {
    configured_base_url();
    report_setting('ATTACHLINK_BASE_URL',null,'','Valid URL or local default.');
} catch (ConfigException $error) {
    report_setting('ATTACHLINK_BASE_URL',$error->getMessage(),config_env('ATTACHLINK_BASE_URL'),'');
}

$dbIssues=db_setting_issues();
foreach (['ATTACHLINK_DB_HOST'=>DB_HOST,'ATTACHLINK_DB_PORT'=>DB_PORT,'ATTACHLINK_DB_NAME'=>DB_NAME,
          'ATTACHLINK_DB_USER'=>DB_USER,'ATTACHLINK_DB_PASS'=>DB_PASS] as $key=>$value) {
    report_setting($key,$dbIssues[$key]??null,$value,'Database setting accepted.');
}
try {
    if ($dbIssues) throw new ConfigException('Fix the database settings above before connecting.');
    $pdo=connect_database();
    $pdo->query('SELECT 1')->closeCursor();
    report_setting('Database connection',null,'','Connected successfully.');
} catch (Throwable $error) {
    report_setting('Database connection',$error instanceof ConfigException?$error->getMessage():'Database query failed.','invalid','');
    $pdo=null;
}
if ($pdo!==null) {
    require_once __DIR__.'/lib/Migrations.php';
    try {
        $pending=array_keys(pending_migrations($pdo));
        report_setting('Database migrations',$pending?'Pending: '.implode(', ',$pending):null,'checked','All migrations recorded.');
    } catch (Throwable $error) {
        report_setting('Database migrations',$error instanceof ConfigException?$error->getMessage():'Could not read migration state.','checked','');
    }
    try {
        $pdo->query('SELECT email_verified_at,password_changed_at,consent_at,consent_version FROM users LIMIT 0')->closeCursor();
        $pdo->query('SELECT html_body,message_id FROM email_outbox LIMIT 0')->closeCursor();
        $pdo->query('SELECT bucket FROM login_attempts LIMIT 0')->closeCursor();
        $pdo->query('SELECT stored_name FROM document_purge_queue LIMIT 0')->closeCursor();
        $pdo->query('SELECT town_id,location_review_status FROM companies LIMIT 0')->closeCursor();
        $pdo->query('SELECT province_id,coordinate_source,attribution FROM towns LIMIT 0')->closeCursor();
        $pdo->query('SELECT details FROM company_location_proposals LIMIT 0')->closeCursor();
        report_setting('Database schema',null,'','Account and outbox tables are ready.');
    } catch (Throwable) {
        report_setting('Database schema','Check ATTACHLINK_DB_NAME and apply the required migrations.','invalid','');
    }
}

$path=application_storage();
$canWrite=false;
if (!is_link($path) && (is_dir($path) || @mkdir($path,0700,true))) {
    $probe=$path.'/'.bin2hex(random_bytes(16)).'.tmp';
    $file=@fopen($probe,'xb');
    if ($file!==false) {
        fclose($file);
        $canWrite=@unlink($probe);
    }
}
report_setting('ATTACHLINK_DOCUMENT_STORAGE',$canWrite?null:'Provide a writable document storage directory.','checked','Directory is writable by this CLI user.');

$transport=mail_transport_name();
$issues=mail_setting_issues();
report_setting('ATTACHLINK_MAIL_TRANSPORT',$issues['ATTACHLINK_MAIL_TRANSPORT']??null,$transport,'Transport selected.');
if (!isset($issues['ATTACHLINK_MAIL_TRANSPORT'])) {
    $settings=$transport==='smtp'?smtp_settings()+['SMTP runtime'=>'checked']:['ATTACHLINK_MAIL_LOG'=>mail_log_path()];
    foreach ($settings as $key=>$value) {
        report_setting($key,$issues[$key]??null,$value,'Accepted. No email sent.');
    }
}
exit($failed?1:0);
