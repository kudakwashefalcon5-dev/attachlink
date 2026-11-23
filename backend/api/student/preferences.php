<?php
require_once __DIR__.'/../../bootstrap.php';
$student=user('student');
method('GET','POST');
$id=$student['id'];
if($_SERVER['REQUEST_METHOD']==='POST'){
    $data=body();
    protect($data);
    $visible=$data['recruiter_visible']??null;
    $sectors=$data['sectors']??'';
    $stipend=$data['stipend']??'';
    $model=$data['work_model']??'';
    $relocation=$data['relocation']??'';
    if(!is_bool($visible)||!is_string($sectors)||mb_strlen($sectors)>255||!is_string($model)||mb_strlen($model)>80||!is_string($relocation)||mb_strlen($relocation)>255)fail('Invalid preferences.');
    if(!is_string($stipend)||($stipend!==''&&!preg_match('/\A\d{1,8}(?:\.\d{1,2})?\z/',$stipend)))fail('Invalid stipend.');
    execute('INSERT INTO student_preferences(student_id,recruiter_visible,sectors,stipend,work_model,relocation) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE recruiter_visible=VALUES(recruiter_visible),sectors=VALUES(sectors),stipend=VALUES(stipend),work_model=VALUES(work_model),relocation=VALUES(relocation)',[$id,(int)$visible,trim($sectors),$stipend===''?null:$stipend,trim($model),trim($relocation)]);
}
$preferences=getrow('SELECT recruiter_visible,sectors,stipend,work_model,relocation FROM student_preferences WHERE student_id=?',[$id])??['recruiter_visible'=>1,'sectors'=>'','stipend'=>null,'work_model'=>'','relocation'=>''];
$preferences['recruiter_visible']=(bool)$preferences['recruiter_visible'];
out(['ok'=>true,'preferences'=>$preferences,'sms_configured'=>false]);
