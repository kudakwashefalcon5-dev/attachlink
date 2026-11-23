<?php
require_once __DIR__.'/../../bootstrap.php';
method('GET');
user('admin');
$sql='SELECT id,admin_id,action,target_type,target_id,detail,created_at FROM admin_audit_log WHERE 1=1';
$args=[];
foreach (['action','target_type','admin_id','target_id','before'] as $key) {
    if (!isset($_GET[$key])||$_GET[$key]==='') continue;
    $sql.=match ($key) {'action'=>' AND action=?','target_type'=>' AND target_type=?','admin_id'=>' AND admin_id=?','target_id'=>' AND target_id=?','before'=>' AND id<?'};
    $args[]=in_array($key,['action','target_type'],true)?required($_GET,$key,64):positive($_GET[$key]);
}
$events=rows($sql.' ORDER BY id DESC LIMIT 101',$args);
$more=count($events)>100;
if ($more) array_pop($events);
out(['ok'=>true,'events'=>$events,'next_before'=>$more?end($events)['id']:null]);
