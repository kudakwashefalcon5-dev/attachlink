<?php
require_once __DIR__.'/../../bootstrap.php';$u=user('employer');$cid=(int)$u['company_id'];
if($_SERVER['REQUEST_METHOD']==='GET'){
 $id=(int)($_GET['opening_id']??0);
 $where=$id?' AND o.id=?':'';$args=$id?[$cid,$id]:[$cid];
 out(['ok'=>true,'applications'=>rows('SELECT a.id,a.opening_id,a.status,a.created_at,u.id AS student_id,u.first_name,u.last_name,CASE WHEN COALESCE(pref.recruiter_visible,1)=1 THEN u.email END AS email,o.title AS opening_title FROM applications a JOIN openings o ON a.opening_id=o.id JOIN users u ON a.student_id=u.id LEFT JOIN student_preferences pref ON pref.student_id=u.id WHERE o.company_id=?'.$where.' ORDER BY a.created_at DESC',$args)]);
}
method('POST');$a=body();protect($a);$id=positive($a['application_id']??0);$status=(string)($a['status']??'');if(!in_array($status,['reviewing','accepted','rejected'],true))fail('Invalid decision.');
$note=$a['note']??'';
if(!is_string($note)||mb_strlen($note)>2000)fail('Invalid review note.');
$pdo=db();$pdo->beginTransaction();
$opening=getrow('SELECT o.id,o.available_positions FROM openings o WHERE o.company_id=? AND o.id=(SELECT opening_id FROM applications WHERE id=?) FOR UPDATE',[$cid,$id]);
$app=getrow('SELECT a.student_id,a.status,o.title FROM applications a JOIN openings o ON o.id=a.opening_id WHERE a.id=? AND o.company_id=? FOR UPDATE',[$id,$cid]);
if(!$app){$pdo->rollBack();fail('Application not found.',404);}
if($app['status']!==$status){
 if($app['status']==='withdrawn'||getrow('SELECT id FROM placements WHERE application_id=?',[$id])){$pdo->rollBack();fail('This application can no longer change status.',409);}
 if($status==='accepted' && $opening['available_positions']!==null && count(rows("SELECT id FROM applications WHERE opening_id=? AND status='accepted' FOR UPDATE",[$opening['id']])) >= (int)$opening['available_positions']){
  $pdo->rollBack();fail('All available positions for this opening are already filled.',409);
 }
 execute('UPDATE applications SET status=? WHERE id=?',[$status,$id]);
 execute('INSERT INTO application_status_events(application_id,changed_by,previous_status,new_status,note) VALUES(?,?,?,?,?)',[$id,$u['id'],$app['status'],$status,trim($note)?:null]);
 notify((int)$app['student_id'],'Application '.$status,'Your application for '.$app['title'].' is now '.$status.'.','application');
 queue_notification_email((int)$app['student_id'],'application_status',['title'=>$app['title'],'status'=>$status]);
}
$pdo->commit();out(['ok'=>true,'message'=>'Application updated.']);
