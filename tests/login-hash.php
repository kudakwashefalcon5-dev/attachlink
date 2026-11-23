<?php
declare(strict_types=1);
require __DIR__.'/../backend/config.php';
require __DIR__.'/../backend/lib/Accounts.php';
$dummy=password_get_info(login_dummy_hash());
$production=password_get_info(attachlink_password_hash('QA production password'));
if ($dummy['algoName']!=='bcrypt'||$dummy!==$production||$dummy['options']['cost']!==PASSWORD_BCRYPT_COST) exit(1);
if (login_password_matches(null,'AttachLink dummy credential')) exit(1);
printf("PASSED unknown-account dummy and production hashes both use bcrypt cost %d.\n",PASSWORD_BCRYPT_COST);
