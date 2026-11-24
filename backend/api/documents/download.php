<?php
require_once __DIR__.'/../../bootstrap.php';$u=user();method('GET');$id=positive($_GET['id']??0);
$d=getrow('SELECT d.*,a.student_id,o.company_id FROM application_documents d JOIN applications a ON d.application_id=a.id JOIN openings o ON o.id=a.opening_id WHERE d.id=?',[$id]);if(!$d)fail('Document not found.',404);
if(!($u['role']==='admin'||($u['role']==='student'&&$u['id']==$d['student_id'])||($u['role']==='employer'&&$u['company_id']==$d['company_id'])))fail('Access denied.',403);
$name=$d['stored_name'];
if(!preg_match('/\A[a-f0-9]{48}\.(pdf|jpg|png|docx?)\z/',$name))fail('Missing file.',404);
$path=application_storage().'/'.$name;if(!is_file($path)||is_link($path))fail('Missing file.',404);
audit_event((int)$u['id'],'document.download','application_document',$id,['actor_role'=>$u['role'],'application_id'=>(int)$d['application_id']]);
header_remove('Content-Type');header('Content-Type: '.$d['mime_type']);header('X-Content-Type-Options: nosniff');header('Content-Disposition: attachment; filename="document.'.pathinfo($d['stored_name'],PATHINFO_EXTENSION).'"');header('Content-Length: '.filesize($path));readfile($path);exit;
