<?php
declare(strict_types=1);
if (PHP_SAPI!=='cli') { http_response_code(404); exit; }

function restore_file_map(string $root,string $directory): array {
    $path=$root.DIRECTORY_SEPARATOR.$directory;
    if (!file_exists($path) && !is_link($path)) return [];
    if (is_link($path) || !is_dir($path)) throw new RuntimeException('An extracted storage directory is missing or unsafe.');
    $resolved=realpath($path);
    if ($resolved===false) throw new RuntimeException('An extracted storage directory cannot be resolved.');
    $files=[];
    $iterator=new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($resolved,FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );
    foreach ($iterator as $entry) {
        if ($entry->isLink()) throw new RuntimeException('A symbolic link was found in the extracted backup.');
        if ($entry->isDir()) continue;
        if (!$entry->isFile()) throw new RuntimeException('A non-regular file was found in the extracted backup.');
        $relative=substr($entry->getPathname(),strlen($resolved)+1);
        $relative=backup_normalize_relative_path(str_replace(DIRECTORY_SEPARATOR,'/',$relative));
        $path=$entry->getRealPath();
        if ($path===false) throw new RuntimeException('An extracted file cannot be resolved.');
        $files[$directory.'/'.$relative]=$path;
    }
    ksort($files,SORT_STRING);
    return $files;
}

function restore_database_file_references(PDO $pdo,string $sql): array {
    $files=[];
    foreach ($pdo->query($sql)->fetchAll(PDO::FETCH_COLUMN) as $name) {
        $path='documents/'.backup_normalize_relative_path((string)$name);
        $files[$path]=true;
    }
    $paths=array_keys($files);
    sort($paths,SORT_STRING);
    return $paths;
}

function restore_verify_kind(string $kind,array $manifest,array $expectedPaths,array $allFiles): void {
    $entry=$manifest['kinds'][$kind]??null;
    $fileKeys=is_array($entry['files']??null)?array_keys($entry['files']):[];
    $isList=$fileKeys===[] || $fileKeys===range(0,count($fileKeys)-1);
    if (!is_array($entry) || !is_int($entry['file_count']??null) || !is_string($entry['sha256']??null)
        || !is_array($entry['files']??null) || !$isList) {
        throw new RuntimeException('Backup manifest is missing a valid '.$kind.' entry.');
    }
    $summary=backup_manifest_kind($entry['files']);
    if ($summary['file_count']!==$entry['file_count'] || !hash_equals($entry['sha256'],$summary['sha256'])) {
        throw new RuntimeException('Backup manifest count or checksum is invalid for '.$kind.'.');
    }
    $manifestPaths=array_column($summary['files'],'path');
    sort($expectedPaths,SORT_STRING);
    if ($manifestPaths!==$expectedPaths) throw new RuntimeException('Restored database and manifest disagree for '.$kind.'.');
    foreach ($summary['files'] as $file) {
        $path=$allFiles[$file['path']]??null;
        $actualHash=is_string($path)?hash_file('sha256',$path):false;
        if (!is_string($path) || is_link($path) || !is_file($path)
            || filesize($path)!==$file['size'] || !is_string($actualHash) || !hash_equals($file['sha256'],$actualHash)) {
            throw new RuntimeException('Restored file count or checksum failed for '.$kind.'.');
        }
    }
}

$exitCode=0;
try {
    require_once __DIR__.'/../config.php';
    require_once __DIR__.'/../lib/BackupManifest.php';
    if ($issue=app_environment_issue()) throw new ConfigException($issue);
    if ($argc!==3) throw new ConfigException('Usage: php backend/jobs/verify-restore.php <extracted-files-directory> <decrypted-database-dump.sql>');
    $root=realpath($argv[1]);
    $dumpPath=realpath($argv[2]);
    if ($root===false || !is_dir($root) || is_link($argv[1]) || $dumpPath===false || !is_file($dumpPath) || is_link($argv[2])) {
        throw new ConfigException('Provide the extracted file archive directory and its matching decrypted database dump.');
    }
    $manifestPath=$root.DIRECTORY_SEPARATOR.'manifest.json';
    if (is_link($manifestPath) || !is_file($manifestPath)) throw new RuntimeException('The extracted archive has no safe manifest.');
    $manifest=json_decode((string)file_get_contents($manifestPath),true,512,JSON_THROW_ON_ERROR);
    $backupId=$manifest['backup_id']??null;
    $database=$manifest['database']??null;
    $expectedKinds=['application_documents','vault','company_files','logos','avatars','unclassified'];
    if (($manifest['format_version']??null)!==1 || !is_string($backupId)
        || !preg_match('/\A\d{8}-\d{6}-[a-f0-9]{8}\z/',$backupId)
        || !is_array($database) || !is_array($manifest['kinds']??null)
        || array_diff($expectedKinds,array_keys($manifest['kinds'])) || array_diff(array_keys($manifest['kinds']),$expectedKinds)) {
        throw new RuntimeException('The extracted backup manifest is invalid.');
    }
    $dumpHash=hash_file('sha256',$dumpPath);
    if (($database['filename']??null)!=='attachlink-db-'.$backupId.'.sql'
        || basename($dumpPath)!==$database['filename'] || !is_int($database['size']??null)
        || !is_string($database['sha256']??null) || !preg_match('/\A[a-f0-9]{64}\z/',$database['sha256'])
        || filesize($dumpPath)!==$database['size'] || !is_string($dumpHash) || !hash_equals($database['sha256'],$dumpHash)) {
        throw new RuntimeException('The decrypted database dump does not match the backup manifest.');
    }

    $pdo=connect_database();
    $databaseKinds=[
        'application_documents'=>restore_database_file_references($pdo,'SELECT stored_name FROM application_documents'),
        'vault'=>restore_database_file_references($pdo,'SELECT stored_name FROM student_document_vault'),
        'company_files'=>restore_database_file_references($pdo,"SELECT stored_name FROM company_files WHERE purpose='verification'"),
        'logos'=>restore_database_file_references($pdo,"SELECT stored_name FROM company_files WHERE purpose='logo'"),
    ];
    $documentFiles=restore_file_map($root,'documents');
    $avatarFiles=restore_file_map($root,'avatars');
    $allFiles=$documentFiles+$avatarFiles;
    $referenced=[];
    foreach ($databaseKinds as $kind=>$paths) {
        foreach ($paths as $path) $referenced[$path]=true;
        restore_verify_kind($kind,$manifest,$paths,$allFiles);
    }
    restore_verify_kind('avatars',$manifest,array_keys($avatarFiles),$allFiles);
    $unclassified=array_values(array_diff(array_keys($documentFiles),array_keys($referenced)));
    sort($unclassified,SORT_STRING);
    restore_verify_kind('unclassified',$manifest,$unclassified,$allFiles);

    $manifestPaths=[];
    foreach ($manifest['kinds'] as $entry) {
        foreach ($entry['files'] as $file) $manifestPaths[$file['path']]=true;
    }
    $actualPaths=array_fill_keys(array_keys($allFiles),true);
    if (array_diff_key($actualPaths,$manifestPaths) || array_diff_key($manifestPaths,$actualPaths)) {
        throw new RuntimeException('Extracted file inventory does not match the backup manifest.');
    }
    foreach ($expectedKinds as $kind) {
        echo 'Verified '.$kind.': '.$manifest['kinds'][$kind]['file_count']." file(s).\n";
    }
    echo "Verified database dump checksum and restored database references.\n";
} catch (Throwable $error) {
    $message=$error instanceof ConfigException?$error->getMessage()
        :($error instanceof PDOException?'Restore verification could not query the restored database.':$error->getMessage());
    fwrite(STDERR,$message."\n");
    $exitCode=1;
}
exit($exitCode);
