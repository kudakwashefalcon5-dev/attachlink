<?php
require_once __DIR__.'/../../bootstrap.php';$u=user('student');
if($_SERVER['REQUEST_METHOD']==='GET'){out(['ok'=>true,'openings'=>rows('SELECT o.id,o.title,o.city,c.name AS company_name FROM saved_openings s JOIN openings o ON s.opening_id=o.id JOIN companies c ON o.company_id=c.id WHERE s.student_id=? ORDER BY s.created_at DESC',[$u['id']])]);}
method('POST','DELETE');$a=body();protect($a);$id=positive($a['opening_id']??0);
if($_SERVER['REQUEST_METHOD']==='DELETE'){execute('DELETE FROM saved_openings WHERE student_id=? AND opening_id=?',[$u['id'],$id]);out(['ok'=>true,'message'=>'Removed.']);}
if(!getrow("SELECT o.id FROM openings o JOIN companies c ON c.id=o.company_id WHERE o.id=? AND o.status='published' AND c.verification_status='verified'",[$id]))fail('Opening not available.',404);
execute('INSERT IGNORE INTO saved_openings(student_id,opening_id) VALUES(?,?)',[$u['id'],$id]);out(['ok'=>true,'message'=>'Saved.']);
