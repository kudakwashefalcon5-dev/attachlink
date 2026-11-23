<?php
require_once __DIR__.'/../bootstrap.php';
$account=user();
$me=(int)$account['id'];
method('GET','POST');
$writable="(v.role='admin' OR u.role='admin' OR (v.role<>u.role AND EXISTS (
 SELECT 1 FROM applications a JOIN openings o ON o.id=a.opening_id
 WHERE a.student_id=IF(v.role='student',v.id,u.id)
 AND o.company_id=IF(v.role='employer',v.company_id,u.company_id)
 AND a.status IN ('submitted','reviewing','accepted')
 )))";
$contactsSql="
 SELECT u.id,u.role,CASE u.role WHEN 'admin' THEN 'Support' WHEN 'employer' THEN COALESCE(c.name,'Company')
 ELSE CONCAT_WS(' ',u.first_name,u.last_name) END AS name, $writable AS can_send,
 (SELECT COUNT(*) FROM messages m WHERE m.sender_id=u.id AND m.recipient_id=v.id AND m.is_read=0) AS unread
 FROM users v JOIN users u ON u.id<>v.id AND u.is_active=1
 LEFT JOIN companies c ON c.id=u.company_id
 WHERE v.id=? AND ($writable OR EXISTS (
 SELECT 1 FROM messages h WHERE (h.sender_id=v.id AND h.recipient_id=u.id) OR (h.sender_id=u.id AND h.recipient_id=v.id)
 ))";
if ($_SERVER['REQUEST_METHOD']==='GET') {
    if (!isset($_GET['with'])) {
        out(['ok'=>true,'role'=>$account['role'],'contacts'=>rows($contactsSql.' ORDER BY u.id DESC',[$me])]);
    }
    $peer=positive($_GET['with']);
    $contact=getrow($contactsSql.' AND u.id=?',[$me,$peer]);
    if (!$contact) fail('Conversation unavailable.',403);
    $before=isset($_GET['before'])?positive($_GET['before']):null;
    $args=[$me,$peer,$peer,$me];
    if ($before!==null) $args[]=$before;
    $messages=rows('SELECT id,sender_id,recipient_id,body,created_at FROM messages WHERE ((sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?))'
        .($before===null?'':' AND id<?').' ORDER BY id DESC LIMIT 101',$args);
    $more=count($messages)>100;
    if ($more) array_pop($messages);
    out(['ok'=>true,'me_id'=>$me,'contact'=>$contact,'messages'=>$messages,'next_before'=>$more?end($messages)['id']:null]);
}
$data=body();
protect($data);
$read=($data['action']??'')==='read';
$peer=positive($data[$read?'peer_id':'recipient_id']??0);
$contact=getrow($contactsSql.' AND u.id=?',[$me,$peer]);
if (!$contact || (!$read && !$contact['can_send'])) fail('Conversation unavailable.',403);
if ($read) {
    $through=positive($data['through_id']??0);
    execute('UPDATE messages SET is_read=1 WHERE sender_id=? AND recipient_id=? AND id<=?',[$peer,$me,$through]);
    out(['ok'=>true]);
}
$message=required($data,'body',1000);
$pdo=db();
$pdo->beginTransaction();
if ($account['role']!=='admin') {
    $recipient=getrow('SELECT role,company_id FROM users WHERE id=? AND is_active=1',[$peer]);
    if (!$recipient || ($recipient['role']!=='admin' && !getrow(
        "SELECT a.id FROM applications a JOIN openings o ON o.id=a.opening_id WHERE a.student_id=? AND o.company_id=? AND a.status IN ('submitted','reviewing','accepted') LIMIT 1 FOR UPDATE",
        $account['role']==='student'?[$me,$recipient['company_id']]:[$peer,$account['company_id']]
    ))) {
        $pdo->rollBack();
        fail('Conversation unavailable.',403);
    }
}
execute('INSERT IGNORE INTO message_email_limits(recipient_id) VALUES(?)',[$peer]);
$limit=getrow('SELECT queued_at > NOW()-INTERVAL 15 MINUTE AS recent FROM message_email_limits WHERE recipient_id=? FOR UPDATE',[$peer]);
$unread=getrow('SELECT id FROM messages WHERE recipient_id=? AND is_read=0 LIMIT 1 FOR UPDATE',[$peer]);
execute('INSERT INTO messages(sender_id,recipient_id,body) VALUES(?,?,?)',[$me,$peer,$message]);
$id=(int)$pdo->lastInsertId();
notify($peer,'New message','You received a new message on AttachLink.','message');
if ((!$unread || !$limit['recent']) && queue_notification_email($peer,'message')) {
    execute('UPDATE message_email_limits SET queued_at=NOW() WHERE recipient_id=?',[$peer]);
}
$pdo->commit();
out(['ok'=>true,'message_id'=>$id],201);
