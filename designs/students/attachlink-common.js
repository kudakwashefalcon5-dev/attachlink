
(function(){
'use strict';
const KEYS={apps:'attachlink_applications',profile:'attachlink_student_profile_v1',saved:'attachlink_saved_openings_v1',messages:'attachlink_demo_messages_v1',notifications:'attachlink_notifications_v1',tracker:'attachlink_application_tracker_v1',interviews:'attachlink_interview_plans_v1',cv:'attachlink_cv_builder_v1',portfolio:'attachlink_portfolio_projects_v1'};
const ROLES={"ZW-ECO-884": {"company": "Econet Wireless Zimbabwe", "title": "Junior Network & Cloud Systems Attachee", "location": "Msasa Campus, Harare", "stipend": "$250 USD/month", "monogram": "EW", "area": "Telecommunications", "skills": "Networking, Linux and cloud infrastructure", "description": "Learn about network operations, cloud platforms and infrastructure monitoring.", "duration": "12 months", "id": "ZW-ECO-884"}, "ZW-ZP-001": {"company": "Zimplats Holdings Ltd", "title": "Industrial IT Systems Attachee", "location": "Ngezi Mine & Harare HQ", "stipend": "$300 USD/month", "monogram": "ZP", "area": "Mining IT", "skills": "IT support, systems and networking", "description": "Support industrial IT systems and learn how digital infrastructure supports mining operations.", "duration": "To be confirmed", "id": "ZW-ZP-001"}, "ZW-DC-001": {"company": "Delta Corporation Ltd", "title": "SCADA & Electrical Attachee", "location": "Southerton Brewery, Harare", "stipend": "$220 USD/month", "monogram": "DC", "area": "Industrial automation", "skills": "SCADA, electrical systems and troubleshooting", "description": "Explore industrial automation, monitoring and electrical systems in a manufacturing environment.", "duration": "12 months", "id": "ZW-DC-001"}, "ZW-BA-001": {"company": "BancABC Zimbabwe", "title": "QA Automation & DevOps Attachee", "location": "Heritage House, Samora Machel Ave, Harare", "stipend": "$280 USD/month", "monogram": "BA", "area": "Fintech Division", "skills": "CI/CD pipelines, Python, Selenium", "description": "Learn software testing, quality assurance and automated delivery practices in banking technology.", "duration": "To be confirmed", "id": "ZW-BA-001"}, "ZW-MM-001": {"company": "Mimosa Mining Company", "title": "Mining Instrumentation & Telemetry Attachee", "location": "Wedza Platinum Complex, Zvishavane", "stipend": "$310 USD/month", "monogram": "MM", "area": "Heavy Minerals", "skills": "Instrumentation, telemetry and monitoring", "description": "Gain exposure to instrumentation and telemetry systems used in mining operations. The sample listing mentions camp quarters.", "duration": "To be confirmed", "id": "ZW-MM-001"}, "ZW-ZM-001": {"company": "ZIMASCO (Pvt) Ltd", "title": "Mechanical Maintenance & Plant Systems", "location": "Kwekwe Works, Midlands", "stipend": "$240 USD/month", "monogram": "ZM", "area": "Smelter Operations", "skills": "Mechanical maintenance, plant systems", "description": "Learn maintenance and operational support for mechanical plant equipment in a smelting environment.", "duration": "To be confirmed", "id": "ZW-ZM-001"}, "ZW-CB-001": {"company": "CBZ Bank Holdings", "title": "Data Analytics & Risk Intelligence Attachee", "location": "CBZ Centre, Kwame Nkrumah Ave, Harare", "stipend": "$260 USD/month", "monogram": "CB", "area": "Treasury & Analytics", "skills": "Data analysis, reporting and risk intelligence", "description": "Explore analytics, reporting and risk-support activities in financial services.", "duration": "To be confirmed", "id": "ZW-CB-001"}};
const get=(key,fallback)=>{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}};
const set=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};
const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const saved=()=>{const v=get(KEYS.saved,[]);return Array.isArray(v)?v.filter(x=>ROLES[x]):[]};
const apps=()=>{const v=get(KEYS.apps,[]);return Array.isArray(v)?v:[]};
const notifications=()=>{const v=get(KEYS.notifications,[]);return Array.isArray(v)?v:[]};
// Stage 6E: application badges use MySQL, not the old shared browser demo.
let mysqlAppCount=null;
let mysqlUnreadCount=null;
function activity(title,body,link){const data=notifications();data.unshift({id:'n-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),title:String(title).slice(0,100),body:String(body).slice(0,240),link:link||'',read:false,at:new Date().toISOString()});if(!set(KEYS.notifications,data.slice(0,100)))return false;refreshNav();return true}
function toast(message){const el=document.createElement('div');el.className='al-toast';el.role='status';el.textContent=message;document.body.appendChild(el);setTimeout(()=>el.remove(),3400)}
// Use the authenticated student account for every navigation label, never the
// sample student name saved by the older browser-only demo.
let sessionNavName = 'Loading profile…';
  let mysqlSavedCount = null;
  async function fetchSavedCount() {
    try {
      const url = new URL('../../backend/api/student/saved-listings.php', window.location.href);
      const response = await fetch(url.href, {credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
      if (response.ok) {
        const data = await response.json();
        if (data?.ok === true && Number.isSafeInteger(Number(data.count))) {
          mysqlSavedCount = Number(data.count);
          refreshNav();
        }
      }
    } catch (error) { console.warn('AttachLink: bookmarks count unavailable', error); }
  }
function refreshNav(){document.querySelectorAll('[data-al-name]').forEach(el=>{el.textContent=sessionNavName});document.querySelectorAll('[data-al-app-count]').forEach(el=>el.textContent=mysqlAppCount===null?'…':String(mysqlAppCount));document.querySelectorAll('[data-al-save-count]').forEach(el=>el.textContent=mysqlSavedCount===null?'…':String(mysqlSavedCount));document.querySelectorAll('[data-al-unread]').forEach(el=>{const n=mysqlUnreadCount??0;el.textContent=String(n);el.hidden=n===0})}
// The server determines the student from the PHP session cookie; never pass
// the student ID from localStorage or query parameters.
async function loadSessionNavName(){
  try {
    const url = new URL('../../backend/api/student/account.php', window.location.href);
    const response = await fetch(url.href, {
      method: 'GET', credentials: 'same-origin', cache: 'no-store',
      headers: {'Accept': 'application/json'}
    });
    if (response.status === 401) {
      sessionNavName = 'Session expired';
      refreshNav();
      window.location.replace('login.html?session=expired');
      return;
    }
    if (!response.ok) throw new Error('Student account request: ' + response.status);
    const data = await response.json();
    if (!data || data.ok !== true || !data.account) throw new Error('Invalid student account response');
    const account = data.account;
    const name = [account.first_name, account.last_name]
      .filter(part => typeof part === 'string' && part.trim())
      .map(part => part.trim()).join(' ');
    sessionNavName = name || 'Student';
    refreshNav();
    applyInstitutionContext(account);
  } catch (error) {
    console.error('AttachLink: unable to load student name from authenticated profile', error);
    sessionNavName = 'Account unavailable';
    refreshNav();
  }
}

// Institution context: preserve Stitch markup, but never show another school's
// invented notices, verification badges, deadlines or clearance rules.
// The school is read from the authenticated Stage 5 MySQL account API.
function applyInstitutionContext(account) {
  const institute = typeof account.institution === 'string' && account.institution.trim()
    ? account.institution.trim() : 'your institution';
  const page = window.location.pathname.split('/').pop().toLowerCase();

  function exact(oldValue, replacement, scope = document) {
    const targets = scope.querySelectorAll('h1,h2,h3,h4,p,span,a,button,li,div');
    targets.forEach(el => {
      if (el.children.length !== 0 || el.textContent.trim() !== oldValue) return;
      el.textContent = replacement;
    });
  }
  function containing(oldValue, replacement, scope = document) {
    const root = scope.body || scope;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const changes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      if (!parent || /^(SCRIPT|STYLE|TEXTAREA|OPTION)$/.test(parent.tagName)) continue;
      if (node.nodeValue.includes(oldValue)) changes.push(node);
    }
    changes.forEach(node => { node.nodeValue = node.nodeValue.replaceAll(oldValue, replacement); });
  }
  // Neutral, accurate language across the student portal: a polytechnic or
  // college student is not necessarily attached to a university.
  containing('Connecting Zimbabwean university students with premier industrial attachments',
    'Connecting Zimbabwean students with industrial attachments');
  containing('University Guidelines', 'Institution Guidelines');
  containing('university attachment coordinator', 'institution attachment coordinator');
  containing('your university', 'your institution');
  containing('contact a university', 'contact an institution');
  containing('university liaison questions', 'institution liaison questions');



  if (page === 'my-applications.html') {
    containing('2025/2026 ACADEMIC PLACEMENT CYCLE', 'Placement cycle: check with ' + institute);
  }

  if (page === 'profile.html') {
    const course = document.querySelector('[data-profile="course"]');
    if (course) {
      const level = String(account.study_level || '').trim();
      const programme = String(account.programme || '').trim();
      course.textContent = [level, programme, institute].filter(Boolean).join(' • ');
    }
    containing('University of Zimbabwe clearance pending signed industrial letter. All portal applications remain fully accessible.',
      'Institution clearance has not yet been verified by ' + institute + '.');
    exact('UZ Verification', 'Institution verification (pending)');
    exact('UZ Prerequisite Credits', 'Institution prerequisites (unverified)');
    exact('UZ Student Scheme', 'Institution scheme (unverified)');
    exact('UZ Registrar Watermark', 'Registrar verification not connected');
    exact('UZ Official Academic Transcript', 'Academic transcript (not verified)');
    exact("Pending Dean's Signature / Stamp", 'Clearance not yet verified');
    exact('Faculty of Science & Technology, University of Zimbabwe',
      institute + ' — liaison contact not linked');
    exact('Industrial Faculty Liaison Module: CS380', 'Liaison module information not linked');
    exact('University SIS Integration (Planned)', 'Institutional system integration (planned)');
    exact('University Gateway Auth', 'Institution sign-in (not connected)');
    containing('UZ ID: R228491M', 'Institution ID: not yet verified');
    containing('Faculty Ref: FS/CS/25', 'Institution reference: not verified');
    containing('University sync: Demo', 'Institution sync: not connected');
    containing('No university database is connected', 'No institution database is connected');
  }

  if (page === 'attachment-details.html') {
    exact('Eligibility & University Requirements', 'Eligibility & Institution Requirements');
    containing('Must be a currently registered Year 3 (or Penultimate Year) student studying Computer Science, Telecommunications Engineering, Information Technology, or Electrical Engineering at a recognized Zimbabwean university (UZ, NUST, HIT, MSU, Africa University, CUT).',
      'This is a sample role. Eligibility for ' + institute + ' students must be confirmed by the employer and the institution.');
    exact("Valid Dean's Clearance / Attachment Recommendation Letter", 'Institution attachment recommendation / clearance letter');
    containing('Official letter signed by the Department Chairperson or Faculty Industrial Liaison Officer confirming readiness for 12 months off-campus attachment.',
      'Ask ' + institute + ' which approvals or letters are required before applying.');
    containing('Minimum weighted cumulative average grade of 65% across completed Parts 1 & 2 academic transcripts.',
      'Academic eligibility criteria must be confirmed for each employer and institution.');
    exact('Direct University Channel', 'Institution channel (not connected)');
    containing('AttachLink verifies this role under Ministry of Higher & Tertiary Education Guidelines. Applications are reviewed directly by the Econet Telecoms Talent Directorate.',
      'This listing is a frontend example and has not been verified or submitted to an employer.');
  }
}

function renderSaveButtons(){const setIds=new Set(saved());document.querySelectorAll('[data-save-role]').forEach(b=>{const id=b.getAttribute('data-save-role');const active=setIds.has(id);b.setAttribute('aria-pressed',String(active));b.setAttribute('aria-label',(active?'Remove saved opening: ':'Save opening: ')+(ROLES[id]?.title||id));b.textContent=active?'★ Saved':'☆ Save';b.classList.toggle('al-saved',active);b.title=active?'Remove from Saved Openings':'Save for later'});refreshNav()}
function toggleSave(id){if(!ROLES[id])return false;const list=saved();const had=list.includes(id);const next=had?list.filter(v=>v!==id):[...list,id];if(!set(KEYS.saved,next)){toast('Browser storage is unavailable.');return false}if(!had)activity('Opening saved',ROLES[id].company+' — '+ROLES[id].title,'attachment-details.html?id='+encodeURIComponent(id));toast(had?'Removed from Saved Openings.':'Added to Saved Openings.');renderSaveButtons();document.dispatchEvent(new CustomEvent('al:saved-updated'));return !had}
document.addEventListener('click',e=>{const btn=e.target.closest('[data-save-role]');if(btn){e.preventDefault();toggleSave(btn.getAttribute('data-save-role'))}});
window.addEventListener('storage',()=>{refreshNav();renderSaveButtons()});
document.addEventListener('DOMContentLoaded',()=>{refreshNav();renderSaveButtons();loadSessionNavName();fetchSavedCount()});
  document.addEventListener('attachlink:db-saved-updated', event=>{
    if (Number.isSafeInteger(Number(event.detail?.count))) {
      mysqlSavedCount=Number(event.detail.count);
      refreshNav();
    } else fetchSavedCount();
  });
  window.addEventListener('focus',()=>fetchSavedCount());
window.addEventListener('pageshow',e=>{if(e.persisted)loadSessionNavName()});
// MySQL-backed application activity. Existing saved-opening and practice-message
// demo functionality remains separate, as those features are not yet in MySQL.
const AttachLinkDBApplications=(()=>{
  const API=new URL('../../backend/api/',window.location.href);
  let cache=null;
  let lastLoaded=0;
  let pending=null;
  function storeKey(){
    if(!cache||!Number.isSafeInteger(Number(cache.user.id))) return null;
    return 'attachlink_mysql_app_alert_state_v1_'+String(cache.user.id);
  }
  function readState(){
    const key=storeKey();
    if(!key)return {read:[],hidden:[]};
    const state=get(key,{read:[],hidden:[]});
    return {read:Array.isArray(state.read)?state.read:[],hidden:Array.isArray(state.hidden)?state.hidden:[]};
  }
  function writeState(state){
    const key=storeKey();
    if(key)set(key,{read:state.read.slice(-2000),hidden:state.hidden.slice(-2000)});
    updateBadges();
    document.dispatchEvent(new Event('attachlink:db-alerts-changed'));
  }
  function eventFor(a){
    const status=String(a.status||'submitted').toLowerCase();
    const id='application-'+String(a.application_id)+'-'+status+'-'+String(a.updated_at||a.submitted_at||'');
    const company=String(a.organization||'Organization');
    const role=String(a.listing_title||'Attachment');
    const title=status==='submitted'?'Application recorded':status==='withdrawn'?'Application withdrawn': 'Application status: '+status;
    let body;
    if(status==='submitted') body='Your application for '+role+' at '+company+' was submitted.';
    else if(status==='withdrawn') body='Your application for '+role+' at '+company+' was withdrawn.';
    else body='Your application status is '+status+'.';
    return {id,title,body,link:'attachment-details.html?id='+encodeURIComponent(String(a.listing_id)),at:a.updated_at||a.submitted_at,application_id:a.application_id};
  }
  function alerts(){
    const s=readState();
    return (cache?.applications||[]).map(eventFor).filter(n=>!s.hidden.includes(n.id))
      .map(n=>({...n,read:s.read.includes(n.id)}));
  }
  function updateBadges(){
    mysqlAppCount=cache?cache.applications.length:null;
    mysqlUnreadCount=cache?.unreadCount??null;
    refreshNav();
  }
  async function getJson(path){
    const response=await fetch(new URL(path,API),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
    let result;
    try{result=await response.json()}catch{throw new Error('The backend did not return JSON. Check Apache and PHP.')}
    if(response.status===401){throw new Error('Your session has expired. Please sign in again.')}
    if(!response.ok||result?.ok!==true)throw new Error(result?.message||('Request failed: HTTP '+response.status));
    return result;
  }
  async function load(force=false){
    if(pending)return pending;
    if(!force&&cache&&Date.now()-lastLoaded<12000)return cache;
    pending=(async()=>{
      const me=await getJson('auth/me.php');
      if(!me.user||me.user.role!=='student'||!Number.isSafeInteger(Number(me.user.id)))throw new Error('A student login is required.');
      const applications=[];
      for(let page=1;page<=100;page++){
        const response=await getJson('student/applications.php?limit=50&page='+page);
        if(!Array.isArray(response.applications))throw new Error('Invalid applications response from MySQL API.');
        applications.push(...response.applications);
        if(!response.has_more)break;
        if(page===100)throw new Error('Too many applications to load.');
      }
      const notifications=await getJson('notifications.php');
      cache={user:me.user,applications,unreadCount:notifications.unread_count};
      lastLoaded=Date.now();
      updateBadges();
      document.dispatchEvent(new Event('attachlink:db-applications-updated'));
      return cache;
    })().finally(()=>{pending=null});
    return pending;
  }
  function markRead(id){const s=readState();if(!s.read.includes(id))s.read.push(id);writeState(s)}
  function markAllRead(){const s=readState();alerts().forEach(n=>{if(!s.read.includes(n.id))s.read.push(n.id)});writeState(s)}
  function clearAlerts(){const s=readState();alerts().forEach(n=>{if(!s.hidden.includes(n.id))s.hidden.push(n.id)});writeState(s)}
  window.addEventListener('pageshow',e=>{if(e.persisted)load(true).catch(console.warn)});
  window.addEventListener('focus',()=>{if(Date.now()-lastLoaded>12000)load(true).catch(console.warn)});
  document.addEventListener('attachlink:application-submitted',()=>{load(true).catch(console.warn)});
  document.addEventListener('DOMContentLoaded',()=>{load(true).catch(err=>{console.warn('AttachLink: cannot read MySQL application counts',err);mysqlAppCount=null;mysqlUnreadCount=null;refreshNav()})});
  return {load,alerts,markRead,markAllRead,clearAlerts,get applications(){return cache?.applications||[]},get user(){return cache?.user||null}};
})();
window.AttachLinkDBApplications=AttachLinkDBApplications;

window.AttachLink={KEYS,ROLES,get,set,esc,saved,apps,notifications,activity,toast,refreshNav,renderSaveButtons,toggleSave};
})();
