<?php
declare(strict_types=1);
ini_set('display_errors', '0');
set_exception_handler(static function (Throwable $error): void {
    if ($error instanceof ConfigException) {
        error_log('AttachLink configuration: '.$error->getMessage());
        fail('The service is temporarily unavailable. Please try again later.',503);
    }
    if ($error instanceof PDOException && in_array((string)$error->getCode(),['42S02','42S22','08003','08006'],true)) {
        error_log('AttachLink database: check ATTACHLINK_DB_NAME, database availability and applied migrations (SQLSTATE '.$error->getCode().').');
        fail('The service is temporarily unavailable. Please try again later.',503);
    }
    error_log('AttachLink request failed: '.$error::class.' in '.basename($error->getFile()).':'.$error->getLine());
    fail('The request could not be completed.',500);
});
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header('Permissions-Policy: camera=(), microphone=(), geolocation=(self)');
require_once __DIR__.'/config.php';
header('Content-Security-Policy: '.content_security_policy());
require_once __DIR__.'/lib/Accounts.php';
require_once __DIR__.'/lib/Migrations.php';
if ($issue=app_environment_issue()) throw new ConfigException($issue);
$usingHttps = request_uses_https();
if (APP_ENV === 'production' && PHP_SAPI !== 'cli') {
    if (!$usingHttps) fail('HTTPS is required.',403);
    require_valid_settings(db_setting_issues());
}
if (session_status() !== PHP_SESSION_ACTIVE) {
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('attachlink_sid');
    session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>APP_ENV==='production'||$usingHttps,'httponly'=>true,'samesite'=>'Lax']);
    if (!session_start()) throw new ConfigException('PHP session.save_path is unavailable or not writable.');
    if (isset($_SESSION['user_id'])) {
        $now = time();
        if ($now - ($_SESSION['authenticated_at'] ?? $now) > 43200 || $now - ($_SESSION['last_active_at'] ?? $now) > 1800) {
            $_SESSION = [];
            session_regenerate_id(true);
        } else {
            $_SESSION['authenticated_at'] ??= $now;
            $_SESSION['last_active_at'] = $now;
        }
    }
}
function out(array $body, int $code = 200): never { http_response_code($code); echo json_encode($body, JSON_UNESCAPED_SLASHES|JSON_INVALID_UTF8_SUBSTITUTE); exit; }
function fail(string $message, int $code = 400): never { out(['ok'=>false,'message'=>$message],$code); }
function db(): PDO {
    static $pdo;
    if ($pdo===null) {
        $connection=connect_database();
        $pending=array_keys(pending_migrations($connection));
        if ($pending) throw new ConfigException('Pending database migrations: '.implode(', ',$pending));
        $pdo=$connection;
    }
    return $pdo;
}
function body(): array {
    $raw=file_get_contents('php://input');
    if (strlen($raw)>1048576) fail('Request too large.',413);
    $a=json_decode($raw,true);
    if (is_array($a)) return $a;
    return $_POST;
}
function method(string ...$allowed): void { if (!in_array($_SERVER['REQUEST_METHOD']??'GET',$allowed,true)) { header('Allow: '.implode(', ',$allowed));fail('Method not allowed.',405); } }
function csrf(): string { if (empty($_SESSION['csrf_token'])) $_SESSION['csrf_token']=bin2hex(random_bytes(32));return $_SESSION['csrf_token']; }
function protect(array $input): void {
    $token = $input['csrf_token'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($token) || !hash_equals(csrf(),$token)) fail('Invalid CSRF token. Refresh and retry.',403);
}
function user(?string $role=null): array {
    $id=(int)($_SESSION['user_id']??0);
    if (!$id) fail('Authentication required.',401);
    $s=db()->prepare('SELECT id,role,first_name,last_name,email,phone,company_id,is_active,email_verified_at,password_changed_at FROM users WHERE id=?');$s->execute([$id]);$u=$s->fetch();
    if (!$u || !(int)$u['is_active'] || $u['password_changed_at'] !== ($_SESSION['password_changed_at'] ?? null)) {unset($_SESSION['user_id']);fail('Account not available.',401);}
    if (APP_ENV==='production' && $u['role']==='admin' && empty($_SESSION['admin_totp_verified'])) fail('Sign in with your authenticator.',401);
    if ($role!==null && $u['role']!==$role) fail('Access denied for this portal.',403);
    return $u;
}
function establish_login(array $user,bool $totpVerified=false): void {
    session_regenerate_id(true);
    $_SESSION=[
        'user_id'=>(int)$user['id'],
        'csrf_token'=>bin2hex(random_bytes(32)),
        'password_changed_at'=>$user['password_changed_at'],
        'authenticated_at'=>time(),
        'last_active_at'=>time(),
        'admin_totp_verified'=>$totpVerified,
    ];
}
function required(array $a,string $key,int $max=255): string {
    $value=$a[$key]??'';if (!is_string($value)) fail("Invalid $key.");
    $val=trim($value);if ($val===''||(function_exists('mb_strlen') ? mb_strlen($val) : strlen($val))>$max)fail("Invalid $key.");return $val;
}
function positive($n): int { $v=filter_var($n,FILTER_VALIDATE_INT);if ($v===false || $v<1)fail('Invalid ID.');return $v; }
function normalizePhone(string $s): string { $s=preg_replace('/[\s()\-]/','',$s);if (str_starts_with($s,'0'))$s='+263'.substr($s,1);elseif(preg_match('/^263/',$s))$s='+'.$s;elseif(preg_match('/^7[1378][0-9]{7}$/',$s))$s='+263'.$s;return $s; }
function getrow(string $sql,array $args=[]): ?array {$s=db()->prepare($sql);$s->execute($args);return $s->fetch()?:null;}
function rows(string $sql,array $args=[]): array {$s=db()->prepare($sql);$s->execute($args);return $s->fetchAll();}
function execute(string $sql,array $args=[]): int {$s=db()->prepare($sql);$s->execute($args);return $s->rowCount();}
function notify(int $userId,string $title,string $message,string $type='info'): void {execute('INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,?)',[$userId,$title,$message,$type]);}

function validate_application_upload(?array $file, bool $allowWord=false): array {
    if (($file['error'] ?? null) !== UPLOAD_ERR_OK || !is_string($file['tmp_name'] ?? null) || !is_uploaded_file($file['tmp_name'])) fail('A required document is missing or could not be uploaded.', 422);
    if ($file['size'] < 1 || $file['size'] > 5 * 1024 * 1024) fail('Documents must be between 1 byte and 5 MB.', 413);
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    $formats = ['application/pdf'=>'pdf','image/jpeg'=>'jpg','image/png'=>'png'];
    if ($allowWord) {
        $formats['application/msword']='doc';
        $formats['application/vnd.openxmlformats-officedocument.wordprocessingml.document']='docx';
    }
    $extension = $formats[$mime] ?? null;
    if (!$extension) fail($allowWord?'Only PDF, JPG, PNG, DOC and DOCX documents are allowed.':'Only PDF, JPG and PNG documents are allowed.',415);
    $name = basename(str_replace('\\', '/', $file['name']));
    return [$file['tmp_name'], mb_strcut($name, 0, 255, 'UTF-8'), $mime, $extension];
}

function store_application_upload(string $temporary, string $extension): string {
    $storage = application_storage();
    if (!is_dir($storage) && !@mkdir($storage, 0700, true) && !is_dir($storage)) throw new RuntimeException('Could not create upload directory.');
    $name = bin2hex(random_bytes(24)).'.'.$extension;
    if (!move_uploaded_file($temporary, $storage.'/'.$name)) throw new RuntimeException('Could not store document.');
    return $name;
}
