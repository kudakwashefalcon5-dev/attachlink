<?php
require_once __DIR__.'/../bootstrap.php';
$account=user();
method('GET','POST','DELETE');
if(!in_array($account['role'],['employer','admin'],true))fail('Access denied.',403);
$company=$account['role']==='employer'?(int)$account['company_id']:positive($_GET['company_id']??0);
if(!$company)fail('Company not found.',404);
if($_SERVER['REQUEST_METHOD']==='GET'){
    if(isset($_GET['id'])){
        $id=positive($_GET['id']);
        $file=getrow('SELECT stored_name,mime_type,purpose FROM company_files WHERE id=? AND company_id=?',[$id,$company]);
        if(!$file)fail('File not found.',404);
        $name=$file['stored_name'];
        if(!preg_match('/\A[a-f0-9]{48}\.(pdf|jpg|png)\z/',$name,$match))fail('File not found.',404);
        $path=application_storage().'/'.$name;
        if(!is_file($path)||is_link($path))fail('File not found.',404);
        header('Content-Type: '.$file['mime_type']);
        if($file['purpose']==='verification'){
            audit_event((int)$account['id'],'document.download','company_verification_document',$id,['actor_role'=>$account['role'],'company_id'=>$company]);
            header('Content-Disposition: attachment; filename="verification-document.'.$match[1].'"');
        }
        header('Content-Length: '.filesize($path));
        readfile($path);
        exit;
    }
    out(['ok'=>true,'files'=>rows('SELECT id,purpose,original_name,uploaded_at FROM company_files WHERE company_id=? ORDER BY id DESC',[$company])]);
}
if($account['role']!=='employer')fail('Access denied.',403);
if($_SERVER['REQUEST_METHOD']==='DELETE'){
    protect(body());
    $pdo=db();$pdo->beginTransaction();
    getrow('SELECT id FROM companies WHERE id=? FOR UPDATE',[$company]);
    $logos=rows("SELECT stored_name FROM company_files WHERE company_id=? AND purpose='logo'",[$company]);
    execute("DELETE FROM company_files WHERE company_id=? AND purpose='logo'",[$company]);
    $pdo->commit();
    foreach($logos as $logo){
        if(preg_match('/\A[a-f0-9]{48}\.(jpg|png)\z/',$logo['stored_name']))@unlink(application_storage().'/'.$logo['stored_name']);
    }
    out(['ok'=>true,'message'=>'Company logo removed.']);
}
protect($_POST);
$purpose=$_POST['purpose']??'';
if(!in_array($purpose,['logo','verification'],true))fail('Invalid file purpose.');
[$temporary,$original,$mime,$extension]=validate_application_upload($_FILES['file']??null);
if($purpose==='logo'&&(!in_array($mime,['image/jpeg','image/png'],true)||!@getimagesize($temporary)))fail('Logos must be JPG or PNG.',415);
$stored=store_application_upload($temporary,$extension);
$pdo=db();
$previous=[];
try{
    $pdo->beginTransaction();
    getrow('SELECT id FROM companies WHERE id=? FOR UPDATE',[$company]);
    if($purpose==='logo'){
        $previous=rows("SELECT stored_name FROM company_files WHERE company_id=? AND purpose='logo'",[$company]);
        execute("DELETE FROM company_files WHERE company_id=? AND purpose='logo'",[$company]);
    }
    execute('INSERT INTO company_files(company_id,purpose,original_name,stored_name,mime_type) VALUES(?,?,?,?,?)',[$company,$purpose,$original,$stored,$mime]);
    $id=(int)$pdo->lastInsertId();
    $pdo->commit();
}catch(Throwable $error){
    if($pdo->inTransaction())$pdo->rollBack();
    @unlink(application_storage().'/'.$stored);
    throw $error;
}
foreach($previous as $file){
    if(preg_match('/\A[a-f0-9]{48}\.(jpg|png)\z/',$file['stored_name']))@unlink(application_storage().'/'.$file['stored_name']);
}
out(['ok'=>true,'id'=>$id,'message'=>'Company file uploaded.'],201);
