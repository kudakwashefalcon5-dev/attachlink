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

$files = [];
$useVault=($_POST['use_vault']??null)==='1';
foreach (REQUIRED_APPLICATION_DOCUMENTS as $field => [$type, $label]) {
    $file = $_FILES[$field] ?? null;
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        if ($useVault) continue;
        fail('Please upload '.$label.'.', 422);
    }
    $files[$field] = validate_application_upload($file);
}

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
    if ($useVault) {
        foreach (rows('SELECT document_type,stored_name,original_name,mime_type FROM student_document_vault WHERE student_id=?',[$student['id']]) as $document) {
            $vault[$document['document_type']]=$document;
        }
        foreach (REQUIRED_APPLICATION_DOCUMENTS as $field => [$type,$label]) {
            if (!isset($files[$field]) && !isset($vault[$field])) {
                $pdo->rollBack();
                fail('Please upload '.$label.'.',422);
            }
        }
    }
    $record = getrow("SELECT o.title,o.company_id FROM openings o JOIN companies c ON c.id=o.company_id WHERE o.id=? AND o.status='published' AND c.verification_status='verified' AND (o.deadline IS NULL OR o.deadline>=CURDATE()) FOR UPDATE", [$opening]);
    if (!$record) {
        $pdo->rollBack();
        fail('Opening is not accepting applications.', 404);
    }
    execute('INSERT INTO applications(opening_id,student_id,cover_letter) VALUES(?,?,?)', [$opening,$student['id'],trim($letter)]);
    $id = (int)$pdo->lastInsertId();
    foreach (REQUIRED_APPLICATION_DOCUMENTS as $field=>[$type]) {
        if (isset($files[$field])) {
            [$temporary,$original,$mime,$extension]=$files[$field];
            $stored=store_application_upload($temporary,$extension);
        } else {
            $original=$vault[$field]['original_name'];
            $mime=$vault[$field]['mime_type'];
            $stored=copy_vault_document($vault[$field]['stored_name']);
        }
        $saved[] = $stored;
        execute('INSERT INTO application_documents(application_id,document_type,original_name,stored_name,mime_type) VALUES(?,?,?,?,?)', [$id,$type,$original,$stored,$mime]);
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
