const {test, expect} = require('@playwright/test');
const {execFileSync} = require('node:child_process');
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');

const api = '/backend/api/';
const secret = 'Browser fixture password 9!';
const nextSecret = 'Changed browser fixture 10!';
const adminSecret = process.env.ATTACHLINK_QA_ADMIN_PASSWORD;
const mailFile = process.env.ATTACHLINK_MAIL_LOG;

async function request(page, route, data) {
    let response;
    if (data) {
        const token = await page.request.get(api+'auth/csrf.php');
        const {csrf_token} = await token.json();
        response = await page.request.post(api+route,{data:{...data,csrf_token}});
    } else {
        response = await page.request.get(api+route);
    }
    expect(response.ok(), route+': '+await response.text()).toBeTruthy();
    return response.json();
}

async function signIn(page, role, email, password) {
    await page.goto('/designs/students/login.html?role='+role);
    await page.getByLabel('Email',{exact:true}).fill(email);
    await page.getByLabel('Password',{exact:true}).fill(password);
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    const folder = {admin:'admin',employer:'employers',student:'students'}[role];
    await expect(page).toHaveURL(new RegExp('/designs/'+folder+'/dashboard.html'));
}

function mailLink(email, subject) {
    execFileSync(process.env.ATTACHLINK_QA_PHP || 'C:/xampp/php/php.exe',['backend/jobs/send-emails.php'],{stdio:'pipe'});
    const messages = fs.readFileSync(mailFile,'utf8').trim().split(/\r?\n/).map(line=>JSON.parse(line));
    const record = messages.findLast(mail=>mail.recipient===email&&mail.subject===subject);
    expect(record?.html_body).toContain('Email preferences');
    return record.body.match(/https?:\/\/[^\s]+#token=[a-f0-9]{64}/)[0];
}

async function verify(page, email) {
    await page.goto(mailLink(email,'Verify your AttachLink email'));
    await page.getByRole('button',{name:'Verify email',exact:true}).click();
    await expect(page.locator('#account-status')).toHaveText('Email verified.');
}

async function apply(page, opening, throttled) {
    await page.goto('/designs/students/attachment-details.html?id='+opening);
    const fields = ['stamped_letter','cv','national_id','transcript','o_level'];
    const file = {name:'fixture.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n%'+ '0'.repeat(20000)+'\n%%EOF\n')};
    const applyButton = page.locator('#listing-apply');
    if (throttled) {
        await page.locator('input[name="stamped_letter"]').setInputFiles({...file,name:'fixture.txt',mimeType:'text/plain'});
        for (const field of fields.slice(1)) await page.locator('input[name="'+field+'"]').setInputFiles(file);
        await applyButton.click();
        await expect(page.locator('#application-feedback')).toContainText('must be a PDF, JPG or PNG');
        await page.locator('input[name="stamped_letter"]').setInputFiles({...file,buffer:Buffer.alloc(5*1024*1024+1)});
        await applyButton.click();
        await expect(page.locator('#application-feedback')).toContainText('must be between 1 byte and 5 MB');
    }
    for (const field of fields) await page.locator('input[name="'+field+'"]').setInputFiles(file);
    const device = throttled ? await page.context().newCDPSession(page) : null;
    if (device) {
        await device.send('Network.enable');
        await device.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:128000,uploadThroughput:24000,connectionType:'cellular3g'});
    }
    try {
        await applyButton.click();
        if (throttled) await expect(page.getByLabel('Application upload progress')).toBeVisible();
        await expect(page.locator('#application-feedback')).toContainText('submitted with 5 private documents',{timeout:20000});
    } finally {
        await device?.detach();
    }
}

test('three portals complete the attachment and account recovery workflow', async ({browser},testInfo) => {
    expect(process.env.ATTACHLINK_DB_NAME).toMatch(/^attachlink_(qa|phase1)[a-z0-9_]*$/);
    expect(adminSecret && mailFile).toBeTruthy();
    const baseURL = testInfo.project.use.baseURL;
    const [student,employer,admin]=await Promise.all(Array.from({length:3},async()=> (await browser.newContext({baseURL})).newPage()));
    const suffix=crypto.randomInt(100000,999999);
    const studentEmail='browser-student-'+suffix+'@example.invalid';
    const employerEmail='browser-company-'+suffix+'@example.invalid';
    const company='Browser Company '+suffix;
    await student.goto('/designs/students/register.html');
    for (const [field,value] of Object.entries({fullName:'Browser Student',dateOfBirth:'2004-03-14',phone:'0776'+suffix,
        email:studentEmail,institution:'University QA',programme:'Engineering',password:secret,confirmPassword:secret})) {
        await student.locator('#'+field).fill(value);
    }
    await student.locator('#gender').selectOption('Prefer not to say');
    await student.locator('#academicLevel').selectOption('Degree');
    await student.locator('#registrationConsent').check();
    await student.locator('#registrationForm button[type="submit"]').click();
    await expect(student.locator('#registrationMessage')).toContainText('Account created');
    await employer.goto('/designs/employers/register.html');
    for (const [name,value] of Object.entries({company_name:company,first_name:'Browser',last_name:'Employer',email:employerEmail,phone:'0777'+suffix,password:secret})) {
        await employer.locator('[name="'+name+'"]').fill(value);
    }
    await employer.locator('[name=consent]').check();
    await employer.locator('#company-registration button[type="submit"]').click();
    await expect(employer.locator('#company-status')).toContainText('Account created');
    await signIn(student,'student',studentEmail,secret);
    const studentRecord={user_id:(await request(student,'auth/me.php')).user.id};
    await signIn(employer,'employer',employerEmail,secret);
    await signIn(admin,'admin','qa-admin@example.invalid',adminSecret);
    await expect(student.getByRole('button',{name:'Resend verification email'})).toBeVisible();
    await expect(employer.getByRole('button',{name:'Resend verification email'})).toBeVisible();
    await student.getByRole('button',{name:'Resend verification email'}).click();
    await expect(student.locator('#verify-email-banner [role=status]')).toHaveText('Verification email queued.');
    await verify(student,studentEmail);
    await verify(employer,employerEmail);
    admin.on('dialog',dialog=>dialog.accept());
    await admin.goto('/designs/admin/verification-queue.html');
    await admin.locator('.submission-row').filter({hasText:company}).click();
    await admin.locator('#liaison-endorsement-notes').fill('Browser QA confirmed company identity.');
    await admin.getByRole('button',{name:/Approve record/i}).click();
    await expect(admin.locator('.submission-row').filter({hasText:company})).toHaveCount(0);
    await admin.goto('/designs/admin/system-settings.html');
    await expect(admin.getByRole('heading',{name:'System settings'})).toBeVisible();
    await admin.getByLabel('Attachment duration').selectOption('8');
    await admin.getByRole('button',{name:'Save settings'}).click();
    await expect(admin.getByRole('status').filter({hasText:'Settings saved.'})).toBeVisible();
    expect((await request(admin,'admin/settings.php')).settings.attachment_months).toBe(8);
    const companyState=await request(employer,'employer/company.php');
    expect(companyState.company.verification_status).toBe('verified');

    await employer.goto('/designs/employers/post-edit-opening.html');
    await expect(employer.locator('body')).toHaveClass(/s8-ready/);
    const title='Browser Opening '+suffix;
    await employer.locator('#input-title').fill(title);
    await employer.locator('#input-description').fill('Industrial design placement for browser QA.');
    await employer.locator('#btn-publish').click();
    await expect(employer.locator('.s8-alert').filter({hasText:'Opening published.'})).toBeVisible();
    const {openings}=await request(employer,'employer/openings.php');
    const opening=openings.find(row=>row.title===title);
    expect(opening.status).toBe('published');

    await apply(student,opening.id,true);
    const applications=(await request(student,'student/applications.php')).applications;
    const first=applications.find(row=>row.opening_id===opening.id);
    await employer.goto('/designs/employers/applicant-profile.html?application_id='+first.id);
    await employer.locator('#s8-next').selectOption('accepted');
    await employer.getByRole('button',{name:'Save Review Decision'}).click();
    await expect(employer.locator('.s8-alert')).toContainText('Application status updated.');
    await employer.goto('/designs/employers/messages.html?with='+studentRecord.user_id);
    const message='Browser workflow message '+suffix;
    await employer.locator('#al-employer-message-text').fill(message);
    await employer.locator('#al-message-send').click();
    await expect(employer.locator('#al-chat-messages')).toContainText(message);
    await student.goto('/designs/students/messages.html');
    await student.locator('#thread-list button').filter({hasText:company}).click();
    await expect(student.locator('#message-list')).toContainText(message);

    const second=(await request(employer,'employer/openings.php',{title:'Withdraw fixture '+suffix,description:'QA withdrawal',status:'published'})).id;
    await apply(student,second,false);
    await student.goto('/designs/students/my-applications.html');
    student.on('dialog',dialog=>dialog.accept());
    const card=student.locator('#applications-list article').filter({hasText:'Withdraw fixture '+suffix});
    await card.getByRole('button',{name:'Withdraw application'}).click();
    await expect(card).toContainText('WITHDRAWN');

    await student.goto('/designs/students/login.html');
    await student.getByRole('link',{name:'Forgot your password?'}).click();
    await student.getByLabel('Email address').fill(studentEmail);
    await student.getByRole('button',{name:'Email me a reset link'}).click();
    await expect(student.locator('#account-status')).toContainText('If an eligible account exists');
    await student.goto(mailLink(studentEmail,'Reset your AttachLink password'));
    await student.getByLabel('New password').fill(nextSecret);
    await student.getByRole('button',{name:'Reset password',exact:true}).click();
    await expect(student.locator('#account-status')).toContainText('Password reset.');
    await signIn(student,'student',studentEmail,nextSecret);

    for(const [role,page,folder] of [['student',student,'students'],['employer',employer,'employers'],['admin',admin,'admin']]){
        for(const width of [375,1280]){
            await page.setViewportSize({width,height:850});
            await page.goto('/designs/'+folder+'/dashboard.html');
            await expect(page.locator('main')).toBeVisible();
            if (role==='student') {
                await expect(page.getByRole('heading',{name:'Welcome back, Browser Student'})).toBeVisible();
                await expect(page.locator('main').getByText('Withdraw fixture '+suffix,{exact:true}).first()).toBeVisible();
            } else if (role==='employer') {
                await expect(page.getByRole('heading',{name:new RegExp(company)})).toBeVisible();
            } else {
                await expect(page.getByText('Registered students',{exact:true})).toBeVisible();
            }
            await page.evaluate(()=>document.fonts.load('24px "Material Symbols Outlined"'));
            await page.evaluate(()=>document.fonts.ready);
            expect(await page.evaluate(()=>Array.from(document.fonts).some(font=>font.family.includes('Material Symbols')&&font.status==='loaded'))).toBeTruthy();
            const screenshot=testInfo.outputPath(role+'-'+width+'.png');
            await page.screenshot({path:screenshot,fullPage:true});
            await testInfo.attach(role+'-'+width,{path:screenshot,contentType:'image/png'});
            const horizontal=await page.evaluate(()=>document.documentElement.scrollWidth);
            expect(horizontal,role+' dashboard at '+width+' px').toBeLessThanOrEqual(width);
        }
    }
});
