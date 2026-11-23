<?php
require_once __DIR__.'/../../bootstrap.php';
method('POST');
$data=body();
protect($data);
require_link_configuration();
$email=is_string($data['email']??null)?strtolower(trim($data['email'])):'';
$daily=reset_daily_bucket($email);
$generic=['ok'=>true,'message'=>'If an eligible account exists, a password reset link will be emailed.'];
$logDaily=static fn()=>error_log('AttachLink recovery: daily email quota reached for bucket '.$daily);
if (attempt_limit_reached([$daily=>10],86400)) {
    $logDaily();
    out($generic);
}
attempt_limit([
    hash('sha256','forgot-ip:'.client_ip())=>30,
    hash('sha256','forgot-account:'.$email.':'.client_ip())=>[3,86400],
    $daily=>[10,86400]
],3600,static function() use ($email) {
    $account=filter_var($email,FILTER_VALIDATE_EMAIL) ? getrow('SELECT id,email FROM users WHERE email=? AND is_active=1 FOR UPDATE',[$email]) : null;
    if ($account) {
        $token=bin2hex(random_bytes(32));
        $expiry=getrow('SELECT NOW() + INTERVAL 1 HOUR AS expires')['expires'];
        execute('INSERT INTO password_resets(token_hash,user_id,expires_at,requested_ip) VALUES(?,?,?,?)',[hash('sha256',$token),$account['id'],$expiry,client_ip()]);
        queue_template('reset',$account['email'],['url'=>account_link('reset',$token)],$expiry);
    }
    return false;
},static function(string $bucket) use ($daily,$logDaily) {
    if ($bucket===$daily) $logDaily();
});
out($generic);
