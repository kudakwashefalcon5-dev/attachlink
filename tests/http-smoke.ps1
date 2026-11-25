param([string]$BaseUrl='http://localhost/attachlink')
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Net.Http
$handler=New-Object System.Net.Http.HttpClientHandler
$handler.AllowAutoRedirect=$false
$client=New-Object System.Net.Http.HttpClient($handler)
$client.Timeout=[TimeSpan]::FromSeconds(10)
function Request($Method,$Path,$Payload){
    $request=New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::new($Method),"$BaseUrl/$Path")
    if($null -ne $Payload){
        $request.Content=[System.Net.Http.StringContent]::new(($Payload | ConvertTo-Json -Compress),[Text.Encoding]::UTF8,'application/json')
    }
    $response=$client.SendAsync($request).GetAwaiter().GetResult()
    $nosniff=''
    if($response.Headers.Contains('X-Content-Type-Options')){$nosniff=$response.Headers.GetValues('X-Content-Type-Options') -join ', '}
    $cacheControl=''
    if($response.Headers.Contains('Cache-Control')){$cacheControl=$response.Headers.CacheControl.ToString()}
    $result=[pscustomobject]@{Code=[int]$response.StatusCode;Body=$response.Content.ReadAsStringAsync().GetAwaiter().GetResult();Location=$response.Headers.Location;Nosniff=$nosniff;CacheControl=$cacheControl}
    $response.Dispose()
    $request.Dispose()
    $result
}
function Check($Name,$Actual,$Expected){
    if($Actual -ne $Expected){throw "$Name expected $Expected, got $Actual"}
    Write-Host "PASS $Name"
}
try{
    Check 'Home portal redirect' (Request GET '').Code 302
    $asset=Request GET 'assets/attachlink-brand.js'
    Check 'Static asset served' $asset.Code 200
    Check 'Static asset nosniff' $asset.Nosniff 'nosniff'
    Check 'Static asset uses bounded public caching' ($asset.CacheControl -match '\bpublic\b' -and $asset.CacheControl -match '\bmax-age=3600\b' -and $asset.CacheControl -match '\bmust-revalidate\b') $true
    $publicPage=Request GET 'privacy.html'
    Check 'Public HTML is not cached' ($publicPage.CacheControl -match 'no-store') $true
    foreach($portal in 'students','employers','admin'){
        $page=Request GET "designs/$portal/dashboard.html"
        Check "$portal page requires login" $page.Code 302
        Check "$portal page is not cached" ($page.CacheControl -match 'no-store') $true
        Check "$portal page uses nosniff" $page.Nosniff 'nosniff'
    }
    foreach($route in 'auth/me.php','student/avatar.php','student/skills.php','student/applications.php','student/saved-listings.php','employer/overview.php','admin/settings.php','admin/placements.php','messages.php','documents/download.php?id=1'){
        $response=Request GET "backend/api/$route"
        Check "$route requires login" $response.Code 401
        Check "$route is not cached" ($response.CacheControl -match 'no-store') $true
        Check "$route uses nosniff" $response.Nosniff 'nosniff'
    }
    $envResponse=Request GET 'backend/.env'
    Check 'Local environment file denied' ($envResponse.Code -in 403,404) $true
    foreach($path in 'database/schema.sql','docs/DEPLOYMENT.md','vendor/autoload.php','composer.json','composer.lock','package.json','package-lock.json','README.md','tests/http-smoke.ps1','scripts/build-release.py'){
        Check "$path is private" ((Request GET $path).Code -in 403,404) $true
    }
    Check 'Private storage denied' (Request GET 'backend/storage/documents/check.pdf').Code 403
    Check 'Login enforces POST' (Request GET 'backend/api/auth/login.php').Code 405
    Check 'Application enforces POST' (Request GET 'backend/api/student/apply-with-documents.php').Code 405
    Check 'Login requires CSRF' (Request POST 'backend/api/auth/login.php' @{email='qa-invalid@example.invalid';password='wrong';role='student'}).Code 403
    $csrf=(Request GET 'backend/api/auth/csrf.php').Body | ConvertFrom-Json
    Check 'CSRF token length' $csrf.csrf_token.Length 64
    $email="qa-$([guid]::NewGuid().ToString('N'))@example.invalid"
    Check 'Wrong password rejected' (Request POST 'backend/api/auth/login.php' @{email=$email;password='wrong';role='student';csrf_token=$csrf.csrf_token}).Code 401
    Check 'SQL syntax in identifier treated as input' (Request POST 'backend/api/auth/login.php' @{email="qa' OR '1'='1@example.invalid";password='wrong';role='student';csrf_token=$csrf.csrf_token}).Code 401
    Check 'Failed login leaves session anonymous' (Request GET 'backend/api/auth/me.php').Code 401
}finally{$client.Dispose();$handler.Dispose()}
