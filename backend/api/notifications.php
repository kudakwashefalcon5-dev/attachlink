<?php
require_once __DIR__.'/../bootstrap.php';$u=user();
if($_SERVER['REQUEST_METHOD']==='GET'){
 $id=$u['id'];
 $unread=(int)getrow('SELECT COUNT(*) AS total FROM notifications WHERE user_id=? AND is_read=0',[$id])['total'];
 out(['ok'=>true,'unread_count'=>$unread,'notifications'=>rows('SELECT id,title,message,type,is_read,created_at FROM notifications WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 100',[$id])]);
}
method('POST');$a=body();protect($a);
if(($a['action']??'')==='read_all')execute('UPDATE notifications SET is_read=1 WHERE user_id=? AND is_read=0',[$u['id']]);
else execute('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?',[positive($a['id']??0),$u['id']]);
out(['ok'=>true]);
