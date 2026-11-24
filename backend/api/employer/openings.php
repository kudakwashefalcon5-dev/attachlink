<?php
require_once __DIR__.'/../../bootstrap.php';$u=user('employer');$cid=(int)$u['company_id'];if(!$cid)fail('Company missing.',404);
if($_SERVER['REQUEST_METHOD']==='GET')out(['ok'=>true,'openings'=>rows('SELECT * FROM openings WHERE company_id=? ORDER BY created_at DESC',[$cid])]);
method('POST');$a=body();protect($a);
if(isset($a['action']) && $a['action']!=='save'){
 $id=positive($a['listing_id']??0);
 $status=match($a['action']){'submit','reopen'=>'published','close'=>'closed','archive'=>'archived',default=>null};
 if(!$status)fail('Invalid action.');
 if($status==='published')require_verified_email($u);
 $updated=execute("UPDATE openings o JOIN companies c ON c.id=o.company_id SET o.status=? WHERE o.id=? AND o.company_id=? AND (?<>'published' OR c.verification_status='verified')",[$status,$id,$cid,$status]);
 if(!$updated){
  $current=getrow('SELECT o.status,c.verification_status FROM openings o JOIN companies c ON c.id=o.company_id WHERE o.id=? AND o.company_id=?',[$id,$cid]);
  if(!$current)fail('Opening not found.',404);
  if($status==='published'&&$current['verification_status']!=='verified')fail('Company must be verified before publishing openings.',403);
 }
 out(['ok'=>true,'listing_id'=>$id,'message'=>'Opening '.$status.'.']);
}
$id=(int)($a['id']??$a['listing_id']??0);$title=required($a,'title',180);$description=required($a,'description',10000);
$company=getrow('SELECT verification_status FROM companies WHERE id=?',[$cid]);
$existing=$id?getrow('SELECT status,work_mode,department,city,requirements,stipend_usd,available_positions,required_skills,intake_start_month,intake_end_month FROM openings WHERE id=? AND company_id=?',[$id,$cid]):null;
if($id&&!$existing)fail('Opening not found.',404);
$status=(string)($a['status']??$existing['status']??'draft');if(!in_array($status,['draft','published','closed','archived'],true))fail('Invalid status.');
if($status==='published')require_verified_email($u);
if($status==='published'&&$company['verification_status']!=='verified')fail('Company must be verified before publishing openings.',403);
$mode=(string)($a['work_mode']??$existing['work_mode']??'onsite');if(!in_array($mode,['onsite','hybrid','remote'],true))fail('Invalid work mode.');
$deadline=($a['deadline']??$a['closing_date']??'')?:null;
if($deadline!==null && (!is_string($deadline)||!preg_match('/\A(\d{4})-(\d{2})-(\d{2})\z/',$deadline,$date)||!checkdate((int)$date[2],(int)$date[3],(int)$date[1])))fail('Invalid deadline.');
$intakeStart=$existing['intake_start_month']??null;
$intakeEnd=$existing['intake_end_month']??null;
if (array_key_exists('intake_start_month',$a) || array_key_exists('intake_end_month',$a)) {
 $intakeStart=array_key_exists('intake_start_month',$a)?$a['intake_start_month']:$intakeStart;
 if ($intakeStart==='') $intakeStart=null;
 $intakeEnd=null;
 if ($intakeStart!==null) {
  if (!is_string($intakeStart) || !preg_match('/\A([1-9][0-9]{3})-(01|08)\z/',$intakeStart,$month) || $month[1]==='9999') {
   fail('Choose January or August and enter a valid intake year.',422);
  }
  $intakeEnd=((int)$month[1]+1).'-'.$month[2];
 }
 $requestedEnd=$a['intake_end_month']??null;
 if ($requestedEnd!==null && $requestedEnd!=='' && $requestedEnd!==$intakeEnd) {
  fail('Intake end is automatically set 12 months after the start.',422);
 }
}
$stipend=array_key_exists('stipend_usd',$a)?$a['stipend_usd']:($existing['stipend_usd']??null);
if($stipend!==null&&(!is_scalar($stipend)||!preg_match('/\A\d{1,8}(\.\d{1,2})?\z/',(string)$stipend)))fail('Invalid stipend.');
$positions=$a['available_positions']??$existing['available_positions']??null;
if($positions!==null&&(!filter_var($positions,FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>1000]])))fail('Available positions must be between 1 and 1000.');
$skills=$a['required_skills']??$existing['required_skills']??null;
if(is_array($skills)){
 if(count($skills)>30)fail('Enter at most 30 required skills.');
 foreach($skills as $skill){if(!is_string($skill)||trim($skill)===''||mb_strlen($skill)>90||preg_match('/[\r\n]/',$skill))fail('Invalid required skill.');}
 $skills=implode("\n",array_unique(array_map('trim',$skills)));
}elseif(array_key_exists('required_skills',$a)){fail('Required skills must be a list.');}
$params=[$title,trim((string)($a['department']??$existing['department']??'')),trim((string)($a['city']??$existing['city']??'')),$mode,$description,trim((string)($a['requirements']??$existing['requirements']??'')),$deadline,$status,$stipend,$positions,$skills,$intakeStart,$intakeEnd];
if($id){$n=execute('UPDATE openings SET title=?,department=?,city=?,work_mode=?,description=?,requirements=?,deadline=?,status=?,stipend_usd=?,available_positions=?,required_skills=?,intake_start_month=?,intake_end_month=? WHERE id=? AND company_id=?',[...$params,$id,$cid]);if(!$n&&!getrow('SELECT id FROM openings WHERE id=? AND company_id=?',[$id,$cid]))fail('Opening not found.',404);}
else{execute('INSERT INTO openings(title,department,city,work_mode,description,requirements,deadline,status,stipend_usd,available_positions,required_skills,intake_start_month,intake_end_month,company_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[...$params,$cid]);$id=(int)db()->lastInsertId();}
out(['ok'=>true,'id'=>$id,'listing_id'=>$id,'message'=>'Opening saved.']);
