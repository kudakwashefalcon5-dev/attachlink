<?php
declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;

interface MailTransport {
    public function send(array $job): void;
}

final class LogMailTransport implements MailTransport {
    public function __construct(private string $path) {}

    public function send(array $job): void {
        $line=json_encode(array_intersect_key($job,array_flip(['recipient','subject','body','html_body','message_id'])),JSON_THROW_ON_ERROR)."\n";
        if (@file_put_contents($this->path,$line,FILE_APPEND|LOCK_EX)!==strlen($line)) {
            throw new RuntimeException('Mail log write failed.');
        }
    }
}

final class PhpMailerTransport implements MailTransport {
    public function send(array $job): void {
        require_once __DIR__.'/../../vendor/autoload.php';
        $settings=smtp_settings();
        $mode=$settings['ATTACHLINK_SMTP_TLS'];
        $username=$settings['ATTACHLINK_SMTP_USERNAME'];
        $mail=new PHPMailer(true);
        $mail->isSMTP();
        $mail->Host=$settings['ATTACHLINK_SMTP_HOST'];
        $mail->Helo=$mail->Hostname=$settings['ATTACHLINK_SMTP_EHLO'];
        $mail->Port=(int)$settings['ATTACHLINK_SMTP_PORT'];
        $mail->SMTPSecure=$mode==='implicit'?PHPMailer::ENCRYPTION_SMTPS:PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Timeout=10;
        $mail->SMTPAuth=$username!=='';
        $mail->AuthType=$settings['ATTACHLINK_SMTP_AUTH'];
        $mail->Username=$username;
        $mail->Password=$settings['ATTACHLINK_SMTP_PASSWORD'];
        $mail->CharSet=PHPMailer::CHARSET_UTF8;
        $mail->setFrom($settings['ATTACHLINK_SMTP_FROM'], 'AttachLink');
        $mail->addAddress($job['recipient']);
        $mail->MessageID=$job['message_id'];
        $mail->Subject=$job['subject'];
        if ($job['html_body']) {
            $mail->isHTML(true);
            $mail->Body=$job['html_body'];
            $mail->AltBody=$job['body'];
        } else {
            $mail->Body=$job['body'];
        }
        $mail->send();
    }
}
