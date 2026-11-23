<?php
require_once __DIR__.'/../../bootstrap.php';$u=user('student');
$fields=['first_name','last_name','phone','date_of_birth','gender','institution','programme','study_level','city'];
if($_SERVER['REQUEST_METHOD']==='POST'){
 $a=body();protect($a);$current=(string)($a['current_password']??'');
 $existing=getrow('SELECT email,phone,password_hash FROM users WHERE id=?',[$u['id']]);
 $newPhone=normalizePhone(trim((string)($a['phone']??'')));
 $email=strtolower(trim((string)($a['email']??$existing['email'])));
 if(strlen($email)>190||!filter_var($email,FILTER_VALIDATE_EMAIL))fail('Invalid email address.');
 if(($newPhone!==($existing['phone']??'')||$email!==$existing['email'])&&!password_verify($current,$existing['password_hash']))fail('Current password required to change your email or phone number.',403);
 $first=required($a,'first_name',100);$last=required($a,'last_name',100);$phone=$newPhone;
 $bio=$a['bio']??null;
 if($bio!==null&&(!is_string($bio)||mb_strlen($bio)>4000))fail('Invalid biography.');
 if($phone!==''&&!preg_match('/^\+2637[1378]\d{7}$/',$phone))fail('Invalid phone.');
 try {
  $pdo=db();$pdo->beginTransaction();
  $locked=getrow('SELECT email,password_hash FROM users WHERE id=? FOR UPDATE',[$u['id']]);
  if ($locked['email']!==$existing['email'] || $locked['password_hash']!==$existing['password_hash']) {$pdo->rollBack();fail('Account changed. Refresh and retry.',409);}
  execute('UPDATE users SET first_name=?,last_name=?,phone=?,email=? WHERE id=?',[$first,$last,$phone?:null,$email,$u['id']]);
  if ($email!==$existing['email']) {
   execute('UPDATE users SET email_verified_at=NULL WHERE id=?',[$u['id']]);
   execute('DELETE FROM email_verifications WHERE user_id=?',[$u['id']]);
   execute('UPDATE password_resets SET used_at=NOW() WHERE user_id=? AND used_at IS NULL',[$u['id']]);
   queue_verification(['id'=>$u['id'],'email'=>$email]);
  }
  execute('UPDATE student_profiles SET date_of_birth=?,gender=?,institution=?,programme=?,study_level=?,city=?,bio=COALESCE(?,bio) WHERE user_id=?',[
   ($a['date_of_birth']??'')?:null,($a['gender']??'')?:null,trim((string)($a['institution']??'')),trim((string)($a['programme']??'')),trim((string)($a['study_level']??'')),trim((string)($a['city']??'')),$bio,$u['id']]);$pdo->commit();
 }catch(PDOException $e){if(isset($pdo)&&$pdo->inTransaction())$pdo->rollBack();if(($e->errorInfo[1]??null)===1062)fail('Email or phone number already in use.',409);throw $e;}
}else method('GET');
$a=getrow('SELECT u.id,u.first_name,u.last_name,u.email,u.phone,p.date_of_birth,p.gender,p.institution,p.programme,p.study_level,p.city,p.bio,p.skills FROM users u JOIN student_profiles p ON u.id=p.user_id WHERE u.id=?',[$u['id']]);
out(['ok'=>true,'account'=>$a]);
