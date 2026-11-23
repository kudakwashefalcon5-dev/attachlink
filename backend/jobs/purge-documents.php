<?php
declare(strict_types=1);
if (PHP_SAPI!=='cli') { http_response_code(404); exit; }
try {
    require_once __DIR__.'/../config.php';
    require_once __DIR__.'/../lib/DocumentPurge.php';
    if ($issue=app_environment_issue()) throw new ConfigException($issue);
    $pdo=connect_database();
    $select=$pdo->prepare('SELECT storage_kind,stored_name FROM document_purge_queue ORDER BY created_at LIMIT 200');
    $select->execute();
    $delete=$pdo->prepare('DELETE FROM document_purge_queue WHERE storage_kind=? AND stored_name=?');
    $failed=false;
    foreach ($select->fetchAll() as $file) {
        if (purge_stored_file($file['storage_kind'],$file['stored_name'])) $delete->execute(array_values($file));
        else $failed=true;
    }
    if ($failed) fwrite(STDERR,"Document removal remains pending. Check storage access.\n");
    exit($failed?1:0);
} catch (Throwable $error) {
    fwrite(STDERR,($error instanceof ConfigException?$error->getMessage():'Could not process the document purge queue.')."\n");
    exit(1);
}
