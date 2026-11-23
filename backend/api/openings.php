<?php
require_once __DIR__.'/../bootstrap.php';method('GET');
$id=(int)($_GET['id']??0);if($id){$o=getrow("SELECT o.*,c.name AS company_name,c.industry FROM openings o JOIN companies c ON o.company_id=c.id WHERE o.id=? AND o.status='published' AND c.verification_status='verified'",[$id]);if(!$o)fail('Opening not found.',404);out(['ok'=>true,'opening'=>$o]);}
$q=trim((string)($_GET['q']??''));$term='%'.$q.'%';
$items=rows("SELECT o.id,o.title,o.city,o.work_mode,o.department,o.deadline,o.created_at,c.id AS company_id,c.name AS company_name FROM openings o JOIN companies c ON c.id=o.company_id WHERE o.status='published' AND (o.deadline IS NULL OR o.deadline>=CURDATE()) AND c.verification_status='verified' AND (?='' OR o.title LIKE ? OR c.name LIKE ? OR o.city LIKE ?) ORDER BY o.created_at DESC LIMIT 100",[$q,$term,$term,$term]);out(['ok'=>true,'openings'=>$items]);
