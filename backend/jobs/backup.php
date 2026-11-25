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

function backup_tar_header($output,string $name,int $size,int $mtime): void {
    $name=backup_normalize_relative_path($name);
    $parts=explode('/',$name);
    $split=null;
    for ($index=count($parts)-1;$index>=0;$index--) {
        $base=implode('/',array_slice($parts,$index));
        $prefix=implode('/',array_slice($parts,0,$index));
        if (strlen($base)<=100 && strlen($prefix)<=155) {
            $split=[$base,$prefix];
            break;
        }
    }
    if ($split===null) throw new RuntimeException('A stored path exceeds the archive format limit.');
    [$base,$prefix]=$split;
    $header=pack('a100a8a8a8a12a12a8a1a100a6a2a32a32a8a8a155a12',
        $base,'0000600','0000000','0000000',sprintf('%011o',$size),sprintf('%011o',$mtime),
        '        ','0','','ustar','00','','','','',$prefix,'');
    $checksum=array_sum(unpack('C*',$header));
    backup_write($output,substr_replace($header,sprintf('%06o',$checksum)."\0 ",148,8));
}

function backup_tar_file($output,string $path,string $name): array {
    if (is_link($path) || !is_file($path)) throw new RuntimeException('A stored file is missing or unsafe.');
    $source=@fopen($path,'rb');
    if (!$source) throw new RuntimeException('Could not read a stored file.');
    try {
        $metadata=fstat($source);
        $size=(int)$metadata['size'];
        if ($size<0 || $size>0x1ffffffff) throw new RuntimeException('Stored file exceeds the archive size limit.');
        backup_tar_header($output,$name,$size,(int)$metadata['mtime']);
        $hash=hash_init('sha256');
        $copied=0;
        while (!feof($source)) {
            $bytes=fread($source,1048576);
            if ($bytes===false) throw new RuntimeException('A stored file could not be archived.');
            if ($bytes==='') break;
            backup_write($output,$bytes);
            hash_update($hash,$bytes);
            $copied+=strlen($bytes);
        }
        $after=fstat($source);
        if ($copied!==$size || (int)$after['size']!==$size || (int)$after['mtime']!==(int)$metadata['mtime']) {
            throw new RuntimeException('A stored file changed while the backup was running.');
        }
        backup_write($output,str_repeat("\0",(512-$size%512)%512));
        return ['path'=>$name,'size'=>$size,'sha256'=>hash_final($hash)];
    } finally {
        fclose($source);
    }
}

function backup_tar_bytes($output,string $name,string $bytes): void {
    backup_tar_header($output,$name,strlen($bytes),time());
    backup_write($output,$bytes);
    backup_write($output,str_repeat("\0",(512-strlen($bytes)%512)%512));
}

function backup_storage_file(string $root,string $relative): string {
    $relative=backup_normalize_relative_path($relative);
    if (is_link($root) || !is_dir($root)) throw new RuntimeException('A referenced storage directory is missing or unsafe.');
    $rootPath=realpath($root);
    if ($rootPath===false) throw new RuntimeException('A referenced storage directory cannot be resolved.');
    $path=$root;
    foreach (explode('/',$relative) as $part) {
        $path.=DIRECTORY_SEPARATOR.$part;
        if (is_link($path)) throw new RuntimeException('A stored file path contains a symbolic link.');
    }
    $resolved=realpath($path);
    if ($resolved===false || !is_file($resolved) || !path_is_within_directory($resolved,$rootPath)) {
        throw new RuntimeException('A database-referenced stored file is missing or outside its storage directory.');
    }
    return $resolved;
}

function backup_storage_tree(string $root): array {
    if (!file_exists($root) && !is_link($root)) return [];
    if (is_link($root) || !is_dir($root)) throw new RuntimeException('A storage root is not a regular directory.');
    $rootPath=realpath($root);
    if ($rootPath===false) throw new RuntimeException('A storage root cannot be resolved.');
    $files=[];
    $iterator=new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($rootPath,FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );
    foreach ($iterator as $entry) {
        if ($entry->isLink()) throw new RuntimeException('A symbolic link was found in a storage tree.');
        if ($entry->isDir()) continue;
        if (!$entry->isFile()) throw new RuntimeException('A non-regular file was found in a storage tree.');
        $relative=substr($entry->getPathname(),strlen($rootPath)+1);
        $relative=backup_normalize_relative_path(str_replace(DIRECTORY_SEPARATOR,'/',$relative));
        $path=$entry->getRealPath();
        if ($path===false) throw new RuntimeException('A stored file cannot be resolved.');
        $files[$relative]=$path;
    }
    ksort($files,SORT_STRING);
    return $files;
}

function backup_database_file_references(PDO $pdo,string $sql): array {
    $files=[];
    foreach ($pdo->query($sql)->fetchAll(PDO::FETCH_COLUMN) as $name) {
        $relative=backup_normalize_relative_path((string)$name);
        $files[$relative]=true;
    }
    $names=array_keys($files);
    sort($names,SORT_STRING);
    return $names;
}

function backup_file_archive_stream($output,string $backupId,array $databaseInfo,PDO $pdo): void {
    $documentRoot=application_storage();
    $avatarRoot=avatar_storage();
    $documentFiles=backup_storage_tree($documentRoot);
    $avatarFiles=backup_storage_tree($avatarRoot);
    $queries=[
        'application_documents'=>'SELECT stored_name FROM application_documents',
        'vault'=>'SELECT stored_name FROM student_document_vault',
        'company_files'=>"SELECT stored_name FROM company_files WHERE purpose='verification'",
        'logos'=>"SELECT stored_name FROM company_files WHERE purpose='logo'",
    ];
    $kinds=[];
    $referenced=[];
    foreach ($queries as $kind=>$sql) {
        $kinds[$kind]=backup_database_file_references($pdo,$sql);
        foreach ($kinds[$kind] as $relative) {
            backup_storage_file($documentRoot,$relative);
            $referenced[$relative]=true;
        }
    }
    $kinds['avatars']=array_keys($avatarFiles);
    $kinds['unclassified']=array_values(array_diff(array_keys($documentFiles),array_keys($referenced)));
    sort($kinds['unclassified'],SORT_STRING);

    $records=[];
    $manifestKinds=[];
    foreach ($kinds as $kind=>$names) {
        $isAvatar=$kind==='avatars';
        $root=$isAvatar?$avatarRoot:$documentRoot;
        $available=$isAvatar?$avatarFiles:$documentFiles;
        $prefix=$isAvatar?'avatars':'documents';
        $kindFiles=[];
        foreach ($names as $relative) {
            $relative=backup_normalize_relative_path($relative);
            $path=$available[$relative]??backup_storage_file($root,$relative);
            $archivePath=$prefix.'/'.$relative;
            if (!isset($records[$archivePath])) {
                $records[$archivePath]=backup_tar_file($output,$path,$archivePath);
            }
            $kindFiles[]=$records[$archivePath];
        }
        $manifestKinds[$kind]=backup_manifest_kind($kindFiles);
    }
    $manifest=[
        'format_version'=>1,
        'backup_id'=>$backupId,
        'database'=>[
            'filename'=>'attachlink-db-'.$backupId.'.sql',
            'size'=>$databaseInfo['size'],
            'sha256'=>$databaseInfo['sha256'],
        ],
        'kinds'=>$manifestKinds,
    ];
    $json=json_encode($manifest,JSON_THROW_ON_ERROR|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT)."\n";
    backup_tar_bytes($output,'manifest.json',$json);
    backup_write($output,str_repeat("\0",1024));
}

function backup_database_stream($output): array {
    require_valid_settings(db_setting_issues());
    $dump=proc_open([config_env('ATTACHLINK_MYSQLDUMP','mysqldump'),'--single-transaction','--quick','--skip-lock-tables',
        '--host='.DB_HOST,'--port='.DB_PORT,'--user='.DB_USER,'--',DB_NAME],
        [0=>['pipe','r'],1=>['pipe','w'],2=>['file',PHP_OS_FAMILY==='Windows'?'NUL':'/dev/null','a']],
        $pipes,null,array_replace(getenv(),['MYSQL_PWD'=>DB_PASS]),['binary_pipes'=>true]);
    if (!is_resource($dump)) throw new RuntimeException('Could not launch the database dump utility.');
    fclose($pipes[0]);
    $hash=hash_init('sha256');
    $size=0;
    try {
        while (!feof($pipes[1])) {
            $bytes=fread($pipes[1],1048576);
            if ($bytes===false) throw new RuntimeException('Could not read the database dump.');
            if ($bytes==='') break;
            backup_write($output,$bytes);
            hash_update($hash,$bytes);
            $size+=strlen($bytes);
        }
    } finally {
        fclose($pipes[1]);
        $status=proc_close($dump);
    }
    if ($size===0 || $status!==0) throw new RuntimeException('Database backup failed.');
    return ['size'=>$size,'sha256'=>hash_final($hash)];
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

function backup_remove_tree(string $path): void {
    if (is_link($path) || is_file($path)) {
        if (!unlink($path)) throw new RuntimeException('Could not remove an expired backup file.');
        return;
    }
    if (!is_dir($path)) return;
    foreach (new DirectoryIterator($path) as $entry) {
        if ($entry->isDot()) continue;
        backup_remove_tree($entry->getPathname());
    }
    if (!rmdir($path)) throw new RuntimeException('Could not remove an expired backup pair.');
}

$lock=null;
$exitCode=0;
try {
    require_once __DIR__.'/../config.php';
    require_once __DIR__.'/../lib/JobHeartbeat.php';
    require_once __DIR__.'/../lib/BackupManifest.php';
    if ($issue=app_environment_issue()) throw new ConfigException($issue);
    require_valid_settings(backup_setting_issues());
    if (($argv[1]??'all')!=='all') throw new ConfigException('Usage: php backend/jobs/backup.php all');
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
    if (path_is_within_directory($directory,application_storage()) || path_is_within_directory($directory,avatar_storage())) {
        throw new ConfigException('ATTACHLINK_BACKUP_DIR must not be inside a document or avatar storage directory.');
    }
    $days=filter_var(config_env('ATTACHLINK_BACKUP_DAYS','30'),FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>3650]]);
    if ($days===false) throw new ConfigException('ATTACHLINK_BACKUP_DAYS must be 1 to 3650.');
    umask(0077);
    $lockPath=$directory.'/.attachlink-backup.lock';
    if (is_link($lockPath)) throw new ConfigException('The backup lock path must not be a symbolic link.');
    $lock=fopen($lockPath,'c');
    if (!$lock || !flock($lock,LOCK_EX|LOCK_NB)) throw new ConfigException('Another backup is running.');

    $pdo=connect_database();
    $backupId=gmdate('Ymd-His').'-'.bin2hex(random_bytes(4));
    $pairName='attachlink-backup-'.$backupId;
    $staging=$directory.'/.' . $pairName . '.tmp';
    $published=$directory.'/'.$pairName;
    if (file_exists($staging) || is_link($staging) || file_exists($published) || is_link($published)
        || !mkdir($staging,0700)) {
        throw new RuntimeException('Could not create a private staging directory for the backup pair.');
    }
    try {
        $databaseInfo=null;
        $databaseFile='attachlink-db-'.$backupId.'.sql';
        $filesFile='attachlink-files-'.$backupId.'.tar';
        backup_encrypt($staging.'/'.$databaseFile.'.age',$recipient,static function($output) use (&$databaseInfo): void {
            $databaseInfo=backup_database_stream($output);
        });
        if (!is_array($databaseInfo)) throw new RuntimeException('Database backup metadata is missing.');
        backup_encrypt($staging.'/'.$filesFile.'.age',$recipient,static function($output) use ($backupId,$databaseInfo,$pdo): void {
            backup_file_archive_stream($output,$backupId,$databaseInfo,$pdo);
        });
        if (file_exists($published) || !rename($staging,$published)) {
            throw new RuntimeException('Could not atomically publish the backup pair.');
        }
    } finally {
        if (is_dir($staging)) backup_remove_tree($staging);
    }

    $cutoff=time()-$days*86400;
    foreach (new DirectoryIterator($directory) as $file) {
        if ($file->isLink()) continue;
        if ($file->isDir() && preg_match('/\Aattachlink-backup-\d{8}-\d{6}-[a-f0-9]{8}\z/',$file->getFilename())
            && $file->getMTime()<$cutoff) {
            backup_remove_tree($file->getPathname());
        } elseif ($file->isFile()
            && preg_match('/\Aattachlink-(?:db-\d{8}-\d{6}-[a-f0-9]{8}\.sql|files-\d{8}-\d{6}-[a-f0-9]{8}\.tar)\.age\z/',$file->getFilename())
            && $file->getMTime()<$cutoff && !unlink($file->getPathname())) {
            throw new RuntimeException('Could not remove an expired legacy backup artifact.');
        }
    }
    record_job_heartbeat($pdo,'backup');
    echo "Encrypted database and file backup pair published: $pairName\n";
} catch (Throwable $error) {
    fwrite(STDERR,($error instanceof PDOException?'Backup failed. Check the database settings.':$error->getMessage())."\n");
    $exitCode=1;
} finally {
    if (is_resource($lock)) {
        flock($lock,LOCK_UN);
        fclose($lock);
    }
}
exit($exitCode);
