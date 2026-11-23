<?php
require_once __DIR__.'/../../bootstrap.php';
method('POST');
$data=body();
protect($data);
$hash=account_token($data);
$record=getrow('SELECT user_id FROM email_verifications WHERE token_hash=? AND expires_at>NOW()',[$hash]);
if (!$record) fail('This link is invalid or expired.',422);
$pdo=db();
$pdo->beginTransaction();
getrow('SELECT id FROM users WHERE id=? FOR UPDATE',[$record['user_id']]);
if (!execute('DELETE FROM email_verifications WHERE token_hash=? AND expires_at>NOW()',[$hash])) {
    $pdo->rollBack();
    fail('This link is invalid or expired.',422);
}
execute('UPDATE users SET email_verified_at=COALESCE(email_verified_at,NOW()) WHERE id=?',[$record['user_id']]);
execute('DELETE FROM email_verifications WHERE user_id=?',[$record['user_id']]);
$pdo->commit();
out(['ok'=>true,'message'=>'Email verified.']);
