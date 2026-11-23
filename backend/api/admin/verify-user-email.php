<?php
require_once __DIR__.'/../../bootstrap.php';
method('POST');
$admin=user('admin');
$data=body();
protect($data);
$id=positive($data['user_id']??0);
$pdo=db();
$pdo->beginTransaction();
$target=getrow('SELECT email_verified_at FROM users WHERE id=? FOR UPDATE',[$id]);
if (!$target) {
    $pdo->rollBack();
    fail('Account not found.',404);
}
if (!$target['email_verified_at']) {
    execute('UPDATE users SET email_verified_at=NOW() WHERE id=?',[$id]);
    execute('DELETE FROM email_verifications WHERE user_id=?',[$id]);
    audit_event((int)$admin['id'],'user.email_verified','user',$id,[]);
}
$pdo->commit();
out(['ok'=>true,'message'=>'Email marked verified.']);
