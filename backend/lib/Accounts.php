<?php
declare(strict_types=1);
require_once __DIR__.'/MailTemplates.php';

function client_ip(): string {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    if (!filter_var($ip, FILTER_VALIDATE_IP)) return '';
    $trusted = array_map('trim', explode(',', getenv('ATTACHLINK_TRUSTED_PROXIES') ?: ''));
    foreach (array_reverse(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '')) as $hop) {
        if (!in_array($ip, $trusted, true)) break;
        $hop = trim($hop);
        if (!filter_var($hop, FILTER_VALIDATE_IP)) return $_SERVER['REMOTE_ADDR'];
        $ip = $hop;
    }
    return $ip;
}

function attempt_limit(array $limits, int $seconds, callable $attempt, ?callable $blocked=null): mixed {
    ksort($limits);
    $pdo = db();

    $pdo->beginTransaction();
    try {
        foreach ($limits as $bucket => $limit) {
            [$limit,$period]=is_array($limit)?$limit:[$limit,$seconds];
            $window=intdiv(time(),$period);
            execute('INSERT INTO login_attempts(bucket,window_id,window_seconds,attempts) VALUES(?,?,?,0) ON DUPLICATE KEY UPDATE attempts=IF(window_id=VALUES(window_id),attempts,0),window_id=VALUES(window_id),window_seconds=VALUES(window_seconds)', [$bucket,$window,$period]);
            if ((int)getrow('SELECT attempts FROM login_attempts WHERE bucket=?', [$bucket])['attempts'] >= $limit) {
                $pdo->rollBack();
                if ($blocked) $blocked($bucket);
                return null;
            }
        }
        $result = $attempt();
        if ($result === false) {
            foreach ($limits as $bucket => $limit) execute('UPDATE login_attempts SET attempts=attempts+1 WHERE bucket=?', [$bucket]);
        }
        $pdo->commit();
        return $result;
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function attempt_limit_reached(array $limits,int $seconds): bool {
    $window=intdiv(time(),$seconds);
    foreach ($limits as $bucket=>$limit) {
        if (getrow('SELECT 1 FROM login_attempts WHERE bucket=? AND window_id=? AND attempts>=?',[$bucket,$window,$limit])) return true;
    }
    return false;
}

function reset_daily_bucket(string $email): string {
    return hash('sha256','forgot-global:'.strtolower($email));
}

function login_account_prefix(?array $account, string $identifier): string {
    return $account ? 'u'.str_pad(dechex((int)$account['id']),16,'0',STR_PAD_LEFT) : 'x'.substr(hash('sha256',$identifier),0,16);
}

function login_dummy_hash(): string {
    return attachlink_password_hash('AttachLink dummy credential');
}

function login_password_matches(?array $account,string $password): bool {
    // Both branches perform a configured hash and one verification.
    $dummy=login_dummy_hash();
    return password_verify($password,$account['password_hash']??$dummy) && $account!==null;
}

function require_verified_email(array $account): void {
    if (!$account['email_verified_at']) fail('Verify your email address before continuing. You can resend the verification email from your account.', 403);
}

function queue_template(string $type,string $recipient,array $data=[],?string $expiry=null): void {
    [$subject,$text,$html]=mail_template($type,$data);
    $host=env_mail_hostname();
    $id='<'.bin2hex(random_bytes(16)).'@'.$host.'>';
    execute('INSERT INTO email_outbox(recipient,subject,body,html_body,expires_at,message_id) VALUES(?,?,?,?,?,?)',
        [$recipient,$subject,$text,$html,$expiry,$id]);
}

function queue_notification_email(int $id,string $type,array $data=[]): bool {
    $recipient=getrow("SELECT u.email,u.role FROM users u LEFT JOIN student_preferences s ON s.student_id=u.id LEFT JOIN employer_preferences e ON e.user_id=u.id WHERE u.id=? AND u.is_active=1 AND u.email_verified_at IS NOT NULL AND COALESCE(s.email_notifications,e.email_notifications,1)=1",[$id]);
    if (!$recipient) return false;
    $data['portal']=match($recipient['role']) {'student'=>'students','employer'=>'employers',default=>'admin'};
    queue_template($type,$recipient['email'],$data);
    return true;
}

function account_link(string $action, string $token): string {
    $base = configured_base_url();
    return $base.'/account-recovery.php?action='.$action.'#token='.$token;
}

function queue_verification(array $account): void {
    require_link_configuration();
    $token = bin2hex(random_bytes(32));
    $expiry = getrow('SELECT NOW() + INTERVAL 1 DAY AS expires')['expires'];
    execute('INSERT INTO email_verifications(token_hash,user_id,expires_at) VALUES(?,?,?)', [hash('sha256',$token),$account['id'],$expiry]);
    queue_template('verify',$account['email'],['url'=>account_link('verify',$token)],$expiry);
}

function account_token(array $input): string {
    $token = $input['token'] ?? '';
    if (!is_string($token) || !preg_match('/\A[a-f0-9]{64}\z/', $token)) fail('This link is invalid or expired.', 422);
    return hash('sha256', $token);
}

function audit_event(int $admin, string $action, string $type, ?int $id, array $detail): void {
    execute('INSERT INTO admin_audit_log(admin_id,action,target_type,target_id,detail) VALUES(?,?,?,?,?)', [$admin,$action,$type,$id,json_encode($detail,JSON_THROW_ON_ERROR)]);
}
