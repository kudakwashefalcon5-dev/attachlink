<?php
require_once __DIR__.'/../../bootstrap.php';
method('POST');
$admin=user('admin');
$data=body();
protect($data);
$action=$data['action']??'';
if ($action==='create') {
    $first=required($data,'first_name',100);
    $last=required($data,'last_name',100);
    $email=strtolower(required($data,'email',190));
    $password=$data['password']??null;
    if (!filter_var($email,FILTER_VALIDATE_EMAIL)||!is_string($password)||strlen($password)<12||strlen($password)>72||str_contains($password,"\0")) {
        fail('Provide a valid email and a password of 12 to 72 bytes.',422);
    }
    $hash=attachlink_password_hash($password);
    $pdo=db();
    $pdo->beginTransaction();
    try {
        execute("INSERT INTO users(role,first_name,last_name,email,password_hash,email_verified_at) VALUES('admin',?,?,?,?,NOW())",[$first,$last,$email,$hash]);
        $id=(int)$pdo->lastInsertId();
        audit_event((int)$admin['id'],'admin.create','user',$id,[]);
        $pdo->commit();
    } catch (PDOException $error) {
        $pdo->rollBack();
        if (($error->errorInfo[1]??0)===1062) fail('Email is already registered.',409);
        throw $error;
    }
    out(['ok'=>true,'user_id'=>$id,'message'=>'Administrator created.'],201);
}
if ($action!=='deactivate') fail('Invalid action.',422);
$id=positive($data['user_id']??null);
if ($id===(int)$admin['id']) fail('You cannot deactivate your own account.',409);
$pdo=db();
$pdo->beginTransaction();
$active=rows("SELECT id FROM users WHERE role='admin' AND is_active=1 ORDER BY id FOR UPDATE");
$ids=array_map('intval',array_column($active,'id'));
if (!in_array((int)$admin['id'],$ids,true)||!in_array($id,$ids,true)||count($ids)<2) {
    $pdo->rollBack();
    fail('The administrator account cannot be deactivated.',409);
}
execute("UPDATE users SET is_active=0,password_changed_at=NOW(6) WHERE id=? AND role='admin'",[$id]);
audit_event((int)$admin['id'],'admin.deactivate','user',$id,[]);
$pdo->commit();
out(['ok'=>true,'message'=>'Administrator deactivated.']);
