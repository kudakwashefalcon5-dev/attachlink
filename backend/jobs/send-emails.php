<?php
declare(strict_types=1);
if (PHP_SAPI!=='cli') { http_response_code(404); exit; }
require_once __DIR__.'/../lib/Mailer.php';
$sendFailed=false;
try {
    require_once __DIR__.'/../config.php';
    if ($issue=app_environment_issue()) throw new ConfigException($issue);
    require_valid_settings(mail_setting_issues());
    $transport=mail_transport_name()==='log'?new LogMailTransport(mail_log_path()):new PhpMailerTransport();
    $pdo=connect_database();
    $sql=$pdo->prepare("SELECT id,recipient,subject,body,html_body,message_id,attempts,expires_at<=NOW() AS expired FROM email_outbox WHERE sent_at IS NULL AND failed_at IS NULL AND (next_attempt_at<=NOW() OR expires_at<=NOW()) ORDER BY next_attempt_at,id LIMIT 1 FOR UPDATE SKIP LOCKED");
    $sent=$pdo->prepare("UPDATE email_outbox SET sent_at=NOW(),body='',html_body=NULL WHERE id=?");
    $failed=$pdo->prepare("UPDATE email_outbox SET attempts=?,next_attempt_at=TIMESTAMPADD(SECOND,?,NOW()),failed_at=IF(? >= 5,NOW(),NULL),body=IF(? >= 5,'',body),html_body=IF(? >= 5,NULL,html_body) WHERE id=?");
    $expired=$pdo->prepare("UPDATE email_outbox SET failed_at=NOW(),body='',html_body=NULL WHERE id=?");
    $pdo->exec('SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED');
    for ($i=0;$i<50;$i++) {
        $pdo->beginTransaction();
        $sql->execute();
        $job=$sql->fetch(PDO::FETCH_ASSOC);
        $sql->closeCursor();
        if (!$job) {
            $pdo->commit();
            break;
        }
        if ($job['expired']) {
            $expired->execute([$job['id']]);
            $pdo->commit();
            continue;
        }
        $job['message_id'] ??= '<legacy-'.hash('sha256',DB_HOST.':'.DB_NAME.':'.$job['id']).'@'.env_mail_hostname().'>';
        try {
            $transport->send($job);
        } catch (Throwable $error) {
            $sendFailed=true;
            $attempt=$job['attempts']+1;
            $failed->execute([$attempt,60*(2**($attempt-1)),$attempt,$attempt,$attempt,$job['id']]);
            $pdo->commit();
            fwrite(STDERR,'Mail delivery failed for outbox row '.$job['id'].".\n");
            continue;
        }
        $sent->execute([$job['id']]);
        $pdo->commit();
    }
} catch (Throwable $error) {
    if (isset($pdo)&&$pdo->inTransaction()) $pdo->rollBack();
    fwrite(STDERR,($error instanceof ConfigException?$error->getMessage():'Mail job failed. Check the outbox and database.')."\n");
    exit(1);
}
exit($sendFailed?1:0);
