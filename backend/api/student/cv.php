<?php
require_once __DIR__.'/../../bootstrap.php';$u=user('student');
if($_SERVER['REQUEST_METHOD']==='GET')out(['ok'=>true,'cv'=>getrow('SELECT * FROM student_cvs WHERE student_id=?',[$u['id']])]);
method('POST');$a=body();protect($a);
$keys=['full_name','email','phone','location','summary','education','skills','experience','projects','awards'];$vals=[];
foreach($keys as $k){$v=trim((string)($a[$k]??''));if(strlen($v)>12000)fail('CV field too long.');$vals[]=$v;}
if (array_key_exists('layout',$a)) {
    if (!in_array($a['layout'],['classic','modern','executive'],true)) fail('Choose a valid CV layout.',422);
    $keys[]='layout';
    $vals[]=$a['layout'];
}
execute('INSERT INTO student_cvs (student_id,'.implode(',',$keys).') VALUES ('.implode(',',array_fill(0,count($keys)+1,'?')).') ON DUPLICATE KEY UPDATE '.implode(',',array_map(fn($k)=>$k.'=VALUES('.$k.')',$keys)),[$u['id'],...$vals]);
out(['ok'=>true,'message'=>'CV saved to MySQL.']);
