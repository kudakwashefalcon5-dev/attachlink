<?php
require_once __DIR__.'/../../bootstrap.php';
$employer=user('employer');
method('GET','POST');
$company=(int)$employer['company_id'];
if(!$company)fail('Company missing.',404);
if($_SERVER['REQUEST_METHOD']==='POST'){
    $input=body();
    protect($input);
    $first=required($input,'first_name',100);
    $last=required($input,'last_name',100);
    $location=$input['location']??'';
    $description=$input['description']??'';
    if(!is_string($location)||mb_strlen($location)>120||!is_string($description)||mb_strlen($description)>10000)fail('Invalid company details.');
    $pdo=db();$pdo->beginTransaction();
    execute('UPDATE users SET first_name=?,last_name=? WHERE id=?',[$first,$last,$employer['id']]);
    execute('UPDATE companies SET city=?,description=? WHERE id=?',[trim($location),trim($description),$company]);
    $pdo->commit();
}
$profile=getrow('SELECT u.first_name,u.last_name,u.email,u.phone,c.id AS organization_id,c.name AS organization_name,c.name AS company_name,c.city AS location,c.description,c.verification_status FROM users u JOIN companies c ON c.id=u.company_id WHERE u.id=?',[$employer['id']]);
out(['ok'=>true,'profile'=>$profile,'message'=>'Profile saved.']);
