<?php
require_once __DIR__.'/../../bootstrap.php';$u=user();method('POST');$a=body();protect($a);
$row=getrow('SELECT password_hash FROM users WHERE id=?',[$u['id']]);if(!password_verify((string)($a['current_password']??''),$row['password_hash']))fail('Current password is incorrect.',403);
$pw=(string)($a['new_password']??'');if(strlen($pw)<10||strlen($pw)>72)fail('Password must be 10 to 72 bytes.');
$pdo=db();$pdo->beginTransaction();
if (!execute('UPDATE users SET password_hash=?,password_changed_at=NOW(6) WHERE id=? AND password_hash=?',[attachlink_password_hash($pw),$u['id'],$row['password_hash']])) { $pdo->rollBack(); fail('Password has changed. Sign in again.',409); }
$version=getrow('SELECT password_changed_at FROM users WHERE id=?',[$u['id']])['password_changed_at'];
queue_template('password_changed',$u['email']);
$pdo->commit();
$_SESSION['password_changed_at']=$version;
session_regenerate_id(true);out(['ok'=>true,'message'=>'Password changed.']);
