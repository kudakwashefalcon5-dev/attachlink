<?php
declare(strict_types=1);
if (!in_array($_SERVER['REMOTE_ADDR']??'',['127.0.0.1','::1','::ffff:127.0.0.1'],true)) {
    http_response_code(404);
    exit;
}
header('Content-Type: application/json');
echo json_encode(['sapi'=>PHP_SAPI]);
