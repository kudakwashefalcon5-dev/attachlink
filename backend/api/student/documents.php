<?php
require_once __DIR__.'/../../bootstrap.php';$u=user('student');
if($_SERVER['REQUEST_METHOD']==='GET'){
 $id=positive($_GET['application_id']??0);if(!getrow('SELECT id FROM applications WHERE id=? AND student_id=?',[$id,$u['id']]))fail('Not found.',404);
 out(['ok'=>true,'documents'=>rows('SELECT id,document_type,original_name,uploaded_at FROM application_documents WHERE application_id=?',[$id])]);
}
method('POST');protect($_POST);$id=positive($_POST['application_id']??0);
if(!getrow('SELECT id FROM applications WHERE id=? AND student_id=?',[$id,$u['id']]))fail('Not found.',404);
$type=(string)($_POST['document_type']??'');$types=['attachment_letter','cv','id','transcript','o_level','a_level','other_certificate'];if(!in_array($type,$types,true))fail('Invalid document type.');
[$temporary,$original,$mime,$extension]=validate_application_upload($_FILES['file']??null);
$pdo=db();
$pdo->beginTransaction();
if (!getrow("SELECT id FROM users WHERE id=? AND is_active=1 FOR UPDATE",[$u['id']])) {
    $pdo->rollBack();
    fail('Account not available.',401);
}
$file=store_application_upload($temporary,$extension);
try {
    execute('INSERT INTO application_documents(application_id,document_type,original_name,stored_name,mime_type) VALUES(?,?,?,?,?)',[$id,$type,$original,$file,$mime]);
    $documentId=(int)$pdo->lastInsertId();
    $pdo->commit();
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    @unlink(application_storage().'/'.$file);
    throw $error;
}
out(['ok'=>true,'document_id'=>$documentId,'message'=>'Document uploaded.'],201);