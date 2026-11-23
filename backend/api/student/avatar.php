<?php
require_once __DIR__.'/../../bootstrap.php';
$student = user('student');
method('GET','POST','DELETE');
$directory = __DIR__.'/../../storage/avatars';
$path = $directory.'/'.$student['id'].'.jpg';
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (empty($_GET['image'])) out(['ok'=>true,'has_photo'=>is_file($path)]);
    $image = @fopen($path, 'rb');
    if (!$image) fail('Photo not found.',404);
    header('Content-Type: image/jpeg');
    fpassthru($image);
    exit;
}
protect($_POST);
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    if (is_file($path) && !@unlink($path)) fail('Could not remove photo.',500);
    out(['ok'=>true,'has_photo'=>false]);
}
$file = $_FILES['avatar'] ?? null;
if (($file['error'] ?? null) !== UPLOAD_ERR_OK || !is_string($file['tmp_name'] ?? null) || !is_uploaded_file($file['tmp_name'])) fail('Choose a photo.',422);
if ($file['size'] < 1 || $file['size'] > 2*1024*1024) fail('Photos must be smaller than 2 MB.',413);
$info = @getimagesize($file['tmp_name']);
$mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
if (!$info || $info[2] !== IMAGETYPE_JPEG || $mime !== 'image/jpeg' || max($info[0],$info[1]) > 2000) fail('Upload a cropped JPEG photo.',415);
if (!is_dir($directory) && !@mkdir($directory,0700,true) && !is_dir($directory)) fail('Could not save photo.',500);
$temporary = $directory.'/'.bin2hex(random_bytes(24)).'.tmp';
$pdo=db();
$pdo->beginTransaction();
if (!getrow("SELECT id FROM users WHERE id=? AND role='student' AND is_active=1 FOR UPDATE",[$student['id']])) {
    $pdo->rollBack();
    fail('Account not available.',401);
}
if (!move_uploaded_file($file['tmp_name'],$temporary) || !@rename($temporary,$path)) {
    if (is_file($temporary)) @unlink($temporary);
    $pdo->rollBack();
    fail('Could not save photo.',500);
}
$pdo->commit();
out(['ok'=>true,'has_photo'=>true]);
