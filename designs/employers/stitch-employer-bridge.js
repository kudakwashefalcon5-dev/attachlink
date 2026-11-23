/* AttachLink Stage 8 correction: non-destructive data bridge for user's ORIGINAL five Stitch screens.
   It does not construct replacement pages or change Stitch CSS. Backend enforces all access checks. */
(() => {
  'use strict';
  const page = location.pathname.split('/').pop();
  const API = '../../backend/api';
  const $ = (q, root = document) => root.querySelector(q);
  const $$ = (q, root = document) => [...root.querySelectorAll(q)];
  const state = {overview:null, listings:[], applications:[], csrf:null};
  const fullName = a => [a?.first_name, a?.last_name].filter(Boolean).join(' ').trim();
  const display = v => v == null || v === '' ? 'Not available' : String(v);
  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = v => v == null || v === '' ? 'Not specified' : '$'+Number(v).toFixed(2)+' USD';
  const url = (file, key, id) => file + (id ? '?' + key + '=' + encodeURIComponent(id) : '');

  function notice(message, error=false) {
    let bar=$('#attachlink-employer-note');
    if(!bar){
      bar=document.createElement('div');bar.id='attachlink-employer-note';
      Object.assign(bar.style,{position:'fixed',right:'20px',bottom:'20px',zIndex:'99999',maxWidth:'390px',padding:'12px 16px',borderRadius:'12px',boxShadow:'0 8px 28px #0002',font:'14px Inter, Arial, sans-serif'});
      document.body.appendChild(bar);
    }
    bar.style.background=error?'#fff0ee':'#e9faf6';bar.style.color=error?'#872b23':'#075b52';
    bar.textContent=message;
  }
  async function get(endpoint){
    const r=await fetch(API+endpoint,{credentials:'same-origin',cache:'no-store'});let j;
    try{j=await r.json()}catch(_){throw Error('Backend returned a non-JSON response (HTTP '+r.status+').')}
    if(!r.ok||j.ok===false)throw Error(j.message||j.error||'Request failed ('+r.status+').');
    return j;
  }
  async function post(endpoint,data){
    if(!state.csrf)state.csrf=(await get('/auth/csrf.php')).csrf_token;
    const r=await fetch(API+endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,csrf_token:state.csrf})});
    let j;try{j=await r.json()}catch(_){throw Error('Backend returned invalid JSON.')}
    if(!r.ok||j.ok===false){if(r.status===403)state.csrf=null;throw Error(j.message||j.error||'Request failed ('+r.status+').')}
    return j;
  }
  async function pages(endpoint,property) {
    const result=[];for(let pg=1;pg<=20;pg++){
      const sep=endpoint.includes('?')?'&':'?';const j=await get(endpoint+sep+'page='+pg);
      result.push(...(j[property]||[]));if(!j.has_more)break;
    }
    return result;
  }
  async function listings(){if(!state.listings.length)state.listings=await pages('/employer/listings.php','listings');return state.listings}
  async function applications(){if(!state.applications.length)state.applications=await pages('/employer/applications.php?limit=50','applications');return state.applications}
  function textReplace(root, pairs) {
    if(!root)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    let node;while((node=walker.nextNode())){
      if(['SCRIPT','STYLE'].includes(node.parentElement?.tagName))continue;
      for(const [from,to] of pairs){if(node.nodeValue.includes(from))node.nodeValue=node.nodeValue.replaceAll(from,String(to))}
    }
  }
  function bindShell() {
    const {user,organization:org}=state.overview;
    const pairs=[
      ['Econet Wireless Zimbabwe Limited',org.name],
      ['Econet Wireless Zimbabwe',org.name],
      ['Tadiwa Moyo',fullName(user)],
      ['Harare HQ • Tech & Telecoms',org.location||'Employer account'],
      ['Talent Acquisition Lead',org.job_title||'Employer contact'],
      ['Aug – Dec 2025 Attachment Intake','Attachment portal • development test'],
      ['Tier 1','Development'],
      ['Accredited Employer','Employer test account']
    ];
    textReplace($('aside'),pairs);textReplace($('header'),pairs);
    for(const a of $$('aside a')) {
      const t=a.textContent.replace(/\s+/g,' ').trim();
      if(/Dashboard/i.test(t))a.href='dashboard.html';
      else if(/Openings/i.test(t))a.href='dashboard.html#stitch-openings';
      else if(/Applicants/i.test(t))a.href='opening-applicants.html';
      else if(/Company Profile/i.test(t))a.href='company-profile.html';
      else if(/Messages/i.test(t)){a.href='../../backend/stage10-inbox.html';}
      else if(/Help & Support/i.test(t)){
        a.href = /Help & Support/i.test(t) ? '../../backend/stage10-inbox.html?support=1' : '../../backend/stage10-inbox.html';
      }
    }
  }
  const put=(el,v)=>{if(el)el.textContent=display(v)};
  function neutralizeSampleActions(root) {
    // Keep the original Stitch buttons, but don't pretend that unsupported actions succeeded.
    for(const b of $$('button',root)) {
      const t=b.textContent.replace(/\s+/g,' ').trim();
      if(/Export CVs|Bulk Shortlist|Bulk Reject|Invite Candidates|Download Dossier|Download Compliance|Renew Credentials|Send Group Message|Save Supervisor|Browse Local Device|View Verification Details/i.test(t)){
        b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();notice('This control remains in the original Stitch design but is not connected to the backend.');},true);
      }
    }
  }
  async function dashboard() {
    const {overview}=state;const [ls,apps]=await Promise.all([listings(),applications()]);
    const shell=$('main > div');if(!shell)return;
    const blocks=[...shell.children].filter(c=>c.tagName==='DIV');
    if(blocks.length<4)return;
    const [banner, welcome, metrics, grid]=blocks;
    textReplace(banner,[['Pending Review',overview.organization.verification_status],['Compliance & Institutional Accreditation','Employer Verification (development)']]);
    const bannerP=$('p',banner);if(bannerP)bannerP.textContent='Development account: status '+overview.organization.verification_status+'. Official accreditation has not been independently verified.';
    const h=$('h1',welcome);if(h)h.textContent='Welcome back, '+overview.user.first_name+' ('+overview.organization.name+')';
    const firstP=$('p',welcome);if(firstP)firstP.textContent='Manage attachment opportunities and student applicants • Development mode';
    for(const b of $$('button',welcome)){
      if(/Post New Opening/i.test(b.textContent))b.addEventListener('click',()=>location.href='post-edit-opening.html');
      if(/Export Cohort Report/i.test(b.textContent))b.addEventListener('click',()=>{
        const lines=[['ID','Student','Institution','Opening','Status'],...apps.map(a=>[a.application_id,fullName(a),a.institution,a.listing_title,a.status])];
        const csv=lines.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
        const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='attachlink-employer-applications.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
      });
    }
    const items=[[overview.counts.published_listings,'Published Openings','Published openings'],[overview.counts.total_applications,'Total Applicants','Applications to your organization'],[overview.counts.shortlisted,'Shortlisted Candidates','Current review stage'],[overview.counts.accepted,'Placed & Accepted','Accepted in local testing']];
    [...metrics.children].forEach((card,i)=>{
      const data=items[i];if(!data)return;
      put($('.font-display',card),data[0]);
      const vals=$$('.font-label-md',card);const label=vals.find(v=>/Openings|Applicants|Candidates|Accepted/.test(v.textContent));put(label,data[1]);
      const desc=$('.font-body-sm',card);put(desc,data[2]);
      const footer=[...card.children].at(-1);if(footer&&footer!==card.children[1])put(footer,'Development records • Not verified');
    });
    const left=grid.children[0],right=grid.children[1];
    const recent=left?.children?.[0];
    if(recent){
      const tbody=$('table tbody',recent);if(tbody){
        const template=$('tr',tbody)?.cloneNode(true);tbody.replaceChildren();
        if(apps.length&&template){for(const a of apps.slice(0,5)){
          const tr=template.cloneNode(true),cells=$$('td',tr);if(cells.length<6)continue;
          const identity=$$('span',cells[0]);if(identity[0])put(identity[0],fullName(a));if(identity.at(-1))put(identity.at(-1),a.institution||'Institution not supplied');
          put($('.font-label-md',cells[1]),a.programme||'Programme not supplied');put($('.font-code-sm',cells[1]),a.study_level||'');
          put($('.font-body-sm',cells[2]),a.listing_title);put($('.font-label-sm',cells[2]),a.submitted_at||'');
          put(cells[3].querySelector('span'),'N/A');put(cells[4].querySelector('span'),a.status);
          // Any design-only verified seal is not evidence of actual student verification.
          for(const icon of $$('[title="Institution Verified"]',tr))icon.removeAttribute('title');
          const btn=$$('button',cells[5]).find(b=>/View Profile/.test(b.textContent));if(btn)btn.onclick=()=>location.href=url('applicant-profile.html','application_id',a.application_id);
          tbody.append(tr);
        }}else{const tr=document.createElement('tr');const cell=document.createElement('td');cell.colSpan=6;cell.className='p-space-lg text-outline';cell.textContent='No student applications submitted to this organization yet.';tr.append(cell);tbody.append(tr)}
      }
      const footer=recent.children[2];if(footer)put($('span, p',footer),'Showing '+Math.min(5,apps.length)+' of '+apps.length+' applications');
    }
    // The supplied Stitch "Active Openings" card styling is retained; only its card content is refreshed.
    const active=right?.children?.[0];
    if(active){active.id='stitch-openings';const head=active.children[0];const viewAll=$$('button,a',head).find(v=>/View All/.test(v.textContent));if(viewAll){put(viewAll,'Post / Edit Openings');viewAll.onclick=()=>location.href='post-edit-opening.html'}
      const list=active.children[1];if(list){const template=list.children[0]?.cloneNode(true);list.replaceChildren();
        if(ls.length && template){for(const l of ls.slice(0,8)){
          const row=template.cloneNode(true);
          const title=$('span.font-label-md',row)||$$('h4,h5,strong',row)[0];if(title)put(title,l.title);
          const txt=$$('span,p',row).filter(x=>x.children.length===0);const city=txt.find(x=>/Harare|Msasa|Kwekwe|Gweru|Bulawayo/i.test(x.textContent));if(city)put(city,l.city);
          const manage=$$('a,button',row).find(x=>/Manage|View/.test(x.textContent));if(manage){manage.href=url('opening-applicants.html','listing_id',l.id);manage.onclick=()=>location.href=url('opening-applicants.html','listing_id',l.id)}
          const statusBadge=$$('span',row).find(x=>/Open|Active|Closing|days left/i.test(x.textContent));if(statusBadge)put(statusBadge,l.status+' • '+(l.review_status||'pending'));
          const filled=$$('span',row).find(x=>/\d+ \/ \d+ filled/.test(x.textContent));if(filled)put(filled,'Not connected');
          const bar=$('.rounded-full.h-1\.5',row);if(bar)bar.style.width='0%';
          list.append(row)
        }}else{list.textContent='No openings for this employer yet. Use Post New Opening to create a draft.'}
      }
    }
    const institute=left?.children?.[1];if(institute){const h=$('h3',institute);if(h)h.textContent='Institution Eligibility (database)';const grid=$('.grid',institute);if(grid){const inst=[...new Set(apps.map(a=>a.institution).filter(Boolean))];let index=0;for(const block of grid.children){const next=inst[index++];if(next)block.textContent=next+' • applicant institution';else block.textContent='No additional institution data';}}}
    const timeline=right?.children?.[1];if(timeline){const h=$('h4',timeline);if(h)h.textContent='Institution notices not connected';const p=$('p',timeline);if(p)p.textContent='Do not treat original Stitch institutional deadlines as verified. Contact the relevant institution.';const cards=$('.space-y-space-sm',timeline);if(cards)cards.textContent='No verified institutional deadline feed is connected.'}
    const stipend=right?.children?.[2];if(stipend){const spans=$$('span',stipend);if(spans.length){put(spans.at(-1),'Employer stipend values are test data until deployment.')}}
  }
  async function applicantList() {
    const [apps,ls]=await Promise.all([applications(),listings()]);
    const fixed=new URLSearchParams(location.search).get('listing_id');
    const current=fixed?apps.filter(a=>String(a.listing_id)===fixed):apps;
    const h=$('main h1');if(h)h.textContent=fixed?(ls.find(l=>String(l.id)===fixed)?.title||'Opening applicants'):'All opening applicants';
    const tbody=$('main table tbody');if(!tbody)return;
    const template=tbody.querySelector('tr')?.cloneNode(true);tbody.replaceChildren();
    const trFor=a=>{
      const tr=template.cloneNode(true),cells=$$('td',tr);if(cells.length<8)return null;
      // Preserve the exact original row structure and Tailwind styling.
      const avatar=$('img',cells[1]);if(avatar){const span=document.createElement('div');span.className=avatar.className.replace('object-cover','')+' bg-primary-fixed text-primary flex items-center justify-center font-semibold';span.textContent=[a.first_name?.[0],a.last_name?.[0]].filter(Boolean).join('').toUpperCase();avatar.replaceWith(span)}
      const verified=$$('[title="Institution Verified"],[title="Verified Attachee Candidate"]',tr);verified.forEach(x=>x.style.display='none');
      const candidate=$$('.font-label-lg',cells[1]).find(x=>x.textContent.trim());if(candidate)put(candidate,fullName(a));
      const contact=$('.font-code-sm',cells[1]);if(contact)put(contact,a.email||'Contact not supplied');
      const ins=$$('span',cells[2]);if(ins.length)put(ins.find(x=>/University|UZ|NUST|MSU/.test(x.textContent))||ins[1],a.institution);
      const line=$('.font-label-sm',cells[2]);if(line)put(line,a.study_level||'Student');
      const program=$('.text-on-surface',cells[3]);if(program)put(program,a.programme);
      const gpa=$('.font-code-sm',cells[3]);if(gpa)put(gpa,'GPA not connected');
      const ai=$('.font-label-sm',cells[4]);if(ai)put(ai,'Not assessed');
      const aiScore=$('.absolute',cells[4]);if(aiScore)put(aiScore,'—');
      const stat=$('.font-label-sm',cells[5])||$('span',cells[5]);if(stat)put(stat,a.status||'submitted');
      const docs=$$('button,span',cells[6]).find(x=>x.children.length===0&&x.textContent.trim());if(docs)put(docs,'Not connected');
      const review=$$('button,a',cells[7]).find(b=>/Review/i.test(b.textContent))||$('button',cells[7]);
      if(review){review.onclick=()=>location.href=url('applicant-profile.html','application_id',a.application_id)}
      return tr;
    };
    const render=()=>{
      const q=($('#candidateSearchInput')?.value||'').toLowerCase().trim();tbody.replaceChildren();
      for(const a of current.filter(a=>[fullName(a),a.institution,a.programme,a.listing_title].join(' ').toLowerCase().includes(q))){const row=template?trFor(a):null;if(row)tbody.append(row)}
      if(!tbody.children.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=8;td.className='p-space-lg text-outline';td.textContent='No database applications found for this employer.';tr.append(td);tbody.append(tr)}
    };
    $('#candidateSearchInput')?.addEventListener('input',render);render();
    const bulk=$('#bulkToolbar');if(bulk){bulk.style.display='none'}
    neutralizeSampleActions($('main'));
  }
  async function applicantProfile() {
    const id=new URLSearchParams(location.search).get('application_id');
    if(!id||!/^[1-9]\d*$/.test(id)){notice('Select an applicant from the Applicants page to load their real record.',true);return}
    const result=await get('/employer/application-detail.php?application_id='+encodeURIComponent(id));
    const a=result.application;
    // Keep the two-column Stitch applicant dossier and all its original sections intact.
    const name=fullName(a);textReplace($('main'),[
      ['Kudzai Musarurwa',name],['KUDZAI MUSARURWA',name.toUpperCase()],
      ['University of Zimbabwe (UZ)',a.institution||'Institution not supplied'],
      ['University of Zimbabwe',a.institution||'Institution not supplied'],
      ['BSc Computer Science',a.programme||'Programme not supplied'],
      ['UZ Verified Student',a.study_level||'Student'],
      ['SHORTLISTED',(a.status||'submitted').toUpperCase()],
      ['kudzai.m@students.uz.ac.zw',a.email||'Not supplied'],
      ['Harare (Mount Pleasant • 4.2 km)',a.student_city||'Location not supplied'],
      ['96%','N/A'], ['96% MATCH','NOT SCORED'],
      ['AI Skills & Coursework Match','AI matching not connected']
    ]);
    // Preserve layout; make template-only academic/document/skills panels visibly non-authoritative.
    for(const h of $$('main h3')){
      const t=h.textContent;
      if(/Skills Evaluation Match/i.test(t))h.textContent='Skills Evaluation (not connected)';
      if(/Technical Assessment Call/i.test(t))h.textContent='Interview Scheduling (not connected)';
      if(/Supervisor & HR Evaluation/i.test(t))h.textContent='Employer Review History';
    }
    const note=$('#notesThread');if(note){note.replaceChildren();const p=document.createElement('p');p.className='text-outline font-body-sm';p.textContent='Review notes are saved through the employer decision workflow. CV and transcript verification is not connected.';note.append(p)}
    const tabs=$('#docTabs');if(tabs){tabs.title='Document previews are sample design placeholders; real document retrieval is not connected.'}
    const header=$('main');
    const reject=$$('button',header).find(b=>/Reject/.test(b.textContent));
    const offer=$$('button',header).find(b=>/Make Offer/.test(b.textContent));
    const stage={submitted:['reviewing','Start review'],reviewing:['shortlisted','Shortlist'],shortlisted:['interview','Invite to interview'],interview:['accepted','Make offer']};
    const nxt=stage[a.status];if(offer) {
      if(!nxt){offer.disabled=true;offer.title='Final status — no additional transitions';}
      else{const icon=$('.material-symbols-outlined',offer);if(icon)icon.nextSibling && (icon.nextSibling.textContent=' '+nxt[1]);else offer.textContent=nxt[1];
        offer.addEventListener('click',async e=>{e.preventDefault();e.stopImmediatePropagation();offer.disabled=true;try{await post('/employer/application-status.php',{application_id:Number(id),status:nxt[0],note:$('#evalNote')?.value||''});notice('Application updated to '+nxt[0]+'.');location.reload()}catch(err){notice(err.message,true);offer.disabled=false}},true);
      }
    }
    if(reject){reject.disabled=!result.allowed_next?.includes('rejected');reject.addEventListener('click',async e=>{e.preventDefault();e.stopImmediatePropagation();const reviewNote=$('#evalNote')?.value?.trim()||'';if(reviewNote.length<10){notice('Enter a rejection reason of at least 10 characters.',true);return}reject.disabled=true;try{await post('/employer/application-status.php',{application_id:Number(id),status:'rejected',note:reviewNote});notice('Application rejected.');location.reload()}catch(err){notice(err.message,true);reject.disabled=false}},true)}
    // Block fake document downloads, messaging and static sample note-saving behavior.
    neutralizeSampleActions(header);
    const saveNote=$$('button',header).find(b=>/Save Note/i.test(b.textContent));if(saveNote)saveNote.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();notice('Use Start review / Shortlist / Interview / Make offer to save a review note.')},true);
  }
  async function companyProfile() {
    const {organization:org,user,counts}=state.overview;
    textReplace($('main'),[
      ['Econet Wireless Zimbabwe Limited',org.name],
      ['Econet Wireless Zimbabwe',org.name],
      ['Econet Park, 2 Old Mutare Road, Msasa, Harare, Zimbabwe',org.location||'Address not provided'],
      ['Telecommunications & Fintech','Company profile'],
      ['Tadiwa Moyo',fullName(user)],
      ['Talent Acquisition Lead',org.job_title||'Employer contact'],
      ['39/50',String(counts.total_applications||0)+' applications'],
      ['Tier 1 Accredited Employer','Development account • '+org.verification_status],
      ['National institutional clearance validated across Zimbabwean state tertiary frameworks, vocational boards, and the Ministry of Higher & Tertiary Education.','This organization is a mock account. Documentation and compliance have not been independently verified.'],
      ['Registrar of Companies','Registration not verified'],
      ['ZIMRA Tax Clearance','Tax clearance not verified'],
      ['Higher Education MOU','Partnership not verified'],
      ['PRAZ Procurement','Procurement not verified']
    ]);
    const h=$('main h1');if(h)put(h,org.name);
    const p=$('#section-overview');if(p){
      const cells=$$('span.font-label-lg, p.font-label-lg',p);
      for(const e of cells)if(e.textContent.includes('Econet'))e.textContent=org.name;
      const profileTitle=$('h2',p);if(profileTitle)profileTitle.textContent='Registered Entity Profile';
      const fieldLabels=$$('span',p).filter(x=>/Official Legal Name|Headquarters & Physical Address|Industry & Sector|Company Registration Number/.test(x.textContent.trim()));
      for(const label of fieldLabels){const row=label.parentElement;if(!row)continue;const val=[...row.children].find(x=>x!==label&&x.textContent.trim());
        if(!val)continue;const name=label.textContent.trim();
        if(/Legal Name/.test(name))put(val,org.name);
        if(/Headquarters/.test(name))put(val,org.location||'Not supplied');
        if(/Company Registration/.test(name))put(val,'Not verified (mock)');
        if(/Industry/.test(name))put(val,'Not recorded');
      }
    }
    const header=$('main > div > div');
    if(header){const p=$('p',header);if(p)p.textContent='Development record • Official accreditation and compliance files are not yet connected.';}
    const audit=$('#section-legal');if(audit){const table=$('table',audit);if(table){const body=$('tbody',table);if(body){body.replaceChildren();const tr=document.createElement('tr');tr.innerHTML='<td colspan="7" class="p-space-lg text-outline">No compliance documents have been uploaded or verified in the backend.</td>';body.append(tr)}}}
    const supervisors=$('#section-supervisors');if(supervisors){const cards=$('.grid',supervisors);if(cards)cards.textContent='Supervisor records are not yet connected to the employer database.'}
    const perks=$('#section-program');if(perks){const cards=$('.grid',perks);if(cards)cards.textContent='Attachment perks and institution agreements have not been verified.'}
    neutralizeSampleActions($('main'));
  }
  async function editor() {
    const form=$('#attachment-form');if(!form)return;
    const title=$('#input-title'),city=$('#input-location'),description=$('#input-description'),deadline=$('#input-deadline'),stipend=$('#input-stipend');
    const id=new URLSearchParams(location.search).get('listing_id');let listingId=id&&/^\d+$/.test(id)?Number(id):null;
    const old=listingId?(await listings()).find(l=>Number(l.id)===listingId):null;
    if(listingId&&!old){notice('This listing does not belong to your organization.',true);return}
    if(old){
      if(title)title.value=old.title||'';if(description)description.value=old.description||'';
      if(deadline)deadline.value=old.closing_date||'';if(stipend)stipend.value=old.stipend_usd==null?'':old.stipend_usd;
      if(city){const text=old.city||'';const match=[...city.options].find(o=>o.textContent.toLowerCase().includes(text.toLowerCase())||o.value.toLowerCase()===text.toLowerCase());if(match)city.value=match.value}
    }else{
      if(title)title.value='';if(description)description.value='';if(stipend)stipend.value='';if(deadline)deadline.value='';
    }
    for(const k of ['preview-title','preview-desc','preview-stipend']){const el=$('#'+k);if(el)el.textContent='Awaiting listing details'}
    const sync=()=>{put($('#preview-title'),title?.value||'Your new attachment opening');put($('#preview-desc'),description?.value||'Your mentorship description');put($('#preview-stipend'),stipend?.value||'Not specified');put($('#preview-location'),city?.options?.[city.selectedIndex]?.textContent||'Zimbabwe')};
    for(const el of [title,description,stipend,city])el?.addEventListener('input',sync);sync();
    const save=$$('main button').find(b=>/Save as Draft/.test(b.textContent));const publish=$('#btn-publish');
    const allowed=!old||(old.status==='draft'&&['draft','rejected','legacy_draft'].includes(old.review_status));
    if(!allowed){if(save)save.disabled=true;if(publish)publish.disabled=true;notice('Only draft or rejected vacancies can be edited.',true);return}
    async function saveRecord(){
      if(!title?.value.trim()||!description?.value.trim()){throw Error('Provide the vacancy title and description first.')}
      const selectedCity=city?.options?.[city.selectedIndex]?.textContent?.trim()||city?.value||'Zimbabwe';
      // Only fields supported by Stage 6B are persisted; the original Stitch controls are preserved.
      const data={action:'save',title:title.value.trim(),city:selectedCity,description:description.value.trim(),requirements:'See description for the required skills and qualifications.',stipend_usd:stipend?.value?.trim()||null,closing_date:deadline?.value||'',institutions:[]};
      if(listingId)data.listing_id=listingId;
      const result=await post('/employer/listings.php',data);listingId=Number(result.listing_id);
      history.replaceState(null,'','post-edit-opening.html?listing_id='+listingId);
    }
    if(save)save.addEventListener('click',async e=>{e.preventDefault();e.stopImmediatePropagation();save.disabled=true;try{await saveRecord();notice('Draft saved.') }catch(err){notice(err.message,true)}finally{save.disabled=false}},true);
    if(publish)publish.addEventListener('click',async e=>{e.preventDefault();e.stopImmediatePropagation();publish.disabled=true;try{await saveRecord();await post('/employer/listings.php',{action:'submit',listing_id:listingId});notice('Opening published.')}catch(err){notice(err.message,true);publish.disabled=false}},true);
    form.addEventListener('submit',e=>e.preventDefault());
    notice('Original Stitch editor is preserved. Stage 6B saves its supported fields; unsupported design-only fields remain local.');
  }
  async function init() {
    try{
      state.overview=await get('/employer/overview.php');
      if(state.overview.user?.role!=='employer')throw Error('Please sign in with an employer account first.');
      bindShell();
      if(page==='dashboard.html')await dashboard();
      if(page==='opening-applicants.html')await applicantList();
      if(page==='applicant-profile.html')await applicantProfile();
      if(page==='company-profile.html')await companyProfile();
      if(page==='post-edit-opening.html')await editor();
    }catch(err){notice('AttachLink: '+(err.message||'Could not connect to the employer session.'),true)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
