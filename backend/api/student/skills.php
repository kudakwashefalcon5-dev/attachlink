<?php
require_once __DIR__.'/../../bootstrap.php';
$student = user('student');
method('GET','POST');
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = body();
    protect($input);
    $action = $input['action'] ?? '';
    if (!in_array($action, ['add','update','delete'], true)) fail('Invalid action.');
    $id = $action === 'add' ? null : positive($input['id'] ?? 0);
    if ($action === 'delete') {
        execute('DELETE FROM student_skills WHERE id=? AND student_id=?', [$id,$student['id']]);
    } else {
        $name = required($input,'name',100);
        $category = required($input,'category',80);
        if ($id === null) execute('INSERT INTO student_skills(student_id,name,category) VALUES(?,?,?)', [$student['id'],$name,$category]);
        else execute('UPDATE student_skills SET name=?,category=? WHERE id=? AND student_id=?', [$name,$category,$id,$student['id']]);
    }
}
out(['ok'=>true,'skills'=>rows('SELECT id,name,category FROM student_skills WHERE student_id=? ORDER BY category,name,id', [$student['id']])]);
