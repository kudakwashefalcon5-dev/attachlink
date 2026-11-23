<?php
declare(strict_types=1);

function admin_totp_key(): string {
    $key=config_env('ATTACHLINK_ADMIN_TOTP_KEY');
    if (!ctype_xdigit($key) || strlen($key)!==64) throw new ConfigException('ATTACHLINK_ADMIN_TOTP_KEY must contain 64 hexadecimal characters.');
    return hex2bin($key);
}

function totp_base32(string $secret): string {
    $alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    $bits='';
    foreach (str_split($secret) as $byte) $bits.=str_pad(decbin(ord($byte)),8,'0',STR_PAD_LEFT);
    $encoded='';
    foreach (str_split($bits,5) as $chunk) $encoded.=$alphabet[bindec(str_pad($chunk,5,'0'))];
    return $encoded;
}

function totp_code(string $secret,int $step): string {
    $digest=hash_hmac('sha1',pack('J',$step),$secret,true);
    $offset=ord($digest[19])&15;
    $value=unpack('N',substr($digest,$offset,4))[1]&0x7fffffff;
    return sprintf('%06d',$value%1000000);
}

function totp_step(string $secret,string $code,int $last): ?int {
    if (!preg_match('/\A[0-9]{6}\z/',$code)) return null;
    $now=intdiv(time(),30);
    for ($step=$now-1;$step<=$now+1;$step++) {
        if ($step>$last && hash_equals(totp_code($secret,$step),$code)) return $step;
    }
    return null;
}

function totp_encrypt(string $secret): string {
    $iv=random_bytes(12);
    $value=openssl_encrypt($secret,'aes-256-gcm',admin_totp_key(),OPENSSL_RAW_DATA,$iv,$tag);
    if ($value===false) throw new ConfigException('Admin authenticator encryption is unavailable.');
    return base64_encode($iv.$tag.$value);
}

function totp_decrypt(string $secret): string {
    $value=base64_decode($secret,true);
    if ($value===false || strlen($value)!==48) throw new ConfigException('Invalid admin authenticator record.');
    $plain=openssl_decrypt(substr($value,28),'aes-256-gcm',admin_totp_key(),OPENSSL_RAW_DATA,substr($value,0,12),substr($value,12,16));
    if ($plain===false) throw new ConfigException('Check ATTACHLINK_ADMIN_TOTP_KEY for the existing authenticator records.');
    return $plain;
}
