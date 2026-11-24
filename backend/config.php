<?php
declare(strict_types=1);
require_once __DIR__.'/lib/Env.php';
load_local_env(__DIR__.'/.env');

function config_env(string $key,string $default=''): string {
    $value=getenv($key);
    return $value===false?$default:$value;
}

function map_tile_settings(): array {
    $url=trim(config_env('ATTACHLINK_MAP_TILE_URL'));
    if ($url==='') return ['url'=>'','origin'=>'','attribution'=>''];
    $attribution=trim(config_env('ATTACHLINK_MAP_ATTRIBUTION'));
    if (!preg_match('~\A(https://[a-z0-9.-]+(?::[0-9]+)?)/[^\s<>"\x27]*\z~i',$url,$matches)
        || !str_contains($url,'{z}') || !str_contains($url,'{x}') || !str_contains($url,'{y}') || $attribution==='') {
        throw new ConfigException('Provide an HTTPS map tile URL with {z}, {x}, {y} and tile attribution.');
    }
    return ['url'=>$url,'origin'=>$matches[1],'attribution'=>$attribution];
}

function content_security_policy(): string {
    $origin=map_tile_settings()['origin'];
    return "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:"
        .($origin===''?'':' '.$origin)
        ."; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
}

function loopback_host(): bool {
    $host=$_SERVER['HTTP_HOST']??'';
    $peer=$_SERVER['REMOTE_ADDR']??'';
    return in_array($peer,['127.0.0.1','::1','::ffff:127.0.0.1'],true)
        && (strcasecmp($host,'::1')===0 || preg_match('/\A(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?\z/i',$host)===1);
}

function detected_environment(): string {
    $configured=getenv('ATTACHLINK_ENV');
    if ($configured==='production') return 'production';
    if ($configured==='development') {
        return PHP_SAPI==='cli' || loopback_host() ? 'development' : 'unconfigured';
    }
    if ($configured!==false && $configured!=='') return 'invalid';
    foreach (array_keys($_SERVER) as $key) {
        if ($key==='HTTP_FORWARDED' || str_starts_with($key,'HTTP_X_FORWARDED_')) return 'unconfigured';
    }
    if (request_uses_https() || ((PHP_SAPI!=='cli' || isset($_SERVER['HTTP_HOST'])) && !loopback_host())) return 'unconfigured';
    $base=config_env('ATTACHLINK_BASE_URL');
    $scheme=parse_url($base,PHP_URL_SCHEME);
    $host=strtolower((string)parse_url($base,PHP_URL_HOST));
    $deployment=($base!=='' && ($scheme!=='http' || !in_array($host,['localhost','127.0.0.1','[::1]'],true)))
        || config_env('ATTACHLINK_MAIL_TRANSPORT')==='smtp' || config_env('ATTACHLINK_SMTP_HOST')!==''
        || config_env('ATTACHLINK_DB_PASS')!=='';
    return $deployment?'unconfigured':'development';
}

function request_uses_https(): bool {
    return !empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS'])!=='off';
}

define('APP_ENV', detected_environment());
if (APP_ENV==='production' && PHP_SAPI!=='cli') header('Strict-Transport-Security: max-age=31536000');
define('DB_HOST', config_env('ATTACHLINK_DB_HOST','127.0.0.1'));
define('DB_PORT', config_env('ATTACHLINK_DB_PORT',ini_get('mysqli.default_port') ?: '3306'));
define('DB_NAME', config_env('ATTACHLINK_DB_NAME','attachlink_db'));
define('DB_USER', config_env('ATTACHLINK_DB_USER',APP_ENV==='production'?'':'root'));
define('DB_PASS', config_env('ATTACHLINK_DB_PASS'));
const APP_DEBUG = false;

function configured_base_url(): string {
    $url=config_env('ATTACHLINK_BASE_URL');
    if ($url==='') {
        if (APP_ENV==='development' && (PHP_SAPI==='cli' || loopback_host())) return 'http://localhost/attachlink';
        throw new ConfigException('ATTACHLINK_BASE_URL is required for emailed links.');
    }
    $parts=parse_url($url);
    if (!filter_var($url,FILTER_VALIDATE_URL) || !in_array($parts['scheme']??null,['http','https'],true)
        || isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment'])
        || (APP_ENV==='production' && $parts['scheme']!=='https')) {
        throw new ConfigException('ATTACHLINK_BASE_URL must be an absolute URL without credentials, query, or fragment. Production requires HTTPS.');
    }
    return rtrim($url,'/');
}

function optional_base_url(): ?string {
    try { return configured_base_url(); }
    catch (ConfigException $error) {
        error_log('AttachLink configuration: '.$error->getMessage());
        return null;
    }
}

function env_mail_hostname(): string {
    $host=config_env('ATTACHLINK_SMTP_EHLO') ?: parse_url(config_env('ATTACHLINK_BASE_URL'),PHP_URL_HOST);
    return filter_var($host,FILTER_VALIDATE_DOMAIN,FILTER_FLAG_HOSTNAME)?$host:'localhost';
}

function app_environment_issue(): ?string {
    return match(APP_ENV) {
        'development','production'=>null,
        'unconfigured'=>'ATTACHLINK_ENV must be explicitly configured for deployment.',
        default=>'ATTACHLINK_ENV must be development or production.',
    };
}

function db_setting_issues(): array {
    $issues=[];
    if (DB_HOST==='' || preg_match('/[;\x00-\x20]/',DB_HOST)) $issues['ATTACHLINK_DB_HOST']='Provide a database hostname or IP.';
    if (!filter_var(DB_PORT,FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>65535]])) $issues['ATTACHLINK_DB_PORT']='Provide a port from 1 to 65535.';
    if (DB_NAME==='' || preg_match('/[;\x00-\x20]/',DB_NAME)) $issues['ATTACHLINK_DB_NAME']='Provide a database name.';
    if (DB_USER==='' || (APP_ENV==='production' && strcasecmp(DB_USER,'root')===0)) $issues['ATTACHLINK_DB_USER']='Provide a database username. Production requires a non-root user.';
    if (APP_ENV==='production' && DB_PASS==='') $issues['ATTACHLINK_DB_PASS']='Production requires a non-empty database password.';
    return $issues;
}

function require_valid_settings(array $issues): void {
    if ($issues) {
        $key=array_key_first($issues);
        throw new ConfigException("$key: ".$issues[$key]);
    }
}

function connect_database(): PDO {
    require_valid_settings(db_setting_issues());
    try {
        return new PDO('mysql:host='.DB_HOST.';port='.DB_PORT.';dbname='.DB_NAME.';charset=utf8mb4',DB_USER,DB_PASS,[
            PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false
        ]);
    } catch (PDOException $error) {
        throw new ConfigException('Database connection failed. Check ATTACHLINK_DB_HOST, ATTACHLINK_DB_PORT, ATTACHLINK_DB_NAME, ATTACHLINK_DB_USER and ATTACHLINK_DB_PASS (SQLSTATE '.$error->getCode().').');
    }
}

function application_storage(): string {
    return config_env('ATTACHLINK_DOCUMENT_STORAGE') ?: __DIR__.'/storage/documents';
}

function mail_transport_name(): string {
    return config_env('ATTACHLINK_MAIL_TRANSPORT',APP_ENV==='development'?'log':'');
}

function mail_log_path(): string {
    return config_env('ATTACHLINK_MAIL_LOG') ?: sys_get_temp_dir().DIRECTORY_SEPARATOR.'attachlink-mail'.DIRECTORY_SEPARATOR.'mail.jsonl';
}

function path_is_within_directory(string $path,string $directory): bool {
    $path=rtrim(str_replace('\\','/',$path),'/');
    $directory=rtrim(str_replace('\\','/',$directory),'/');
    if (PHP_OS_FAMILY==='Windows') {
        $path=strtolower($path);
        $directory=strtolower($directory);
    }
    return $path===$directory || str_starts_with($path,$directory.'/');
}

function prepare_private_mail_log(string $path): void {
    if ($path==='' || is_link($path)) throw new ConfigException('ATTACHLINK_MAIL_LOG must not be a symbolic link.');
    $directory=dirname($path);
    if (!is_dir($directory)) {
        $previous=umask(0077);
        try {
            $created=@mkdir($directory,0700,true);
        } finally {
            umask($previous);
        }
        if (!$created && !is_dir($directory)) throw new ConfigException('Could not create the private mail log directory.');
        clearstatcache(true,$directory);
    }
    if (is_link($directory) || !is_dir($directory) || !is_writable($directory)) {
        throw new ConfigException('ATTACHLINK_MAIL_LOG must be inside a writable private directory.');
    }
    $resolvedDirectory=realpath($directory);
    $roots=[realpath(dirname(__DIR__))];
    if (!empty($_SERVER['DOCUMENT_ROOT'])) $roots[]=realpath($_SERVER['DOCUMENT_ROOT']);
    foreach ($roots as $root) {
        if ($resolvedDirectory!==false && $root!==false && path_is_within_directory($resolvedDirectory,$root)) {
            throw new ConfigException('ATTACHLINK_MAIL_LOG must be outside the application and document roots.');
        }
    }
    if (PHP_OS_FAMILY!=='Windows') {
        $mode=@fileperms($directory);
        if ($mode===false || ($mode&0077)!==0) throw new ConfigException('The mail log directory must have 0700 permissions.');
    }
    if (file_exists($path)) {
        if (!is_file($path) || !is_writable($path) || (!@chmod($path,0600) && PHP_OS_FAMILY!=='Windows')) {
            throw new ConfigException('ATTACHLINK_MAIL_LOG must be a writable regular file.');
        }
        if (PHP_OS_FAMILY!=='Windows') {
            clearstatcache(true,$path);
            $mode=@fileperms($path);
            if ($mode===false || ($mode&0077)!==0) throw new ConfigException('The mail log file must have 0600 permissions.');
        }
    }
}

function smtp_settings(): array {
    $mode=config_env('ATTACHLINK_SMTP_TLS') ?: 'starttls';
    return [
        'ATTACHLINK_SMTP_HOST'=>config_env('ATTACHLINK_SMTP_HOST'),
        'ATTACHLINK_SMTP_EHLO'=>config_env('ATTACHLINK_SMTP_EHLO'),
        'ATTACHLINK_SMTP_TLS'=>$mode,
        'ATTACHLINK_SMTP_PORT'=>config_env('ATTACHLINK_SMTP_PORT') ?: ($mode==='implicit'?'465':'587'),
        'ATTACHLINK_SMTP_AUTH'=>config_env('ATTACHLINK_SMTP_AUTH') ?: 'LOGIN',
        'ATTACHLINK_SMTP_FROM'=>config_env('ATTACHLINK_SMTP_FROM'),
        'ATTACHLINK_SMTP_USERNAME'=>config_env('ATTACHLINK_SMTP_USERNAME'),
        'ATTACHLINK_SMTP_PASSWORD'=>config_env('ATTACHLINK_SMTP_PASSWORD'),
    ];
}

function mail_setting_issues(): array {
    $transport=mail_transport_name();
    if (!in_array($transport,['log','smtp'],true)) {
        return ['ATTACHLINK_MAIL_TRANSPORT'=>'Set this to log or smtp.'];
    }
    if ($transport==='log') {
        if (APP_ENV!=='development') return ['ATTACHLINK_MAIL_TRANSPORT'=>'The log transport is allowed only in development.'];
        try {
            prepare_private_mail_log(mail_log_path());
        } catch (ConfigException $error) {
            return ['ATTACHLINK_MAIL_LOG'=>$error->getMessage()];
        }
        return [];
    }
    $settings=smtp_settings();
    $tests=[
        'ATTACHLINK_SMTP_HOST'=>[filter_var($settings['ATTACHLINK_SMTP_HOST'],FILTER_VALIDATE_DOMAIN,FILTER_FLAG_HOSTNAME),'Provide a valid SMTP hostname.'],
        'ATTACHLINK_SMTP_EHLO'=>[filter_var($settings['ATTACHLINK_SMTP_EHLO'],FILTER_VALIDATE_DOMAIN,FILTER_FLAG_HOSTNAME) && str_contains($settings['ATTACHLINK_SMTP_EHLO'],'.') && !filter_var($settings['ATTACHLINK_SMTP_EHLO'],FILTER_VALIDATE_IP),'Provide a fully qualified EHLO hostname.'],
        'ATTACHLINK_SMTP_TLS'=>[in_array($settings['ATTACHLINK_SMTP_TLS'],['starttls','implicit'],true),'Choose starttls or implicit.'],
        'ATTACHLINK_SMTP_PORT'=>[filter_var($settings['ATTACHLINK_SMTP_PORT'],FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>65535]]),'Provide a port from 1 to 65535.'],
        'ATTACHLINK_SMTP_AUTH'=>[in_array($settings['ATTACHLINK_SMTP_AUTH'],['LOGIN','PLAIN'],true),'Choose LOGIN or PLAIN.'],
        'ATTACHLINK_SMTP_FROM'=>[filter_var($settings['ATTACHLINK_SMTP_FROM'],FILTER_VALIDATE_EMAIL),'Provide a valid sender address.'],
        'ATTACHLINK_SMTP_USERNAME'=>[$settings['ATTACHLINK_SMTP_PASSWORD']==='' || $settings['ATTACHLINK_SMTP_USERNAME']!=='','Provide a username when a password is set.'],
        'ATTACHLINK_SMTP_PASSWORD'=>[$settings['ATTACHLINK_SMTP_USERNAME']==='' || $settings['ATTACHLINK_SMTP_PASSWORD']!=='','Provide a password when a username is set.'],
        'SMTP runtime'=>[extension_loaded('openssl') && is_readable(__DIR__.'/../vendor/autoload.php'),'SMTP requires OpenSSL and Composer dependencies.'],
    ];
    $issues=[];
    foreach ($tests as $key=>[$valid,$explanation]) if (!$valid) $issues[$key]=$explanation;
    return $issues;
}

function require_link_configuration(): void {
    configured_base_url();
    require_valid_settings(mail_setting_issues());
}

const PASSWORD_BCRYPT_COST = 11;

function attachlink_password_hash(string $password): string {
    return password_hash($password,PASSWORD_BCRYPT,['cost'=>PASSWORD_BCRYPT_COST]);
}
