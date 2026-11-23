<?php
declare(strict_types=1);

function purge_stored_file(string $kind,string $name): bool {
    if ($kind==='avatar' && preg_match('/\A[1-9][0-9]*\.jpg\z/',$name)) {
        $path=__DIR__.'/../storage/avatars/'.$name;
    } elseif ($kind==='document' && preg_match('/\A[a-f0-9]{48}\.(pdf|jpg|jpeg|png)\z/',$name)) {
        $path=application_storage().'/'.$name;
        if (!is_dir(application_storage())) return false;
    } else return false;
    return (!file_exists($path) && !is_link($path)) || @unlink($path);
}
