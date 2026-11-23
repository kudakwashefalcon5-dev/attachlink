<?php
require_once __DIR__.'/../../bootstrap.php';
$admin=user('admin');
method('GET','POST');
if($_SERVER['REQUEST_METHOD']==='POST'){
    $data=body();
    protect($data);
    $months=$data['attachment_months']??null;
    $grace=$data['registration_grace']??'';
    $cadence=$data['logbook_cadence']??null;
    $stipend=$data['minimum_stipend']??'';
    if(!in_array($months,[8,10,12],true)||!in_array($cadence,['weekly','fortnightly','monthly'],true))fail('Invalid duration or logbook cadence.');
    if(!is_string($grace)||($grace!==''&&(!preg_match('/\A(\d{4})-(\d{2})-(\d{2})\z/',$grace,$parts)||!checkdate((int)$parts[2],(int)$parts[3],(int)$parts[1]))))fail('Invalid grace date.');
    if(!is_string($stipend)||($stipend!==''&&!preg_match('/\A\d{1,8}(\.\d{1,2})?\z/',$stipend)))fail('Invalid minimum stipend.');
    $pdo=db();$pdo->beginTransaction();
    execute('INSERT INTO system_settings(id,attachment_months,registration_grace,logbook_cadence,minimum_stipend,updated_by) VALUES(1,?,?,?,?,?) ON DUPLICATE KEY UPDATE attachment_months=VALUES(attachment_months),registration_grace=VALUES(registration_grace),logbook_cadence=VALUES(logbook_cadence),minimum_stipend=VALUES(minimum_stipend),updated_by=VALUES(updated_by)',[$months,$grace?:null,$cadence,$stipend===''?null:$stipend,$admin['id']]);
    audit_event((int)$admin['id'],'settings.update','system_settings',1,['attachment_months'=>$months,'registration_grace'=>$grace,'logbook_cadence'=>$cadence,'minimum_stipend'=>$stipend]);
    $pdo->commit();
}
out(['ok'=>true,'settings'=>getrow('SELECT attachment_months,registration_grace,logbook_cadence,minimum_stipend FROM system_settings WHERE id=1')]);
