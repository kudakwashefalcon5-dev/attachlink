<?php
require_once __DIR__.'/../../bootstrap.php';
user('student');
method('GET');
out(['ok'=>true,'configured'=>false]);
