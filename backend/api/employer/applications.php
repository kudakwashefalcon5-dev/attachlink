<?php
require_once __DIR__.'/../../bootstrap.php';
$u=user('employer');
method('GET');
$id=isset($_GET['application_id'])?positive($_GET['application_id']):null;
$preferenceColumns=$id===null?'':',pref.recruiter_visible,pref.sectors AS preferred_sectors,pref.work_model AS preferred_work_model,pref.relocation AS preferred_relocation';
$sql='SELECT a.id AS application_id,a.opening_id AS listing_id,a.status,a.cover_letter,a.created_at AS submitted_at,u.id AS student_id,u.first_name,u.last_name,CASE WHEN COALESCE(pref.recruiter_visible,1)=1 THEN u.email END AS email,p.institution,p.programme,p.study_level,CASE WHEN COALESCE(pref.recruiter_visible,1)=1 THEN p.city END AS student_city,o.title AS listing_title'.$preferenceColumns.' FROM applications a JOIN openings o ON o.id=a.opening_id JOIN users u ON u.id=a.student_id LEFT JOIN student_profiles p ON p.user_id=u.id LEFT JOIN student_preferences pref ON pref.student_id=u.id WHERE o.company_id=?';
if($id===null)out(['ok'=>true,'applications'=>rows($sql.' ORDER BY a.created_at DESC,a.id DESC',[$u['company_id']]),'has_more'=>false]);
$application=getrow($sql.' AND a.id=?',[$u['company_id'],$id]);
if(!$application)fail('Application not found.',404);
if ($application['recruiter_visible']!==null && !(bool)$application['recruiter_visible']) {
    unset($application['preferred_sectors'],$application['preferred_work_model'],$application['preferred_relocation']);
}
unset($application['recruiter_visible']);
$placed=getrow('SELECT id FROM placements WHERE application_id=?',[$id]);
$next=$placed||$application['status']==='withdrawn'?[]:array_values(array_diff(['reviewing','accepted','rejected'],[$application['status']]));
$events=rows('SELECT e.previous_status,e.new_status,e.note,e.created_at,c.name AS changed_by FROM application_status_events e JOIN applications a ON a.id=e.application_id JOIN openings o ON o.id=a.opening_id JOIN companies c ON c.id=o.company_id WHERE e.application_id=? AND c.id=? ORDER BY e.id DESC',[$id,$u['company_id']]);
out(['ok'=>true,'application'=>$application,'allowed_next'=>$next,'events'=>$events]);
