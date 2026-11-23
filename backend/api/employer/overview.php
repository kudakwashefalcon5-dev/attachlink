<?php
require_once __DIR__.'/../../bootstrap.php';
$u=user('employer');
method('GET');
$company=getrow('SELECT *,city AS location FROM companies WHERE id=?',[$u['company_id']]);
if(!$company)fail('Company missing.',404);
$listings=getrow("SELECT COUNT(*) AS all_listings,COUNT(CASE WHEN status='published' THEN 1 END) AS published_listings FROM openings WHERE company_id=?",[$u['company_id']]);
$applications=getrow("SELECT COUNT(*) AS total_applications,COUNT(CASE WHEN a.status='submitted' THEN 1 END) AS new_applications,COUNT(CASE WHEN a.status='reviewing' THEN 1 END) AS reviewing,COUNT(CASE WHEN a.status='accepted' THEN 1 END) AS accepted FROM applications a JOIN openings o ON o.id=a.opening_id WHERE o.company_id=?",[$u['company_id']]);
out(['ok'=>true,'user'=>$u,'organization'=>$company,'counts'=>$listings+$applications]);
