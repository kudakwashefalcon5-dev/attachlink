<?php
require_once __DIR__.'/../../bootstrap.php';
$u=user('student');
method('GET');
out(['ok'=>true,'applications'=>rows('SELECT a.id,a.id AS application_id,a.opening_id,a.opening_id AS listing_id,a.status,a.created_at,a.created_at AS submitted_at,o.title,o.title AS listing_title,o.city AS listing_city,o.status AS listing_status,c.id AS company_id,c.name AS company_name,(c.verification_status=\'verified\' AND EXISTS(SELECT 1 FROM company_files f WHERE f.company_id=c.id AND f.purpose=\'logo\')) AS has_company_logo,c.name AS organization FROM applications a JOIN openings o ON a.opening_id=o.id JOIN companies c ON o.company_id=c.id WHERE a.student_id=? ORDER BY a.created_at DESC',[$u['id']])]);
