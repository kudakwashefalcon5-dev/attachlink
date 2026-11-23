<?php
require_once __DIR__.'/../../bootstrap.php';$u=user('employer');method('GET');$id=positive($_GET['application_id']??0);
if(!getrow('SELECT a.id FROM applications a JOIN openings o ON o.id=a.opening_id WHERE a.id=? AND o.company_id=?',[$id,$u['company_id']]))fail('Application not found.',404);
out(['ok'=>true,'documents'=>rows('SELECT id,document_type,original_name,uploaded_at FROM application_documents WHERE application_id=?',[$id])]);
