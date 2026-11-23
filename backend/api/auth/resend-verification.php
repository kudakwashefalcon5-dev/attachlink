<?php
require_once __DIR__.'/../../bootstrap.php';
method('POST');
$account=user();
protect(body());
if ($account['email_verified_at']) out(['ok'=>true,'message'=>'Your email address is already verified.']);
require_link_configuration();
$result=attempt_limit([hash('sha256','resend:'.$account['id'])=>3],3600,static function() use ($account) {
    $current=getrow('SELECT id,email,email_verified_at FROM users WHERE id=? FOR UPDATE',[$account['id']]);
    if (!$current || $current['email_verified_at']) return true;
    queue_verification($current);
    return false;
});
if ($result===null) fail('Too many verification requests. Try again later.',429);
out(['ok'=>true,'message'=>$result?'Your email address is already verified.':'Verification email queued.']);
