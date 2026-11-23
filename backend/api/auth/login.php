<?php
require_once __DIR__.'/../../bootstrap.php';method('POST');$a=body();protect($a);
$email=trim((string)($a['email']??''));$phone=normalizePhone(trim((string)($a['phone']??'')));
if($email==='' && $phone==='')fail('Email or phone required.');
$identitySql='SELECT id,role,first_name,last_name,company_id,is_active,password_hash,password_changed_at FROM users';
$u=$email!==''?getrow($identitySql.' WHERE email=?',[strtolower($email)]):getrow($identitySql.' WHERE phone=?',[$phone]);
$ipBucket=hash('sha256','login-ip:'.client_ip());
$prefix=login_account_prefix($u,strtolower($email?:$phone));
$accountBucket=$prefix.substr(hash('sha256','login-local:'.client_ip()),0,47);
$globalBucket=$prefix.substr(hash('sha256','login-global'),0,47);
$expected=$a['role']??$a['portal']??'';
if(in_array($expected,['recruiter','company'],true))$expected='employer';
$limits=[$ipBucket=>100,$accountBucket=>10,$globalBucket=>50];
$result=null;
if (!attempt_limit_reached($limits,900)) {
    $matches=login_password_matches($u,(string)($a['password']??''));
    $result=attempt_limit($limits,900,static function() use ($matches,$u,$expected,$accountBucket,$globalBucket) {
        if (!$matches) return false;
        if (!(int)$u['is_active']) return 'disabled';
        if ($expected!==$u['role']) return 'portal';
        execute('DELETE FROM login_attempts WHERE bucket IN (?,?)',[$accountBucket,$globalBucket]);
        return true;
    });
}
if ($result===null) {
    header('Retry-After: '.(900-time()%900));
    fail('Too many sign-in attempts. Try again later.',429);
}
if ($result===false) fail('Incorrect email/phone or password.',401);
if ($result==='disabled') fail('Account disabled.',403);
if ($result==='portal') fail('Account does not belong to selected portal.',403);
$hash=$u['password_hash'];
$hashInfo=password_get_info($hash);
if ($hashInfo['algoName']==='bcrypt' && ($hashInfo['options']['cost']??0)<PASSWORD_BCRYPT_COST
    && password_needs_rehash($hash,PASSWORD_BCRYPT,['cost'=>PASSWORD_BCRYPT_COST])) {
    $replacement=attachlink_password_hash((string)($a['password']??''));
    execute('UPDATE users SET password_hash=? WHERE id=? AND BINARY password_hash=BINARY ?',[$replacement,$u['id'],$hash]);
}
if (APP_ENV==='production' && $u['role']==='admin') {
    require_once __DIR__.'/../../lib/AdminTotp.php';
    admin_totp_key();
    $id=(int)$u['id'];
    $secret=getrow('SELECT admin_id FROM admin_totp WHERE admin_id=?',[$id])?null:random_bytes(20);
    session_regenerate_id(true);
    $_SESSION=[
        'csrf_token'=>bin2hex(random_bytes(32)),
        'totp_pending'=>['id'=>$id,'password_changed_at'=>$u['password_changed_at'],'expires'=>time()+300,'secret'=>$secret],
    ];
    out(['ok'=>true,'totp_required'=>true,'setup_key'=>$secret===null?null:totp_base32($secret)]);
}
establish_login($u);
out(['ok'=>true,'message'=>'Signed in.','user'=>['id'=>(int)$u['id'],'role'=>$u['role'],'first_name'=>$u['first_name'],'last_name'=>$u['last_name'],'company_id'=>$u['company_id']]]);
