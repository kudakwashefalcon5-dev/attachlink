<?php
declare(strict_types=1);
if (PHP_SAPI!=='cli') { http_response_code(404); exit; }

function backup_write($stream,string $bytes): void {
    while ($bytes!=='') {
        $written=@fwrite($stream,$bytes);
        if (!$written) throw new RuntimeException('Could not write to the encryption process.');
        $bytes=substr($bytes,$written);
    }
}

function backup_tar_file($output,string $path,string $name): void {
    $source=fopen($path,'rb');
    if (!$source) throw new RuntimeException('Could not read a stored file.');
    try {
        $metadata=fstat($source);
        $size=$metadata['size'];
        if ($size<0 || $size>0x1ffffffff) throw new RuntimeException('Stored file exceeds the archive size limit.');
        $header=pack('a100a8a8a8a12a12a8a1a100a6a2a32a32a8a8a155a12',
            $name,'0000600','0000000','0000000',sprintf('%011o',$size),sprintf('%011o',$metadata['mtime']),
            '        ','0','','ustar','00','','','','','','');
        $checksum=array_sum(unpack('C*',$header));
        backup_write($output,substr_replace($header,sprintf('%06o',$checksum)."\0 ",148,8));
        if ($size && @stream_copy_to_stream($source,$output,$size)!==$size) {
            throw new RuntimeException('A stored file could not be archived.');
        }
        $padding=(512-$size%512)%512;
        backup_write($output,str_repeat("\0",$padding));
    } finally {
        fclose($source);
    }
}

function backup_tar_storage($output,string $directory,string $prefix): void {
    if (!is_dir($directory)) return;
    foreach (new FilesystemIterator($directory,FilesystemIterator::SKIP_DOTS) as $file) {
        if ($file->isLink() || !$file->isFile() || !preg_match('/\A[0-9a-f]+\.(pdf|jpe?g|png)\z/',$file->getFilename())) continue;
        backup_tar_file($output,$file->getPathname(),$prefix.'/'.$file->getFilename());
    }
}

function backup_database_stream($output): void {
    require_valid_settings(db_setting_issues());
    $dump=proc_open([config_env('ATTACHLINK_MYSQLDUMP','mysqldump'),'--single-transaction','--quick','--skip-lock-tables',
        '--host='.DB_HOST,'--port='.DB_PORT,'--user='.DB_USER,'--',DB_NAME],
        [0=>['pipe','r'],1=>['pipe','w'],2=>['file',PHP_OS_FAMILY==='Windows'?'NUL':'/dev/null','a']],
        $pipes,null,array_replace(getenv(),['MYSQL_PWD'=>DB_PASS]),['binary_pipes'=>true]);
    if (!is_resource($dump)) throw new RuntimeException('Could not launch the database dump utility.');
    fclose($pipes[0]);
    try {
        $copied=@stream_copy_to_stream($pipes[1],$output);
    } finally {
        fclose($pipes[1]);
        $status=proc_close($dump);
    }
    if (!$copied || $status!==0) throw new RuntimeException('Database backup failed.');
}

function backup_encrypt(string $target,string $recipient,callable $write): void {
    $pending=$target.'.tmp';
    $age=proc_open([config_env('ATTACHLINK_AGE','age'),'--encrypt','--recipient',$recipient],
        [0=>['pipe','r'],1=>['file',$pending,'xb'],2=>['file',PHP_OS_FAMILY==='Windows'?'NUL':'/dev/null','a']],
        $pipes,null,null,['binary_pipes'=>true]);
    if (!is_resource($age)) {
        if (is_file($pending)) @unlink($pending);
        throw new RuntimeException('Could not launch ATTACHLINK_AGE.');
    }
    try {
        try {
            $write($pipes[0]);
        } finally {
            fclose($pipes[0]);
            $status=proc_close($age);
        }
        if ($status!==0 || !is_file($pending) || !filesize($pending) || !rename($pending,$target)) {
            throw new RuntimeException('Backup encryption failed. Check ATTACHLINK_AGE and ATTACHLINK_BACKUP_RECIPIENT.');
        }
    } finally {
        if (is_file($pending)) @unlink($pending);
    }
}

try {
    require_once __DIR__.'/../config.php';
    if ($issue=app_environment_issue()) throw new ConfigException($issue);
    $mode=$argv[1]??'all';
    if (!in_array($mode,['all','database','documents'],true)) throw new ConfigException('Usage: php backend/jobs/backup.php [all|database|documents]');
    $recipient=config_env('ATTACHLINK_BACKUP_RECIPIENT');
    if (!preg_match('/\Aage1[0-9a-z]{58}\z/',$recipient)) {
        throw new ConfigException('Set ATTACHLINK_BACKUP_RECIPIENT to an age public recipient.');
    }
    $configuredDirectory=config_env('ATTACHLINK_BACKUP_DIR');
    $directory=$configuredDirectory===''?false:realpath($configuredDirectory);
    $root=str_replace('\\','/',realpath(__DIR__.'/../..')).'/';
    $backupPath=$directory===false?'':str_replace('\\','/',$directory).'/';
    if (!$directory || !is_dir($directory) || !is_writable($directory) || stripos($backupPath,$root)===0) {
        throw new ConfigException('Set ATTACHLINK_BACKUP_DIR to an existing, private directory outside the application.');
    }
    $days=filter_var(config_env('ATTACHLINK_BACKUP_DAYS','30'),FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>3650]]);
    if ($days===false) throw new ConfigException('ATTACHLINK_BACKUP_DAYS must be 1 to 3650.');
    umask(0077);
    $lock=fopen($directory.'/.attachlink-backup.lock','c');
    if (!$lock || !flock($lock,LOCK_EX|LOCK_NB)) throw new ConfigException('Another backup is running.');
    $id=gmdate('Ymd-His').'-'.bin2hex(random_bytes(4));
    if ($mode!=='documents') {
        backup_encrypt($directory.'/attachlink-db-'.$id.'.sql.age',$recipient,'backup_database_stream');
        echo "Encrypted database snapshot saved.\n";
    }
    if ($mode!=='database') {
        backup_encrypt($directory.'/attachlink-files-'.$id.'.tar.age',$recipient,static function ($output): void {
            backup_tar_storage($output,application_storage(),'documents');
            backup_tar_storage($output,__DIR__.'/../storage/avatars','avatars');
            backup_write($output,str_repeat("\0",1024));
        });
        echo "Encrypted document snapshot saved.\n";
    }
    foreach (new DirectoryIterator($directory) as $file) {
        if (!$file->isLink() && $file->isFile() && preg_match('/\Aattachlink-(db-\d{8}-\d{6}-[a-f0-9]{8}\.sql|files-\d{8}-\d{6}-[a-f0-9]{8}\.tar)\.age\z/',$file->getFilename())
            && $file->getMTime()<time()-$days*86400 && !unlink($file->getPathname())) {
            throw new RuntimeException('Could not remove an expired encrypted backup.');
        }
    }
} catch (Throwable $error) {
    fwrite(STDERR,($error instanceof PDOException?'Backup failed. Check the database settings.':$error->getMessage())."\n");
    exit(1);
}
