<?php
declare(strict_types=1);
if (PHP_SAPI!=='cli') { http_response_code(404); exit; }
$lockAcquired=false;
$lockHeld=false;
$exitCode=0;
try {
    require_once __DIR__.'/../config.php';
    require_once __DIR__.'/../lib/DocumentPurge.php';
    require_once __DIR__.'/../lib/JobHeartbeat.php';
    if ($issue=app_environment_issue()) throw new ConfigException($issue);
    $pdo=connect_database();
    $lockName='attachlink-purge:'.substr(hash('sha256',DB_NAME),0,40);
    $lock=$pdo->prepare('SELECT GET_LOCK(?,0)');
    $lock->execute([$lockName]);
    $lockAcquired=(int)$lock->fetchColumn()===1;
    $lock->closeCursor();
    if (!$lockAcquired) {
        $lockHeld=true;
        throw new RuntimeException('Another document purge job is running.');
    }

    $select=$pdo->prepare('SELECT storage_kind,stored_name FROM document_purge_queue ORDER BY created_at LIMIT 200');
    $select->execute();
    $delete=$pdo->prepare('DELETE FROM document_purge_queue WHERE storage_kind=? AND stored_name=?');
    $failed=false;
    foreach ($select->fetchAll() as $file) {
        if (purge_stored_file($file['storage_kind'],$file['stored_name'])) $delete->execute(array_values($file));
        else $failed=true;
    }
    if ($failed) throw new RuntimeException('Document removal remains pending. Check storage access.');
    record_job_heartbeat($pdo,'purge-documents');
} catch (Throwable $error) {
    $message=$error instanceof ConfigException || $lockHeld
        ?$error->getMessage()
        :'Could not process the document purge queue.';
    fwrite(STDERR,$message."\n");
    $exitCode=1;
} finally {
    if ($lockAcquired) {
        try {
            $release=$pdo->prepare('SELECT RELEASE_LOCK(?)');
            $release->execute([$lockName]);
            $released=(int)$release->fetchColumn()===1;
            $release->closeCursor();
            if (!$released) throw new RuntimeException('Could not release the document purge lock.');
        } catch (Throwable $error) {
            fwrite(STDERR,"Could not release the document purge lock.\n");
            $exitCode=1;
        }
    }
}
exit($exitCode);
