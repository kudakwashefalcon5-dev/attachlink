<?php
require __DIR__.'/../backend/config.php';
require __DIR__.'/../backend/lib/Accounts.php';
$account=['password_hash'=>attachlink_password_hash('Known fixture password')];
$known=[];
$unknown=[];
for ($i=0;$i<8;$i++) {
    foreach ($i%2 ? [null,$account] : [$account,null] as $fixture) {
        $start=hrtime(true);
        if (login_password_matches($fixture,'Incorrect fixture password')) exit(1);
        $elapsed=hrtime(true)-$start;
        if ($fixture) $known[]=$elapsed; else $unknown[]=$elapsed;
    }
}
sort($known);
sort($unknown);
$ratio=$unknown[4]/$known[4];
printf("Known %.1f ms, unknown %.1f ms, ratio %.3f\n",$known[4]/1e6,$unknown[4]/1e6,$ratio);
exit($ratio<0.8||$ratio>1.25?1:0);
