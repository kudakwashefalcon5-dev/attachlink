param([string]$BaseUrl='http://127.0.0.1:18743/backend/api', [string]$ParallelBaseUrl, [string]$Php='C:/xampp/php/php.exe', [string]$Mysql='C:/xampp/mysql/bin/mysql.exe', [Parameter(Mandatory=$true)][string]$AdminPassword)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Net.Http
function Client { [System.Net.Http.HttpClient]::new() }
function Call($Client,$Method,$Path,$Expected,$Data=$null){
    $request=[System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($Method),"$BaseUrl/$Path")
    if($Data -is [System.Net.Http.HttpContent]){$request.Content=$Data}
    elseif($null -ne $Data){$request.Content=[System.Net.Http.StringContent]::new(($Data|ConvertTo-Json -Compress),[Text.Encoding]::UTF8,'application/json')}
    $response=$Client.SendAsync($request).GetAwaiter().GetResult()
    $body=$response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    if([int]$response.StatusCode -ne $Expected){throw "$Method $Path expected $Expected, got $([int]$response.StatusCode): $body"}
    if($Expected -eq 200 -and $Path -like 'student/company-logo.php?*'){
        Confirm ($response.Content.Headers.ContentType.MediaType -eq 'image/png' -and $response.Headers.Contains('X-Content-Type-Options') -and $response.Headers.GetValues('X-Content-Type-Options') -contains 'nosniff') 'Logo type and nosniff verified'
    }
    Write-Host "PASS $Method $Path ($Expected)"
    if($response.Content.Headers.ContentType.MediaType -eq 'application/json'){return ($body|ConvertFrom-Json)}
}
function Token($Client){(Call $Client GET auth/csrf.php 200).csrf_token}
function Post($Client,$Path,$Expected,$Data){
    if($Path -eq 'auth/register.php'){ $Data.consent=$true; $Data.consent_version='pilot-2026-11' }
    $Data.csrf_token=Token $Client
    Call $Client POST $Path $Expected $Data
}
function Pack($Client,$Opening,$Invalid=$false,$Omit=''){
    $part=[System.Net.Http.MultipartFormDataContent]::new()
    $part.Add([System.Net.Http.StringContent]::new((Token $Client)),'csrf_token')
    $part.Add([System.Net.Http.StringContent]::new([string]$Opening),'listing_id')
    foreach($field in 'stamped_letter','academic_certificates','national_id','transcript','birth_certificate'){
        if($field -eq $Omit){continue}
        $content=if($Invalid -and $field -eq 'academic_certificates'){'invalid document'}else{"%PDF-1.4`n%%EOF`n"}
        $part.Add([System.Net.Http.ByteArrayContent]::new([Text.Encoding]::ASCII.GetBytes($content)),$field,'test.pdf')
    }
    return ,$part
}
function Confirm($Condition,$Message){if(!$Condition){throw $Message};Write-Host "PASS $Message"}
if ($env:ATTACHLINK_DB_NAME -notmatch '^attachlink_(qa|phase1)[a-z0-9_]*$' -or !$env:ATTACHLINK_MAIL_LOG) {
    throw 'Set ATTACHLINK_DB_NAME to the isolated QA database and ATTACHLINK_MAIL_LOG to the QA mail file.'
}
$env:ATTACHLINK_ENV='development'
$env:ATTACHLINK_MAIL_TRANSPORT='log'
function Flush-Mail {
    & $Php (Join-Path $PSScriptRoot '../backend/jobs/send-emails.php')
    if ($LASTEXITCODE) { throw 'Mail worker failed' }
}
function Mail($Email,$Subject) {
    @(Get-Content -LiteralPath $env:ATTACHLINK_MAIL_LOG | ForEach-Object { $_ | ConvertFrom-Json } |
        Where-Object { $_.recipient -eq $Email -and $_.subject -eq $Subject })
}
function MailToken($Email,$Subject) {
    $last=Mail $Email $Subject | Select-Object -Last 1
    if ($last.body -notmatch '#token=([a-f0-9]{64})(?:\s|$)') {throw "Missing mail token for $Subject"}
    $Matches[1]
}
function Verify($Client,$Email) {
    $null=Post $Client auth/verify-email.php 200 @{token=(MailToken $Email 'Verify your AttachLink email')}
    Confirm ((Call $Client GET auth/me.php 200).user.email_verified_at) 'Email verification persisted'
}
$student=Client
$employer=Client
$admin=Client
$otherEmployer=Client
$secondStudent=Client
$oldSession=Client
$anonymous=Client
$secret='Qa-Account-Only-41769'
$resetSecret='Qa-Account-Reset-41769'
try{
    $id=(Get-Random -Minimum 100000 -Maximum 999998)
    $studentEmail="qa-student-$id@example.invalid"
    $employerEmail="qa-employer-$id@example.invalid"
    $studentRecord=Post $student auth/register.php 201 @{role='student';first_name='QA';last_name='Student';email=$studentEmail;phone="0771${id}";password=$secret}
    $employerRecord=Post $employer auth/register.php 201 @{role='employer';first_name='QA';last_name='Employer';email=$employerEmail;phone="0772${id}";password=$secret;company_name="QA Company $id"}
    $null=Post $student auth/register.php 400 @{role='admin';first_name='QA';last_name='Denied';email="qa-denied-$id@example.invalid";phone="0774${id}";password=$secret}
    $null=Post $student auth/login.php 400 @{role='student'}
    $null=Post $student auth/login.php 401 @{role='student';email="invalid-email-$id";password=$secret}
    $null=Post $student auth/login.php 401 @{role='student';email=$studentEmail;password='wrong'}
    $null=Post $student auth/login.php 403 @{role='student';email=$employerEmail;password=$secret}
    $null=Post $student auth/login.php 403 @{role='student';email='qa-admin@example.invalid';password=$AdminPassword}
    $null=Post $student auth/login.php 403 @{role='employer';email=$studentEmail;password=$secret}
    $null=Post $employer auth/login.php 403 @{role='employer';email='qa-admin@example.invalid';password=$AdminPassword}
    $null=Post $admin auth/login.php 403 @{role='admin';email=$studentEmail;password=$secret}
    $null=Post $admin auth/login.php 403 @{role='admin';email=$employerEmail;password=$secret}
    $null=Call $student GET auth/me.php 401
    $null=Post $student auth/login.php 200 @{role='student';email=$studentEmail;password=$secret}
    $null=Post $employer auth/login.php 200 @{role='employer';email=$employerEmail;password=$secret}
    $otherEmployerRecord=Post $otherEmployer auth/register.php 201 @{role='employer';first_name='QA';last_name='Other';email="qa-other-$id@example.invalid";phone="0773${id}";password=$secret;company_name="QA Other $id"}
    $null=Post $otherEmployer auth/login.php 200 @{role='employer';email="qa-other-$id@example.invalid";password=$secret}
    $adminRecord=Post $admin auth/login.php 200 @{role='admin';email='qa-admin@example.invalid';password=$AdminPassword}
    $null=Call $student GET admin/overview.php 403
    $null=Post $oldSession auth/login.php 200 @{role='student';email=$studentEmail;password=$secret}
    $anonymous.DefaultRequestHeaders.Host='forged.invalid'
    $null=$anonymous.DefaultRequestHeaders.TryAddWithoutValidation('X-Forwarded-Host','also-forged.invalid')
    $null=$anonymous.DefaultRequestHeaders.TryAddWithoutValidation('X-Forwarded-For','203.0.113.29')
    $known=Post $anonymous auth/forgot-password.php 200 @{email=$studentEmail}
    $unknown=Post $anonymous auth/forgot-password.php 200 @{email="qa-unknown-$id@example.invalid"}
    Confirm ($known.message -ceq $unknown.message) 'Password reset response is generic'
    $null=Post $anonymous auth/forgot-password.php 200 @{email=$studentEmail}
    Flush-Mail
    $expiredToken=Mail $studentEmail 'Reset your AttachLink password' | Select-Object -First 1
    if ($expiredToken.body -notmatch '#token=([a-f0-9]{64})(?:\s|$)') { throw 'Reset token fixture missing' }
    $expiredTokenValue=$Matches[1]
    $canonical=$BaseUrl -replace '/backend/api/?$',''
    Confirm ($expiredToken.body.Contains("$canonical/account-recovery.php?action=reset") -and $expiredToken.html_body.Contains($canonical) -and !$expiredToken.body.Contains('forged.invalid')) 'Forged host headers do not change reset links'
    Confirm ($expiredToken.message_id -match '^<[^@]+@[^>]+>$') 'Mail has a stable Message-ID'
    $expiredToken=$expiredTokenValue
    $anonymous.DefaultRequestHeaders.Clear()
    $mysqlArgs=@('--protocol=tcp','-h',$(if($env:ATTACHLINK_DB_HOST){$env:ATTACHLINK_DB_HOST}else{'127.0.0.1'}),'-P',$(if($env:ATTACHLINK_DB_PORT){$env:ATTACHLINK_DB_PORT}else{'3306'}),'-u',$(if($env:ATTACHLINK_DB_USER){$env:ATTACHLINK_DB_USER}else{'root'}),$env:ATTACHLINK_DB_NAME)
    $previousMysqlPwd=$env:MYSQL_PWD
    try {
        $env:MYSQL_PWD=$env:ATTACHLINK_DB_PASS
        $observed=& $Mysql @mysqlArgs -N -e "SELECT requested_ip FROM password_resets WHERE token_hash=SHA2('$expiredToken',256)"
        Confirm ($observed -ne '203.0.113.29' -and $observed) 'Untrusted forwarded IP ignored'
        & $Mysql @mysqlArgs -e "UPDATE password_resets SET expires_at=NOW()-INTERVAL 1 SECOND WHERE token_hash=SHA2('$expiredToken',256)"
        if ($LASTEXITCODE) {throw 'Could not set expired reset fixture'}
    } finally {$env:MYSQL_PWD=$previousMysqlPwd}
    $null=Post $anonymous auth/reset-password.php 422 @{token=$expiredToken;new_password=$resetSecret}
    for($n=0;$n -lt 10;$n++){
        $null=Post $anonymous auth/login.php 401 @{role='student';email=$studentEmail;password='wrong'}
    }
    $null=Post $anonymous auth/login.php 429 @{role='student';email=$studentEmail;password=$secret}
    $resetToken=MailToken $studentEmail 'Reset your AttachLink password'
    $null=Post $anonymous auth/reset-password.php 200 @{token=$resetToken;new_password=$resetSecret}
    $null=Post $anonymous auth/reset-password.php 422 @{token=$resetToken;new_password=$secret}
    $null=Call $student GET auth/me.php 401
    $null=Call $oldSession GET auth/me.php 401
    $null=Post $student auth/login.php 401 @{role='student';email=$studentEmail;password=$secret}
    $null=Post $student auth/login.php 200 @{role='student';email=$studentEmail;password=$resetSecret}
    Confirm $true 'Password reset cleared the exhausted login bucket'
    $null=Post $anonymous auth/forgot-password.php 200 @{email=$studentEmail}
    $null=Post $anonymous auth/forgot-password.php 200 @{email=$studentEmail}
    Flush-Mail
    Confirm (@(Mail $studentEmail 'Reset your AttachLink password').Count -eq 3) 'Forgot-password throttles without exposing account state'
    Confirm (@(Mail "qa-unknown-$id@example.invalid" 'Reset your AttachLink password').Count -eq 0) 'Unknown account received no reset mail'
    for ($n=0;$n -lt 3;$n++) { $null=Post $student auth/resend-verification.php 200 @{} }
    $null=Post $student auth/resend-verification.php 429 @{}
    Flush-Mail
    Confirm (@(Mail $studentEmail 'Verify your AttachLink email').Count -eq 4) 'Registration and resend mail delivered once per request'

    $company=(Call $employer GET employer/company.php 200).company
    $null=Post $employer employer/company.php 200 @{name=$company.name;city='QA City';industry='Design';description='QA business'}
    $verification=[System.Net.Http.MultipartFormDataContent]::new()
    $verification.Add([System.Net.Http.StringContent]::new((Token $employer)),'csrf_token')
    $verification.Add([System.Net.Http.StringContent]::new('verification'),'purpose')
    $verification.Add([System.Net.Http.ByteArrayContent]::new([Text.Encoding]::ASCII.GetBytes("%PDF-1.4`n%%EOF`n")),'file','verification.pdf')
    $companyFile=Call $employer POST company-files.php 201 $verification
    $null=Call $admin GET "company-files.php?company_id=$($company.id)&id=$($companyFile.id)" 200
    $null=Call $student GET "company-files.php?company_id=$($company.id)&id=$($companyFile.id)" 403
    $null=Call $otherEmployer GET "company-files.php?company_id=$($company.id)&id=$($companyFile.id)" 404
    $png=[Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVJkAAAAASUVORK5CYII=')
    $oldLogo=0
    foreach($name in 'logo.png','replacement.png'){
        $logo=[System.Net.Http.MultipartFormDataContent]::new()
        $logo.Add([System.Net.Http.StringContent]::new((Token $employer)),'csrf_token')
        $logo.Add([System.Net.Http.StringContent]::new('logo'),'purpose')
        $logo.Add([System.Net.Http.ByteArrayContent]::new($png),'file',$name)
        $latest=Call $employer POST company-files.php 201 $logo
        $null=Call $employer GET "company-files.php?id=$($latest.id)" 200
        if($oldLogo){$null=Call $employer GET "company-files.php?id=$oldLogo" 404}
        $null=Call $student GET "student/company-logo.php?company_id=$($company.id)" 404
        $oldLogo=$latest.id
    }
    $null=Call $employer DELETE company-files.php 200 @{csrf_token=(Token $employer)}
    $null=Call $employer GET "company-files.php?id=$oldLogo" 404
    $null=Call $admin GET "company-files.php?company_id=$($company.id)&id=$($companyFile.id)" 200
    $null=Post $student student/account.php 200 @{first_name='QA';last_name='Student';phone="0771${id}";bio='QA profile'}
    $prefs=Post $student student/preferences.php 200 @{recruiter_visible=$false;stipend='75.00';sectors='Design'}
    Confirm (!$prefs.preferences.recruiter_visible -and !$prefs.sms_configured) 'Recruiter privacy saved and SMS state reported'
    $null=Post $student admin/setting-entries.php 403 @{category='campus';name='Unauthorized test'}
    $entries=Post $admin admin/setting-entries.php 200 @{category='campus';name="QA campus $id";province='QA Province';phone='+263 1234567'}
    Confirm ($entries.entries.name -contains "QA campus $id") 'Campus settings persisted'
    $entries=Post $admin admin/setting-entries.php 200 @{category='programme';name="QA programme $id";code="QA-$id";faculty='Design';coordinator='QA Coordinator';quota='20';visits='2'}
    $programme=$entries.entries | Where-Object name -eq "QA programme $id"
    $entries=Post $admin admin/setting-entries.php 200 @{category='programme';id=$programme.id;is_active=$false}
    Confirm (($entries.entries | Where-Object id -eq $programme.id).is_active -eq 0) 'Programme setting persisted'
    $null=Post $admin admin/setting-entries.php 400 @{category='intake';name="QA invalid $id";start_date='2027-04-01';end_date='2027-03-01'}
    $entries=Post $admin admin/setting-entries.php 200 @{category='intake';name="QA intake $id";start_date='2027-03-01';end_date='2027-04-01'}
    Confirm ($entries.entries.name -contains "QA intake $id") 'Intake setting persisted'
    $skills=(Post $student student/skills.php 200 @{action='add';category='Design';name='Technical drawing'}).skills
    Confirm ($skills[0].name -eq 'Technical drawing') 'Skill persisted'
    $null=Post $student student/cv.php 200 @{full_name='QA Student';summary='QA CV'}
    Confirm ((Call $student GET student/cv.php 200).cv.summary -eq 'QA CV') 'CV persisted'
    $plan=(Post $student student/interviews.php 200 @{company=$company.name;role='QA Interview';date='2027-02-01';time='09:00';type='Online';duration=30}).plans[0]
    Confirm ($plan.time -eq '09:00') 'Interview plan persisted'
    $null=Call $student DELETE student/interviews.php 200 @{id=$plan.id;csrf_token=(Token $student)}
    $opening=(Post $employer employer/openings.php 200 @{title="QA Opening $id";description='QA vacancy';status='draft';department='Design';city='QA City';requirements='QA requirements';available_positions=1;required_skills=@('Technical drawing','Planning')}).id
    $null=Post $employer employer/openings.php 400 @{id=$opening;title='Invalid';description='QA';available_positions=0}
    $null=Post $otherEmployer employer/openings.php 404 @{id=$opening;title='Unauthorized';description='QA'}
    $null=Post $employer employer/openings.php 403 @{action='submit';listing_id=$opening}
    $null=Post $admin admin/companies.php 200 @{company_id=$company.id;status='verified'}
    $null=Post $employer employer/openings.php 403 @{action='submit';listing_id=$opening}
    Verify $employer $employerEmail
    $null=Post $employer employer/openings.php 200 @{id=$opening;title="QA Opening $id";description='QA vacancy amended'}
    $null=Post $employer employer/openings.php 200 @{action='submit';listing_id=$opening}
    $logo=[System.Net.Http.MultipartFormDataContent]::new()
    $logo.Add([System.Net.Http.StringContent]::new((Token $employer)),'csrf_token')
    $logo.Add([System.Net.Http.StringContent]::new('logo'),'purpose')
    $logo.Add([System.Net.Http.ByteArrayContent]::new($png),'file','logo.png')
    $null=Call $employer POST company-files.php 201 $logo
    $null=Call $student GET "student/company-logo.php?company_id=$($company.id)" 200
    $null=Call $employer GET "student/company-logo.php?company_id=$($company.id)" 403

    $null=Post $employer employer/openings.php 200 @{action='close';listing_id=$opening}
    $null=Call $student GET "listings/detail.php?id=$opening" 404
    $null=Post $employer employer/openings.php 200 @{action='reopen';listing_id=$opening}
    $details=(Call $student GET "listings/detail.php?id=$opening" 200).listing
    Confirm ($details.available_positions -eq 1 -and $details.city -eq 'QA City' -and $details.requirements -eq 'QA requirements' -and $details.required_skills -match 'Technical drawing' -and $details.department -eq 'Design') 'Opening positions, skills and department persisted'
    $null=Call $student GET "listings/detail.php?id=$opening" 200
    $saved=Post $student student/saved-listings.php 200 @{listing_id=$opening;action='save'}
    Confirm ($saved.saved.listing_id -contains $opening) 'Opening saved'
    $null=Call $student POST student/apply-with-documents.php 403 (Pack $student $opening)
    Verify $student $studentEmail
    $null=Call $student POST student/apply-with-documents.php 415 (Pack $student $opening $true)
    $applications=(Call $student GET student/applications.php 200).applications
    Confirm ($applications.Count -eq 0) 'Invalid document pack created no application'
    foreach($field in 'stamped_letter','academic_certificates','national_id','transcript','birth_certificate'){
        $null=Call $student POST student/apply-with-documents.php 422 (Pack $student $opening $false $field)
    }
    $application=Call $student POST student/apply-with-documents.php 201 (Pack $student $opening)
    Confirm ($application.document_count -eq 5) 'All five required documents recorded'
    Confirm ((Call $student GET student/applications.php 200).applications.id -contains $application.application_id) 'Submitted application appears in My Applications'
    $null=Call $student POST student/apply-with-documents.php 409 (Pack $student $opening)
    $documents=(Call $employer GET "employer/documents.php?application_id=$($application.application_id)" 200).documents
    $null=Call $employer GET "documents/download.php?id=$($documents[0].id)" 200
    $null=Call $otherEmployer GET "documents/download.php?id=$($documents[0].id)" 403
    $null=Call $otherEmployer GET "employer/applications.php?application_id=$($application.application_id)" 404
    $null=Call $otherEmployer GET "messages.php?with=$($studentRecord.user_id)" 403
    $null=Post $otherEmployer employer/applicants.php 404 @{application_id=$application.application_id;status='accepted'}
    $null=Post $employer employer/applicants.php 200 @{application_id=$application.application_id;status='accepted';note='Verified QA documents'}
    $secondEmail="qa-second-$id@example.invalid"
    $second=Post $secondStudent auth/register.php 201 @{role='student';first_name='QA';last_name='Second';email=$secondEmail;phone="0775${id}";password=$secret}
    $null=Post $secondStudent auth/login.php 200 @{role='student';email=$secondEmail;password=$secret}
    Flush-Mail
    Confirm (@(Mail $employerEmail 'New application').Count -eq 1) 'New application email delivered'
    Confirm (@(Mail $studentEmail 'Application accepted').Count -eq 1) 'Decision email delivered'
    Verify $secondStudent $secondEmail
    Confirm ((Call $employer GET email-preferences.php 200).email_notifications) 'Email notifications default on'
    $null=Post $employer email-preferences.php 200 @{email_notifications=$false}
    $another=Call $secondStudent POST student/apply-with-documents.php 201 (Pack $secondStudent $opening)
    $null=Post $employer employer/applicants.php 409 @{application_id=$another.application_id;status='accepted'}
    $null=Post $student student/withdraw-application.php 404 @{application_id=$another.application_id}
    $null=Post $student student/withdraw-application.php 409 @{application_id=$application.application_id}
    $null=Call $secondStudent GET "messages.php?with=$($employerRecord.user_id)" 200
    $null=Post $employer employer/applicants.php 200 @{application_id=$another.application_id;status='reviewing'}
    $null=Post $secondStudent messages.php 201 @{recipient_id=$employerRecord.user_id;body='History before withdrawal'}
    $null=Post $secondStudent student/withdraw-application.php 200 @{application_id=$another.application_id}
    $null=Post $secondStudent student/withdraw-application.php 409 @{application_id=$another.application_id}
    $closed=Call $secondStudent GET "messages.php?with=$($employerRecord.user_id)" 200
    Confirm (!$closed.contact.can_send -and $closed.messages[0].body -eq 'History before withdrawal') 'Closed thread history remains read-only'
    $null=Post $secondStudent messages.php 403 @{recipient_id=$employerRecord.user_id;body='Closed conversation'}
    Confirm ((Call $employer GET "employer/applications.php?application_id=$($another.application_id)" 200).events[0].new_status -eq 'withdrawn') 'Withdrawal event recorded'
    Confirm ((Call $employer GET notifications.php 200).notifications.title -contains 'Application withdrawn') 'Employer notified of withdrawal'
    Flush-Mail
    Confirm (@(Mail $employerEmail 'New application').Count -eq 1) 'Employer email preference suppressed delivery'
    $null=Post $employer email-preferences.php 200 @{email_notifications=$true}
    $null=Post $student email-preferences.php 200 @{email_notifications=$false}
    Confirm (!(Call $student GET email-preferences.php 200).email_notifications) 'Student email preference saved'
    $null=Post $student email-preferences.php 200 @{email_notifications=$true}
    $detail=Call $employer GET "employer/applications.php?application_id=$($application.application_id)" 200
    Confirm ($null -eq $detail.application.email -and $null -eq $detail.application.student_city) 'Recruiter-hidden contact fields withheld'
    foreach($field in 'preferred_sectors','preferred_work_model','preferred_relocation','preferred_stipend'){
        Confirm ($null -eq $detail.application.PSObject.Properties[$field]) "$field withheld when recruiter visibility is off"
    }
    $null=Post $student student/preferences.php 200 @{recruiter_visible=$true;stipend='75.00';sectors='Design';work_model='Hybrid';relocation='Harare'}
    $shared=(Call $employer GET "employer/applications.php?application_id=$($application.application_id)" 200).application
    Confirm ($shared.preferred_sectors -eq 'Design' -and $shared.preferred_work_model -eq 'Hybrid' -and $shared.preferred_relocation -eq 'Harare') 'Visible placement preferences shared'
    Confirm ($null -eq $shared.PSObject.Properties['preferred_stipend']) 'Stipend never returned'
    Confirm ($detail.events[0].new_status -eq 'accepted' -and $detail.events[0].note -eq 'Verified QA documents') 'Application decision history persisted'
    $null=Post $admin admin/placements.php 400 @{application_id=$application.application_id;start_date='2027-01-01';end_date='2026-12-31'}
    $null=Post $admin admin/placements.php 200 @{application_id=$application.application_id;start_date='2027-01-01';end_date='2027-04-30'}
    $null=Post $admin admin/placements.php 200 @{application_id=$application.application_id;start_date='2027-01-01';end_date='2027-05-31'}
    $null=Post $employer employer/applicants.php 409 @{application_id=$application.application_id;status='rejected'}
    $null=Post $student messages.php 201 @{recipient_id=$employerRecord.user_id;body='<b>QA message</b>'}
    $null=Post $student messages.php 201 @{recipient_id=$employerRecord.user_id;body='Another unread message'}
    Flush-Mail
    Confirm (@(Mail $employerEmail 'New message').Count -eq 1) 'An existing unread stream within the cooldown suppresses duplicate mail'
    $thread=Call $employer GET "messages.php?with=$($studentRecord.user_id)" 200
    Confirm ((Call $employer GET "messages.php?with=$($studentRecord.user_id)&before=$($thread.messages[0].id)" 200).messages.Count -eq 1) 'Thread cursor excludes the boundary message'
    Confirm ($thread.messages.body -contains '<b>QA message</b>') 'Message stored as text'
    $null=Post $employer messages.php 200 @{action='read';peer_id=$studentRecord.user_id;through_id=$thread.messages[0].id}
    $null=Post $employer messages.php 201 @{recipient_id=$studentRecord.user_id;body='Employer reply'}
    $qaSender=[long]$studentRecord.user_id
    $qaRecipient=[long]$employerRecord.user_id
    $previousMysqlPwd=$env:MYSQL_PWD
    try {
        $env:MYSQL_PWD=$env:ATTACHLINK_DB_PASS
        & $Mysql @mysqlArgs -e "INSERT INTO messages(sender_id,recipient_id,body) SELECT $qaSender,$qaRecipient,'QA pagination fixture' FROM seq_1_to_100"
        if ($LASTEXITCODE) {throw 'Could not insert thread pagination fixtures'}
    } finally {$env:MYSQL_PWD=$previousMysqlPwd}
    $page=Call $employer GET "messages.php?with=$qaSender" 200
    Confirm ($page.messages.Count -eq 100 -and $page.next_before -eq $page.messages[99].id) 'First thread page has an older cursor'
    $older=Call $employer GET "messages.php?with=$qaSender&before=$($page.next_before)" 200
    Confirm ($older.messages.Count -eq 3 -and $null -eq $older.next_before -and $older.messages[0].id -lt $page.next_before) 'Older thread page completes without overlap'

    $null=Post $student messages.php 201 @{recipient_id=$adminRecord.user.id;body='Student support request'}
    $null=Post $employer messages.php 201 @{recipient_id=$adminRecord.user.id;body='Employer support request'}
    $null=Post $admin messages.php 201 @{recipient_id=$studentRecord.user_id;body='Support to student'}
    $null=Post $admin messages.php 201 @{recipient_id=$employerRecord.user_id;body='Support to employer'}
    Confirm ((Call $student GET "messages.php?with=$($adminRecord.user.id)" 200).messages.body -contains 'Support to student') 'Student support thread persisted'
    Confirm ((Call $employer GET "messages.php?with=$($adminRecord.user.id)" 200).messages.body -contains 'Support to employer') 'Employer support thread persisted'
    $contacts=(Call $student GET messages.php 200).contacts
    Confirm (($contacts|Where-Object id -eq $adminRecord.user.id).name -eq 'Support') 'Administrator identity shown as Support'
    Confirm (($contacts|Where-Object id -eq $employerRecord.user_id).name -eq $company.name) 'Company identity shown to student'
    $notifications=(Call $student GET notifications.php 200).notifications
    Confirm ($notifications.title -contains 'Placement recorded') 'Placement notification available'
    $null=Post $student notifications.php 200 @{id=$notifications[0].id}
    $null=Post $admin admin/announcements.php 201 @{title='QA Announcement';message='Message for students';audience='student'}
    Confirm ((Call $student GET notifications.php 200).notifications.title -contains 'QA Announcement') 'Announcement delivered'
    $null=Post $student notifications.php 200 @{action='read_all'}
    $null=Post $admin admin/settings.php 200 @{attachment_months=10;registration_grace='2027-01-01';logbook_cadence='weekly';minimum_stipend='75.00'}
    if ($ParallelBaseUrl) {
        $raceOpening=(Post $employer employer/openings.php 200 @{title="QA capacity race $id";description='One slot';status='published';available_positions=1}).id
        $left=Call $student POST student/apply-with-documents.php 201 (Pack $student $raceOpening)
        $right=Call $secondStudent POST student/apply-with-documents.php 201 (Pack $secondStudent $raceOpening)
        $racer=Client
        try {
            $null=Post $racer auth/login.php 200 @{role='employer';email=$employerEmail;password=$secret}
            $requestA=[System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Post,"$BaseUrl/employer/applicants.php")
            $requestB=[System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Post,"$ParallelBaseUrl/employer/applicants.php")
            $jsonA=@{application_id=$left.application_id;status='accepted';csrf_token=(Token $employer)} | ConvertTo-Json -Compress
            $jsonB=@{application_id=$right.application_id;status='accepted';csrf_token=(Token $racer)} | ConvertTo-Json -Compress
            $requestA.Content=[System.Net.Http.StringContent]::new($jsonA,[Text.Encoding]::UTF8,'application/json')
            $requestB.Content=[System.Net.Http.StringContent]::new($jsonB,[Text.Encoding]::UTF8,'application/json')
            $a=$employer.SendAsync($requestA)
            $b=$racer.SendAsync($requestB)
            $codes=@([int]$a.GetAwaiter().GetResult().StatusCode,[int]$b.GetAwaiter().GetResult().StatusCode) | Sort-Object
            Confirm (($codes -join ',') -eq '200,409') "Parallel acceptance produced one success and one capacity conflict ($codes)"
            $accepted=@((Call $employer GET "employer/applicants.php?opening_id=$raceOpening" 200).applications | Where-Object status -eq 'accepted')
            Confirm ($accepted.Count -eq 1) 'Exactly one concurrent acceptance persisted'
        } finally { $racer.Dispose() }
    }
    $null=Post $student auth/logout.php 200 @{}
    $null=Call $student GET auth/me.php 401
    $null=Post $student auth/login.php 200 @{role='student';email=$studentEmail;password=$resetSecret}
    Confirm ((Call $student GET student/account.php 200).account.bio -eq 'QA profile') 'Profile edits survived logout and login'
    $null=Post $student auth/logout.php 200 @{}
    $null=Post $admin admin/companies.php 200 @{company_id=$company.id;status='rejected'}
    $null=Call $secondStudent GET "student/company-logo.php?company_id=$($company.id)" 404
    $null=Post $admin admin/users.php 200 @{user_id=$second.user_id;is_active=0}
    $null=Post $admin admin/users.php 200 @{user_id=$second.user_id;is_active=1}
    $null=Post $secondStudent admin/verify-user-email.php 403 @{user_id=$otherEmployerRecord.user_id}
    $null=Post $admin admin/verify-user-email.php 200 @{user_id=$otherEmployerRecord.user_id}
    $null=Post $admin admin/verify-user-email.php 200 @{user_id=$otherEmployerRecord.user_id}
    Confirm ((Call $otherEmployer GET auth/me.php 200).user.email_verified_at) 'Administrator verified an account'
    foreach($action in 'user.email_verified','company.verification','placement.create','placement.update','settings.update','settings.entry.create','settings.entry.update','user.status'){
        $events=(Call $admin GET "admin/audit-log.php?action=$action" 200).events
        Confirm ($events.Count -gt 0 -and @($events | Where-Object action -ne $action).Count -eq 0) "Audit filter for $action"
    }
    $null=Call $secondStudent GET admin/audit-log.php 403
    Flush-Mail
    Confirm (@(Mail $employerEmail 'New message').Count -gt 0) 'Message email delivered'
    Confirm (@(Mail $employerEmail 'Company verification').Count -gt 0) 'Verification result email delivered'
    for($n=0;$n -lt 5;$n++){ $null=Post $anonymous auth/login.php 200 @{role='student';email=$studentEmail;password=$resetSecret} }
    for($n=0;$n -lt 6;$n++){ $null=Post $anonymous auth/login.php 401 @{role='student';email=$studentEmail;password='wrong'} }
    $null=Post $anonymous auth/login.php 200 @{role='student';email=$studentEmail;password=$resetSecret}
    for($n=0;$n -lt 10;$n++){ $null=Post $anonymous auth/login.php 401 @{role='student';email=$studentEmail;password='wrong'} }
    $null=Post $anonymous auth/login.php 429 @{role='student';phone="0771${id}";password=$resetSecret}
    Confirm (@(Mail $studentEmail 'Your AttachLink password changed').Count -eq 1) 'Reset queued a security notification'
    $null=Post $secondStudent auth/change-password.php 200 @{current_password=$secret;new_password=$resetSecret}
    Flush-Mail
    Confirm (@(Mail $secondEmail 'Your AttachLink password changed').Count -eq 1) 'Signed-in password change queued a security notification'
    $null=Post $employer employer/openings.php 200 @{action='archive';listing_id=$opening}
    $null=Call $admin GET admin/overview.php 200
    $null=Post $employer auth/logout.php 200 @{}
    $null=Call $employer GET employer/company.php 401
    $null=Post $admin auth/logout.php 200 @{}
    $null=Call $admin GET admin/overview.php 401
} finally { $student.Dispose(); $employer.Dispose(); $admin.Dispose(); $otherEmployer.Dispose(); $secondStudent.Dispose(); $oldSession.Dispose(); $anonymous.Dispose() }
