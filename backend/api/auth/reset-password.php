<?php
require_once __DIR__.'/../../bootstrap.php';
method('POST');
$data=body();
protect($data);
$hash=account_token($data);
$password=$data['new_password']??null;
if (!is_string($password)||strlen($password)<10||strlen($password)>72||str_contains($password,"\0")) fail('Password must be 10 to 72 bytes.');
$reset=getrow('SELECT user_id FROM password_resets WHERE token_hash=? AND used_at IS NULL AND expires_at>NOW()',[$hash]);
if (!$reset) fail('This link is invalid or expired.',422);
$pdo=db();
$pdo->beginTransaction();
$account=getrow('SELECT id,email FROM users WHERE id=? AND is_active=1 FOR UPDATE',[$reset['user_id']]);
if (!$account || !execute('UPDATE password_resets SET used_at=NOW() WHERE token_hash=? AND used_at IS NULL AND expires_at>NOW()',[$hash])) {
    $pdo->rollBack();
    fail('This link is invalid or expired.',422);
}
execute('UPDATE users SET password_hash=?,password_changed_at=NOW(6) WHERE id=?',[attachlink_password_hash($password),$account['id']]);
execute('UPDATE password_resets SET used_at=NOW() WHERE user_id=? AND used_at IS NULL',[$account['id']]);
execute('DELETE FROM login_attempts WHERE bucket LIKE ?', [login_account_prefix($account,'').'%']);
queue_template('password_changed',$account['email']);
$pdo->commit();
$_SESSION=[];
session_regenerate_id(true);
out(['ok'=>true,'message'=>'Password reset. Sign in with your new password.']);
