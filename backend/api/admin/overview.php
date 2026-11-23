<?php
require_once __DIR__.'/../../bootstrap.php';
user('admin');
method('GET');
$accounts=getrow("SELECT COUNT(CASE WHEN role='student' THEN 1 END) AS students,COUNT(CASE WHEN role='employer' THEN 1 END) AS employers FROM users");
$companies=getrow("SELECT COUNT(CASE WHEN verification_status='pending' THEN 1 END) AS pending,COUNT(CASE WHEN verification_status='verified' THEN 1 END) AS verified_in_database FROM companies");
$openings=getrow("SELECT COUNT(*) AS unexpired_published FROM openings o JOIN companies c ON c.id=o.company_id WHERE o.status='published' AND c.verification_status='verified' AND (o.deadline IS NULL OR o.deadline>=CURDATE())");
$applications=getrow("SELECT COUNT(*) AS total,COUNT(CASE WHEN status='accepted' THEN 1 END) AS accepted,COUNT(CASE WHEN status='submitted' THEN 1 END) AS submitted FROM applications");
$placements=(int)getrow('SELECT COUNT(*) AS n FROM placements')['n'];
$support=(int)getrow("SELECT COUNT(DISTINCT m.sender_id) AS n FROM messages m JOIN users u ON u.id=m.recipient_id WHERE u.role='admin' AND m.is_read=0")['n'];
$counts=$accounts+['companies_pending'=>$companies['pending'],'companies_verified'=>$companies['verified_in_database'],'openings'=>$openings['unexpired_published'],'applications'=>$applications['total'],'accepted_applications'=>$applications['accepted'],'placements'=>$placements,'pending_support_conversations'=>$support];
out(['ok'=>true,'counts'=>$counts,'account_totals'=>$accounts,'organization_totals'=>$companies,'listing_totals'=>$openings,'application_totals'=>$applications]);
