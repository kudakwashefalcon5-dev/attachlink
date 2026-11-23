<?php
require_once __DIR__.'/../../bootstrap.php';
require_once __DIR__.'/../../lib/DocumentPurge.php';
method('POST');
$student=user('student');
$data=body();
protect($data);
$password=$data['current_password']??null;
if (($data['confirm']??null)!==true || !is_string($password)) fail('Confirm account deletion and provide your password.',422);
$identity=getrow('SELECT password_hash FROM users WHERE id=?',[$student['id']]);
if (!$identity || !password_verify($password,$identity['password_hash'])) fail('Current password is incorrect.',403);

$pdo=db();
$pdo->beginTransaction();
$current=getrow("SELECT email,password_hash FROM users WHERE id=? AND role='student' AND is_active=1 FOR UPDATE",[$student['id']]);
if (!$current || $current['password_hash']!==$identity['password_hash']) {
    $pdo->rollBack();
    fail('Account changed. Sign in again and retry.',409);
}
$files=rows("SELECT 'document' AS storage_kind,d.stored_name FROM application_documents d JOIN applications a ON d.application_id=a.id WHERE a.student_id=? UNION ALL SELECT 'document',stored_name FROM student_document_vault WHERE student_id=?",[$student['id'],$student['id']]);
$files[]=['storage_kind'=>'avatar','stored_name'=>$student['id'].'.jpg'];
foreach ($files as $file) {
    execute('INSERT IGNORE INTO document_purge_queue(storage_kind,stored_name) VALUES(?,?)',array_values($file));
}
execute('DELETE FROM email_outbox WHERE recipient=?',[$current['email']]);
execute('DELETE FROM login_attempts WHERE bucket LIKE ? OR bucket=?',[login_account_prefix($student,'').'%',reset_daily_bucket($current['email'])]);
execute('DELETE FROM applications WHERE student_id=?',[$student['id']]);
execute("DELETE FROM users WHERE id=? AND role='student'",[$student['id']]);
$pdo->commit();

$pending=false;
foreach ($files as $file) {
    if (purge_stored_file($file['storage_kind'],$file['stored_name'])) {
        execute('DELETE FROM document_purge_queue WHERE storage_kind=? AND stored_name=?',array_values($file));
    } else {
        $pending=true;
        error_log('AttachLink deletion: pending file removal in document_purge_queue.');
    }
}
$_SESSION=[];
session_regenerate_id(true);
out(['ok'=>true,'message'=>$pending?'Account deleted. Remaining file removal is queued.':'Account and data deleted.']);
