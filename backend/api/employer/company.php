<?php
require_once __DIR__.'/../../bootstrap.php';$u=user('employer');$id=(int)$u['company_id'];if(!$id)fail('Company missing.',404);
if($_SERVER['REQUEST_METHOD']==='POST'){
 $a=body();protect($a);$name=required($a,'name',180);
 execute('UPDATE companies SET name=?,description=?,website=?,industry=?,city=? WHERE id=?',[$name,trim((string)($a['description']??'')),trim((string)($a['website']??'')),trim((string)($a['industry']??'')),trim((string)($a['city']??'')),$id]);
}else method('GET');
out(['ok'=>true,'company'=>getrow('SELECT id,name,description,website,industry,city,verification_status FROM companies WHERE id=?',[$id])]);
