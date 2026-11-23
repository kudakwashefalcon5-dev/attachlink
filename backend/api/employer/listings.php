<?php
require_once __DIR__.'/../../bootstrap.php';
$u=user('employer');
method('GET','POST');
if($_SERVER['REQUEST_METHOD']==='POST')require __DIR__.'/openings.php';
$data=rows('SELECT o.*,o.deadline AS closing_date FROM openings o WHERE company_id=? ORDER BY created_at DESC,id DESC',[$u['company_id']]);
out(['ok'=>true,'listings'=>$data,'has_more'=>false]);
