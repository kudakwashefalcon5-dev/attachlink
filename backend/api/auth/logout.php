<?php
require_once __DIR__.'/../../bootstrap.php';
method('POST');
protect(body());
$_SESSION=[];
$cookie=session_get_cookie_params();
setcookie(session_name(),'',[
    'expires'=>time()-3600,
    'path'=>$cookie['path'],
    'domain'=>$cookie['domain'],
    'secure'=>$cookie['secure'],
    'httponly'=>$cookie['httponly'],
    'samesite'=>$cookie['samesite'],
]);
session_destroy();
out(['ok'=>true,'message'=>'Signed out.']);
