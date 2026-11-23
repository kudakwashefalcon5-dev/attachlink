<?php
require_once __DIR__.'/../../bootstrap.php';
$admin=user('admin');
if ($_SERVER['REQUEST_METHOD']==='GET') {
 $placements=rows('SELECT p.*,a.student_id,o.title,c.name AS company_name,u.first_name,u.last_name FROM placements p JOIN applications a ON a.id=p.application_id JOIN users u ON u.id=a.student_id JOIN openings o ON o.id=a.opening_id JOIN companies c ON c.id=o.company_id ORDER BY p.created_at DESC');
 $eligible=rows("SELECT a.id AS application_id, a.student_id, u.first_name,u.last_name,o.title,c.name AS company_name FROM applications a JOIN users u ON u.id=a.student_id JOIN openings o ON o.id=a.opening_id JOIN companies c ON c.id=o.company_id WHERE a.status='accepted' ORDER BY a.created_at DESC");
 out(['ok'=>true,'placements'=>$placements,'eligible_applications'=>$eligible]);
}
method('POST');$a=body();protect($a);
$id=positive($a['application_id']??0);
$start=trim((string)($a['start_date']??''));$end=trim((string)($a['end_date']??''));
foreach ([$start,$end] as $date) {
 if ($date==='')continue;
 $parsed=DateTimeImmutable::createFromFormat('!Y-m-d',$date);
 if (!$parsed||$parsed->format('Y-m-d')!==$date)fail('Dates must be valid YYYY-MM-DD values.');
}
if ($start!=='' && $end!=='' && $end<$start)fail('End date must not be earlier than start date.');
$notes=trim((string)($a['notes']??''));if(strlen($notes)>5000)fail('Notes are too long.');
$pdo=db();$pdo->beginTransaction();
$app=getrow("SELECT a.student_id,o.title FROM applications a JOIN openings o ON o.id=a.opening_id WHERE a.id=? AND a.status='accepted' FOR UPDATE",[$id]);
if (!$app){$pdo->rollBack();fail('Only accepted applications can be placed.',400);}
$exists=getrow('SELECT id FROM placements WHERE application_id=?',[$id]);
execute('INSERT INTO placements(application_id,start_date,end_date,notes) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE start_date=VALUES(start_date),end_date=VALUES(end_date),notes=VALUES(notes)',[$id,$start?:null,$end?:null,$notes]);
if (!$exists) notify((int)$app['student_id'],'Placement recorded','Your placement for '.$app['title'].' has been recorded.','placement');
$placement=getrow('SELECT id FROM placements WHERE application_id=?',[$id]);
audit_event((int)$admin['id'],$exists?'placement.update':'placement.create','placement',(int)$placement['id'],['application_id'=>$id,'start_date'=>$start,'end_date'=>$end]);
$pdo->commit();
out(['ok'=>true,'message'=>$exists?'Placement updated.':'Placement recorded.']);
