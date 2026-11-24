const {test,expect}=require('@playwright/test');
const {execFileSync}=require('node:child_process');

const base=process.env.ATTACHLINK_LOCATION_TEST_URL;
test.skip(!base,'Set ATTACHLINK_LOCATION_TEST_URL to the local XAMPP development URL.');
test.use({actionTimeout:8000,navigationTimeout:12000});
const phpPath=process.env.ATTACHLINK_TEST_PHP||'C:/xampp/php/php.exe';
const php=(code,args=[])=>execFileSync(phpPath,['-r',`
  require 'backend/config.php';
  if(APP_ENV!=='development'||DB_HOST!=='127.0.0.1'||DB_NAME!=='attachlink_db') exit(2);
  $db=connect_database();
  `+code,...args],{encoding:'utf8'}).trim();
const address=(path)=>new URL(path,base).href;
const apiRoot=path=>address('backend/api/'+path);
const geoLabel="Use my current location (I'm at the office)";

async function api(context,path,{data,status=200,csrf=true}={}) {
  let response;
  if (data) {
    const token=csrf?(await api(context,'auth/csrf.php')).csrf_token:null;
    response=await context.request.post(apiRoot(path),{data:{...data,csrf_token:token}});
  } else response=await context.request.get(apiRoot(path));
  expect(response.status(),path).toBe(status);
  return response.json();
}
async function watchPolicy(context) {
  await context.addInitScript(()=>{
    window.policyViolations=[];
    document.addEventListener('securitypolicyviolation',event=>window.policyViolations.push(event.effectiveDirective));
  });
}
async function verifyHeaders(response) {
  const headers=response.headers();
  expect(headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=(self)');
  expect(headers['content-security-policy']).toContain("img-src 'self' data: blob:;");
}

for(const mode of ['granted','poor','denied','timeout','insecure','away']) {
  test('registration location '+mode,async({browser})=>{
    const context=await browser.newContext();
    try {
      await watchPolicy(context);
      await context.addInitScript(mode=>{
        window.geoCalls=0;
        if(mode==='insecure')Object.defineProperty(window,'isSecureContext',{value:false});
        Object.defineProperty(navigator,'geolocation',{value:{
          getCurrentPosition(success,error,options){
            window.geoCalls++;
            window.geoOptions=options;
            if(mode==='denied'||mode==='timeout')error({code:mode==='denied'?1:3});
            else success({coords:{latitude:-17.82772,longitude:31.05337,accuracy:mode==='poor'?650:45}});
          }
        }});
      },mode);
      const page=await context.newPage();
      const response=await page.goto(address('designs/employers/register.html'));
      await verifyHeaders(response);
      expect(await page.evaluate(()=>window.geoCalls)).toBe(0);
      await page.getByText('Prepare your company location (optional)').click();
      await page.getByLabel('Province',{exact:true}).selectOption({label:'Harare'});
      await page.getByLabel('Town',{exact:true}).selectOption({label:'Harare'});
      if(mode==='away') {
        await page.getByRole('button',{name:"I'm not at the office"}).click();
        await expect(page.getByText('Town-level location selected.')).toBeVisible();
      } else {
        await page.getByRole('button',{name:geoLabel}).click();
      }
      if(mode==='granted'||mode==='poor'){
        await expect(page.getByText('Device location captured.',{exact:false})).toBeVisible();
        await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(1);
        await page.getByRole('button',{name:'Confirm location for later'}).click();
        await expect(page.getByText('Confirm the office pin before continuing.')).toBeVisible();
        await page.getByLabel('I confirm this exact location is the office.').check();
        if(mode==='poor') {
          await expect(page.getByText('Low accuracy.',{exact:false})).toBeVisible();
          await page.getByRole('button',{name:'Confirm location for later'}).click();
          await expect(page.getByText('Confirm the low GPS accuracy or adjust the pin.',{exact:true})).toBeVisible();
          await page.getByLabel('I confirm this result even though',{exact:false}).check();
        }
      }
      if(mode==='denied')await expect(page.getByText('Location permission denied.',{exact:false})).toBeVisible();
      if(mode==='timeout')await expect(page.getByText('The location request timed out.',{exact:false})).toBeVisible();
      if(mode==='insecure')await expect(page.getByText('Device location is unavailable here.',{exact:false})).toBeVisible();
      await page.getByRole('button',{name:'Confirm location for later'}).click();
      await expect(page.getByText('Location ready.',{exact:false})).toBeVisible();
      expect(await page.evaluate(()=>window.geoCalls)).toBe(['away','insecure'].includes(mode)?0:1);
      expect(await page.evaluate(()=>window.policyViolations)).toEqual([]);
    } finally { await context.close(); }
  });
}

test('live employer location validation, publishing, admin review, audit and safe rendering',async({browser})=>{
  const fixture=JSON.parse(php(`
    require 'backend/lib/Accounts.php';
    $db->beginTransaction();
    $seed=bin2hex(random_bytes(8)); $password=bin2hex(random_bytes(20));
    $hash=attachlink_password_hash($password); $companies=[]; $users=[];
    foreach (['employer','other','admin','student'] as $key) {
      $company=null;
      if (in_array($key,['employer','other'],true)) {
        $db->prepare("INSERT INTO companies(name,city,verification_status) VALUES (?,'Legacy address',?)")->execute([
          $key==='employer'?'<img src=x onerror=alert(1)>':'Other location fixture',
          $key==='employer'?'pending':'verified'
        ]);
        $company=(int)$db->lastInsertId(); $companies[$key]=$company;
      }
      $email="$key-$seed@example.test"; $role=$key==='other'?'employer':$key;
      $db->prepare("INSERT INTO users(role,company_id,first_name,last_name,email,password_hash,email_verified_at)
        VALUES (?,?,'Location','Fixture',?,?,NOW())")->execute([$role,$company,$email,$hash]);
      $users[$key]=['id'=>(int)$db->lastInsertId(),'email'=>$email,'role'=>$role];
    }
    $db->prepare("INSERT INTO openings(company_id,title,description,status) VALUES (?,'Legacy published opening','Fixture','published')")->execute([$companies['other']]);
    $legacyOpening=(int)$db->lastInsertId();
    $db->commit(); echo json_encode(compact('companies','users','password','legacyOpening'));
  `));
  const contexts={};
  const location='company-location.php';
  try {
    for(const [key,identity] of Object.entries(fixture.users)){
      const context=contexts[key]=await browser.newContext();
      await watchPolicy(context);
      await api(context,'auth/login.php',{data:{email:identity.email,password:fixture.password,role:identity.role}});
    }
    const {employer,other,admin,student}=contexts;
    const company=fixture.companies.employer;
    const {towns}=await api(employer,'location-towns.php');
    const find=name=>towns.find(town=>town.name===name);
    const harare=find('Harare'), bulawayo=find('Bulawayo'), beitbridge=find('Beitbridge');
    const town=place=>({town_id:place.id,province_id:place.province_id});
    const pin={...town(harare),location_precision:'exact',latitude:'-17.827720',longitude:'31.053370',
      location_source:'employer_gps_once',accuracy_m:45,pin_confirmed:true};
    await api(other,location+'?company_id='+company,{status:403});
    await api(other,location,{data:{...pin,company_id:company},status:403});
    await api(student,location,{data:pin,status:403});
    await api(employer,location,{data:pin,csrf:false,status:403});
    for(const invalid of [{latitude:91},{longitude:181},{latitude:'-17.8277201'},
      {pin_confirmed:false},{accuracy_m:650},{province_id:bulawayo.province_id},
      {latitude:bulawayo.latitude,longitude:bulawayo.longitude}]){
      await api(employer,location,{data:{...pin,...invalid},status:422});
    }
    const warning=await api(employer,location,{data:{...pin,...town(beitbridge),latitude:-22.55,longitude:30}});
    expect(warning.warning).toContain('outside');
    const initial=await api(employer,location,{data:pin});
    expect(initial.location.location_source).toBe('employer_gps_once');
    expect(Number(initial.location.accuracy_m)).toBe(45);
    const identity=fixture.users.employer;
    await api(employer,'auth/login.php',{data:{email:identity.email,password:fixture.password,role:identity.role}});
    expect(await api(employer,location)).toEqual({...initial,warning:undefined});
    await api(admin,'admin/companies.php',{data:{company_id:company,status:'verified'}});
    const proposed=await api(employer,location,{data:town(bulawayo)});
    expect(proposed.location.town_id).toBe(harare.id);
    expect(proposed.pending.town_id).toBe(bulawayo.id);
    const adminPage=await admin.newPage();
    adminPage.on('dialog',dialog=>{throw Error('Company label executed JavaScript: '+dialog.message());});
    await verifyHeaders(await adminPage.goto(address('designs/admin/companies.html')));
    const card=adminPage.locator('li.company-directory-card').filter({hasText:'<img src=x onerror=alert(1)>'});
    await expect(card.locator('h2')).toHaveText('<img src=x onerror=alert(1)>');
    await expect(card.locator('img')).toHaveCount(0);
    await card.locator('summary').click();
    await card.getByRole('button',{name:'Approve location'}).click();
    await expect(card.getByText('Verified location',{exact:false})).toBeVisible();
    const approved=await api(employer,location);
    expect(approved.location.town_id).toBe(bulawayo.id);
    expect(approved.location.location_review_status).toBe('approved');
    const another=await api(employer,location,{data:town(harare)});
    await api(admin,location,{data:{company_id:company,action:'approve',revision:approved.revision},status:409});
    const rejected=await api(admin,location,{data:{company_id:company,action:'reject',revision:another.revision}});
    expect(rejected.location.town_id).toBe(bulawayo.id);
    expect(rejected.pending).toBeNull();
    const draft={title:'Location fixture opening',description:'Test listing',status:'published',
      accommodation:'yes',meal_allowance:'unknown',transport_allowance:'no',remote_option:'hybrid'};
    await api(other,'employer/openings.php',{data:draft,status:422});
    expect((await api(student,'listings/detail.php?id='+fixture.legacyOpening)).listing.title).toBe('Legacy published opening');
    await api(employer,'employer/openings.php',{data:{...draft,remote_option:'invalid'},status:422});
    await api(employer,'employer/openings.php',{data:draft});
    const {openings}=await api(employer,'employer/openings.php');
    expect(openings[0]).toMatchObject({accommodation:'yes',transport_allowance:'no',remote_option:'hybrid'});
    const {events}=await api(admin,'admin/audit-log.php?action=company.location.approve');
    expect(events.some(event=>Number(event.target_id)===company)).toBe(true);
    const profile=await employer.newPage();
    await verifyHeaders(await profile.goto(address('designs/employers/company-profile.html#company-location')));
    const locationPanel=profile.locator('#company-location');
    await locationPanel.getByLabel('Full Google Maps URL or latitude, longitude').fill('https://www.google.com/maps/@-20.15,28.58333,14z');
    await locationPanel.getByRole('button',{name:'Place pasted pin'}).click();
    await expect(locationPanel.getByText('Check and confirm the pasted pin.')).toBeVisible();
    await expect(locationPanel.getByLabel('I confirm this exact location is the office.')).not.toBeChecked();
    await locationPanel.locator('.al-location-map').click({position:{x:100,y:100}});
    await expect(locationPanel.getByLabel('I confirm this exact location is the office.')).toBeVisible();
    expect(await adminPage.evaluate(()=>window.policyViolations)).toEqual([]);
    expect(await profile.evaluate(()=>window.policyViolations)).toEqual([]);
  } finally {
    await Promise.all(Object.values(contexts).map(context=>context.close()));
    php(`
      $companyIds=json_decode($argv[1],true);$userIds=json_decode($argv[2],true);
      foreach ($companyIds as $id) {
        $db->prepare('DELETE FROM admin_audit_log WHERE target_type=? AND target_id=?')->execute(['company',$id]);
        $db->prepare('DELETE FROM company_verification_decisions WHERE company_id=?')->execute([$id]);
      }
      foreach ($userIds as $identity) {
        $db->prepare('DELETE FROM email_outbox WHERE recipient=?')->execute([$identity['email']]);
        $db->prepare('DELETE FROM users WHERE id=?')->execute([$identity['id']]);
      }
      foreach ($companyIds as $id) $db->prepare('DELETE FROM companies WHERE id=?')->execute([$id]);
    `,[JSON.stringify(fixture.companies),JSON.stringify(fixture.users)]);
  }
});
