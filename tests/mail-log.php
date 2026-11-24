<?php
declare(strict_types=1);

require_once __DIR__.'/../backend/config.php';
require_once __DIR__.'/../backend/lib/Mailer.php';

if (APP_ENV!=='development' || mail_transport_name()!=='log' || mail_setting_issues()) {
    throw new RuntimeException('The mail log fixture requires a valid development log transport.');
}

$path=mail_log_path();
$logDirectory=dirname($path);
$expired=['created_at'=>time()-86401,'body'=>'expired-entry-secret'];
$recent=['created_at'=>time()-60,'body'=>'recent-entry'];
if (file_put_contents($path,json_encode($expired)."\n".json_encode($recent)."\n")===false) {
    throw new RuntimeException('Could not prepare the mail log fixture.');
}
chmod($path,0600);

$token=str_repeat('a',58).'abcdef';
$url='https://example.invalid/account-recovery.php?action=reset#token='.$token;
(new LogMailTransport($path))->send([
    'recipient'=>'qa@example.invalid',
    'subject'=>'Password reset',
    'body'=>'Use '.$url.' or visit https://example.invalid/support. Code: '.$token,
    'html_body'=>'<a href="https://example.invalid/account-recovery.php?action=verify#token='.$token.'">Verify</a>',
    'message_id'=>'<qa@example.invalid>',
]);

$contents=file_get_contents($path);
if ($contents===false || str_contains($contents,'expired-entry-secret') || !str_contains($contents,'recent-entry')
    || str_contains($contents,$token) || str_contains($contents,'https://example.invalid')
    || substr_count($contents,'token ending abcdef')!==3) {
    throw new RuntimeException('Mail log expiry or redaction failed.');
}
if (PHP_OS_FAMILY!=='Windows') {
    $directoryMode=fileperms($logDirectory)&0777;
    $fileMode=fileperms($path)&0777;
    if ($directoryMode!==0700 || $fileMode!==0600) {
        throw new RuntimeException('Mail log permissions are not 0700/0600.');
    }
}

echo "PASSED private mail log, token/link redaction, and 24-hour expiry.\n";
