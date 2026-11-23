<?php
require_once __DIR__.'/../../bootstrap.php';
$u=user('student');
method('GET','POST');
if ($_SERVER['REQUEST_METHOD']==='POST') {
    $input=body();
    protect($input);
    $id=positive($input['listing_id'] ?? 0);
    $action=$input['action'] ?? '';
    if ($action==='remove') {
        execute('DELETE FROM saved_openings WHERE student_id=? AND opening_id=?',[$u['id'],$id]);
    } elseif ($action==='save') {
        if (!getrow("SELECT o.id FROM openings o JOIN companies c ON c.id=o.company_id WHERE o.id=? AND o.status='published' AND c.verification_status='verified'",[$id])) fail('Opening not available.',404);
        execute('INSERT IGNORE INTO saved_openings(student_id,opening_id) VALUES(?,?)',[$u['id'],$id]);
    } else fail('Invalid action.');
}
$saved=rows('SELECT o.id AS listing_id,o.company_id,o.title,o.city,o.deadline AS closing_date,(c.verification_status=\'verified\' AND EXISTS(SELECT 1 FROM company_files f WHERE f.company_id=c.id AND f.purpose=\'logo\')) AS has_company_logo,c.name AS organization FROM saved_openings s JOIN openings o ON s.opening_id=o.id JOIN companies c ON o.company_id=c.id WHERE s.student_id=? ORDER BY s.created_at DESC',[$u['id']]);
out(['ok'=>true,'count'=>count($saved),'saved'=>$saved]);
