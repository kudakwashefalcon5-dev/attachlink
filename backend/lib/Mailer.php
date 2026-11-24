<?php
declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;

interface MailTransport {
    public function send(array $job): void;
}

final class LogMailTransport implements MailTransport {
    public function __construct(private string $path) {}

    public function send(array $job): void {
        prepare_private_mail_log($this->path);
        $record=array_intersect_key($job,array_flip(['recipient','subject','body','html_body','message_id']));
        foreach (['subject','body','html_body'] as $field) {
            if (isset($record[$field]) && is_string($record[$field])) $record[$field]=self::redact($record[$field]);
        }
        $record['created_at']=time();
        $line=json_encode($record,JSON_THROW_ON_ERROR|JSON_UNESCAPED_SLASHES)."\n";
        $previous=umask(0077);
        try {
            $file=@fopen($this->path,'c+b');
        } finally {
            umask($previous);
        }
        if ($file===false || is_link($this->path)) {
            if (is_resource($file)) fclose($file);
            throw new RuntimeException('Mail log could not be opened safely.');
        }
        if ((!@chmod($this->path,0600) && PHP_OS_FAMILY!=='Windows') || !flock($file,LOCK_EX)) {
            fclose($file);
            throw new RuntimeException('Mail log permissions or lock could not be secured.');
        }
        try {
            rewind($file);
            $cutoff=time()-86400;
            $retained=[];
            while (($existing=fgets($file))!==false) {
                $entry=json_decode($existing,true);
                if (is_array($entry) && is_int($entry['created_at']??null) && $entry['created_at']>=$cutoff) {
                    $retained[]=$existing;
                }
            }
            if (!rewind($file) || !ftruncate($file,0)) throw new RuntimeException('Mail log rotation failed.');
            foreach ([...$retained,$line] as $entry) {
                self::write_all($file,$entry);
            }
            if (!fflush($file)) throw new RuntimeException('Mail log write failed.');
        } finally {
            flock($file,LOCK_UN);
            fclose($file);
        }
    }

    private static function redact(string $value): string {
        $value=preg_replace_callback('~(?:https?:)?//[^\s<>"\']+|mailto:[^\s<>"\']+~i',static function(array $match): string {
            $url=html_entity_decode($match[0],ENT_QUOTES|ENT_HTML5,'UTF-8');
            $suffix='';
            if (preg_match('~[?&#]token=([^&#\s]+)~i',$url,$token)) {
                $value=rawurldecode($token[1]);
                $suffix='; token ending '.substr($value,-6);
            }
            return '[link redacted'.$suffix.']';
        },$value);
        $value=preg_replace_callback('/(?<![a-f0-9])[a-f0-9]{64}(?![a-f0-9])/i',static function(array $match): string {
            return 'token ending '.substr($match[0],-6);
        },$value);
        return preg_replace_callback('/\btoken\s*[=:]\s*([A-Za-z0-9._~+\/=-]+)/i',static function(array $match): string {
            return 'token ending '.substr($match[1],-6);
        },$value);
    }

    private static function write_all($file,string $bytes): void {
        while ($bytes!=='') {
            $written=fwrite($file,$bytes);
            if (!$written) throw new RuntimeException('Mail log write failed.');
            $bytes=substr($bytes,$written);
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
