<?php
require_once __DIR__.'/../../bootstrap.php';
method('POST');
$student=user('student');
$data=body();
protect($data);
$id=positive($data['application_id']??0);
$pdo=db();
$pdo->beginTransaction();
$app=getrow('SELECT a.status,o.title,o.company_id FROM applications a JOIN openings o ON o.id=a.opening_id WHERE a.id=? AND a.student_id=? FOR UPDATE',[$id,$student['id']]);
if (!$app || !in_array($app['status'],['submitted','reviewing'],true)) {
    $pdo->rollBack();
    if (!$app) fail('Application not found.',404);
    fail('Only submitted or reviewing applications can be withdrawn.',409);
}
execute("UPDATE applications SET status='withdrawn' WHERE id=?",[$id]);
execute("INSERT INTO application_status_events(application_id,changed_by,previous_status,new_status) VALUES(?,?,?,'withdrawn')",[$id,$student['id'],$app['status']]);
foreach (rows("SELECT id FROM users WHERE company_id=? AND role='employer' AND is_active=1",[$app['company_id']]) as $employer) {
    notify((int)$employer['id'],'Application withdrawn','An application for '.$app['title'].' was withdrawn.','application');
}
$pdo->commit();
out(['ok'=>true,'message'=>'Application withdrawn.']);
