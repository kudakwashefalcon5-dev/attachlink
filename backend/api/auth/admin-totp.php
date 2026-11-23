<?php
declare(strict_types=1);
require_once __DIR__.'/../../bootstrap.php';
require_once __DIR__.'/../../lib/AdminTotp.php';
method('POST');
$data=body();
protect($data);
$pending=$_SESSION['totp_pending']??null;
if (APP_ENV!=='production' || !$pending || $pending['expires']<time()) {
    unset($_SESSION['totp_pending']);
    fail('Sign in again to verify your administrator account.',401);
}
$code=$data['code']??null;
if (!is_string($code) || strlen($code)>40) fail('Enter an authenticator code or recovery code.',422);
$id=$pending['id'];
$result=attempt_limit([hash('sha256','admin-totp:'.$id)=>8],900,static function () use ($id,$pending,$code) {
    $account=getrow("SELECT id,is_active,password_changed_at FROM users WHERE id=? AND role='admin' FOR UPDATE",[$id]);
    if (!$account || !$account['is_active'] || $account['password_changed_at']!==$pending['password_changed_at']) return false;
    $record=getrow('SELECT encrypted_secret,last_step,recovery_hashes FROM admin_totp WHERE admin_id=? FOR UPDATE',[$id]);
    $codes=[];
    if (!$record) {
        $secret=$pending['secret'];
        if ($secret===null || ($step=totp_step($secret,$code,-1))===null) return false;
        for ($i=0;$i<10;$i++) $codes[]=bin2hex(random_bytes(10));
        $hashes=array_map(static fn($value)=>hash('sha256',$value),$codes);
        execute('INSERT INTO admin_totp(admin_id,encrypted_secret,last_step,recovery_hashes) VALUES(?,?,?,?)',[$id,totp_encrypt($secret),$step,json_encode($hashes,JSON_THROW_ON_ERROR)]);
        audit_event($id,'admin.totp_enrolled','user',$id,[]);
    } else {
        if ($pending['secret']!==null) return false;
        $step=totp_step(totp_decrypt($record['encrypted_secret']),$code,(int)$record['last_step']);
        if ($step!==null) {
            execute('UPDATE admin_totp SET last_step=? WHERE admin_id=?',[$step,$id]);
        } else {
            $hashes=json_decode($record['recovery_hashes'],true,512,JSON_THROW_ON_ERROR);
            $match=array_search(hash('sha256',strtolower(trim($code))),$hashes,true);
            if ($match===false) return false;
            unset($hashes[$match]);
            execute('UPDATE admin_totp SET recovery_hashes=? WHERE admin_id=?',[json_encode(array_values($hashes),JSON_THROW_ON_ERROR),$id]);
            audit_event($id,'admin.totp_recovery_used','user',$id,[]);
        }
    }
    return [$account,$codes];
});
if ($result===null) fail('Too many verification attempts. Try again later.',429);
if ($result===false) fail('The authenticator or recovery code is invalid.',401);
[$account,$codes]=$result;
establish_login($account,true);
out(['ok'=>true,'recovery_codes'=>$codes]);
