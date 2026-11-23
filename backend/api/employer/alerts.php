<?php
require_once __DIR__.'/../../bootstrap.php';
$employer=user('employer');
method('GET');
$messages=rows("SELECT m.sender_id AS peer_id,'message' AS type,'New message' AS title,m.created_at AS detail FROM messages m WHERE m.recipient_id=? AND m.is_read=0 ORDER BY m.id DESC LIMIT 10",[$employer['id']]);
$applications=rows("SELECT a.id,'application' AS type,o.title,a.status AS detail FROM applications a JOIN openings o ON o.id=a.opening_id WHERE o.company_id=? ORDER BY a.id DESC LIMIT 10",[$employer['company_id']]);
$unread=getrow('SELECT COUNT(*) AS total FROM messages WHERE recipient_id=? AND is_read=0',[$employer['id']]);
out(['ok'=>true,'unread_messages'=>(int)$unread['total'],'messages'=>$messages,'applications'=>$applications]);
