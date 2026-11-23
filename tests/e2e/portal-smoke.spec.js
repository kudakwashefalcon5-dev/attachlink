const {test, expect} = require('@playwright/test');
const {source: axe} = require('axe-core');
const fs = require('node:fs');
const path = require('node:path');
const {randomInt} = require('node:crypto');

const api = '/backend/api/';
const password = 'Portal smoke fixture password';
const longName='Interdisciplinary'.repeat(5);
const longMessage='M'.repeat(1000);
const requiredDocuments=['stamped_letter','cv','national_id','transcript','o_level'];
const expectedStatus = {student: 'students', employer: 'employers', admin: 'admin'};
async function call(page, route, data) {
    let response;
    if (data) {
        const token = await page.request.get(api+'auth/csrf.php');
        response = await page.request.post(api+route,{data:{...data,csrf_token:(await token.json()).csrf_token}});
    } else response = await page.request.get(api+route);
    expect(response.ok(), route+' '+response.status()).toBeTruthy();
    return response.json();
}

async function prepare(browser, baseURL) {
    const roles={};
    const suffix=randomInt(100000,999999);
    for (const role of Object.keys(expectedStatus)) {
        const page=await (await browser.newContext({baseURL})).newPage();
        roles[role]=page;
        const email=role==='admin'?'qa-admin@example.invalid':'smoke-'+role+'-'+suffix+'@example.invalid';
        if (role!=='admin') {
            await call(page,'auth/register.php',{role,email,first_name:longName,last_name:longName,
                phone:(role==='student'?'0778':'0779')+suffix,company_name:'Portal Smoke Company '+longName+suffix,
                password,consent:true,consent_version:'pilot-2026-11'});
        }
        await call(page,'auth/login.php',{role,email,password:role==='admin'?process.env.ATTACHLINK_QA_ADMIN_PASSWORD:password});
    }
    const {student,employer,admin}=roles;
    for (const page of [student,employer]) {
        const {user}=await call(page,'auth/me.php');
        await call(admin,'admin/verify-user-email.php',{user_id:user.id});
    }
    const {company}=await call(employer,'employer/company.php');
    await call(admin,'admin/companies.php',{company_id:company.id,status:'verified',note:'Disposable browser fixture'});
    const {csrf_token}=await call(student,'auth/csrf.php');
    const pdf=Buffer.from('%PDF-1.4\n%%EOF\n');
    const maxPdf=Buffer.alloc(5*1024*1024,0x20);
    pdf.copy(maxPdf);
    let opening,application;
    for (let i=0;i<50;i++) {
        const id=(await call(employer,'employer/openings.php',{
            title:'Smoke opening '+suffix+' '+(i+1),
            description:'Disposable opening',status:'published'
        })).id;
        const multipart={csrf_token,listing_id:String(id)};
        for (const name of requiredDocuments) {
            multipart[name]={name:'fixture.pdf',mimeType:'application/pdf',buffer:i===0?maxPdf:pdf};
        }
        const submitted=await student.request.post(api+'student/apply-with-documents.php',{multipart,timeout:60000});
        expect(submitted.status(),'application '+(i+1)).toBe(201);
        const result=await submitted.json();
        if (i===0) {
            expect(result.document_count).toBe(requiredDocuments.length);
            opening=id;
            application=result.application_id;
        }
    }
    expect((await call(student,'student/applications.php')).applications).toHaveLength(50);
    const {user}=await call(employer,'auth/me.php');
    await call(student,'messages.php',{recipient_id:user.id,body:longMessage});
    return {roles,opening,application,employerId:user.id};

}

test('seeded portal pages stay local, fit both widths and pass axe checks', async ({browser}, testInfo) => {
    test.setTimeout(360000);
    expect(process.env.ATTACHLINK_DB_NAME).toMatch(/^attachlink_(qa|phase[13])[a-z0-9_]*$/);
    const baseURL=testInfo.project.use.baseURL;
    const origin=new URL(baseURL).origin;
    const {roles,opening,application,employerId}=await prepare(browser,baseURL);
    const checks=[];
    for (const [role,page] of Object.entries(roles)) {
        let problems=[];
        await page.route('**/*', route=>{
            const url=new URL(route.request().url());
            if (['http:','https:'].includes(url.protocol)&&url.origin!==origin) {
                problems.push('external request '+url.origin+url.pathname);
                return route.abort();
            }
            return route.continue();
        });
        page.on('pageerror', error=>problems.push('page error '+error.message));
        page.on('console', message=>{if(message.type()==='error')problems.push('console error '+message.text());});
        page.on('response', response=>{if(response.status()>=400)problems.push('HTTP '+response.status()+' '+new URL(response.url()).pathname);});
        page.on('requestfailed', request=>problems.push('failed request '+request.url()+' '+request.failure()?.errorText));
        const folder=expectedStatus[role];
        const files=fs.readdirSync(path.join('designs',folder)).filter(name=>name.endsWith('.html')||name==='audit-log.php').sort();
        for (const width of [375,1280]) {
            await page.setViewportSize({width,height:850});
            for (const file of files) {
                problems=[];
                const query=file==='attachment-details.html'?'?id='+opening:
                    file==='applicant-profile.html'?'?application_id='+application:
                    file==='messages.html'&&role==='student'?'?peer_id='+employerId:'';
                const route='/designs/'+folder+'/'+file+query;
                await page.goto(route,{waitUntil:'networkidle'});
                await page.evaluate(()=>document.fonts.ready);
                if (role==='student'&&file==='messages.html') await expect(page.locator('#message-list')).toContainText(longMessage);
                const horizontal=await page.evaluate(()=>document.documentElement.scrollWidth);
                if (horizontal>width) problems.push('horizontal overflow '+horizontal+' > '+width);
                await page.evaluate(axe);
                const result=await page.evaluate(()=>window.axe.run());
                const violations=result.violations.map(({id,impact,nodes})=>({id,impact,nodes:nodes.map(({target,html})=>({target,html}))}));
                checks.push({route,width,horizontal,problems:[...new Set(problems)],violations});
            }
        }
    }
    const artifact=testInfo.outputPath('portal-audit.json');
    fs.writeFileSync(artifact,JSON.stringify(checks,null,2));
    await testInfo.attach('portal-audit',{path:artifact,contentType:'application/json'});
    const failures=checks.flatMap(({route,width,problems,violations})=>[
        ...problems.map(issue=>route+' '+width+' '+issue),
        ...violations.filter(issue=>['critical','serious','moderate'].includes(issue.impact))
            .map(issue=>route+' '+width+' axe '+issue.id+' ('+issue.nodes.length+')')
    ]);
    expect(failures).toEqual([]);
});
