<?php
require_once __DIR__.'/../../bootstrap.php';
$employer=user('employer');
method('GET');
$id=positive($_GET['application_id']??null);
$contact=getrow('SELECT a.student_id AS user_id FROM applications a JOIN openings o ON o.id=a.opening_id JOIN users u ON u.id=a.student_id WHERE a.id=? AND o.company_id=? AND u.is_active=1 AND EXISTS (SELECT 1 FROM applications ap JOIN openings op ON op.id=ap.opening_id WHERE ap.student_id=a.student_id AND op.company_id=o.company_id AND ap.status IN (\'submitted\',\'reviewing\',\'accepted\'))',[$id,$employer['company_id']]);
if(!$contact)fail('Application contact unavailable.',404);
out(['ok'=>true,'contact'=>$contact]);
