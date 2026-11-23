<?php
require_once __DIR__.'/../../bootstrap.php';
$student=user('student');
method('GET','POST','DELETE');
$studentId=$student['id'];
if($_SERVER['REQUEST_METHOD']!=='GET'){
    $input=body();
    protect($input);
    $id=isset($input['id'])?positive($input['id']):null;
    if($_SERVER['REQUEST_METHOD']==='DELETE'){
        if($id===null)fail('Invalid interview ID.');
        execute('DELETE FROM student_interview_plans WHERE student_id=? AND id=?',[$studentId,$id]);
    }else{
        $company=required($input,'company',180);
        $role=required($input,'role',180);
        $date=required($input,'date',10);
        $time=required($input,'time',5);
        $type=required($input,'type',40);
        $duration=positive($input['duration']??30);
        $venue=$input['venue']??'';
        $notes=$input['notes']??'';
        if(!preg_match('/\A(\d{4})-(\d{2})-(\d{2})\z/',$date,$parts)||!checkdate((int)$parts[2],(int)$parts[3],(int)$parts[1])||!preg_match('/\A(?:[01]\d|2[0-3]):[0-5]\d\z/',$time))fail('Invalid interview date or time.');
        if($duration>1440||!is_string($venue)||mb_strlen($venue)>255||!is_string($notes)||mb_strlen($notes)>4000)fail('Invalid interview details.');
        $values=[$company,$role,$date,$time,$type,$duration,$venue,$notes];
        if($id===null)execute('INSERT INTO student_interview_plans(company,role_name,interview_date,interview_time,interview_type,duration,venue,notes,student_id) VALUES(?,?,?,?,?,?,?,?,?)',[...$values,$studentId]);
        else execute('UPDATE student_interview_plans SET company=?,role_name=?,interview_date=?,interview_time=?,interview_type=?,duration=?,venue=?,notes=? WHERE student_id=? AND id=?',[...$values,$studentId,$id]);
    }
}
out(['ok'=>true,'plans'=>rows("SELECT id,company,role_name AS role,interview_date AS date,TIME_FORMAT(interview_time,'%H:%i') AS time,interview_type AS type,duration,venue,notes FROM student_interview_plans WHERE student_id=? ORDER BY interview_date,interview_time,id",[$studentId])]);
