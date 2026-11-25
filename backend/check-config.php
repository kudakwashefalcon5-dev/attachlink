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

function php_limit_bytes(string $value): ?int {
    if (!preg_match('/\A\s*([0-9]+)\s*([KMG]?)\s*\z/i',$value,$match)) return null;
    $number=(int)$match[1];
    $multiplier=match(strtoupper($match[2])) {'K'=>1024,'M'=>1048576,'G'=>1073741824,default=>1};
    return $number>intdiv(PHP_INT_MAX,$multiplier)?PHP_INT_MAX:$number*$multiplier;
}

function writable_directory(string $path): bool {
    return path_is_absolute($path) && is_dir($path) && is_writable($path);
}

try {
    require_once __DIR__.'/config.php';
} catch (Throwable $error) {
    report_setting('backend/.env',$error instanceof ConfigException?$error->getMessage():'Could not read configuration.','invalid','');
    exit(1);
}
report_setting('ATTACHLINK_ENV',app_environment_issue(),config_env('ATTACHLINK_ENV'),'Detected '.APP_ENV.'.');
report_setting('Web server',null,'','Apache only; nginx and Caddy are unsupported.');
$proxyIssues=trusted_proxy_setting_issues();
report_setting('ATTACHLINK_TRUSTED_PROXIES',$proxyIssues['ATTACHLINK_TRUSTED_PROXIES']??null,
    config_env('ATTACHLINK_TRUSTED_PROXIES'),'Exact proxy IPs accepted, or no proxy configured.');
$aiIssues=ai_provider_setting_issues();
foreach (['ATTACHLINK_SUPPORT_AI','ATTACHLINK_INTERVIEW_AI_URL','ATTACHLINK_INTERVIEW_AI_MODEL','ATTACHLINK_INTERVIEW_AI_KEY'] as $key) {
    report_setting($key,$aiIssues[$key]??null,config_env($key),'Valid or not configured.');
}
report_setting('AI provider transport',$aiIssues['AI provider transport']??null,'configured','PHP cURL or HTTPS streams are available or not required.');
require_once __DIR__.'/lib/CompanyLocation.php';
foreach (['ATTACHLINK_ZW_LOCATION_BOUNDS'=>'location_bounds','ATTACHLINK_LOCATION_MAX_KM'=>'location_distance_limit'] as $key=>$check) {
    try { $check(); report_setting($key,null,'','Valid location setting.'); }
    catch (ConfigException $error) { report_setting($key,$error->getMessage(),'invalid',''); }
}
try {
    map_tile_settings();
    report_setting('ATTACHLINK_MAP_TILE_ORIGIN',null,'','Valid HTTPS tile origin or no tile service configured.');
} catch (ConfigException $error) {
    report_setting('ATTACHLINK_MAP_TILE_ORIGIN',$error->getMessage(),'invalid','');
}
$backupIssues=backup_setting_issues();
foreach ($backupIssues as $key=>$issue) {
    report_setting($key,$issue,config_env($key),'Backup setting validated.');
}
if (!isset($backupIssues['ATTACHLINK_BACKUP_DIR'])) {
    report_setting('ATTACHLINK_BACKUP_DIR',null,config_env('ATTACHLINK_BACKUP_DIR'),'Private backup location configured or not required in development.');
}
if (!isset($backupIssues['ATTACHLINK_BACKUP_RECIPIENT'])) {
    report_setting('ATTACHLINK_BACKUP_RECIPIENT',null,config_env('ATTACHLINK_BACKUP_RECIPIENT'),'Age recipient valid or not required in development.');
}
if (!isset($backupIssues['ATTACHLINK_BACKUP_DAYS'])) {
    report_setting('ATTACHLINK_BACKUP_DAYS',null,config_env('ATTACHLINK_BACKUP_DAYS','30'),'Retention period is from 1 to 3650 days.');
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
        $pdo->query('SELECT job_name,last_successful_at FROM job_heartbeats LIMIT 0')->closeCursor();
        report_setting('Database schema',null,'','Account and outbox tables are ready.');
    } catch (Throwable) {
        report_setting('Database schema','Check ATTACHLINK_DB_NAME and apply the required migrations.','invalid','');
    }
}

$path=application_storage();
$storageIssues=application_storage_issues();
$storageIssue=$storageIssues?reset($storageIssues):null;
$canWrite=false;
if ($storageIssue===null && !is_dir($path) && !@mkdir($path,0700,true) && !is_dir($path)) {
    $storageIssue='Could not create the private document storage directory.';
}
if ($storageIssue===null) {
    clearstatcache(true,$path);
    $storageIssues=application_storage_issues();
    $storageIssue=$storageIssues?reset($storageIssues):null;
}
if ($storageIssue===null) {
    $probe=$path.'/'.bin2hex(random_bytes(16)).'.tmp';
    $file=@fopen($probe,'xb');
    if ($file!==false) {
        fclose($file);
        $canWrite=@unlink($probe);
    }
    if (!$canWrite) $storageIssue='The document storage directory must permit safe file creation and removal.';
}
report_setting('ATTACHLINK_DOCUMENT_STORAGE',$storageIssue,'checked','Private directory is outside the document root and writable.');
if (config_env('ATTACHLINK_AVATAR_STORAGE')!=='') {
    $avatarIssues=avatar_storage_issues();
    $avatarIssue=$avatarIssues?reset($avatarIssues):null;
    report_setting('ATTACHLINK_AVATAR_STORAGE',$avatarIssue,'checked','Private directory is outside the document root and writable.');
}

$uploadBytes=php_limit_bytes((string)ini_get('upload_max_filesize'));
$postBytes=php_limit_bytes((string)ini_get('post_max_size'));
$maxUploads=filter_var((string)ini_get('max_file_uploads'),FILTER_VALIDATE_INT,['options'=>['min_range'=>9]]);
report_setting('PHP upload_max_filesize',$uploadBytes!==null && $uploadBytes>=5*1048576?null:'Set upload_max_filesize to at least 5M.',(string)ini_get('upload_max_filesize'),'At least 5 MiB.');
report_setting('PHP post_max_size',$postBytes!==null && $postBytes>45*1048576?null:'Set post_max_size above 45M.',(string)ini_get('post_max_size'),'Above 45 MiB.');
report_setting('PHP max_file_uploads',$maxUploads!==false?null:'Set max_file_uploads to at least 9.',(string)ini_get('max_file_uploads'),'At least nine files.');
report_setting('PHP file_uploads',filter_var((string)ini_get('file_uploads'),FILTER_VALIDATE_BOOLEAN)?null:'Enable file_uploads.','configured','File uploads are enabled.');
$uploadTemp=trim((string)ini_get('upload_tmp_dir'))?:sys_get_temp_dir();
report_setting('PHP upload_tmp_dir',writable_directory($uploadTemp)?null:'Set a writable absolute upload temporary directory.',$uploadTemp,'Directory is writable.');
$sessionSave=trim((string)ini_get('session.save_path'));
if ($sessionSave==='') $sessionSave=sys_get_temp_dir();
elseif (str_contains($sessionSave,';')) $sessionSave=substr($sessionSave,strrpos($sessionSave,';')+1);
report_setting('PHP session.save_path',writable_directory($sessionSave)?null:'Set an existing writable absolute session directory.',$sessionSave,'Directory is writable.');
$sessionLifetime=filter_var((string)ini_get('session.gc_maxlifetime'),FILTER_VALIDATE_INT,['options'=>['min_range'=>43200]]);
report_setting('PHP session.gc_maxlifetime',$sessionLifetime!==false?null:'Set session.gc_maxlifetime to at least 43200 seconds.',(string)ini_get('session.gc_maxlifetime'),'At least 12 hours.');

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
