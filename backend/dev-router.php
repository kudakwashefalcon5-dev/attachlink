<?php
declare(strict_types=1);

$path=str_replace('\\','/',rawurldecode(parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH)?:'/'));
if (preg_match('~(?:^|/)(?:\.env(?:[./:]|$)|\.git(?:/|$))~i',$path)) {
    http_response_code(404);
    return true;
}
if ($path==='/designs/admin/login.html') {
    header('Location: ../students/login.html?role=admin', true, 302);
    return true;
}
if (preg_match('~^/designs/(students|employers|admin)/([a-z-]+)\.html$~',$path,$match)
    && !in_array($match[2],['login','register'],true)) {
    $_GET['page']=$match[2];
    require __DIR__.'/../designs/'.$match[1].'/auth-gate.php';
    return true;
}
return false;
