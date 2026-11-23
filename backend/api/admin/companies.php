<?php
require_once __DIR__.'/../../bootstrap.php';$u=user('admin');
if($_SERVER['REQUEST_METHOD']==='GET')out(['ok'=>true,'companies'=>rows("SELECT c.id,c.name,c.description,c.website,c.industry,c.city,c.verification_status,c.created_at FROM companies c ORDER BY (c.verification_status='pending') DESC,c.created_at DESC LIMIT 200")]);
method('POST');$a=body();protect($a);$id=positive($a['company_id']??0);$status=(string)($a['status']??'');if(!in_array($status,['pending','verified','rejected'],true))fail('Invalid status.');
if(!getrow('SELECT id FROM companies WHERE id=?',[$id]))fail('Company not found.',404);
$reason=$a['note']??'';
if(!is_string($reason)||mb_strlen($reason)>2000)fail('Verification notes are limited to 2,000 characters.');
$pdo=db();$pdo->beginTransaction();
execute('UPDATE companies SET verification_status=?,verified_by=?,verified_at=? WHERE id=?',[$status,$status==='verified'?$u['id']:null,$status==='verified'?date('Y-m-d H:i:s'):null,$id]);
execute('INSERT INTO company_verification_decisions(company_id,admin_id,status,reason) VALUES(?,?,?,?)',[$id,$u['id'],$status,trim($reason)?:null]);
foreach(rows("SELECT id FROM users WHERE role='employer' AND company_id=?",[$id]) as $emp){notify((int)$emp['id'],'Company verification','Your company verification status is '.$status.'.','verification');
 queue_notification_email((int)$emp['id'],'company_verification',['status'=>$status]);
}
audit_event((int)$u['id'],'company.verification','company',$id,['status'=>$status]);
$pdo->commit();out(['ok'=>true,'message'=>'Verification updated.']);
