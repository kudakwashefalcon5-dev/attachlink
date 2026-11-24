<?php
require_once __DIR__.'/../../bootstrap.php';
user('student');
method('GET');
$page = positive($_GET['page'] ?? 1);
$limit = min(100,positive($_GET['limit'] ?? 30));
if ($page > 100000) fail('Page is out of range.');
$offset = ($page-1)*$limit;
$items = rows("SELECT o.id,o.company_id,o.title,o.city,o.work_mode,o.description,o.requirements,o.stipend_usd,o.deadline AS closing_date,EXISTS(SELECT 1 FROM company_files f WHERE f.company_id=c.id AND f.purpose='logo') AS has_company_logo,c.name AS organization FROM openings o JOIN companies c ON c.id=o.company_id WHERE o.status='published' AND (o.deadline IS NULL OR o.deadline>=CURDATE()) AND c.verification_status='verified' AND EXISTS(SELECT 1 FROM users company_user WHERE company_user.company_id=c.id AND company_user.role='employer' AND company_user.is_active=1) ORDER BY o.created_at DESC,o.id DESC LIMIT ? OFFSET ?", [$limit+1,$offset]);
$more = count($items)>$limit;
if ($more) array_pop($items);
out(['ok'=>true,'listings'=>$items,'has_more'=>$more]);
