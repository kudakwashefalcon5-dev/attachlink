<?php
require_once __DIR__.'/../bootstrap.php';
$account=user();
if (!in_array($account['role'],['student','employer'],true)) fail('Access denied.',403);
method('GET','POST');
$student=$account['role']==='student';
if ($_SERVER['REQUEST_METHOD']==='POST') {
    $data=body();
    protect($data);
    if (!is_bool($data['email_notifications']??null)) fail('Invalid email notification preference.');
    $sql=$student
        ? 'INSERT INTO student_preferences(student_id,email_notifications) VALUES(?,?) ON DUPLICATE KEY UPDATE email_notifications=VALUES(email_notifications)'
        : 'INSERT INTO employer_preferences(user_id,email_notifications) VALUES(?,?) ON DUPLICATE KEY UPDATE email_notifications=VALUES(email_notifications)';
    execute($sql,[$account['id'],(int)$data['email_notifications']]);
}
$sql=$student?'SELECT email_notifications FROM student_preferences WHERE student_id=?':'SELECT email_notifications FROM employer_preferences WHERE user_id=?';
out(['ok'=>true,'email_notifications'=>(bool)(getrow($sql,[$account['id']])['email_notifications']??1)]);
