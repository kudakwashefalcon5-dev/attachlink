<?php
require_once __DIR__.'/../../bootstrap.php';
user('student');
method('GET');
$id = positive($_GET['id'] ?? 0);
$listing = getrow("SELECT o.*,o.deadline AS closing_date,EXISTS(SELECT 1 FROM company_files f WHERE f.company_id=c.id AND f.purpose='logo') AS has_company_logo,c.name AS organization,c.description AS organization_description,c.city AS organization_location,c.website AS organization_website FROM openings o JOIN companies c ON c.id=o.company_id WHERE o.id=? AND o.status='published' AND c.verification_status='verified' AND EXISTS(SELECT 1 FROM users company_user WHERE company_user.company_id=c.id AND company_user.role='employer' AND company_user.is_active=1)", [$id]);
if (!$listing) fail('Opening not found.',404);
out(['ok'=>true,'listing'=>$listing]);
