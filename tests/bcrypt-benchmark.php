<?php
declare(strict_types=1);
require __DIR__.'/../backend/config.php';
$hash=attachlink_password_hash('Benchmark fixture password');
$samples=[];
for ($i=0;$i<15;$i++) {
    $start=hrtime(true);
    if (!password_verify('Benchmark fixture password',$hash)) exit(1);
    $samples[]=(hrtime(true)-$start)/1e6;
}
sort($samples);
printf("bcrypt cost %d; verify median %.1f ms, p95 %.1f ms (%d samples)\n",PASSWORD_BCRYPT_COST,$samples[7],$samples[14],count($samples));
