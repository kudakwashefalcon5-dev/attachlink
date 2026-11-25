<?php
declare(strict_types=1);
if (PHP_SAPI!=='cli') { http_response_code(404); exit; }

$lockAcquired=false;
$lockHeld=false;
$exitCode=0;
$counts=[];
try {
    require_once __DIR__.'/../config.php';
    require_once __DIR__.'/../lib/JobHeartbeat.php';
    if ($issue=app_environment_issue()) throw new ConfigException($issue);
    $pdo=connect_database();
    $lockName='attachlink-retention:'.substr(hash('sha256',DB_NAME),0,40);
    $lock=$pdo->prepare('SELECT GET_LOCK(?,0)');
    $lock->execute([$lockName]);
    $lockAcquired=(int)$lock->fetchColumn()===1;
    $lock->closeCursor();
    if (!$lockAcquired) {
        $lockHeld=true;
        throw new RuntimeException('Another data retention purge is running.');
    }

    $operations=[
        'password_resets_deleted'=>"DELETE FROM password_resets WHERE expires_at<NOW()-INTERVAL 30 DAY",
        'reset_ips_cleared'=>"UPDATE password_resets SET requested_ip=NULL WHERE requested_ip IS NOT NULL AND expires_at<NOW()-INTERVAL 7 DAY",
        'email_verifications_deleted'=>"DELETE FROM email_verifications WHERE expires_at<NOW()-INTERVAL 30 DAY",
        'login_attempts_deleted'=>"DELETE FROM login_attempts WHERE window_id<FLOOR(UNIX_TIMESTAMP()/window_seconds)",
        'email_bodies_cleared'=>"UPDATE email_outbox SET body='',html_body=NULL WHERE (expires_at<NOW()-INTERVAL 30 DAY OR COALESCE(sent_at,failed_at)<NOW()-INTERVAL 30 DAY) AND (body<>'' OR html_body IS NOT NULL)",
        'document_access_audit_deleted'=>"DELETE FROM admin_audit_log WHERE action='document.download' AND created_at<NOW()-INTERVAL 365 DAY",
    ];
    foreach ($operations as $name=>$sql) {
        $counts[$name]=$pdo->exec($sql);
        if ($counts[$name]===false) throw new RuntimeException('A data retention operation failed.');
    }
    record_job_heartbeat($pdo,'purge-retention');
} catch (Throwable $error) {
    $message=$error instanceof ConfigException || $lockHeld
        ?$error->getMessage()
        :'Could not complete the data retention purge.';
    fwrite(STDERR,$message."\n");
    $exitCode=1;
} finally {
    if ($lockAcquired) {
        try {
            $release=$pdo->prepare('SELECT RELEASE_LOCK(?)');
            $release->execute([$lockName]);
            $released=(int)$release->fetchColumn()===1;
            $release->closeCursor();
            if (!$released) throw new RuntimeException('Could not release the data retention lock.');
        } catch (Throwable $error) {
            fwrite(STDERR,"Could not release the data retention lock.\n");
            $exitCode=1;
        }
    }
}
if ($exitCode===0) {
    fwrite(STDOUT,json_encode(['event'=>'job_finished','job'=>'purge-retention','counts'=>$counts,'status'=>'succeeded'],JSON_THROW_ON_ERROR)."\n");
}
exit($exitCode);
