/* AttachLink Stage 9B: behavior-only integration for the ORIGINAL uploaded Administrator Stitch screens.
 * Never treat the source templates' 2024/25 national statistics, PDF certificates or sample people as real records.
 * Backend endpoints enforce administrator role; this script does not implement authorization.
 */
(() => {
  'use strict';
  const path = location.pathname.split('/').pop();
  const apiRoot = '../../backend/api/';
  const text = (node, value) => { if (node) node.textContent = String(value ?? '—'); };
  const byId = id => document.getElementById(id);
  const number = n => Number(n || 0).toLocaleString('en-US');
  const q = selector => document.querySelector(selector);
  const qAll = selector => [...document.querySelectorAll(selector)];
  const findText = (selector, term) => qAll(selector).find(e => e.textContent.trim().toLowerCase().includes(term.toLowerCase()));
  const element = (name, className, content) => {
    const e = document.createElement(name);
    if (className) e.className = className;
    if (content !== undefined) text(e, content);
    return e;
  };
  function note(message, error=false) {
    let n = byId('stage9b-notice');
    if (!n) {
      n = element('div', 'al-stage9b-note'); n.id='stage9b-notice';n.setAttribute('role','status');
      const main=q('main'); if (main) main.prepend(n); else document.body.prepend(n);
    }
    n.className='al-stage9b-note'+(error?' al-stage9b-error':'');
    text(n,message);
  }
  async function api(path, payload) {
    let opt={credentials:'same-origin',cache:'no-store',headers:{'Accept':'application/json'}};
    if (payload !== undefined) {
      const csrf=await api('auth/csrf.php');
      if (!csrf.csrf_token) throw Error('Could not verify the administrative form session.');
      opt.method='POST'; opt.headers['Content-Type']='application/json';
      opt.body=JSON.stringify({...payload,csrf_token:csrf.csrf_token});
    }
    let r, j;
    try { r=await fetch(apiRoot+path,opt); } catch (e) { throw Error('The administrator portal is temporarily unavailable.'); }
    try { j=await r.json(); } catch(e) { throw Error('Backend returned an unexpected response (HTTP '+r.status+').'); }
    if(!r.ok || j.ok===false) {
      const message=j.message||j.error||('HTTP '+r.status);
      const err=new Error(message);err.status=r.status;throw err;
    }
    return j;
  }
  function placeholder(message) { return element('div','al-stage9b-placeholder',message); }
  function replaceCardBody(heading, title, message) {
    const h=findText('h2,h3',heading);
    if (!h) return;
    text(h,title);
    const card=h.closest('.bg-surface-container-lowest');
    if (!card) return;
    const head=[...card.children].find(c=>c.contains(h));
    for(const child of [...card.children]) if(child !== head) child.remove();
    card.append(placeholder(message));
  }
  function replaceLeaf(needle,replacement){
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes){
      if(['SCRIPT','STYLE'].includes(node.parentNode?.nodeName))continue;
      if(node.nodeValue && node.nodeValue.includes(needle))node.nodeValue=node.nodeValue.replace(needle,replacement);
    }
  }
  function neutralizeOfficialTemplates(){
    const replacements={
      'Intake 2024/2025 - Active':'Attachment administration',
      'National Liaison Network • Harare HQ':'',
      'Operating under Zimbabwe Council for Higher Education (ZIMCHE) Act 25:27 Attachment Directives.':'AttachLink administration',
      'Official Liaison Contact: +263 (242) 791-641':'No official liaison contact connected',
      'Directorate Node 01 - Harare':'',
      'Liaison cycles across 2024 calendar intake (Jan - Oct)':'Historical trends unavailable',
      'Host absorption rate across top 5 enrolled qualifications':'Programme statistics not connected',
      'Regional spread across industrial clusters':'Regional statistics not connected',
      'Intake 2024/2025 - ACTIVE':'Attachment administration',
      'NATIONAL REGISTRY SYNC ACTIVE':'',
      'National Registry Sync Active':'',
      'SYS-REF: ZWE-HE-2024/25-ATT':'AttachLink'
    };
    for(const [needle,replacement] of Object.entries(replacements))replaceLeaf(needle,replacement);
  }
  function scrubIdentity() {
    // Change placeholder officer identity and official claims to local development context.
    qAll('header,aside').forEach(region=>{
      const walker=document.createTreeWalker(region,NodeFilter.SHOW_TEXT);
      const replacements={
        'Eng. Tendai Moyo':'Administrator',
        'Chief Liaison Director · Harare':'AttachLink',
        'Zimbabwe Council':'AttachLink',
        'Higher & Tertiary Education Liaison Network':'Administration',
        'INTAKE 2024/2025 - ACTIVE':'ATTACHMENT ADMINISTRATION'
      };
      const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
      nodes.forEach(n=>{for(const [from,to] of Object.entries(replacements)) if(n.nodeValue?.includes(from))n.nodeValue=n.nodeValue.replace(from,to);});
      // Replace example headshot with a neutral letter avatar; preserve original shape/size.
      region.querySelectorAll('img[alt="Profile"]').forEach(img=>{
        img.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="#005c55"/><text x="48" y="60" text-anchor="middle" font-size="37" font-family="Arial" font-weight="bold" fill="white">AD</text></svg>');
      });
      region.querySelectorAll('img[alt="AttachLink Logo"]').forEach(img=>{
        img.alt='AL';img.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" rx="12" fill="#005c55"/><text x="24" y="30" text-anchor="middle" font-size="17" font-family="Arial" font-weight="bold" fill="white">AL</text></svg>');
      });
    });
    const links={overview:'dashboard.html',verification:'verification-queue.html',companies:'companies.html',attachees:'attachees-directory.html',placements:'placements-registry.html',settings:'system-settings.html'};
    qAll('nav a[data-path]').forEach(a=>{const key=a.dataset.path;if(links[key])a.href=links[key];});
    document.title='AttachLink | Administrator Portal';
  }
  function attachLinkHandlers() {
    // Prevent template buttons with no backend from misleading the admin.
    qAll('button').filter(b => /Export Directorate|Print Formal Gazette|Record Manual Placement|Batch Status Notice|Register Student|Schedule Intake|Add Degree|Connect Hub|Provision Officer/i.test(b.textContent)).forEach(b=>{
      b.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();alert('This function is not connected to the AttachLink database yet.');},true);
    });
  }
  async function companyDirectory() {
    const {companies}=await api('admin/companies.php');
    const search=byId('company-search');
    const filter=byId('company-status-filter');
    const list=byId('company-results');
    const status=byId('company-results-status');
    const labels={pending:'Pending review',verified:'Verified',rejected:'Rejected'};
    function render() {
      const term=search.value.trim().toLowerCase();
      const visible=companies.filter(company=>(!filter.value||company.verification_status===filter.value) &&
        [company.name,company.industry,company.city].some(value=>String(value??'').toLowerCase().includes(term)));
      list.replaceChildren();
      for(const company of visible) {
        const card=element('li','company-directory-card');
        const title=element('h2','',company.name);
        const location=[company.industry,company.city].filter(Boolean).join(' ? ');
        const badge=element('span','company-directory-status',labels[company.verification_status]||'Status unavailable');
        badge.dataset.status=company.verification_status;
        card.append(title,badge);
        if(location)card.append(element('p','',location));
        if(company.description)card.append(element('p','',company.description));
        list.append(card);
      }
      status.textContent=visible.length ? visible.length+' '+(visible.length===1?'company':'companies') : 'No companies match your filters.';
    }
    search.addEventListener('input',render);
    filter.addEventListener('change',render);
    render();
  }
  async function identity() {
    const data=await api('auth/me.php');
    const name=[data.user.first_name,data.user.last_name].filter(Boolean).join(' ');
    qAll('header span').filter(e=>e.childElementCount===0 && e.textContent.trim()==='Administrator').forEach(e=>text(e,name||'Administrator'));
  }
  async function overview(data) {
    const ui=window.AttachLinkOverview;
    const hero=q('main h1');
    if(hero)text(hero,'Administration');
    const lead=findText('main p','National Attachment Cycle Monitoring');
    if(lead)text(lead,'Manage companies, applications and placements.');
    const badge=findText('main span','ZIMCHE Regulated');
    if(badge)badge.hidden=true;
    for(const heading of ['Monthly Application & Verification Trends','Placements by Faculty','Provincial Allocation Hubs']){
      const card=findText('h2,h3',heading)?.closest('.bg-surface-container-lowest');
      if(card)card.style.display='none';
    }
    const container=q('#al-admin-overview-loading')||q('main .lg\\:grid-cols-5');
    const section=ui.node('section','al-overview admin-overview');
    section.setAttribute('aria-labelledby','admin-overview-title');
    const header=ui.node('div','admin-overview-header');
    const heading=ui.node('h2','','Platform overview');
    heading.id='admin-overview-title';
    header.append(heading,ui.actions([['Review companies','verification-queue.html'],['View users','attachees-directory.html']]));
    section.append(header);
    const groups=[
      ['Accounts and verification',[
        ['Registered students','school','students'],['Registered employers','domain','employers'],
        ['Companies awaiting review','schedule','companies_pending'],['Verified companies','verified','companies_verified']
      ]],
      ['Recruitment and support',[
        ['Active openings','work','openings'],['Applications','description','applications'],
        ['Accepted applications','check_circle','accepted_applications'],['Placements','assignment_turned_in','placements'],
        ['Open support conversations','support_agent','pending_support_conversations']
      ]]
    ];
    for(const [label,metrics] of groups){
      const group=ui.node('div','admin-overview-group');
      group.append(ui.node('h3','',label),ui.metrics(metrics.map(([name,icon,key])=>[name,icon,data.counts[key]])));
      section.append(group);
    }
    if(container)container.replaceWith(section);else q('main')?.prepend(section);
    const verifyButton=findText('button','Initiate Verification');
    if(verifyButton)verifyButton.onclick=()=>location.href='verification-queue.html';

    const reviewHead=findText('h2','Directorate Review Queue');
    const review=reviewHead?.closest('.bg-surface-container-lowest');
    if(!review)return;
    const titleBar=[...review.children].find(child=>child.contains(reviewHead));
    for(const child of [...review.children])if(child!==titleBar)child.remove();
    text(reviewHead,'Company verification');
    const viewButton=findText('button','View All');
    if(viewButton)viewButton.onclick=()=>location.href='verification-queue.html';
    try{
      const {companies}=await api('admin/companies.php');
      const pending=companies.filter(company=>company.verification_status==='pending');
      const badge=reviewHead.parentElement?.querySelector('span');
      if(badge)text(badge,String(data.counts.companies_pending)+' pending');
      if(!pending.length)review.append(placeholder('No companies are awaiting verification.'));
      for(const company of pending.slice(0,7)){
        const row=element('a','al-stage9b-list-row',company.name);
        row.href='verification-queue.html';
        review.append(row);
      }
    }catch{review.append(placeholder('The verification queue is temporarily unavailable.'));}
  }
  let selected=null;let reviewItems=[];let queueFilter='all';
  function setInspector(item) {
    selected=item;
    text(byId('doc-id'),item?`TEST ${item.type.toUpperCase()} #${item.id}`:'No record selected');
    text(byId('inspect-title'),item?.name||'Select an organization or listing');
    text(byId('inspect-subtitle'),item?.description||'No official documents connected.');
    for(const id of ['meta-degree','meta-gpa','meta-phone','meta-host'])text(byId(id),'Not linked');
    if(item)text(byId('meta-host'),item.type==='listing'?item.organization:'Organization review');
    const notes=byId('liaison-endorsement-notes');if(notes)notes.value='';
    byId('verification-file-list')?.remove();
    if(item?.type==='organization'){
      const listing=element('div','al-stage9b-muted','Loading verification documents...');
      listing.id='verification-file-list';
      byId('inspect-subtitle')?.after(listing);
      const url='company-files.php?company_id='+encodeURIComponent(item.id);
      api(url).then(result=>{
        if(selected!==item)return;
        listing.replaceChildren();
        for(const file of result.files.filter(file=>file.purpose==='verification')){
          const a=element('a','block text-primary underline',file.original_name);
          a.href='../../backend/api/'+url+'&id='+encodeURIComponent(file.id);
          listing.append(a);
        }
        if(!listing.childElementCount)listing.textContent='No verification documents uploaded.';
      }).catch(error=>{listing.textContent=error.message;});
    }
  }
  function renderReviewQueue() {
    const container=byId('submissions-container');if(!container)return;
    container.replaceChildren();
    const visible=reviewItems.filter(x=>queueFilter==='all'||(queueFilter==='company'&&x.type==='organization')||(queueFilter==='listing'&&x.type==='listing'));
    if(!visible.length){container.append(placeholder('No matching pending review records.'));return;}
    for(const item of visible){
      const row=element('div','submission-row grid grid-cols-12 px-space-md py-space-md cursor-pointer hover:bg-surface-container-low items-center');
      const title=element('div','col-span-5 font-headline-sm text-body-md font-semibold text-on-surface truncate',item.name);
      const desc=element('div','col-span-4 text-body-sm text-body-sm text-on-surface-variant',item.type==='listing'?'Vacancy review':'Organization verification');
      const status=element('div','col-span-3 font-body-sm text-body-sm text-secondary text-right','Pending');
      row.append(title,desc,status);row.tabIndex=0;row.onclick=()=>setInspector(item);row.onkeydown=e=>{if(e.key==='Enter')row.click();};container.append(row);
    }
    if(!selected||!visible.includes(selected))setInspector(visible[0]);
  }
  async function loadQueue() {
    const [orgs,listings]=await Promise.all([api('admin/companies.php'),Promise.resolve({listings:[]})]);
    reviewItems=[...orgs.companies.filter(x=>['pending','unverified'].includes(x.verification_status)).map(x=>({type:'organization',id:x.id,name:x.name,description:x.description||x.location||'Organization status pending external verification'})),
      ...listings.listings.filter(x=>x.review_status==='pending').map(x=>({type:'listing',id:x.id,name:x.title,organization:x.organization,description:x.description||'Vacancy review'}))];
    const counts={all:reviewItems.length,company:reviewItems.filter(x=>x.type==='organization').length,listing:reviewItems.filter(x=>x.type==='listing').length};
    text(byId('tab-all'),'All pending ('+counts.all+')');
    text(byId('tab-company'),'Companies ('+counts.company+')');
    text(byId('tab-student'),'Vacancies ('+counts.listing+')');
    renderReviewQueue();
  }
  async function verification() {
    // Hide copied official certificate preview and statutory claims. They don't exist in database.
    const inspection=byId('inspect-title')?.closest('.bg-surface-container-lowest');
    if(inspection){
      const preview=[...inspection.children][2];if(preview)preview.replaceWith(placeholder('No verification documents uploaded.'));
      const buttons=inspection.querySelectorAll('[onclick="zoomDocumentModal()"],[onclick="downloadOriginalDoc()"]');buttons.forEach(b=>{b.disabled=true;b.title='Documents not connected';b.style.opacity='0.45';});
      const label=inspection.querySelector('.uppercase');if(label)text(label,'Verification review');
      const quick=inspection.querySelector('#preset-chips');if(quick)quick.remove();
      const approve=findText('button','Approve & Issue Permit');if(approve)text(approve.querySelector('span:last-child')||approve,'Approve record');
    }
    // Hide non-source-backed legal compliance section; never claim statutory certification.
    const right=inspection?.parentElement;if(right&&right.children[1])right.children[1].replaceWith(placeholder('Review the evidence provided by the company.'));
    const noticeNode=findText('main p','Compliance')||findText('main div','ZIMCHE');
    if(noticeNode && noticeNode.childElementCount===0)text(noticeNode,'LOCAL TEST REVIEW · No independent accreditation claims');
    window.filterCategory = value=>{
      queueFilter=value==='student'?'listing':value;
      const active=value==='student'?'student':value==='company'?'company':'all';
      [['all','tab-all'],['company','tab-company'],['student','tab-student']].forEach(([v,id])=>{
        const b=byId(id);if(!b)return;const on=active===v;
        b.classList.toggle('bg-surface-container-lowest',on);b.classList.toggle('shadow-sm',on);
        b.classList.toggle('text-on-surface',on);b.classList.toggle('text-on-surface-variant',!on);
      });
      renderReviewQueue();
    };
    window.filterUrgency = ()=>{};
    window.selectSubmission = ()=>{};
    window.zoomDocumentModal=()=>alert('Document previews are not connected yet.');
    window.downloadOriginalDoc=()=>alert('There are no uploaded verification documents to download.');
    window.insertTag=()=>{};
    window.triggerDecision=async decision=>{
      if(!selected){alert('Select a pending organization or listing first.');return;}
      if(decision==='request_correction'){alert('Correction requests do not yet have a backend endpoint.');return;}
      const noteEl=byId('liaison-endorsement-notes'); const reason=noteEl?.value.trim()||'';
      if(reason.length<10){alert('Enter a review note of at least 10 characters.');noteEl?.focus();return;}
      if(decision==='approve' && selected.type==='organization' && !confirm('Only mark this organization verified if you have independently checked its identity. Continue?')) return;
      const payload=selected.type==='organization' ? {organization_id:Number(selected.id),decision:decision==='approve'?'verified':'rejected',note:reason} : {listing_id:Number(selected.id),decision:decision==='approve'?'approved':'rejected',note:reason};
      try{const result=await api('admin/companies.php',{company_id:payload.organization_id,status:payload.decision,note:reason});alert(result.message||'Decision saved.');selected=null;await loadQueue();}
      catch(e){alert('Decision not saved: '+e.message);}
    };
    if(location.search.includes('focus=organizations'))queueFilter='company';
    await loadQueue();
    const banner=findText('span','14 Documents Pending Review');if(banner)text(banner,reviewItems.length+' pending reviews');
    const headerText=findText('main span','Institutional Verification Queue');if(headerText)text(headerText,'AttachLink Review Queue');
    replaceLeaf('Cycle: 2024/2025 National Placement Audits','Company review queue');
    replaceLeaf('Statutory clearance under the Zimbabwe Council for Higher Education (ZIMCHE) industrial placement framework. Endorse tripartite agreements, risk indemnities, and company host quotas.','Review pending company records and supporting documents.');
    replaceLeaf('Showing 6 of 14 submissions in active cycle','Showing '+reviewItems.length+' pending records on this page');
    replaceLeaf('Page 1 of 3','Page 1 (max 20)');
    qAll('main button').filter(b=>['Previous','Next'].includes(b.textContent.trim())).forEach(b=>{b.disabled=true;b.title='Pagination not connected yet';});
    replaceLeaf('28 Docs','Not tracked');replaceLeaf('4.2 Hrs','Not tracked');
    replaceLeaf('Auditor: Eng. Tendai Moyo','Review by signed-in administrator');
    window.filterCategory(queueFilter==='listing'?'student':queueFilter);
    const search=byId('queue-search');if(search)search.addEventListener('input',()=>{
      const term=search.value.toLowerCase().trim();
      byId('submissions-container')?.querySelectorAll('.submission-row').forEach(row=>{row.style.display=row.textContent.toLowerCase().includes(term)?'':'none';});
    });
    note('Review the company evidence before approving.');
  }
  async function attachees() {
    const h=q('main h1');if(h)text(h,'Student Directory (Test Accounts)');
    const p=h?.parentElement?.querySelector('p');if(p)text(p,'Registered student accounts');
    const tbody=q('main table tbody');if(tbody)tbody.replaceChildren();
    const drawer=byId('student-drawer');if(drawer)drawer.classList.add('hidden');
    const all=await Promise.all([api('admin/users.php'),api('admin/overview.php')]);
    const students=all[0].users.filter(u=>u.role==="student");const totals=all[1];
    const directorySearch=q('main input[placeholder^=\"Search by student name\"]');
    if(tbody){
      if(!students.length) { const tr=element('tr');const td=element('td','p-space-lg','No student accounts on this page.');td.colSpan=7;tr.append(td);tbody.append(tr); }
      for(const s of students){
        const tr=element('tr','border-b border-surface-container');
        tr.dataset.directoryRecord=JSON.stringify(s);
        const cells=[`${s.first_name} ${s.last_name}`,s.programme||'Not provided',s.institution||'Not provided','Not connected',s.account_status||'—',s.application_count+' applications','View'];
        cells.forEach((v,index)=>{const td=element('td','px-space-md py-space-sm font-body-sm text-body-sm',v); if(index===6){td.textContent='';const btn=element('button','text-primary font-headline-sm text-headline-sm','View');btn.type='button';btn.onclick=()=>{if(drawer){drawer.classList.remove('hidden');text(byId('drawer-name'),s.first_name+' '+s.last_name);text(byId('drawer-programme'),s.programme||'Not provided');text(byId('drawer-dept'),s.institution||'Not provided');text(byId('drawer-status'),s.account_status);text(byId('drawer-host'),'Not linked');text(byId('drawer-location'),s.city||'Not provided');text(byId('drawer-supervisor'),'Not linked');text(byId('drawer-phone'),'Not disclosed');text(byId('drawer-email'),'Not disclosed');text(byId('drawer-regno'),'Account #'+s.id);}};td.append(btn);}tr.append(td);});tbody.append(tr);
      }
    }
    const directoryMetrics=[
      ['Accepted Applications',totals.application_totals.accepted],
      ['Submitted Applications',totals.application_totals.submitted],
      ['Students (total)',totals.account_totals.students],
      ['Awaiting Review',totals.application_totals.reviewing]
    ];
    const dirCards=qAll('main .font-metric-kpi').slice(0,4);
    dirCards.forEach((metric,i)=>{
      text(metric,number(directoryMetrics[i][1]));
      const card=metric.closest('.bg-surface-container-lowest');
      if(card){const label=card.querySelector('.uppercase');if(label)text(label,directoryMetrics[i][0]);
        const badge=metric.parentElement?.querySelector('span:not(.font-metric-kpi)');if(badge)text(badge,'DB');
      }
    });
    qAll('button').filter(b=>/Batch Status Notice|Register Student|Export Student List/i.test(b.textContent)).forEach(b=>{b.title='Not connected; read-only registry.';});
    replaceLeaf('National Summary:','Summary');
    replaceLeaf('2,680 Placed',number(totals.application_totals.accepted)+' accepted');
    replaceLeaf('712 Applied',number(totals.application_totals.submitted)+' submitted');
    replaceLeaf('410 Unplaced','Not tracked');replaceLeaf('40 Flagged','Not tracked');
    const registryFooter=[...qAll('main span,main p')].find(x=>x.childElementCount===0 && /3,842 students/.test(x.textContent));
    if(registryFooter)text(registryFooter,'Showing '+students.length+' student account(s) on this page');
    replaceLeaf('Showing 1 to 7 of 3,842 students','Showing '+students.length+' student accounts');
    replaceLeaf('Intake: 2024/2025','All intakes');replaceLeaf('Level: Part III','All levels');
    const selectors=qAll('main select');
    const options=[
      ['All institutions','institution'],['All programmes','programme'],
      ['All levels','study_level'],['All statuses','account_status']
    ];
    selectors.forEach((select,index)=>{
      const option=options[index]; if(!option){select.disabled=true;return;} const [label,key]=option;
      const values=[...new Set(students.map(student=>student[key]).filter(Boolean))].sort();
      select.replaceChildren(new Option(label,''),...values.map(value=>new Option(value,value)));
      select.onchange=filterDirectory;
    });
    function filterDirectory(){
      const search=(directorySearch?.value||'').trim().toLowerCase();
      for(const row of qAll('tr[data-directory-record]')){
        const student=JSON.parse(row.dataset.directoryRecord);
        const matches=[student.first_name,student.last_name,student.id,student.institution,student.programme].join(' ').toLowerCase().includes(search);
        row.hidden=!matches||selectors.some((select,index)=>select.value&&options[index]&&select.value!==student[options[index][1]]);
      }
    }
    if(directorySearch){
      directorySearch.placeholder='Search name, account ID, institution or programme';
      directorySearch.oninput=filterDirectory;
    }
    const badge=findText('main span','National Registry Sync Active');if(badge)text(badge,'');
    note('Read-only directory · Showing '+students.length+' student accounts on the first page. Contact details and document verification are not connected.');
  }
  async function settings() {
    const months=byId('attachment-months');
    const cadence=byId('logbook-cadence');
    const grace=byId('registration-grace');
    const stipend=byId('minimum-stipend');
    function populate(data) {
      months.value = data?.attachment_months ?? '12';
      cadence.value = data?.logbook_cadence ?? 'fortnightly';
      grace.value = data?.registration_grace ?? '';
      stipend.value = data?.minimum_stipend ?? '';
    }
    let saved = (await api('admin/settings.php')).settings;
    populate(saved);
    window.handleDiscard = () => populate(saved);
    window.handleSave = async () => {
      try {
        const result = await api('admin/settings.php', {
          attachment_months:Number(months.value), registration_grace:grace.value,
          logbook_cadence:cadence.value, minimum_stipend:stipend.value
        });
        saved = result.settings;
        populate(saved);
        note('Settings saved.');
      } catch (error) { note(error.message, true); }
    };
    await manageSettingEntries();
  }

  async function manageSettingEntries(){
    const intake=q('#intakes .grid.md\\:grid-cols-2');
    const campus=q('#campuses .grid.md\\:grid-cols-2');
    const programmes=q('#programmes tbody');
    const empty=(host,label)=>host.append(element('p','text-on-surface-variant p-space-md',label));
    function render(entries){
      for(const host of [intake,campus,programmes])host?.replaceChildren();
      for(const row of entries){
        const d=row.details;
        if(row.category==='programme'){
          const tr=element('tr','hover:bg-surface-container-low');
          for(const value of [row.name+' ('+d.code+')',d.faculty,d.coordinator,d.quota,d.visits])tr.append(element('td','p-space-md',value));
          const td=element('td','p-space-md');
          const toggle=element('input','');toggle.type='checkbox';toggle.checked=Number(row.is_active)===1;
          toggle.setAttribute('aria-label','Enable '+row.name);
          toggle.onchange=async()=>{
            toggle.disabled=true;
            try{render((await api('admin/setting-entries.php',{category:'programme',id:Number(row.id),is_active:toggle.checked})).entries);}
            catch(error){toggle.checked=!toggle.checked;toggle.disabled=false;note(error.message,true);}
          };
          td.append(toggle);tr.append(td);programmes?.append(tr);
          continue;
        }
        const card=element('div','bg-surface-container-low p-space-lg rounded-xl space-y-space-sm');
        card.append(element('h3','font-headline-md text-headline-md',row.name));
        const details=row.category==='campus'?[d.province,d.phone]:['Start: '+d.start_date,'Close: '+d.end_date];
        for(const value of details)card.append(element('p','text-on-surface-variant',value));
        (row.category==='campus'?campus:intake)?.append(card);
      }
      if(intake&&!intake.childElementCount)empty(intake,'No intakes scheduled.');
      if(campus&&!campus.childElementCount)empty(campus,'No campuses registered.');
      if(programmes&&!programmes.childElementCount){const row=element('tr','');const cell=element('td','p-space-md','No programmes configured.');cell.colSpan=6;row.append(cell);programmes.append(row);}
      const count=q('#programmes .flex.items-center.gap-space-sm > span');
      if(count)count.textContent=entries.filter(row=>row.category==='programme').length+' Programmes Configured';
    }
    async function save(category,data){render((await api('admin/setting-entries.php',{category,...data})).entries);note('Record saved.');}
    function editor(label,category,fields){
      const button=qAll('main button').find(item=>item.textContent.includes(label));
      if(!button)return;
      button.onclick=()=>{
        if(q('#settings-entry-form'))return;
        const form=element('form','bg-surface-container-low p-space-lg rounded-xl space-y-space-sm');form.id='settings-entry-form';
        for(const [name,title,type] of fields){
          const label=element('label','block',title);
          const input=element('input','block w-full rounded-lg bg-surface-container-lowest p-space-sm');input.name=name;input.type=type||'text';input.required=true;
          if(type==='number')input.min='0';
          label.append(input);form.append(label);
        }
        const submit=element('button','text-primary font-semibold mr-4','Save');submit.type='submit';
        const cancel=element('button','text-on-surface-variant','Cancel');cancel.type='button';cancel.onclick=()=>form.remove();
        form.append(submit,cancel);button.closest('.flex.justify-between')?.after(form);
        if(!form.isConnected)button.parentElement.after(form);
        form.querySelector('input').focus();
        form.onsubmit=async event=>{
          event.preventDefault();submit.disabled=true;
          try{await save(category,Object.fromEntries(new FormData(form)));form.remove();}
          catch(error){note(error.message,true);submit.disabled=false;}
        };
      };
    }
    editor('Schedule Intake','intake',[['name','Intake name'],['start_date','Start date','date'],['end_date','Closing date','date']]);
    editor('Add Degree','programme',[['name','Programme name'],['code','Code'],['faculty','Faculty'],['coordinator','Coordinator'],['quota','Student quota','number'],['visits','Mandatory visits','number']]);
    const campusFields=qAll('#campuses input');
    campusFields.forEach(field=>{field.disabled=false;});
    const connect=q('#campuses button');
    if(connect)connect.onclick=async()=>{
      connect.disabled=true;
      try{await save('campus',{name:campusFields[0].value,province:campusFields[1].value,phone:campusFields[2].value});campusFields.forEach(field=>{field.value='';});}
      catch(error){note(error.message,true);}
      finally{connect.disabled=false;}
    };
    q('#access tbody')?.replaceChildren();
    const users=(await api('admin/users.php')).users.filter(user=>user.role==='admin');
    for(const user of users){
      const tr=element('tr','');
      for(const value of [user.first_name+' '+user.last_name,'Administrator',Number(user.is_active)?'Active':'Disabled'])tr.append(element('td','p-space-md',value));
      q('#access tbody')?.append(tr);
    }
    const provision=q('#access button');
    if(provision)provision.remove();
    render((await api('admin/setting-entries.php')).entries);
  }

  async function run() {
    const pageMain=q('main');if(pageMain)pageMain.style.visibility='hidden';
    scrubIdentity();neutralizeOfficialTemplates();attachLinkHandlers();
    let loading;
    if(path==='dashboard.html'){
      loading=element('section','al-overview');
      loading.id='al-admin-overview-loading';
      loading.setAttribute('role','status');
      loading.append(element('h2','','Platform Overview'),placeholder('Loading platform statistics...'));
      q('main .lg\\:grid-cols-5')?.replaceWith(loading);
      if(!loading.isConnected)pageMain?.prepend(loading);
      loading.style.visibility='visible';
    }
    try {
      await identity();
      const navTotals=await api('admin/overview.php');
      const verificationNav=q('nav a[data-path="verification"]');
      const navBadge=verificationNav?.querySelector('span:last-child');
      if(navBadge && /^\d+$/.test(navBadge.textContent.trim()))text(navBadge,(navTotals.organization_totals.pending||0)+(navTotals.organization_totals.unverified||0)+(navTotals.listing_review_totals?.pending||0));
      if(path==='dashboard.html')await overview(navTotals);
      if(path==='companies.html')await companyDirectory();
      if(path==='verification-queue.html')await verification();
      if(path==='attachees-directory.html')await attachees();
      if(path==='system-settings.html')await settings();
      if(pageMain)pageMain.style.visibility='visible';
    } catch(err) {
      if(pageMain){
        pageMain.replaceChildren();
        pageMain.style.visibility='visible';
        if(loading){
          loading.replaceChildren(element('h2','','Platform Overview'),placeholder('Platform statistics are unavailable. Try refreshing the page.'));
          pageMain.append(loading);
        }
      }
      if(!loading)note('Could not load the administrator portal. '+err.message+(err.status===403?' Sign in as an administrator.':''),true);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})();
