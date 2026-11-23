<?php
require_once __DIR__.'/../../bootstrap.php';
method('POST');
$admin=user('admin');
$data=body();
protect($data);
$id=positive($data['user_id']??0);
$target=getrow('SELECT email FROM users WHERE id=?',[$id]);
if (!$target) fail('Account not found.',404);
$pdo=db();
$pdo->beginTransaction();
execute('DELETE FROM login_attempts WHERE bucket=?',[reset_daily_bucket($target['email'])]);
audit_event((int)$admin['id'],'user.reset_quota_cleared','user',$id,[]);
$pdo->commit();
out(['ok'=>true,'message'=>'Daily password reset quota cleared.']);
