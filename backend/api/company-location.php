<?php
declare(strict_types=1);
require_once __DIR__.'/../bootstrap.php';
require_once __DIR__.'/../lib/CompanyLocation.php';
method('GET','POST');
$actor=user();
$admin=$actor['role']==='admin';
if (!$admin && $actor['role']!=='employer') fail('Access denied.',403);
$input=$_SERVER['REQUEST_METHOD']==='POST'?body():$_GET;
$id=$admin?positive($input['company_id']??null):(int)$actor['company_id'];
if (!$id) fail('Company not found.',404);
if (!$admin && isset($input['company_id']) && filter_var($input['company_id'],FILTER_VALIDATE_INT)!==$id) fail('Access denied.',403);
if ($_SERVER['REQUEST_METHOD']==='GET') out(['ok'=>true]+company_location_response($id));

protect($input);
$action=$input['action']??'save';
if (!in_array($action,$admin?['save','approve','reject']:['save'],true)) fail('Invalid location action.',422);
$candidate=null;
$warning=null;
if ($action==='save') [$candidate,$warning]=validate_company_location($input,$admin);

$pdo=db();
$pdo->beginTransaction();
try {
    if (!getrow('SELECT id FROM companies WHERE id=? FOR UPDATE',[$id])) {
        $pdo->rollBack();
        fail('Company not found.',404);
    }
    $before=company_location_response($id);
    if ($action!=='save' && ($input['revision']??null)!==$before['revision']) {
        $pdo->rollBack();
        fail('The location changed. Refresh the page before reviewing it.',409);
    }
    if ($action==='reject') {
        if (!$before['pending']) {
            $pdo->rollBack();
            fail('There is no location proposal to reject.',409);
        }
        execute("UPDATE companies SET location_review_status='rejected' WHERE id=?",[$id]);
    } elseif ($action==='approve') {
        $candidate=$before['pending'];
        if (!$candidate && $before['location']['town_id'] && !$before['location']['location_approved_at']) {
            $candidate=$before['location'];
        }
        if (!$candidate) {
            $pdo->rollBack();
            fail('There is no location awaiting approval.',409);
        }
        store_company_location($id,$candidate,'approved');
    } elseif (!$admin && $before['location']['verification_status']==='verified') {
        $candidate['location_updated_at']=getrow('SELECT NOW() AS updated_at')['updated_at'];
        execute('INSERT INTO company_location_proposals(company_id,details) VALUES(?,?) ON DUPLICATE KEY UPDATE details=VALUES(details)',
            [$id,json_encode($candidate,JSON_THROW_ON_ERROR)]);
        execute("UPDATE companies SET location_review_status='pending' WHERE id=?",[$id]);
    } else {
        store_company_location($id,$candidate,$admin?'approved':'none');
    }
    if ($action!=='save'||$admin||$before['location']['verification_status']!=='verified') {
        execute('DELETE FROM company_location_proposals WHERE company_id=?',[$id]);
    }
    $after=company_location_response($id);
    audit_event((int)$actor['id'],'company.location.'.$action,'company',$id,
        ['actor_role'=>$actor['role'],'old'=>$before,'new'=>$after]);
    $pdo->commit();
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $error;
}
out(['ok'=>true,'warning'=>$warning]+$after);
