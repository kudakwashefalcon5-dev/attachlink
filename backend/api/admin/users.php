<?php
require_once __DIR__.'/../../bootstrap.php';$u=user('admin');
if($_SERVER['REQUEST_METHOD']==='GET')out(['ok'=>true,'users'=>rows("SELECT u.id,u.role,u.first_name,u.last_name,u.email,u.phone,u.is_active,u.created_at,p.institution,p.programme,p.city,p.study_level,c.name AS company_name,IF(u.is_active=1,'Active','Disabled') AS account_status,(SELECT COUNT(*) FROM applications a WHERE a.student_id=u.id) AS application_count FROM users u LEFT JOIN student_profiles p ON p.user_id=u.id LEFT JOIN companies c ON c.id=u.company_id ORDER BY u.created_at DESC LIMIT 300")]);
method('POST');$a=body();protect($a);$id=positive($a['user_id']??0);if($id===(int)$u['id'])fail('Cannot change your own account status.');$active=(int)($a['is_active']??-1);if(!in_array($active,[0,1],true))fail('Invalid status.');
$pdo=db();$pdo->beginTransaction();
if (execute("UPDATE users SET is_active=? WHERE id=? AND role<>'admin'",[$active,$id])) {
    audit_event((int)$u['id'],'user.status','user',$id,['is_active'=>$active]);
}
$pdo->commit();out(['ok'=>true]);
