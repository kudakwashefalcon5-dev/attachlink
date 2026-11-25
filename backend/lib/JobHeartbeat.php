<?php
declare(strict_types=1);

function record_job_heartbeat(PDO $pdo,string $job): void {
    if (!preg_match('/\A[a-z][a-z0-9-]{0,62}\z/',$job)) {
        throw new InvalidArgumentException('Invalid job heartbeat name.');
    }
    $statement=$pdo->prepare('INSERT INTO job_heartbeats(job_name,last_successful_at) VALUES(?,NOW()) ON DUPLICATE KEY UPDATE last_successful_at=NOW()');
    $statement->execute([$job]);
}

function job_heartbeat_status(PDO $pdo): array {
    $thresholds=[
        'send-emails'=>['label'=>'Email worker','stale_after_seconds'=>300],
        'purge-documents'=>['label'=>'Document purge','stale_after_seconds'=>900],
        'backup'=>['label'=>'Backup','stale_after_seconds'=>129600],
    ];
    $rows=$pdo->query('SELECT job_name,last_successful_at,TIMESTAMPDIFF(SECOND,last_successful_at,NOW()) AS age_seconds FROM job_heartbeats')->fetchAll();
    $lastRuns=[];
    foreach ($rows as $row) {
        if (isset($thresholds[$row['job_name']])) $lastRuns[$row['job_name']]=$row;
    }
    $status=[];
    foreach ($thresholds as $job=>$settings) {
        $last=$lastRuns[$job]??null;
        $status[]=[
            'job'=>$job,
            'label'=>$settings['label'],
            'last_successful_at'=>$last['last_successful_at']??null,
            'stale_after_seconds'=>$settings['stale_after_seconds'],
            'stale'=>$last===null || (int)$last['age_seconds']>$settings['stale_after_seconds'],
        ];
    }
    return $status;
}
