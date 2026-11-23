<?php
require_once __DIR__.'/../../bootstrap.php';method('POST');$a=body();protect($a);
require_once __DIR__.'/../../lib/Consent.php';
if (($a['consent']??null)!==true || ($a['consent_version']??null)!==CONSENT_VERSION) fail('Accept the current privacy notice and terms to register.',422);
$role=(string)($a['role']??'student');if(!in_array($role,['student','employer'],true))fail('Invalid registration role.');
$first=required($a,'first_name',100);$last=required($a,'last_name',100);
$email=strtolower(required($a,'email',190));if(!filter_var($email,FILTER_VALIDATE_EMAIL))fail('Invalid email address.');
$phone=normalizePhone(required($a,'phone',30));if(!preg_match('/^\+2637[1378]\d{7}$/',$phone))fail('Invalid Zimbabwean phone number.');
$password=(string)($a['password']??'');if(strlen($password)<10||strlen($password)>72)fail('Password must be 10 to 72 bytes.');
if($role==='employer')$company=required($a,'company_name',180);
try {
 $pdo=db();$pdo->beginTransaction();$companyId=null;
 if($role==='employer'){$s=$pdo->prepare('INSERT INTO companies(name,industry,city) VALUES(?,?,?)');$s->execute([$company,trim((string)($a['industry']??'')),trim((string)($a['city']??''))]);$companyId=(int)$pdo->lastInsertId();}
 $s=$pdo->prepare('INSERT INTO users(role,company_id,first_name,last_name,email,phone,password_hash,consent_at,consent_version) VALUES(?,?,?,?,?,?,?,NOW(),?)');
 $s->execute([$role,$companyId,$first,$last,$email,$phone,attachlink_password_hash($password),CONSENT_VERSION]);$id=(int)$pdo->lastInsertId();
 if($role==='student'){
  $s=$pdo->prepare('INSERT INTO student_profiles(user_id,date_of_birth,gender,institution,programme,study_level,city) VALUES(?,?,?,?,?,?,?)');
  $s->execute([$id,($a['date_of_birth']??'')?:null,($a['gender']??'')?:null,($a['institution']??'')?:null,($a['programme']??'')?:null,($a['study_level']??'')?:null,($a['city']??'')?:null]);
 }
 queue_verification(['id'=>$id,'email'=>$email]);
 $pdo->commit();out(['ok'=>true,'message'=>'Account created. Check your email to verify your address, then sign in.','user_id'=>$id],201);
} catch(ConfigException $e) {
 if(isset($pdo)&&$pdo->inTransaction())$pdo->rollBack();
 throw $e;
} catch(PDOException $e){if(isset($pdo)&&$pdo->inTransaction())$pdo->rollBack();if($e->getCode()==='23000')fail('Email or phone already registered.',409);throw $e;}
