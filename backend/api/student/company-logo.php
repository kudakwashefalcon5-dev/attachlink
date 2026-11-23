<?php
require_once __DIR__.'/../../bootstrap.php';
method('GET');
user('student');
$id=positive($_GET['company_id']??0);
$file=getrow("SELECT f.stored_name FROM company_files f JOIN companies c ON c.id=f.company_id WHERE c.id=? AND c.verification_status='verified' AND f.purpose='logo' ORDER BY f.id DESC LIMIT 1",[$id]);
if (!$file || !preg_match('/\A[a-f0-9]{48}\.(jpg|png)\z/',$file['stored_name'],$match)) fail('Logo not found.',404);
$path=application_storage().'/'.$file['stored_name'];
if (!is_file($path)||is_link($path)||!($stream=@fopen($path,'rb'))) fail('Logo not found.',404);
header('Content-Type: '.($match[1]==='jpg'?'image/jpeg':'image/png'));
fpassthru($stream);
fclose($stream);
