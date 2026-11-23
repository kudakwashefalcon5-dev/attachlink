if (location.pathname.split('/').pop() !== 'messages.html') {
/* AttachLink Stage 8 — Employer Stitch integration. No student portal files changed.
   This client never decides authorization: every API independently validates role and org. */
(() => {
  'use strict';
  const API = '../../backend/api';
  const page = location.pathname.split('/').pop().toLowerCase();
  const $ = (q, root = document) => root.querySelector(q);
  const $$ = (q, root = document) => [...root.querySelectorAll(q)];
  const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = v => v ? String(v) : '—';
  const int = v => Number(v || 0);
  const amount = v => v === null || v === undefined || v === '' ? 'Not specified' : '$' + Number(v).toLocaleString(undefined,{maximumFractionDigits:2}) + ' USD/month';
  const link = (path, title) => `<a href="${escape(path)}" class="text-primary hover:underline font-semibold">${escape(title)}</a>`;
  const btn = (label, attrib = '', secondary = false) => `<button type="button" class="${secondary ? 's8-action-soft' : 's8-action'}" ${attrib}>${escape(label)}</button>`;
  let overview = null;
  let csrf = '';
  let cachedListings = [];
  let cachedApplications = [];

  async function request(endpoint, options = {}) {
    const response = await fetch(API + endpoint, { credentials:'same-origin', cache:'no-store', ...options });
    let json;
    try { json = await response.json(); } catch (_) { throw new Error('The backend did not return JSON (HTTP '+response.status+').'); }
    if (!response.ok || json.ok === false) {
      const err = new Error(json.message || json.error || `Request failed (HTTP ${response.status})`);
      err.status = response.status;
      throw err;
    }
    return json;
  }
  async function token() {
    if (!csrf) csrf = (await request('/auth/csrf.php')).csrf_token;
    return csrf;
  }
  async function post(endpoint, data) {
    const tokenValue = await token();
    try { return await request(endpoint, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,csrf_token:tokenValue})}); }
    catch(e) { if (e.status === 403) csrf = ''; throw e; }
  }
  async function allListings() {
    const rows=[];
    for (let pageNum = 1; pageNum <= 20; pageNum++) {
      const result = await request('/employer/listings.php?page='+pageNum);
      rows.push(...(result.listings || []));
      if (!result.has_more) break;
    }
    cachedListings = rows;
    return rows;
  }
  async function allApplications(params = {}) {
    const rows=[];
    const suffix = new URLSearchParams(params);
    for (let pageNum=1; pageNum<=20;pageNum++) {
      suffix.set('page',pageNum);suffix.set('limit','50');
      const result = await request('/employer/applications.php?'+suffix);
      rows.push(...(result.applications || []));
      if (!result.has_more) break;
    }
    cachedApplications=rows;
    return rows;
  }
  function alertBox(message, error=false) {
    const current = $('#s8-message');
    if (current) { current.textContent=message;current.classList.toggle('error',error);return; }
    const target = $('#s8-content') || $('main form') || $('main');
    if (!target) return;
    const d = document.createElement('div');d.id='s8-message';d.className='s8-alert'+(error?' error':'');d.textContent=message;
    target.prepend(d);
  }
  function safeError(e) { alertBox(e.message || 'Could not load employer information.',true); }
  function neutralizeSidebar() {
    const as = $('aside'), header=$('header');
    // Exact text slots from the original Stitch design; keep every class and layout.
    const expected={'Econet Wireless Zimbabwe':overview.organization.name,
      'Harare HQ • Tech & Telecoms':overview.organization.location || 'Employer account',
      'Tadiwa Moyo':`${overview.user.first_name} ${overview.user.last_name}`,
      'Talent Acquisition Lead':overview.organization.job_title || 'Employer account',
      'Accredited Employer':'Company profile',
      'Tier 1':overview.organization.verification_status,
      'Aug – Dec 2025 Attachment Intake':'Company workspace'};
    for (const area of [as,header]) {
      if (!area) continue;
      const walk=document.createTreeWalker(area,NodeFilter.SHOW_TEXT);const texts=[];
      while (walk.nextNode()) texts.push(walk.currentNode);
      for (const t of texts) {
        const k=t.nodeValue.trim(); if(Object.hasOwn(expected,k))t.nodeValue=t.nodeValue.replace(k,expected[k]);
        if (k==='3' && (t.parentElement?.closest('a')?.textContent.includes('Messages'))) t.nodeValue=t.nodeValue.replace('3','');
      }
    }
    // Stable navigation everywhere in the employer portal.
    for(const a of $$('aside a')) {
      const val=a.textContent.replace(/\s+/g,' ').trim();
      if(/Dashboard/.test(val))a.href='dashboard.html';
      else if(/Openings/.test(val))a.href='openings.html';
      else if(/Applicants/.test(val))a.href='opening-applicants.html';
      else if(/Company Profile/.test(val))a.href='company-profile.html';
      else if(/Messages|Help & Support/.test(val)) {
        a.href='messages.html?support=1';
      }
      a.classList.remove('bg-primary-container','text-on-primary');
      if ((page==='dashboard.html'&&/Dashboard/.test(val)) || (['openings.html','post-edit-opening.html'].includes(page)&&/Openings/.test(val)) || (['opening-applicants.html','applicant-profile.html'].includes(page)&&/Applicants/.test(val)) || (page==='company-profile.html'&&/Company Profile/.test(val))) {
        a.classList.add('bg-primary-container','text-on-primary');
      }
    }
    for(const b of $$('header button')) if(b.textContent.trim()==='notifications') {
      b.title='Employer notifications are not connected yet';b.onclick=()=>alertBox('Employer notifications are not connected yet.');
    }
  }
  function mount(html) { const node=$('#s8-content');if(node)node.innerHTML=html; }
  const status = v => `<span class="s8-status">${escape(v||'unknown')}</span>`;
  function applicationRow(a) {
    const name=fmt(`${a.first_name||''} ${a.last_name||''}`.trim());
    return `<tr><td>${escape(name)}<div class="s8-muted">${escape(a.institution||'Institution not supplied')}</div></td><td>${escape(a.programme||'—')}<div class="s8-muted">${escape(a.study_level||'')}</div></td><td>${escape(a.listing_title||'—')}</td><td>${status(a.status)}</td><td>${link('applicant-profile.html?application_id='+encodeURIComponent(a.application_id),'Review')}</td></tr>`;
  }
  function openingRow(l) {
    const review = overview.organization.verification_status;
    const actions=l.status==='archived'?[]:l.status==='published'?[['close','Close']]:[['reopen',l.status==='draft'?'Publish':'Reopen'],['archive','Archive']];
    const controls=actions.map(([action,label])=>btn(label,'data-opening-action="'+action+'" data-opening-id="'+escape(l.id)+'"')).join(' ');
    return `<tr><td><strong>${escape(l.title)}</strong><div class="s8-muted">${escape(l.city)}</div></td><td>${status(l.status)}</td><td>${status(review)}</td><td>${escape(amount(l.stipend_usd))}</td><td>${escape(l.closing_date || 'Not set')}</td><td>${link('post-edit-opening.html?listing_id='+encodeURIComponent(l.id),'View / Edit')} &nbsp; ${link('opening-applicants.html?listing_id='+encodeURIComponent(l.id),'Applicants')} ${controls}</td></tr>`;
  }
  function statCard(n,label,explanation) {
    return `<div class="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm hover:shadow-md transition-shadow"><div class="flex items-start justify-between mb-space-md"><span class="material-symbols-outlined text-primary">analytics</span></div><div><div class="font-headline-lg text-headline-lg text-on-surface">${int(n)}</div><div class="font-title-md text-title-md text-on-surface font-semibold">${escape(label)}</div><p class="s8-muted mt-1">${escape(explanation)}</p></div></div>`;
  }
  async function dashboard() {
    const [listings, apps] = await Promise.all([allListings(),allApplications()]);
    const c=overview.counts;
    const upcoming=apps.slice(0,6), open=listings.slice(0,6);
    mount(`<div class="s8-alert">Verification status: <strong>${escape(overview.organization.verification_status)}</strong>.</div>
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-space-md mb-space-xl">
      <div><div class="font-label-sm text-label-sm text-primary">Corporate Workspace • ${escape(overview.organization.location||'Zimbabwe')}</div><h1 class="font-headline-lg text-headline-lg text-on-surface tracking-tight mt-2">Welcome back, ${escape(overview.user.first_name)} <span class="font-normal">(${escape(overview.organization.name)})</span></h1><p class="font-body-md text-body-md text-on-surface-variant mt-1">Company workspace</p></div>
      <div class="s8-flex">${btn('Export Applications CSV','id="s8-export"',true)} ${btn('Post New Opening','id="s8-new"')}</div>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md mb-space-2xl">${statCard(c.published_listings,'Published openings','Approved listings in your organization')}${statCard(c.total_applications,'Total applicants','Applications to your organization')}${statCard(c.shortlisted,'Shortlisted','Candidates at shortlist stage')}${statCard(c.accepted,'Accepted','Accepted test applications')}</div>
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start"><div class="lg:col-span-8 flex flex-col gap-space-md"><div class="rounded-xl bg-surface-container-lowest shadow-sm p-space-lg"><div class="flex items-center justify-between mb-space-lg"><div><h2 class="font-headline-sm text-headline-sm">Recent Student Applicants</h2><p class="s8-muted">${apps.length} accessible applications • ${c.new_applications} awaiting review</p></div>${link('opening-applicants.html','All applicants')}</div><div style="overflow:auto"><table class="s8-table"><thead><tr><th>Student / institution</th><th>Programme</th><th>Opening</th><th>Status</th><th>Action</th></tr></thead><tbody>${upcoming.map(applicationRow).join('')||'<tr><td colspan="5">No submitted applications yet.</td></tr>'}</tbody></table></div></div><div class="s8-card"><h3>Institutional eligibility</h3><p class="s8-muted">An opening's eligibility is set by its institution restriction list. No university agreements or verification are assumed.</p></div></div>
    <div class="lg:col-span-4 flex flex-col gap-space-lg"><div class="s8-card"><div class="flex items-center justify-between mb-space-md"><h3 class="font-title-md text-title-md">Your Openings</h3>${link('openings.html','View all ('+listings.length+')')}</div>${open.map(l=>`<div class="p-space-md bg-surface-container-low rounded-lg mb-2"><div class="font-semibold text-sm">${escape(l.title)}</div><div class="s8-muted">${escape(l.city)} • ${escape(l.status)} • ${escape(l.review_status||'')}</div><div class="mt-2">${link('opening-applicants.html?listing_id='+l.id,'Manage applicants')}</div></div>`).join('')||'<p class="s8-muted">No listings yet. Create your first draft.</p>'}</div><div class="s8-card"><h3>Review workflow</h3><p class="s8-muted mt-2">Publish openings once your company has been verified.</p></div></div></div>`);
    $('#s8-new').onclick=()=>{location.href='post-edit-opening.html';};
    $('#s8-export').onclick=()=>exportCsv(apps);
  }
  function exportCsv(apps) {
    const cols=['application_id','first_name','last_name','email','institution','programme','listing_title','status','submitted_at'];
    const csv=[cols.join(','),...apps.map(a=>cols.map(k=>'"'+String(a[k]??'').replace(/"/g,'""')+'"').join(','))].join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='attachlink-employer-test-applications.csv';a.click();URL.revokeObjectURL(url);
  }
  async function openings() {
    const rows=await allListings();
    mount(`<div class="flex items-center justify-between gap-space-md mb-space-xl"><div><h1 class="font-headline-lg text-headline-lg">My Attachment Openings</h1><p class="s8-note">${escape(overview.organization.name)} • ${rows.length} openings</p></div>${btn('Post New Opening','id="s8-new"')}</div>
      <div class="s8-card"><div class="s8-alert">Drafts are private. Published openings from verified companies are visible to students.</div><div style="overflow:auto"><table class="s8-table"><thead><tr><th>Position / city</th><th>Status</th><th>Company verification</th><th>Stipend</th><th>Closing</th><th>Manage</th></tr></thead><tbody>${rows.map(openingRow).join('')||'<tr><td colspan="6">No openings yet.</td></tr>'}</tbody></table></div></div>`);
    $('#s8-new').onclick=()=>location.href='post-edit-opening.html';
    $$('[data-opening-action]').forEach(button=>{
      button.onclick=async()=>{
        const action=button.dataset.openingAction;
        if(action==='archive'&&!confirm('Archive this opening?'))return;
        button.disabled=true;
        try{
          await post('/employer/listings.php',{action,listing_id:Number(button.dataset.openingId)});
          await openings();
        }catch(error){safeError(error);button.disabled=false;}
      };
    });
  }
  async function applicants() {
    const [apps,listings]=await Promise.all([allApplications(),allListings()]);
    const params=new URLSearchParams(location.search);const fixedListing=params.get('listing_id')||'';
    const initial= listings.some(l=>String(l.id)===fixedListing)?fixedListing:'';
    mount(`<div class="mb-space-xl"><h1 class="font-headline-lg text-headline-lg">Opening Applicants</h1><p class="s8-muted">Only applications belonging to ${escape(overview.organization.name)} are accessible.</p></div>
    <div class="s8-card"><div class="s8-flex mb-space-md"><input class="s8-field" style="flex:2;min-width:230px" id="s8-search" type="search" placeholder="Search applicants by name, institution or opening"/><select class="s8-field" aria-label="Filter by application status" id="s8-status" style="flex:1;min-width:140px"><option value="">All statuses</option>${['submitted','reviewing','shortlisted','interview','accepted','rejected','withdrawn'].map(x=>`<option value="${x}">${x}</option>`).join('')}</select><select class="s8-field" aria-label="Filter by opening" id="s8-listing" style="flex:1;min-width:160px"><option value="">All openings</option>${listings.map(l=>`<option value="${escape(l.id)}" ${String(l.id)===initial?'selected':''}>${escape(l.title)}</option>`).join('')}</select></div>
    <div id="s8-count" class="s8-muted mb-space-md"></div><div style="overflow:auto"><table class="s8-table"><thead><tr><th>Student / institution</th><th>Programme</th><th>Applied opening</th><th>Status</th><th>Review</th></tr></thead><tbody id="s8-app-rows"></tbody></table></div></div>`);
    function render() {
      const q=$('#s8-search').value.toLowerCase().trim(), status=$('#s8-status').value, listing=$('#s8-listing').value;
      const matches=apps.filter(a=>(!status||a.status===status)&&(!listing||String(a.listing_id)===listing)&&(!q||[a.first_name,a.last_name,a.institution,a.programme,a.listing_title].join(' ').toLowerCase().includes(q)));
      $('#s8-count').textContent=`Showing ${matches.length} of ${apps.length} organization applications`;
      $('#s8-app-rows').innerHTML=matches.map(applicationRow).join('')||'<tr><td colspan="5">No applications match your filters.</td></tr>';
    }
    ['s8-search','s8-status','s8-listing'].forEach(id=>$('#'+id).addEventListener(id==='s8-search'?'input':'change',render));render();
  }
  const ALLOWED = {submitted:['reviewing','rejected'],reviewing:['shortlisted','rejected'],shortlisted:['interview','rejected'],interview:['accepted','rejected']};
  async function applicantProfile() {
    const id=new URLSearchParams(location.search).get('application_id');
    if (!/^\d+$/.test(id||'')||Number(id)<1) throw new Error('Choose an applicant from the Applicants page.');
    const record=await request('/employer/applications.php?application_id='+encodeURIComponent(id));
    const a=record.application;
    const docs=await request('/employer/documents.php?application_id='+encodeURIComponent(id));
    const hist={events:record.events||[]};
    const next=record.allowed_next||ALLOWED[a.status]||[];
    const name=`${a.first_name} ${a.last_name}`;
    mount(`<div class="mb-space-md">${link('opening-applicants.html?listing_id='+encodeURIComponent(a.listing_id),'← Applicants')} <span class="s8-muted"> / Application #${escape(a.application_id)}</span></div>
    <div class="s8-grid"><div class="flex flex-col gap-space-lg"><div class="s8-card"><div class="flex items-center justify-between mb-space-lg"><div><h1 class="font-headline-lg text-headline-lg">${escape(name)}</h1><p class="s8-note">${escape(a.institution||'Institution not provided')} • ${escape(a.programme||'Programme not provided')} • ${escape(a.study_level||'')}</p></div>${status(a.status)}</div><div class="grid grid-cols-1 sm:grid-cols-2 gap-space-md text-sm"><div><div class="s8-muted">Email</div><div>${escape(a.email||'—')}</div></div><div><div class="s8-muted">Student city</div>${escape(a.student_city||'Not specified')}</div><div><div class="s8-muted">Opening</div>${escape(a.listing_title)}</div><div><div class="s8-muted">Applied on</div>${escape(a.submitted_at||'—')}</div></div></div>
    <div class="s8-card"><h2>Application Cover Letter</h2><div class="bg-surface-container-low p-space-md rounded-xl" style="white-space:pre-wrap;overflow-wrap:anywhere">${escape(a.cover_letter||'No cover letter supplied.')}</div></div>
    <div class="s8-card"><h2>Review History</h2>${(hist.events||[]).map(ev=>`<div class="border-b border-surface-container-low pb-space-sm mb-space-sm"><div class="s8-flex">${status(ev.previous_status||'initial')} → ${status(ev.new_status)}</div><p class="s8-muted">${escape(ev.changed_by||'Employer')} • ${escape(ev.created_at)}</p>${ev.note?`<p class="text-sm mt-1">${escape(ev.note)}</p>`:''}</div>`).join('')||'<p class="s8-note">No recorded employer review events.</p>'}</div></div>
    <div class="flex flex-col gap-space-lg"><div class="s8-card"><h2>Review Application</h2><p class="s8-note mb-space-md">Current status: ${escape(a.status)}.</p>${next.length ? `<label class="font-semibold block mb-1" for="s8-next">Next decision</label><select class="s8-field mb-space-md" id="s8-next">${next.map(v=>`<option value="${v}">${v}</option>`).join('')}</select><label class="font-semibold block mb-1" for="s8-note">Review note</label><textarea class="s8-field mb-space-md" rows="4" id="s8-note" placeholder="Reason required for rejection"></textarea>${btn('Save Review Decision','id="s8-save"')}<div class="s8-note mt-2">Rejecting requires at least 10 characters.</div>`:'<p class="s8-alert">This application has a final status or cannot be advanced further.</p>'}</div>
    <div class="s8-card"><h2>Applicant Documents</h2><p class="s8-note"></p><div id="s8-documents"></div><p></p></div></div></div>`);
    const documents = $("#s8-documents");
    for (const doc of docs.documents) { const a=document.createElement("a"); a.href=API+"/documents/download.php?id="+encodeURIComponent(doc.id); a.textContent=doc.original_name; documents.append(a,document.createElement("br")); }
    if (!docs.documents.length) documents.textContent="No documents uploaded.";
    documents.insertAdjacentHTML("beforeend", link("messages.html?with="+encodeURIComponent(a.student_id),"Message applicant"));
    if(next.length)$('#s8-save').onclick=async()=>{
      const b=$('#s8-save');b.disabled=true;
      try { const decision=$('#s8-next').value,note=$('#s8-note').value;
        await post('/employer/applicants.php',{application_id:Number(id),status:decision,note});
        await applicantProfile();alertBox('Application status updated.');
      } catch(e) {safeError(e);} finally {b.disabled=false;}
    };
  }
  async function companyProfile() {
    const org=overview.organization;
    mount(`<div class="mb-space-xl"><div class="font-label-sm text-primary">Company profile</div><h1 class="font-headline-lg text-headline-lg">${escape(org.name)}</h1><p class="s8-muted">Company verification: ${escape(org.verification_status)}. This is not proof of official accreditation.</p></div>
    <div class="s8-grid"><div class="flex flex-col gap-space-lg"><div class="s8-card"><h2>Registered Entity Profile</h2><div class="grid grid-cols-1 sm:grid-cols-2 gap-space-lg"><div><p class="s8-muted">Organization name</p><strong>${escape(org.name)}</strong></div><div><p class="s8-muted">Location</p>${escape(org.location||'Not supplied')}</div><div><p class="s8-muted">Employer contact</p>${escape(overview.user.first_name+' '+overview.user.last_name)}</div><div><p class="s8-muted">Position</p>${escape(org.job_title||'Not supplied')}</div></div><div class="mt-space-lg"><p class="s8-muted">Organization description</p><p style="white-space:pre-wrap">${escape(org.description||'No description stored yet.')}</p></div></div><div class="s8-card"><h2>Verification and Compliance</h2><p class="s8-note"></p><div id="s8-company-files"></div><p></p></div></div><div class="flex flex-col gap-space-lg"><div class="s8-card"><h2>Company overview</h2><p class="text-sm">Organization ID: ${escape(org.id)}</p><p class="text-sm mt-2">Verification: ${status(org.verification_status)}</p><p class="text-sm mt-2">Openings: ${int(overview.counts.all_listings)}</p><p class="text-sm mt-2">Applications: ${int(overview.counts.total_applications)}</p></div><div class="s8-card"><h2>Edit Company Details</h2><form id="s8-company-edit"></form></div></div></div>`);
    const edit=$('#s8-company-edit');
    for(const [key,title] of [['name','Company name'],['city','City'],['industry','Industry'],['website','Website'],['description','Description']]){
      const label=document.createElement('label');
      label.className='block mb-space-sm';
      label.textContent=title;
      const field=document.createElement(key==='description'?'textarea':'input');
      field.name=key; field.className='s8-field'; field.value=org[key]||'';
      field.required=key==='name';
      label.append(field); edit.append(label);
    }
    const save=document.createElement('button');
    save.type='submit'; save.className='s8-action'; save.textContent='Save company details'; edit.append(save);
    edit.onsubmit=async event=>{
      event.preventDefault(); save.disabled=true;
      try{
        await post('/employer/company.php',Object.fromEntries(new FormData(edit)));
        location.reload();
      }catch(error){safeError(error);save.disabled=false;}
    };
    const files=$('#s8-company-files');
    async function loadFiles(){
      const result=await request('/company-files.php');
      files.querySelector('.company-file-list')?.remove();
      const list=document.createElement('div'); list.className='company-file-list mb-space-md';
      for(const file of result.files){
        const url=API+'/company-files.php?id='+encodeURIComponent(file.id);
        const asset=document.createElement(file.purpose==='logo'?'img':'a');
        if(file.purpose==='logo'){asset.src=url;asset.alt=org.name+' logo';asset.className='w-20 h-20 object-contain';}
        else{asset.href=url;asset.textContent=file.original_name;}
        list.append(asset,document.createElement('br'));
        if(file.purpose==='logo'){
          const remove=document.createElement('button');
          remove.type='button';remove.className='s8-action-soft';remove.textContent='Remove logo';
          remove.onclick=async()=>{
            remove.disabled=true;
            try{
              await request('/company-files.php',{method:'DELETE',headers:{'X-CSRF-Token':await token()}});
              await loadFiles();
            }catch(error){safeError(error);remove.disabled=false;}
          };
          list.append(remove,document.createElement('br'));
        }
      }
      files.prepend(list);
    }
    for(const [purpose,label,types] of [['logo','Upload logo','.jpg,.jpeg,.png'],['verification','Upload verification document','.pdf,.jpg,.jpeg,.png']]){
      const form=document.createElement('form'); form.className='s8-flex my-space-sm';
      const input=document.createElement('input');
      input.type='file'; input.accept=types; input.required=true; input.setAttribute('aria-label',label);
      const submit=document.createElement('button'); submit.type='submit'; submit.className='s8-action'; submit.textContent=label;
      form.append(input,submit); files.append(form);
      form.onsubmit=async event=>{
        event.preventDefault(); submit.disabled=true;
        try{
          const data=new FormData();
          data.set('csrf_token',await token()); data.set('purpose',purpose); data.set('file',input.files[0]);
          await request('/company-files.php',{method:'POST',body:data}); form.reset(); await loadFiles();
        }catch(error){safeError(error);}finally{submit.disabled=false;}
      };
    }
    await loadFiles();
  }
  async function editor() {
    const main=$('main');if(!main)throw new Error('Could not find Stitch vacancy form.');
    // Existing Stitch form, cards, controls, preview and colour classes stay in the HTML.
    const title=$('#input-title'),city=$('#input-location'),description=$('#input-description'),stipend=$('#input-stipend'),deadline=$('#input-deadline');
    if(!title||!city||!description)throw new Error('Stitch editor fields were not found.');
    // Neutralize leftover dated/sample claims in the supplied editor, without touching its layout.
    const originalClaims={
      'Econet Wireless Zimbabwe':overview.organization.name,
      'INTAKE: AUG 2025 – AUG 2026':'TEST INTAKE • Dates not linked',
      '31 July 2025':'Deadline not set',
      'Cohort August 2025 intake round':'New opening',
      'UZ, NUST, MSU, HIT, CUT':'Select eligible institutions below',
      'This opening automatically notifies faculty placement officers across accredited Zimbabwean universities once verified by HR Operations.':'After administrator approval, eligible students can see this opening. Faculty notifications are not connected.'
    };
    const textWalker=document.createTreeWalker(main,NodeFilter.SHOW_TEXT);
    while(textWalker.nextNode()) {
      const t=textWalker.currentNode;const v=t.nodeValue.trim();
      if(Object.hasOwn(originalClaims,v))t.nodeValue=t.nodeValue.replace(v,originalClaims[v]);
    }
    const form=$('#attachment-form');
    const department=$('#input-department'),counter=$('#slot-counter');
    const addSkill=$$('main button').find(button=>button.textContent.includes('Add Skill'));
    const skillTemplate=addSkill.previousElementSibling.cloneNode(true);
    for(const chip of [...addSkill.parentElement.children])if(chip!==addSkill)chip.remove();
    function addSkillChip(value){
      const chip=skillTemplate.cloneNode(true);
      chip.dataset.requiredSkill=value;
      chip.querySelector('span:nth-child(2)').textContent=value;
      const remove=chip.querySelector('button');
      remove.setAttribute('aria-label','Remove '+value);
      remove.onclick=()=>chip.remove();
      addSkill.before(chip);
    }
    addSkill.onclick=()=>{
      const value=prompt('Enter a required skill')?.trim();
      const skills=$$('[data-required-skill]');
      if(!value||skills.some(chip=>chip.dataset.requiredSkill===value))return;
      if(skills.length>=30||value.length>90){alertBox('Enter up to 30 skills, with at most 90 characters each.',true);return;}
      addSkillChip(value);
    };
    const requirements=document.createElement('div');requirements.className='rounded-xl bg-surface-container-lowest p-space-lg shadow-sm mt-space-md';
    requirements.innerHTML='<label class="block font-title-md text-title-md font-bold mb-space-sm" for="s8-requirements">Requirements</label><textarea id="s8-requirements" class="s8-field" rows="4" placeholder="Required knowledge, skills, or qualifications"></textarea>';
    form.append(requirements);
    const meta=new URLSearchParams(location.search);let id=meta.get('listing_id');
    if(id && !/^\d+$/.test(id))throw new Error('Invalid listing ID.');
    const all=id?await allListings():[];
    const editing=id ? all.find(l=>String(l.id)===id) : null;
    if(id&&!editing)throw new Error('Listing not found in this employer account.');
    if(editing) {
      title.value=editing.title||'';description.value=editing.description||'';
      department.value=editing.department||'';
      counter.textContent=editing.available_positions??'1';
      for(const skill of (editing.required_skills||'').split('\n').filter(Boolean))addSkillChip(skill);
      const value=(editing.city||'').toLowerCase();
      if(![...city.options].some(o=>o.value===value)) {const opt=new Option(editing.city, value);city.add(opt);}
      city.value=value;
      $('#s8-requirements').value=editing.requirements||'';
      stipend.value=editing.stipend_usd===null?'':editing.stipend_usd;
      deadline.value=editing.closing_date||'';
    }
    // Blank the leftover sample preview. It is not persisted and shouldn't claim an Econet vacancy.
    const preview={'preview-title':title.value||'Your attachment title','preview-dept':department.value||'Department','preview-desc':description.value||'Write your opening description to preview it here.','preview-stipend':stipend.value||'Not specified','preview-location':city.options[city.selectedIndex]?.textContent||'Zimbabwe','preview-slots':counter.textContent+' Open Positions'};
    for(const [key,value] of Object.entries(preview)) {const el=$('#'+key);if(el)el.textContent=value;}
    const changePreview=()=>{
      if($('#preview-title'))$('#preview-title').textContent=title.value||'Your attachment title';
      if($('#preview-desc'))$('#preview-desc').textContent=description.value||'Write a description';
      if($('#preview-location'))$('#preview-location').textContent=city.options[city.selectedIndex]?.textContent||'Zimbabwe';
      if($('#preview-stipend'))$('#preview-stipend').textContent=stipend.value||'Not specified';
    };
    [title,city,description,stipend].forEach(el=>el.addEventListener('input',changePreview));
    const save=$$('main button').find(b=>b.textContent.includes('Save as Draft'));
    const submit=$('#btn-publish');
    const view=$$('main button').find(b=>b.textContent.includes('Student Preview Mode'));
    if(view)view.onclick=()=>alertBox('The existing preview is local only. Student visibility begins after publication.');
    alertBox('Save your opening as a draft or publish it when your company is verified.');
    async function doSave() {
      const val=stipend.value.replace(/\s*USD.*$/i,'').replace('$','').trim();
      const data={action:'save',title:title.value.trim(),department:department.value.trim(),available_positions:Number(counter.textContent),required_skills:$$('[data-required-skill]').map(chip=>chip.dataset.requiredSkill),city:city.options[city.selectedIndex]?.textContent?.split(' - ')[0]||city.value,description:description.value.trim(),requirements:$('#s8-requirements').value.trim(),stipend_usd:val||null,closing_date:deadline.value||''};
      if(id)data.listing_id=Number(id);
      const result=await post('/employer/listings.php',data);
      id=String(result.listing_id);
      history.replaceState(null,'','post-edit-opening.html?listing_id='+id);
      return result;
    }
    if(save)save.onclick=async(e)=>{e.preventDefault();save.disabled=true;try{await doSave();alertBox('Opening saved.');}catch(err){safeError(err);}finally{save.disabled=false;}};
    if(submit)submit.textContent='Publish opening';
    if(submit)submit.onclick=async(e)=>{e.preventDefault();submit.disabled=true;try{await doSave();await post('/employer/listings.php',{action:'submit',listing_id:Number(id)});alertBox('Opening published.');if(save)save.disabled=true;form.querySelectorAll('input,textarea,select').forEach(el=>el.disabled=true);}catch(err){safeError(err);submit.disabled=false;}};
    // Remove original form submission because API writes must be CSRF protected.
    if(form)form.addEventListener('submit',e=>e.preventDefault());
  }
  // Populate the supplied Stitch employer Dashboard IN PLACE, preserving its original main grid.
  async function dashboardInplace() {
    const [listings,apps]=await Promise.all([allListings(),allApplications()]);
    const shell=$('main > div');
    const blocks=[...shell.children].filter(el=>el.tagName==='DIV');
    if(blocks.length<4)throw new Error('Stitch Dashboard structure is incomplete.');
    const banner=blocks[0],welcome=blocks[1],metrics=blocks[2],grid=blocks[3];
    // Keep original banner container, welcome header, metric tiles and two-column layout.
    const bannerText=$$('.font-headline-sm',banner).find(el=>el.textContent.includes('Compliance'));
    if(bannerText)bannerText.textContent='Company verification';
    const pending=$$('span',banner).find(el=>el.textContent.includes('Pending Review'));
    if(pending)pending.textContent=overview.organization.verification_status;
    const bannerP=$('p',banner);
    if(bannerP)bannerP.textContent='Company verification: '+overview.organization.verification_status+'.';
    const verifyButton=$$('button',banner).find(b=>b.textContent.includes('View Verification'));
    if(verifyButton)verifyButton.onclick=()=>location.href='company-profile.html';
    const h=$('h1',welcome);if(h)h.textContent='Welcome back, '+overview.user.first_name+' ('+overview.organization.name+')';
    const firstP=$('p',welcome);if(firstP)firstP.textContent='Manage openings and review applicants.';
    const badge=$$('span',welcome).find(el=>el.childElementCount===0 && el.textContent.includes('Harare Hub'));
    if(badge)badge.textContent=overview.organization.location||'Zimbabwe';
    const newBtn=$$('button',welcome).find(b=>b.textContent.includes('Post New Opening'));
    if(newBtn)newBtn.onclick=()=>location.href='post-edit-opening.html';
    const exportBtn=$$('button',welcome).find(b=>b.textContent.includes('Export Cohort'));
    if(exportBtn){exportBtn.innerHTML='<span class="material-symbols-outlined text-base">ios_share</span> Export Applications CSV';exportBtn.onclick=()=>exportCsv(apps);}
    const labels=[
      [overview.counts.published_listings,'Published Openings','Approved in the current organization'],
      [overview.counts.total_applications,'Total Applicants','From your own listings'],
      [overview.counts.reviewing,'Applications in Review','Awaiting the next review stage'],
      [overview.counts.accepted,'Accepted','Accepted by your company']
    ];
    [...metrics.children].forEach((card,index)=>{
      if(!labels[index])return;
      const [value,title,description]=labels[index];
      // Same Stitch card div and its exact padding/shadow, only data inside changes.
      card.innerHTML=`<div class="flex items-start justify-between mb-space-md"><span class="material-symbols-outlined text-primary">analytics</span></div><div><div class="font-headline-lg text-headline-lg text-on-surface">${int(value)}</div><div class="font-title-md text-title-md text-on-surface font-semibold">${escape(title)}</div><div class="s8-muted mt-1">${escape(description)}</div></div>`;
    });
    const left=grid.children[0],right=grid.children[1];
    if(!left||!right)throw new Error('Dashboard columns were not found.');
    const recent=left.children[0];
    recent.innerHTML=`<div class="flex items-center justify-between gap-space-md mb-space-lg"><div><h2 class="font-headline-sm text-headline-sm">Recent Student Applicants</h2><p class="font-body-sm text-body-sm text-outline mt-1">${int(overview.counts.total_applications)} applications • ${int(overview.counts.new_applications)} submitted and waiting for review</p></div>${link('opening-applicants.html','View all')}</div><div style="overflow:auto"><table class="s8-table"><thead><tr><th>Student / institution</th><th>Degree programme</th><th>Opening</th><th>Status</th><th>Action</th></tr></thead><tbody>${apps.slice(0,5).map(applicationRow).join('')||'<tr><td colspan="5">No applicants yet.</td></tr>'}</tbody></table></div>`;
    left.children[1]?.remove();
    const openingPanel=right.children[0];
    if(openingPanel)openingPanel.innerHTML=`<div class="flex items-center justify-between mb-space-md"><div><h3 class="font-title-md text-title-md">Active Openings</h3><p class="s8-muted">Published openings</p></div>${link('openings.html','View all ('+listings.length+')')}</div>${listings.slice(0,5).map(l=>`<div class="p-space-md rounded-lg bg-surface-container-low mb-space-md"><div class="font-bold text-sm">${escape(l.title)}</div><div class="s8-muted mt-1">${escape(l.city)} • ${escape(l.status)} • ${escape(l.review_status||'')}</div><div class="mt-2">${link('opening-applicants.html?listing_id='+l.id,'Manage applicants')}</div></div>`).join('')||'<p class="s8-muted">No listings yet. Create a draft to begin.</p>'}`;
    right.children[1]?.remove();
  }

  // Preserve the supplied Opening Applicants page, filtering and table's original surface.
  async function applicantsInplace() {
    const [apps,listings]=await Promise.all([allApplications(),allListings()]);
    const root=$('main > div');const wrapper=root?.children[0];
    if(!wrapper || wrapper.children.length<7)throw new Error('Original applicants table structure is incomplete.');
    const header=wrapper.children[2],filters=wrapper.children[3],bulk=wrapper.children[4],tableBox=wrapper.children[5],footer=wrapper.children[6];
    const params=new URLSearchParams(location.search);const fixed=params.get('listing_id')||'';
    const listingId=listings.some(l=>String(l.id)===fixed)?fixed:'';
    header.innerHTML=`<div class="flex flex-col gap-space-sm mb-space-lg"><div class="font-label-md text-label-md text-primary">${link('openings.html','Openings')} / Applicants</div><div class="flex flex-col lg:flex-row lg:justify-between lg:items-end gap-space-md"><div><h1 class="font-headline-lg text-headline-lg">Opening Applicants</h1><p class="s8-note">${escape(overview.organization.name)} • ${apps.length} database applications</p></div>${link('dashboard.html','Dashboard')}</div></div>`;
    filters.innerHTML=`<div class="s8-flex"><input class="s8-field" id="s8-search" type="search" style="flex:2;min-width:230px" placeholder="Search candidates by name, institution or opening"><select class="s8-field" aria-label="Filter by application status" id="s8-status" style="flex:1;min-width:130px"><option value="">All statuses</option>${['submitted','reviewing','shortlisted','interview','accepted','rejected','withdrawn'].map(v=>`<option value="${v}">${v}</option>`).join('')}</select><select class="s8-field" aria-label="Filter by opening" id="s8-listing" style="flex:1;min-width:170px"><option value="">All openings</option>${listings.map(l=>`<option value="${escape(l.id)}" ${String(l.id)===listingId?'selected':''}>${escape(l.title)}</option>`).join('')}</select></div>`;
    bulk.hidden=true;bulk.style.display='none';
    const table=$('table',tableBox);
    if(!table)throw new Error('Stitch applicants table missing.');
    table.innerHTML='<thead><tr><th>Student / institution</th><th>Programme</th><th>Applied opening</th><th>Status</th><th>Action</th></tr></thead><tbody id="s8-app-rows"></tbody>';
    function render() {
      const q=$('#s8-search').value.toLowerCase().trim(), s=$('#s8-status').value, l=$('#s8-listing').value;
      const filtered=apps.filter(a=>(!s||a.status===s)&&(!l||String(a.listing_id)===l)&&(!q||[a.first_name,a.last_name,a.institution,a.programme,a.listing_title].join(' ').toLowerCase().includes(q)));
      $('#s8-app-rows').innerHTML=filtered.map(applicationRow).join('')||'<tr><td colspan="5">No applications match the selected filters.</td></tr>';
    }
    ['s8-search','s8-status','s8-listing'].forEach(id=>$('#'+id).addEventListener(id==='s8-search'?'input':'change',render));render();
  }

  async function init() {
    try {
      overview=await request('/employer/overview.php');
      if(overview.user?.role !== 'employer')throw new Error('Please sign in with an employer account.');
      neutralizeSidebar();
      switch(page) {
        case 'dashboard.html':await dashboardInplace();break;
        case 'openings.html':await openings();break;
        case 'opening-applicants.html':await applicantsInplace();break;
        case 'applicant-profile.html':await applicantProfile();break;
        case 'company-profile.html':await companyProfile();break;
        case 'post-edit-opening.html':await editor();break;
        default:throw new Error('Unknown employer page.');
      }
    } catch(e) {
      const main=$('main');
      if(main) main.innerHTML=`<div class="s8-card" style="margin:40px 0"><h1 class="font-headline-lg text-headline-lg">Employer portal unavailable</h1><p class="s8-alert error" style="margin:16px 0">${escape(e.message||'Could not load your employer session.')}</p><p>Sign in with your employer account to continue.</p><div class="mt-4">${link('login.html','Employer sign in')}</div></div>`;
    } finally {document.body.classList.add('s8-ready');}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

}

if (location.pathname.split('/').pop() !== 'openings.html') {
/* AttachLink Stage 10B employer controls.
 * Additive behavior only: the five uploaded Stitch layouts and compiled CSS are unchanged.
 * All account/listing mutations are checked again by PHP and MySQL.
 */
(() => {
  'use strict';
  const API = '../../backend/api';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const endpoint = (path) => API + path;
  const page = location.pathname.split('/').pop();
  let csrf = '';
  let profile = null;
  let alertsCache = null;
  let alertOpen = false;
  let overlay = null;
  let syncIdentity = false;
  let lastListingFetch = 0;

  function el(tag, cls, content) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (content !== undefined) node.textContent = String(content);
    return node;
  }
  function note(message, bad = false) {
    let target = $('#attachlink-employer-note');
    if (!target) {
      target = el('div'); target.id = 'attachlink-employer-note';
      Object.assign(target.style, {position:'fixed',bottom:'18px',right:'18px',zIndex:'100000',maxWidth:'420px',borderRadius:'12px',padding:'13px 18px',boxShadow:'0 8px 30px #0003',font:'14px Inter, Arial, sans-serif'});
      document.body.append(target);
    }
    target.textContent = message;
    target.style.background = bad ? '#fff1ee' : '#e4f9f4';
    target.style.color = bad ? '#922e22' : '#075e55';
  }
  async function api(path, data) {
    const options = {credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}};
    if (data !== undefined) {
      if (!csrf) {
        const t = await api('/auth/csrf.php');
        if (!t.csrf_token) throw Error('Session security token unavailable. Sign in again.');
        csrf = t.csrf_token;
      }
      options.method = 'POST';
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify({...data, csrf_token:csrf});
    }
    const response = await fetch(endpoint(path), options);
    const result = await response.json().catch(() => ({ok:false,message:'The server did not return JSON. Check Apache and PHP.'}));
    if (!response.ok || result.ok !== true) {
      if (response.status === 403) csrf = '';
      throw Error(result.message || result.error || `HTTP ${response.status}`);
    }
    return result;
  }
  function initials(first, last) { return ((first||'').slice(0,1)+(last||'').slice(0,1)).toUpperCase() || 'AL'; }
  function markAvatar() {
    const img = $('header img[alt="Profile"]');
    if (!img) return;
    const avatar = el('span', img.className.replace(/object-cover/g,'') + ' bg-primary-container text-on-primary font-bold inline-flex items-center justify-center');
    avatar.textContent = initials(profile?.first_name,profile?.last_name);
    avatar.style.flexShrink = '0'; avatar.style.cursor='pointer';
    const link = el('a'); link.href = 'company-profile.html#section-overview';
    link.dataset.employerProfile=''; link.title='Employer profile';
    link.append(avatar); img.replaceWith(link);
    const identity = $('header .text-right');
    if (identity) {
      identity.title = 'Open employer profile'; identity.style.cursor = 'pointer';
      identity.addEventListener('click',() => location.href = 'company-profile.html#section-overview');
    }
  }
  function updateAccountHeader() {
    if (!profile) return;
    const name = $('header .text-right .font-label-md');
    if (name) name.textContent = [profile.first_name,profile.last_name].filter(Boolean).join(' ');
    const role = $('header .text-right .font-body-sm');
    if (role) role.textContent = profile.job_title || 'Employer contact';
  }
  function openModal(title, renderer) {
    closeModal();
    modalTrigger=document.activeElement;
    overlay = el('div');overlay.setAttribute('role','presentation');overlay.id='attachlink-stage10b-modal';
    Object.assign(overlay.style,{position:'fixed',inset:'0',background:'#102b2c88',zIndex:'110000',display:'flex',alignItems:'center',justifyContent:'center',padding:'18px'});
    const dialog = el('section','bg-surface-container-lowest rounded-xl shadow-xl text-on-surface');
    dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',title);
    Object.assign(dialog.style,{width:'min(720px,100%)',maxHeight:'90vh',overflow:'auto',padding:'24px',fontFamily:'Inter,Arial,sans-serif'});
    const row = el('div','flex items-center justify-between gap-space-md mb-space-md');
    const heading=el('h2','font-headline-sm text-headline-sm text-primary',title);
    const close=el('button','px-space-md py-2 rounded-lg bg-surface-container text-on-surface','Close ×'); close.type='button';close.onclick=closeModal;
    row.append(heading,close); dialog.append(row); renderer(dialog);
    overlay.append(dialog); document.body.append(overlay);
    overlay.addEventListener('mousedown',ev=>{if(ev.target===overlay)closeModal();});
    document.addEventListener('keydown',modalKeys);
    close.focus();return dialog;
  }
  let modalTrigger;
  function modalKeys(event) {
    if (event.key==='Escape') { closeModal(); return; }
    if (event.key!=='Tab') return;
    const items=[...overlay.querySelectorAll('a[href],button,input,select,textarea,[tabindex="0"]')].filter(node=>!node.disabled&&node.getClientRects().length);
    const first=items[0],last=items.at(-1);
    if (event.shiftKey&&document.activeElement===first) { event.preventDefault();last?.focus(); }
    else if (!event.shiftKey&&document.activeElement===last) { event.preventDefault();first?.focus(); }
  }
  function closeModal(){
    if (!overlay) return;
    overlay.remove();overlay=null;
    document.removeEventListener('keydown',modalKeys);
    modalTrigger?.focus();
  }
  function actionButton(label, onClick, secondary=false) {
    const b=el('button',secondary?'px-space-md py-2 rounded-lg bg-surface-container text-on-surface font-label-md text-label-md':'px-space-md py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md',label);
    b.type='button'; b.style.cursor='pointer';b.addEventListener('click',onClick);return b;
  }
  function fieldsRow(label,value,readonly=false,multi=false) {
    const wrapper=el('label','flex flex-col gap-1 font-label-md text-label-md text-on-surface');wrapper.style.marginBottom='12px';
    const labelText=el('span','text-outline',label);
    const input=el(multi?'textarea':'input','w-full rounded-lg bg-surface-container-low text-on-surface px-space-md py-3');
    input.style.border='1px solid #c8ddda'; input.style.minHeight=multi?'94px':'44px';input.style.font='inherit';
    input.value=value||''; input.readOnly=readonly;
    if(readonly)input.style.opacity='.8';
    wrapper.append(labelText,input);return [wrapper,input];
  }

  async function editProfile() {
    try { profile=(await api('/employer/profile.php')).profile; updateAccountHeader(); }
    catch(err){note('Employer profile: '+err.message,true);return;}
    openModal('Edit employer profile',modal=>{
      const description=el('p','font-body-sm text-on-surface-variant mb-space-lg','Change your contact and organization details. Legal business name and verification are admin-controlled.');modal.append(description);
      const form=el('form','grid grid-cols-1 gap-space-sm');
      const entries=[['First name',profile.first_name,'first_name'],['Last name',profile.last_name,'last_name'],['Role / job title',profile.job_title,'job_title'],['Organization location',profile.location,'location'],['Organization description',profile.description,'description'],['Registered legal name (admin controlled)',profile.organization_name,'_legal']];
      const values={};for(const [label,val,key] of entries){const [wrap,input]=fieldsRow(label,val,key==='_legal',key==='description');form.append(wrap);values[key]=input;}
      const message=el('p','font-body-sm text-on-surface-variant','');message.setAttribute('role','status');
      const buttons=el('div','flex gap-space-sm flex-wrap');const save=actionButton('Save profile',async()=>{
        save.disabled=true;message.textContent='Saving…';
        const payload={first_name:values.first_name.value,last_name:values.last_name.value,job_title:values.job_title.value,location:values.location.value,description:values.description.value};
        try{const res=await api('/employer/profile.php',payload);profile=res.profile;message.textContent=res.message;updateAccountHeader();setTimeout(()=>{if(overlay)closeModal();location.reload();},650);}catch(e){message.textContent=e.message;save.disabled=false;}
      });
      const cancel=actionButton('Cancel',closeModal,true);buttons.append(save,cancel);form.append(buttons,message);modal.append(form);
    });
  }
  async function showNotifications() {
    const btn=$('header button[aria-label="Notifications"]');if(!btn)return;
    if (alertOpen){const t=$('#employer-alert-tray');if(t)t.remove();alertOpen=false;btn.setAttribute('aria-expanded','false');return;}
    let response;
    try{response=await api('/employer/alerts.php'); alertsCache=response;}catch(err){note('Notifications: '+err.message,true);return;}
    const tray=el('div','bg-surface-container-lowest rounded-xl shadow-xl text-on-surface');tray.id='employer-alert-tray';
    Object.assign(tray.style,{position:'fixed',top:'78px',right:'22px',width:'min(430px,calc(100vw - 34px))',maxHeight:'75vh',overflow:'auto',zIndex:'99990',border:'1px solid #d6e3e1',padding:'18px'});
    const title=el('h3','font-headline-sm text-headline-sm mb-space-sm','Notifications');tray.append(title);
    const unread=el('p','font-body-sm text-on-surface-variant mb-space-md',response.unread_messages+' unread message(s) • Recent applications');tray.append(unread);
    const items=[...response.messages.map(x=>({...x,section:'Message'})),...response.applications.map(x=>({...x,section:'Application'}))];
    if (!items.length) tray.append(el('p','text-on-surface-variant','No messages or applications yet.'));
    for(const x of items){const link=el('a','block p-space-sm rounded-lg hover:bg-surface-container mb-space-xs');link.style.display='block';link.style.textDecoration='none';link.style.color='inherit';
      link.href=x.type==='message'?'messages.html?peer_id='+encodeURIComponent(x.peer_id):'applicant-profile.html?application_id='+encodeURIComponent(x.id);
      link.append(el('strong','font-label-md text-primary',x.title),el('p','font-body-sm text-on-surface-variant',x.detail||''));tray.append(link);
    }
    const tools=el('div','flex flex-wrap gap-space-sm mt-space-md');tools.append(actionButton('Open inbox',()=>location.href='messages.html'),actionButton('Review applicants',()=>location.href='opening-applicants.html',true));tray.append(tools);
    document.body.append(tray);alertOpen=true;btn.setAttribute('aria-expanded','true');
    const leave=e=>{if(!tray.contains(e.target)&&!btn.contains(e.target)){tray.remove();alertOpen=false;document.removeEventListener('click',leave,true);}};
    // Don't treat this event as an outside click on the opening button.
    setTimeout(()=>document.addEventListener('click',leave,true),0);
  }
  async function refreshBadge() {
    try{
      const res=await api('/employer/alerts.php');alertsCache=res;
      const nav=$('aside a[data-path="messages"]');
      const badge=nav&&$$('span',nav).find(x=>/^(\d+)$/.test(x.textContent.trim()));
      if(badge)badge.textContent=String(res.unread_messages);
      const dot=$('header button[aria-label="Notifications"] .absolute');
      if(dot)dot.style.display=res.unread_messages?'':'none';
    }catch(_){/* Keep the existing page usable if messages are unavailable. */}
  }
  async function myOpenings() {
    let data;try{data=await api('/employer/listings.php?page=1');}catch(err){note(err.message,true);return;}
    openModal('Manage my openings',modal=>{
      modal.append(el('p','font-body-sm text-on-surface-variant mb-space-md','These are your organization’s database vacancies. Drafts need administrator approval before publication.'));
      const list=el('div','flex flex-col gap-space-sm');modal.append(list);
      const footer=el('div','flex gap-space-sm flex-wrap mt-space-lg');footer.append(actionButton('Create new opening',()=>location.href='post-edit-opening.html'));
      modal.append(footer);
      async function render(rows){list.replaceChildren();
        if(!rows.length){list.append(el('p','text-on-surface-variant','No openings yet. Create the first draft.'));return;}
        for(const l of rows){const card=el('div','p-space-md rounded-lg bg-surface-container-low');card.style.marginBottom='10px';
          card.append(el('strong','font-label-lg text-primary',l.title),el('p','font-body-sm text-on-surface-variant',`${l.city} • ${l.status} • ${l.review_status || 'draft'}`));
          const controls=el('div','flex gap-space-sm flex-wrap mt-space-sm');
          controls.append(actionButton('Applicants',()=>location.href='opening-applicants.html?listing_id='+encodeURIComponent(l.id),true));
          if(l.status==='draft'&&['draft','rejected','legacy_draft'].includes(l.review_status||'draft')){
            controls.append(actionButton('Edit',()=>location.href='post-edit-opening.html?listing_id='+encodeURIComponent(l.id),true));
            controls.append(actionButton('Submit for review',async()=>{
              if(!confirm('Submit this test vacancy for administrator review?'))return;
              try{await api('/employer/listings.php',{action:'submit',listing_id:Number(l.id)});note('Submitted for admin review.');closeModal();location.reload()}catch(e){note(e.message,true)}
            }));
          }
          if(l.status==='published'&&l.review_status==='approved')controls.append(actionButton('Close vacancy',async()=>{
            if(!confirm('Close this opening?'))return;
            try{await api('/employer/listings.php',{action:'close',listing_id:Number(l.id)});note('Vacancy closed.');closeModal();location.reload()}catch(e){note(e.message,true)}
          },true));
          card.append(controls);list.append(card);
        }
      }
      render(data.listings||[]);
      if(data.has_more)modal.append(el('p','font-body-sm text-on-surface-variant','Showing first 20 openings. Additional pages remain available through the backend.'));
    });
  }
  function interceptNavigations() {
    // Stage 8's original sidebar uses placeholder href="#". Do not replace the sidebar HTML.
    for(const a of $$('aside a[data-path]')){
      const name=a.dataset.path;
      if(name==='messages')a.href='messages.html';
      if(name==='help-support')a.href='messages.html?support=1';
      if(name==='dashboard')a.href='dashboard.html';
      if(name==='applicants')a.href='opening-applicants.html';
      if(name==='company-profile')a.href='company-profile.html';
      if(name==='openings'){
        a.href='dashboard.html#stitch-openings';
        a.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();myOpenings();},true);
      }
    }
    // A visible way to return to the shared login without overwriting the original sidebar.
    const sidebarHelp=$('aside a[data-path="help-support"]');
    const footer=sidebarHelp?.closest('.p-space-md');
    if(footer&&!$('#employer-switch-account')){
      const switcher=el('button','font-label-sm text-label-sm text-primary mt-space-sm','Sign out / Switch account');
      switcher.id='employer-switch-account';switcher.type='button';
      switcher.style.textDecoration='underline';switcher.style.cursor='pointer';
      switcher.addEventListener('click',async()=>{
        if(!confirm('Sign out from this employer account?'))return;
        try{await api('/auth/logout.php',{});location.href='login.html';}
        catch(e){note('Sign out failed: '+e.message,true);}
      });
      footer.append(switcher);
    }
    const bell=$('header button[aria-label="Notifications"]');
    if(bell){bell.setAttribute('aria-expanded','false');bell.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();showNotifications();},true)}
    // Two original design navigation buttons lead to the actual working views.
    if(page==='dashboard.html'){
      for(const button of $$('main button')){
        if(/View Verification Details/.test(button.textContent))button.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();location.href='company-profile.html#section-legal';},true);
        else if(/View All|Post \/ Edit Openings/.test(button.textContent)&&button.closest('main'))button.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();myOpenings();},true);
        else if(/tune/.test(button.textContent.trim())&&button.textContent.length<40)button.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();location.href='opening-applicants.html';},true);
      }
    }
    if(page==='company-profile.html'){
      const edit=$$('main button').find(b=>/Edit Details/.test(b.textContent));
      if(edit)edit.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();editProfile();},true);
      const ping=$$('main button').find(b=>/Send Internal Ping/.test(b.textContent));
      if(ping)ping.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();location.href='messages.html?support=1';},true);
      if(location.hash.includes('section-legal')&&typeof window.switchTab==='function')window.switchTab('legal');
    }
    if(page==='applicant-profile.html'){
      const message=$$('main button').find(b=>/^chat\s+Message$/.test(b.textContent.trim())||b.textContent.trim()==='Message');
      if(message)message.addEventListener('click',async e=>{e.preventDefault();e.stopImmediatePropagation();
        const id=new URLSearchParams(location.search).get('application_id');if(!id)return note('Select an applicant first.',true);
        try{const res=await api('/employer/applicant-contact.php?application_id='+encodeURIComponent(id));location.href='messages.html?peer_id='+res.contact.user_id;}
        catch(err){note('Cannot open message: '+err.message,true)}
      },true);
    }
    if(page==='post-edit-opening.html')editorExtras();
  }
  function editorExtras() {
    const title=$('#input-title'),desc=$('#input-description');
    const inputSnapshot={};
    for(const x of $$('#attachment-form input[id],#attachment-form select[id],#attachment-form textarea[id]'))inputSnapshot[x.id]=x.value;
    const revert=$$('main button').find(b=>/Revert Changes/.test(b.textContent));
    if(revert)revert.addEventListener('click',e=>{
      e.preventDefault();e.stopImmediatePropagation();if(!confirm('Restore fields to the values when this editor was opened?'))return;
      for(const [id,value] of Object.entries(inputSnapshot)){const input=$('#'+CSS.escape(id));if(input){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}}
      note('Editor fields restored. Database records were not changed.');
    },true);
    const preview=$$('main button').find(b=>/Student Preview Mode/.test(b.textContent));
    if(preview)preview.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();
      const card=$('#preview-title')?.closest('.rounded-xl')||$('#preview-title');
      if(card){card.scrollIntoView({behavior:'smooth',block:'center'});card.style.outline='3px solid #0c786d';setTimeout(()=>card.style.outline='',1500)}
      note('Student preview is a local design preview. Only approved listings appear in the student portal.');
    },true);
    $$('main button').find(b=>/Add Discipline/.test(b.textContent))?.remove();
    for(const b of $$('main button')){
      if(!/^(format_bold|format_italic|format_list_bulleted)$/.test(b.textContent.trim()))continue;
      b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();if(!desc)return;
        const start=desc.selectionStart,end=desc.selectionEnd,text=desc.value.slice(start,end),kind=b.textContent.trim();
        const insertion=kind==='format_bold'?'**'+(text||'bold text')+'**':kind==='format_italic'?'*'+(text||'italic text')+'*':'\n- '+(text||'item');
        desc.setRangeText(insertion,start,end,'end');desc.dispatchEvent(new Event('input',{bubbles:true}));desc.focus();
      },true);
    }
    $$('main button').find(b=>/Quick Apply with Industrial Letter/.test(b.textContent))?.remove();
  }
  async function init() {
    interceptNavigations();markAvatar();
    try{profile=(await api('/employer/profile.php')).profile;syncIdentity=true;updateAccountHeader();
      const avatar=$('header a[data-employer-profile] span');if(avatar)avatar.textContent=initials(profile.first_name,profile.last_name);
    }catch(err){if(/sign in|401|403/i.test(err.message))note('Sign in to the employer portal to continue.',true);}
    await refreshBadge();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

}

/* AttachLink Stage 14 — show the employer's registered COMPANY name in the portal header.
   Personal contact details are still editable within Company Profile. */
(() => {
  'use strict';
  const endpoint = '../../backend/api/employer/profile.php';
  let company = null;
  let observer = null;
  let updating = false;
  function initials(name) {
    const words = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return 'CO';
    return (words.length > 1 ? words[0][0]+words[1][0] : words[0].slice(0,2)).toUpperCase();
  }
  function render() {
    if (updating || !company) return;
    updating = true;
    try {
      const text = document.querySelector('header .text-right .font-label-md');
      if (text && text.textContent.trim() !== company) text.textContent = company;
      const role = document.querySelector('header .text-right .font-body-sm');
      if (role && role.textContent.trim() !== 'Company account') role.textContent = 'Company account';
      const avatar = document.querySelector('header a[data-employer-profile] span');
      const letters = initials(company);
      if (avatar && avatar.textContent.trim() !== letters) avatar.textContent = letters;
    } finally { updating = false; }
  }
  async function loadCompany() {
    try {
      const response = await fetch(endpoint, {credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
      if (!response.ok) return;
      const data = await response.json();
      const legalName = data?.profile?.organization_name;
      if (data?.ok && typeof legalName === 'string' && legalName.trim()) {
        company = legalName.trim();
        render();
      }
    } catch {/* Do not replace the header with a personal name on a failed API call. */}
  }
  function init() {
    if (!document.querySelector('header')) return;
    render();
    observer = new MutationObserver(() => { render(); });
    observer.observe(document.querySelector('header'), {subtree:true,childList:true,characterData:true});
    loadCompany();
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();

