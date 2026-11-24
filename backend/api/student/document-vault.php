<?php
declare(strict_types=1);
require_once __DIR__.'/../../bootstrap.php';
require_once __DIR__.'/../../lib/ApplicationDocuments.php';
method('GET','POST');
$student=user('student');
$id=(int)$student['id'];
if ($_SERVER['REQUEST_METHOD']==='POST') {
    protect($_POST);
    $field=$_POST['document_type']??null;
    if (!is_string($field) || !isset(REQUIRED_APPLICATION_DOCUMENTS[$field])) fail('Invalid document type.',422);
    $maxSlots=$field==='academic_certificates'?MAX_ACADEMIC_CERTIFICATES:1;
    $slot=filter_var($_POST['slot']??1,FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>$maxSlots]]);
    if ($slot===false) fail('Invalid document slot.',422);
    $remove=($_POST['action']??'')==='remove';
    if ($remove && $field!=='academic_certificates') fail('Only academic certificate files can be removed here.',422);
    if (!$remove) [$temporary,$original,$mime,$extension]=validate_application_upload($_FILES['file']??null,true);
    $pdo=db();
    $pdo->beginTransaction();
    $stored=null;
    try {
        $current=getrow('SELECT password_changed_at,is_active FROM users WHERE id=? FOR UPDATE',[$id]);
        if (!$current || !$current['is_active'] || $current['password_changed_at']!==$student['password_changed_at']) {
            $pdo->rollBack();
            fail('Sign in again before uploading documents.',401);
        }
        $previous=getrow('SELECT stored_name FROM student_document_vault WHERE student_id=? AND document_type=? AND slot=?',[$id,$field,$slot]);
        if ($remove) {
            execute('DELETE FROM student_document_vault WHERE student_id=? AND document_type=? AND slot=?',[$id,$field,$slot]);
        } else {
            $stored=store_application_upload($temporary,$extension);
            execute('INSERT INTO student_document_vault(student_id,document_type,slot,original_name,stored_name,mime_type) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE original_name=VALUES(original_name),stored_name=VALUES(stored_name),mime_type=VALUES(mime_type)',[$id,$field,$slot,$original,$stored,$mime]);
        }
        if ($previous) execute("INSERT IGNORE INTO document_purge_queue(storage_kind,stored_name) VALUES('document',?)",[$previous['stored_name']]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        if ($stored!==null) @unlink(application_storage().'/'.$stored);
        throw $error;
    }
}
$documents=rows('SELECT document_type,slot,original_name FROM student_document_vault WHERE student_id=? ORDER BY document_type,slot',[$id]);
$required=[];
foreach (REQUIRED_APPLICATION_DOCUMENTS as $field=>[$type,$label,$description]) {
    $required[]=['document_type'=>$field,'label'=>$label,'description'=>$description,
        'max_files'=>$field==='academic_certificates'?MAX_ACADEMIC_CERTIFICATES:1];
}
out(['ok'=>true,'documents'=>$documents,'required_documents'=>$required]);
