<?php
declare(strict_types=1);

function mail_template(string $type, array $data=[]): array {
    $base=optional_base_url();
    [$subject,$message,$url,$button,$security]=match($type) {
        'verify'=>['Verify your AttachLink email','Confirm your email address for AttachLink. This link expires in 24 hours.',$data['url'],'Verify email',true],
        'reset'=>['Reset your AttachLink password','A password reset was requested for your AttachLink account. This link expires in one hour.',$data['url'],'Reset password',true],
        'password_changed'=>['Your AttachLink password changed','Your AttachLink password has changed. If you did not make this change, reset your password immediately and contact support.',$base.'/account-recovery.php','Reset password',false],
        'application_status'=>['Application '.$data['status'],'Your application for '.$data['title'].' is now '.$data['status'].'.',$base.'/designs/students/my-applications.html','View applications',false],
        'new_application'=>['New application','A student applied for '.$data['title'].'.',$base.'/designs/employers/opening-applicants.html','View applicants',false],
        'message'=>['New message','You have a new message in your AttachLink inbox.',$base.'/designs/'.$data['portal'].'/messages.html','View messages',false],
        'company_verification'=>['Company verification','Your company verification status is '.$data['status'].'.',$base.'/designs/employers/company-profile.html','View company profile',false],
    };
    if (!$security && $base===null) $url=null;
    $preferences=$base===null?null:$base.'/account-recovery.php?action=settings';
    $ignore=$security?"If you didn't request this, you can ignore this email.":'';
    $text="AttachLink\n\n$message".($url?"\n\n$button: $url":'').($ignore?"\n\n$ignore":'').($preferences?"\n\nEmail preferences: $preferences":'');
    $escape=static fn(string $value): string=>htmlspecialchars($value,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
    $html='<!doctype html><html lang="en"><meta charset="utf-8"><title>'.$escape($subject).'</title><body><h1>AttachLink</h1><p>'.$escape($message).'</p>'
        .($url?'<p><a href="'.$escape($url).'">'.$escape($button).'</a></p>':'')
        .($ignore===''?'':'<p>'.$escape($ignore).'</p>')
        .($preferences?'<footer><a href="'.$escape($preferences).'">Email preferences</a></footer>':'').'</body></html>';
    return [$subject,$text,$html];
}
