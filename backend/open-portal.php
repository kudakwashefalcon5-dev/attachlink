<?php
require_once __DIR__.'/bootstrap.php';
method('GET');
$directory = ['student'=>'students','employer'=>'employers','admin'=>'admin'][user()['role']];
header('Location: ../designs/'.$directory.'/dashboard.html', true, 302);
exit;
