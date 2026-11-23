/* AttachLink local XAMPP integration. Uses PHP sessions, no localStorage identity. */
(()=>{'use strict';
const root='../../backend/api/',role=location.pathname.includes('/students/')?'student':location.pathname.includes('/employers/')?'employer':'admin',page=location.pathname.split('/').pop(),$=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=(file)=>role==='student'?`../students/${file}`:`../${role==='employer'?'employers':'admin'}/${file}`;
let csrfToken='',myUser=null;
async function api(path,data,verb='POST'){
 const options={credentials:'same-origin',cache:'no-store'};
 if(data!==undefined){if(!csrfToken)csrfToken=(await api('auth/csrf.php')).csrf_token;options.method=verb;options.headers={'Content-Type':'application/json','X-CSRF-Token':csrfToken};options.body=JSON.stringify({...data,csrf_token:csrfToken});}
 const r=await fetch(root+path,options);let d;try{d=await r.json()}catch{throw Error('The request could not be completed. Try again.')}if(!r.ok||!d.ok)throw Error(d.message||`HTTP ${r.status}`);return d;
}
const button=(label,fn)=>{let b=document.createElement('button');b.type='button';b.textContent=label;b.className='al-api-btn';b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){showError(e)}finally{b.disabled=false}};return b};
function el(t,txt){let x=document.createElement(t);if(txt!==undefined)x.textContent=String(txt);return x}
function clear(node){if(node)node.replaceChildren()}
function showError(e){console.error('[AttachLink]',e);let n=$('al-api-error');if(!n){n=el('div');n.id='al-api-error';n.className='al-api-error';document.body.prepend(n);}n.textContent=e.message||String(e);n.hidden=false;}
function empty(node,message){clear(node);node.append(el('p',message))}
function panel(title,target){let x=el('section');x.className='al-api-panel';x.append(el('h2',title));(target||document.querySelector('main')||document.body).prepend(x);return x}
function pLine(parent,label,value){let line=el('p');let b=el('strong',label+': ');line.append(b,document.createTextNode(String(value??'—')));parent.append(line)}
function field(form,name,label,value='',kind='text',required=false){let l=el('label');l.className='al-api-field';l.textContent=label;let v=kind==='textarea'?el('textarea'):el('input');if(kind!=='textarea')v.type=kind;v.name=name;v.value=value??'';v.required=required;l.append(v);form.append(l);return v}
function getForm(form){return Object.fromEntries(new FormData(form).entries())}
function card(title,subtitle){let d=el('article');d.className='al-api-card';d.append(el('h3',title),el('p',subtitle||''));return d}
function replaceFixture(node){if(node)node.replaceChildren()}
function insertStyles(){let s=el('style');s.textContent=`.al-api-panel{background:#fff;color:#153d3c;padding:20px;border:1px solid #dce8e5;border-radius:14px;margin:18px 0;box-shadow:0 1px 5px #002c2410;font-family:Inter,Arial,sans-serif}.al-api-panel h2{font-size:1.2rem;font-weight:700;margin:0 0 14px}.al-api-panel h3{font-size:1rem;font-weight:700;margin:0 0 6px}.al-api-card{padding:14px;border:1px solid #e2e9e7;border-radius:12px;margin:8px 0;background:#fbfefd}.al-api-card p{margin:5px 0;font-size:.9rem}.al-api-btn{background:#08796d!important;color:#fff!important;border:0!important;border-radius:9px!important;padding:9px 13px!important;margin:5px 7px 5px 0!important;cursor:pointer!important;font:inherit!important}.al-api-btn:disabled{opacity:.6}.al-api-field{display:block;margin:10px 0;font-size:.9rem;font-weight:600}.al-api-field input,.al-api-field textarea,.al-api-field select{display:block;width:100%;border:1px solid #aabdb9;background:white;border-radius:8px;padding:9px;color:#173936}.al-api-field textarea{min-height:80px}.al-api-error{background:#fff0ee;color:#992e23;padding:12px;border:1px solid #e0aba4;border-radius:9px;position:relative;z-index:50}.al-api-muted{color:#5a7371;font-size:.9rem}.al-api-list{display:grid;gap:9px}.al-api-link{color:#06796b;text-decoration:underline}.al-api-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}`;document.head.append(s)}
function goAuth(){const path=role==='admin'?'../admin/login.html':role==='employer'?'../students/login.html?role=recruiter':'../students/login.html';location.replace(path)}
async function signout(){await api('auth/logout.php',{});goAuth()}
function addLogout(){if(document.querySelector('[data-al-logout]'))return;let a=button('Sign out',signout);a.dataset.alLogout='1';let nav=document.querySelector('nav')||document.querySelector('header')||document.querySelector('aside');(nav||document.body).append(a)}
async function student(){
 if(page==='dashboard.html'){
  const ui=window.AttachLinkOverview;
  const section=ui.node('section','al-overview');
  section.setAttribute('aria-label','Application overview');
  section.setAttribute('aria-busy','true');
  $('recommended-openings')?.before(section);
  const tiles=[['Total applications','description'],['Pending applications','schedule'],['Accepted applications','check_circle']];
  const links=[['Browse Opportunities','#all-attachment-openings'],['My Applications','my-applications.html'],['Notifications','notifications.html']];
  section.append(ui.metrics(tiles),ui.node('p','','Loading your application activity...'));
  try{
   const [result,alerts]=await Promise.all([api('student/applications.php'),api('notifications.php')]);
   const applications=result.applications;
   const counts=[applications.length,applications.filter(item=>['submitted','reviewing'].includes(item.status)).length,applications.filter(item=>item.status==='accepted').length];
   const activity=ui.node('div','al-activity');
   activity.append(ui.node('h2','','Recent activity'));
   if(!applications.length)activity.append(ui.node('p','','No applications yet. Explore available attachment opportunities to get started.'));
   const entries=[
    ...applications.map(item=>({title:item.title,detail:item.status,created_at:item.created_at})),
    ...alerts.notifications.map(item=>({title:item.title,detail:item.message,created_at:item.created_at}))
   ].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,5);
   const list=ui.node('ul','');
   for(const item of entries){
    const row=ui.node('li','');
    row.append(ui.node('strong','',item.title),ui.node('span','',item.detail));
    list.append(row);
   }
   if(entries.length)activity.append(list);
   activity.append(ui.actions(links));
   section.replaceChildren(ui.metrics(tiles.map((tile,index)=>[...tile,counts[index]])),activity);
  }catch{
   section.replaceChildren(ui.node('h2','','Recent activity'),ui.node('p','','Application activity is unavailable. Try refreshing the page.'),ui.actions(links));
  }finally{section.setAttribute('aria-busy','false');}
 }
 if(page==='saved-openings.html'){let box=$('saved-results')||panel('Saved openings');let list=async()=>{let d=await api('student/saved.php');clear(box);for(let o of d.openings){let c=card(o.title,`${o.company_name} • ${o.city||''}`);let a=el('a','View');a.href=`attachment-details.html?id=${o.id}`;a.className='al-api-link';c.append(a,button('Remove',async()=>{await api('student/saved.php',{opening_id:o.id},'DELETE');await list()}));box.append(c)}if(!d.openings.length)box.append(el('p','No saved openings.'))};await list()}
 if(page==='profile.html'){
  const [profile,activity]=await Promise.all([api('student/account.php'),api('student/applications.php')]);
  const account=profile.account;
  if($('application-count'))$('application-count').textContent=String(activity.applications.length);
  const biography=el('p',account.bio||'Biography not provided.');
  $('profile-name')?.parentElement.append(biography);
  $('export-profile-btn')?.addEventListener('click',()=>window.print());
  $('share-profile-btn')?.setAttribute('hidden','');
  for(const control of document.querySelectorAll('[data-upload],[data-view]')){
   control.onclick=()=>location.assign('my-applications.html');
  }
  for(const status of document.querySelectorAll('[data-doc-name]'))status.textContent='See My Applications';
  for(const control of document.querySelectorAll('[data-demo-notice]')){
   if(control.dataset.demoNotice.startsWith('Messaging'))control.onclick=()=>location.assign('messages.html');
   else{control.disabled=true;control.title='Appointment booking is unavailable';}
  }
 }
 if(page==='messages.html')await messages('thread-list','thread-heading','message-list','chat-form','message-text');
 if(page==='account.html')return; // Existing working PHP account page handles its own requests.
}
async function uploadDialog(id){
 if(!csrfToken)csrfToken=(await api('auth/csrf.php')).csrf_token;
 let modal=panel('Upload application documents');modal.scrollIntoView({behavior:'smooth'});const existing=await api('student/documents.php?application_id='+encodeURIComponent(id));for(const doc of existing.documents){const link=el('a',doc.original_name);link.href=root+'documents/download.php?id='+encodeURIComponent(doc.id);link.className='al-api-link';modal.append(link,el('br'));}let note=el('p','Upload each required document (PDF/JPG/PNG, maximum 5 MB). A-level certificate is optional if unavailable.');modal.append(note);
 for(const [type,label] of [['attachment_letter','Stamped attachment letter'],['cv','CV'],['id','National ID'],['transcript','Academic transcript'],['o_level','O-level certificate'],['a_level','A-level certificate (if applicable)'],['other_certificate','Other certificate']]){
  let row=el('div');row.className='al-api-row';let input=el('input');input.type='file';input.accept='.pdf,.jpg,.jpeg,.png';let b=button('Upload '+label,async()=>{if(!input.files?.[0])throw Error('Select a file first.');let form=new FormData();form.append('application_id',id);form.append('document_type',type);form.append('csrf_token',csrfToken);form.append('file',input.files[0]);let r=await fetch(root+'student/documents.php',{method:'POST',credentials:'same-origin',body:form});let d=await r.json();if(!r.ok||!d.ok)throw Error(d.message||'Upload failed');b.textContent='Uploaded ✓'});row.append(input,b);modal.append(row)
 }modal.append(button('Close',()=>modal.remove()));
}
async function employer(){
 if(page==='dashboard.html'){let company=(await api('employer/company.php')).company,opens=(await api('employer/openings.php')).openings,apps=(await api('employer/applicants.php')).applications;let p=panel('Your company — live database');pLine(p,'Company',company.name);pLine(p,'Verification',company.verification_status);pLine(p,'Openings',opens.length);pLine(p,'Applications received',apps.length);p.append(button('Manage openings',()=>location.assign('openings.html')),button('View applicants',()=>location.assign('opening-applicants.html')));}
 if(page==='openings.html'){let box=$('s8-content')||panel('Company openings');async function draw(){let d=await api('employer/openings.php');clear(box);let p=panel('Company openings',box);for(let o of d.openings){let c=card(o.title,`${o.status} • ${o.city||''} • ${o.deadline||'No deadline'}`);let a=el('a','Edit');a.href='post-edit-opening.html?id='+o.id;a.className='al-api-link';c.append(a);p.append(c)}if(!d.openings.length)p.append(el('p','No openings posted yet.'));p.append(button('Post opening',()=>location.assign('post-edit-opening.html')))}await draw()}
 if(page==='company-profile.html'){let d=(await api('employer/company.php')).company;let box=$('s8-content')||panel('Company profile');clear(box);let p=panel('Company profile',box);let f=el('form');for(const [k,label] of [['name','Company name'],['industry','Industry'],['city','City'],['website','Website'],['description','Description']])field(f,k,label,d[k],k==='description'?'textarea':'text',k==='name');f.append(button('Save company profile',async()=>{await api('employer/company.php',getForm(f));alert('Company profile saved.')}));p.append(el('p','Verification status: '+d.verification_status),f)}
 if(page==='post-edit-opening.html'){const form=$('attachment-form');if(!form)return;let id=new URLSearchParams(location.search).get('id');if(id){let d=(await api('employer/openings.php')).openings.find(o=>String(o.id)===id);if(d){for(let [key,value] of Object.entries({'input-title':d.title,'input-department':d.department,'input-description':d.description,'input-deadline':d.deadline,'input-location':d.city}))if($(key))$(key).value=value||'';}}
  form.addEventListener('submit',async e=>{e.preventDefault();e.stopImmediatePropagation();await saveOpening('published')},true);
  async function saveOpening(status){try{let d=await api('employer/openings.php',{id:id||undefined,title:$('input-title')?.value,department:$('input-department')?.value,city:$('input-location')?.value,description:$('input-description')?.value,requirements:$('input-gpa')?.value||'',deadline:$('input-deadline')?.value||null,status});location.assign('openings.html')}catch(e){showError(e)}}
  if($('btn-publish'))$('btn-publish').onclick=e=>{e.preventDefault();e.stopImmediatePropagation();saveOpening('published')};let p=panel('Database publishing');p.append(el('p','Only verified companies can publish. Drafts remain private.'));p.append(button('Save as draft',()=>saveOpening('draft')));
 }
 if(page==='opening-applicants.html'||page==='applicant-profile.html'){let box=panel('Applicants');async function draw(){let d=await api('employer/applicants.php');clear(box);box.append(el('h2','Student applications'));for(let a of d.applications){let c=card(a.first_name+' '+a.last_name,`${a.opening_title} • ${a.status} • ${a.email}`);for(let status of ['reviewing','accepted','rejected'])c.append(button(status,async()=>{await api('employer/applicants.php',{application_id:a.id,status});await draw()}));c.append(button('Review documents',async()=>{let r=await api('employer/documents.php?application_id='+a.id);let p=panel('Student documents',box);for(let doc of r.documents){let l=el('a',doc.document_type+' — '+doc.original_name);l.href=root+'documents/download.php?id='+doc.id;l.target='_blank';l.className='al-api-link';p.append(l,el('div'))}if(!r.documents.length)p.append(el('p','No documents uploaded.'))}));box.append(c)}if(!d.applications.length)box.append(el('p','No applications received.'))}await draw()}
 if(page==='messages.html')await messages('al-contact-list','al-conversation-title','al-chat-messages','al-employer-message-form','al-employer-message-text');
}
async function admin(){
 if(page==='placements-registry.html'){
  let p=panel('Placement records — live database');
  async function draw(){
   const d=await api('admin/placements.php');clear(p);p.append(el('h2','Placement records — live database'));
   let f=el('form');f.className='al-placement-form';
   let l=el('label','Accepted application');l.className='al-api-field';let select=el('select');select.name='application_id';select.required=true;
   let placeholder=el('option','Choose an accepted application');placeholder.value='';select.append(placeholder);
   for(let a of d.eligible_applications||[]){let opt=el('option',`${a.first_name} ${a.last_name} — ${a.title} (${a.company_name})`);opt.value=a.application_id;select.append(opt)}
   l.append(select);f.append(l);field(f,'start_date','Start date','','date');field(f,'end_date','End date','','date');field(f,'notes','Placement notes','','textarea');
   let submit=el('button','Save placement');submit.type='submit';submit.className='al-api-btn';submit.disabled=!d.eligible_applications?.length;f.append(submit);
   f.addEventListener('submit',async event=>{event.preventDefault();submit.disabled=true;try{await api('admin/placements.php',getForm(f));await draw()}catch(e){showError(e);submit.disabled=false}});
   select.addEventListener('change',()=>{
    const record=d.placements.find(item=>String(item.application_id)===select.value);
    for(const key of ['start_date','end_date','notes'])f.elements.namedItem(key).value=record?.[key]||'';
   });
   p.append(f);
   if(!d.eligible_applications?.length)p.append(el('p','No accepted applications are available yet. An employer must accept an application first.'));
   let list=el('div');list.className='al-api-list';p.append(list);
   const registry=document.querySelector('main table tbody');
   if(registry)registry.replaceChildren();
   for(const placement of d.placements){
    const name=`${placement.first_name} ${placement.last_name}`;
    const edit=button('Edit placement',()=>{
     select.value=String(placement.application_id);
     select.dispatchEvent(new Event('change'));
     select.focus();
    });
    if(registry){
     const row=el('tr');row.className='border-b border-surface-container';
     for(const value of [name,placement.company_name,placement.title,placement.start_date,placement.end_date,placement.notes,'','Recorded']){
      const cell=el('td',value||'');cell.className='px-space-md py-space-sm';row.append(cell);
     }
     const action=el('td');action.append(edit);row.append(action);registry.append(row);
    }else{
     const record=card(placement.title,`${name} • ${placement.company_name}`);
     record.append(edit);list.append(record);
    }
   }
   if(!d.placements.length)list.append(el('p','No placements recorded yet.'));
  }
  await draw();
 }
 if(page==='messages.html')await messages('contacts','threadTitle','messages','sendForm','body');
}
async function messages(contactsId,titleId,listId,formId,textId){let contacts=$(contactsId),title=$(titleId),list=$(listId),form=$(formId),input=$(textId);if(!contacts||!list||!form||!input)return;let selected=null;
 async function loadContacts(){let d=await api('messages.php');clear(contacts);for(let c of d.contacts){let b=button(c.name,async()=>{selected=c;await loadThread()});contacts.append(b)}if(!d.contacts.length)contacts.append(el('p','No available contacts. A student can message an employer after applying.'))}
 async function loadThread(){if(!selected)return;let d=await api('messages.php?with='+selected.id);if(title)title.textContent=d.contact.name;clear(list);for(let msg of [...d.messages].reverse()){let c=card(msg.sender_id==myUser.id?'You':d.contact.name,msg.body);list.append(c)}input.disabled=false;const send=form.querySelector('button[type="submit"],#send,#al-message-send');if(send)send.disabled=false;}
 form.addEventListener('submit',async e=>{e.preventDefault();e.stopImmediatePropagation();if(!selected||!input.value.trim())return;try{await api('messages.php',{recipient_id:selected.id,body:input.value.trim()});input.value='';await loadThread()}catch(err){showError(err)}},true);
 await loadContacts();const withId=new URLSearchParams(location.search).get('with');if(withId){let d=await api('messages.php');selected=d.contacts.find(c=>String(c.id)===withId)||null;if(selected)await loadThread()}setInterval(()=>{if(document.visibilityState==='visible'&&selected)loadThread().catch(console.error)},5000);
}
async function init(){insertStyles();if(['login.html','register.html'].includes(page))return;try{let r=await api('auth/me.php');myUser=r.user;if(myUser.role!==role){showError(Error('You are signed into the '+myUser.role+' portal, not the '+role+' portal.'));setTimeout(goAuth,1600);return}addLogout();if(role==='student')await student();else if(role==='employer')await employer();else await admin()}catch(e){if(e.message==='Authentication required.'){goAuth();return}showError(e)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
