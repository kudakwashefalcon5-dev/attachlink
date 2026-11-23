<?php
require_once __DIR__.'/../../bootstrap.php';
$admin=user('admin');
method('GET','POST');
if($_SERVER['REQUEST_METHOD']==='POST'){
    $data=body();
    protect($data);
    $category=$data['category']??'';
    $fields=match($category){
        'campus'=>['province'=>120,'phone'=>40],
        'programme'=>['code'=>40,'faculty'=>140,'coordinator'=>180,'quota'=>6,'visits'=>3],
        'intake'=>['start_date'=>10,'end_date'=>10],
        default=>[]
    };
    if(!$fields)fail('Invalid configuration category.');
    if(isset($data['id'])){
        if($category!=='programme'||!is_bool($data['is_active']??null))fail('Invalid update.');
        $pdo=db();$pdo->beginTransaction();
        if (execute("UPDATE admin_setting_entries SET is_active=? WHERE id=? AND category='programme'",[(int)$data['is_active'],positive($data['id'])])) audit_event((int)$admin['id'],'settings.entry.update','setting_entry',(int)$data['id'],['category'=>$category,'is_active'=>$data['is_active']]);
        $pdo->commit();
    }else{
        $name=required($data,'name',180);
        $details=[];
        foreach($fields as $key=>$max)$details[$key]=required($data,$key,$max);
        if($category==='intake'){
            foreach($details as $date){
                $parsed=DateTimeImmutable::createFromFormat('!Y-m-d',$date);
                if(!$parsed||$parsed->format('Y-m-d')!==$date)fail('Use valid YYYY-MM-DD dates.');
            }
            if($details['start_date']>$details['end_date'])fail('Closing date must follow the start date.');
        }
        if($category==='programme'&&(!ctype_digit($details['quota'])||!ctype_digit($details['visits'])))fail('Quota and visits must be whole numbers.');
        if($category==='campus'&&!preg_match('/\A[+\d() .-]{5,40}\z/',$details['phone']))fail('Invalid switchboard number.');
        try{$pdo=db();$pdo->beginTransaction();execute('INSERT INTO admin_setting_entries(category,name,details,created_by) VALUES(?,?,?,?)',[$category,$name,json_encode($details,JSON_THROW_ON_ERROR),$admin['id']]);
            audit_event((int)$admin['id'],'settings.entry.create','setting_entry',(int)$pdo->lastInsertId(),['category'=>$category]);
            $pdo->commit();
        }
        catch(PDOException $error){if($pdo->inTransaction())$pdo->rollBack();if(($error->errorInfo[1]??null)===1062)fail('A record with this name already exists.',409);throw $error;}
    }
}
$entries=rows('SELECT id,category,name,details,is_active FROM admin_setting_entries ORDER BY category,name');
foreach($entries as &$entry)$entry['details']=json_decode($entry['details'],true,512,JSON_THROW_ON_ERROR);
unset($entry);
out(['ok'=>true,'entries'=>$entries]);
