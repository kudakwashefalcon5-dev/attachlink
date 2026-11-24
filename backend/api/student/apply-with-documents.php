<?php
declare(strict_types=1);
require_once __DIR__.'/../../bootstrap.php';
require_once __DIR__.'/../../lib/ApplicationDocuments.php';
method('POST');
$student = user('student');
protect($_POST);
require_verified_email($student);
$opening = positive($_POST['listing_id'] ?? 0);
$letter = $_POST['cover_letter'] ?? '';
if (!is_string($letter) || strlen($letter) > 12000) fail('Invalid cover letter.');

$pdo = db();
$saved = [];
try {
    $pdo->beginTransaction();
    $current = getrow('SELECT is_active,email_verified_at,password_changed_at FROM users WHERE id=? FOR UPDATE', [$student['id']]);
    if (!$current || !$current['is_active'] || $current['password_changed_at'] !== $student['password_changed_at']) {
        $pdo->rollBack();
        fail('Sign in again before applying.', 401);
    }
    if (!$current['email_verified_at']) {
        $pdo->rollBack();
        require_verified_email($current);
    }
    $vault=[];
    foreach (rows('SELECT document_type,stored_name,original_name,mime_type FROM student_document_vault WHERE student_id=? ORDER BY document_type,slot',[$student['id']]) as $document) {
        $vault[$document['document_type']][]=$document;
    }
    $missing=[];
    foreach (REQUIRED_APPLICATION_DOCUMENTS as $field=>[$type,$label]) {
        if (!isset($vault[$field])) $missing[]=$label;
    }
    if ($missing) {
        $pdo->rollBack();
        out(['ok'=>false,'message'=>'Complete your application documents in My Profile before applying.',
            'missing_documents'=>$missing],422);
    }
    $record = getrow("SELECT o.title,o.company_id FROM openings o JOIN companies c ON c.id=o.company_id WHERE o.id=? AND o.status='published' AND c.verification_status='verified' AND EXISTS(SELECT 1 FROM users company_user WHERE company_user.company_id=c.id AND company_user.role='employer' AND company_user.is_active=1) AND (o.deadline IS NULL OR o.deadline>=CURDATE()) FOR UPDATE", [$opening]);
    if (!$record) {
        $pdo->rollBack();
        fail('Opening is not accepting applications.', 404);
    }
    execute('INSERT INTO applications(opening_id,student_id,cover_letter) VALUES(?,?,?)', [$opening,$student['id'],trim($letter)]);
    $id = (int)$pdo->lastInsertId();
    foreach (REQUIRED_APPLICATION_DOCUMENTS as $field=>[$type]) {
        foreach ($vault[$field] as $document) {
            $stored=copy_vault_document($document['stored_name']);
            $saved[]=$stored;
            execute('INSERT INTO application_documents(application_id,document_type,original_name,stored_name,mime_type) VALUES(?,?,?,?,?)',
                [$id,$type,$document['original_name'],$stored,$document['mime_type']]);
        }
    }
    notify((int)$student['id'], 'Application submitted', 'Your application for '.$record['title'].' was submitted.', 'application');
    foreach (rows("SELECT id FROM users WHERE role='employer' AND company_id=? AND is_active=1", [$record['company_id']]) as $employer) {
        notify((int)$employer['id'], 'New application', 'A student applied for '.$record['title'], 'application');
        queue_notification_email((int)$employer['id'],'new_application',['title'=>$record['title']]);
    }
    $pdo->commit();
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    foreach ($saved as $file) @unlink(application_storage().'/'.$file);
    if ($error instanceof PDOException && ($error->errorInfo[1] ?? null) === 1062) fail('You already applied to this opening.', 409);
    error_log('AttachLink application submission failed: '.$error::class);
    fail('Application could not be submitted.', 500);
}
out(['ok'=>true,'application_id'=>$id,'document_count'=>count($saved),'message'=>'Application submitted.'], 201);
