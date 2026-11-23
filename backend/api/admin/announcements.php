<?php
require_once __DIR__.'/../../bootstrap.php';
user('admin');
method('POST');
$data=body();
protect($data);
$title=required($data,'title',180);
$message=required($data,'message',2000);
$audience=$data['audience']??'all';
if(!in_array($audience,['all','student','employer'],true))fail('Invalid announcement audience.');
$count=execute("INSERT INTO notifications(user_id,title,message,type) SELECT id,?,?,'announcement' FROM users WHERE is_active=1 AND role IN ('student','employer') AND (?='all' OR role=?)",[$title,$message,$audience,$audience]);
out(['ok'=>true,'recipient_count'=>$count],201);
