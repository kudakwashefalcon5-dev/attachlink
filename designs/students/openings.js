if ('dashboard.html' === location.pathname.split('/').pop()) {
/* AttachLink Stage 6C: approved MySQL listings in the EXISTING Stitch dashboard.
   Demo fixtures are seeded separately in MySQL. No old sample card is restored.
   Only authenticated, eligible listings supplied by Stage 6A can be displayed.
   All database/user text uses textContent (never HTML interpolation). */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const recommended = $('recommended-card-list');
  const allList = $('all-card-list');
  if (!recommended || !allList) return;
  const resultCount = $('attachment-results-count');
  const extraCount = $('dashboard-db-listing-count');
  const search = $('role-search-input');
  const location = $('location-filter');
  const faculty = $('faculty-filter');
  const stipend = $('stipend-filter');
  const recEmpty = $('recommended-empty');
  const allEmpty = $('all-empty');
  let listings = [];
  let sortMode = 'recent';
  let loaded = false;
  let failed = false;
  const API = new URL('../../backend/api/', window.location.href).href;

  function make(tag, className = '', value = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined && value !== null) node.textContent = String(value);
    return node;
  }
  function amount(value) {
    if (value === null || value === undefined || value === '') return 'Stipend not specified';
    const number = Number(value);
    return Number.isFinite(number) ? ('$' + number.toFixed(2) + ' USD / month') : 'Stipend not specified';
  }
  function dateText(value) {
    if (!value) return 'Deadline not specified';
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + 'T12:00:00') : null;
    return parsed && !Number.isNaN(parsed.valueOf())
      ? ('Closes ' + parsed.toLocaleDateString('en-ZW', {day: 'numeric', month: 'short', year: 'numeric'}))
      : 'Deadline not specified';
  }
  function orgInitials(value) {
    const parts = String(value || '').split(/\s+/).filter(Boolean);
    return (parts.slice(0, 2).map(part => part[0]).join('') || 'AL').toUpperCase();
  }
  function button(text, className, onclick) {
    const b = make('button', className, text);
    b.type = 'button';
    b.addEventListener('click', onclick);
    return b;
  }
  function card(item, compact) {
    const box = make('div', compact
      ? 'bg-surface-container-lowest rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between group'
      : 'bg-surface-container-lowest rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row items-start md:items-center justify-between gap-4');
    const overview = make('div', compact ? 'flex flex-col gap-3' : 'flex items-start gap-4');
    const monogram = make('div', 'w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center font-headline-sm text-headline-sm text-primary font-bold shrink-0', orgInitials(item.organization));
    const content = make('div', compact ? 'flex flex-col gap-2' : 'flex flex-col gap-1');
    const name = make('h3', compact ? 'font-title-md text-title-md text-on-surface font-semibold' : 'font-title-md text-title-md text-on-surface font-semibold', item.title);
    if (Number(item.has_company_logo)) window.AttachLinkCompanyLogo(monogram,item.company_id);
    const org = make('p', 'font-body-sm text-body-sm text-on-surface-variant', item.organization);
    const loc = make('p', 'font-body-sm text-body-sm text-outline', item.city || 'Location not specified');
    content.append(name, org, loc);
    if (compact) {
      const header = make('div', 'flex items-start justify-between gap-2');
      header.append(monogram);
      overview.append(header, content);
      box.append(overview);
      const bottom = make('div', 'mt-4 pt-3 flex flex-col gap-3 bg-surface-container-low -mx-4 -mb-4 p-4 rounded-b-xl');
      bottom.append(make('span', 'font-title-md text-title-md text-primary font-bold', amount(item.stipend_usd)));
      bottom.append(button('View & Apply', 'w-full py-2.5 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md hover:bg-primary transition-colors', () => showDetails(item.id)));
      const save = button('☆ Save', 'w-full py-2 rounded-lg bg-surface-container-lowest text-primary font-label-md text-label-md font-semibold hover:bg-surface-container transition-colors', () => {});
      save.setAttribute('data-save-db', String(item.id));
      bottom.append(save);
      box.append(bottom);
    } else {
      overview.append(monogram, content);
      box.append(overview);
      const right = make('div', 'flex items-center justify-between md:justify-end gap-4 w-full md:w-auto shrink-0');
      const summary = make('div', 'flex flex-col text-left md:text-right');
      summary.append(make('span', 'font-title-md text-title-md text-on-surface font-bold', amount(item.stipend_usd)),
        make('span', 'font-body-sm text-body-sm text-outline', dateText(item.closing_date)));
      const actions = make('div', 'flex items-center gap-2');
      actions.append(button('Details', 'px-3.5 py-2 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md', () => showDetails(item.id)));
      actions.append(button('Apply', 'px-4 py-2 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md hover:bg-primary transition-colors', () => showDetails(item.id)));
      const save = button('☆ Save', 'px-3.5 py-2 rounded-lg bg-surface-container-low text-primary font-label-md text-label-md font-semibold hover:bg-surface-container transition-colors', () => {});
      save.setAttribute('data-save-db', String(item.id));
      actions.append(save);
      right.append(summary, actions);
      box.append(right);
    }
    return box;
  }

  function currentResults() {
    const term = search.value.trim().toLocaleLowerCase();
    const city = location.value;
    const minimum = stipend.value;
    const result = listings.filter(item => {
      if (term && ![item.title, item.organization, item.city, item.description, item.requirements]
        .some(value => String(value || '').toLocaleLowerCase().includes(term))) return false;
      if (city !== 'all' && String(item.city || '').trim().toLocaleLowerCase() !== city) return false;
      const salary = Number(item.stipend_usd);
      if (minimum !== 'any' && (!Number.isFinite(salary) || item.stipend_usd === null)) return false;
      if (minimum === '150' && salary < 150) return false;
      if (minimum === '200' && (salary < 200 || salary > 350)) return false;
      if (minimum === '350' && salary < 350) return false;
      return true;
    });
    if (sortMode === 'stipend') result.sort((a, b) => Number(b.stipend_usd || 0) - Number(a.stipend_usd || 0));
    else if (sortMode === 'closing') result.sort((a, b) => String(a.closing_date || '9999').localeCompare(String(b.closing_date || '9999')));
    else result.sort((a, b) => Number(b.id) - Number(a.id));
    return result;
  }
  function render() {
    recommended.replaceChildren();
    allList.replaceChildren();
    const rows = currentResults();
    rows.slice(0, 3).forEach(item => recommended.append(card(item, true)));
    rows.forEach(item => allList.append(card(item, false)));
    recEmpty.classList.toggle('hidden', rows.length !== 0);
    allEmpty.classList.toggle('hidden', rows.length !== 0);
    const emptyText = failed ? 'Could not load attachment listings. Check the Stage 6 API and your login session.'
      : (loaded ? 'No published attachment opportunities available yet for your selected filters.' : 'Loading openings…');
    recEmpty.textContent = emptyText;
    allEmpty.textContent = emptyText;
    resultCount.textContent = failed ? 'Could not load database listings'
      : (loaded ? `Showing ${rows.length} of ${listings.length} openings` : 'Loading openings…');
    if (extraCount) extraCount.textContent = rows.length + ' of ' + listings.length + ' database listings';
    window.AttachLinkSaved?.paint();
  }

  async function fetchJson(path, options = {}) {
    const response = await fetch(new URL(path, API).href, {
      method: options.method || 'GET', credentials: 'same-origin', cache: 'no-store',
      headers: {'Accept': 'application/json', ...(options.body ? {'Content-Type': 'application/json'} : {})},
      ...(options.body ? {body: JSON.stringify(options.body)} : {})
    });
    if (response.status === 401) {
      window.location.replace('login.html?session=expired');
      throw new Error('Please sign in as a student.');
    }
    let data;
    try { data = await response.json(); } catch (_) { throw new Error('The server returned an invalid response.'); }
    if (!response.ok || data.ok !== true) throw new Error(data.message || ('API error ' + response.status));
    return data;
  }

  async function load() {
    render();
    try {
      const rows = [];
      // Stage 6A supplies a maximum of 30 listings per page. Follow up to ten pages.
      for (let page = 1; page <= 10; page++) {
        const data = await fetchJson('listings/index.php?limit=30&page=' + page);
        if (!Array.isArray(data.listings)) throw new Error('Invalid listings response.');
        rows.push(...data.listings);
        if (!data.has_more) break;
      }
      listings = rows;
      loaded = true;
      failed = false;
    } catch (error) {
      console.error('AttachLink Stage 6 listings:', error);
      failed = true;
      loaded = false;
    }
    render();
  }

  // Keep the original Stitch organization/details page instead of the Stage 6C modal.
  function showDetails(id) {
    if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) return;
    window.location.assign('attachment-details.html?id=' + encodeURIComponent(String(id)));
  }

  function init() {
    // Existing quick filters represent data Stage 6A does not return. Avoid fake results.
    document.querySelectorAll('[data-quick-filter]').forEach(control => {
      control.disabled = true;
      control.setAttribute('aria-disabled', 'true');
      control.title = 'This filter will be enabled once employers provide verified filter data.';
      control.style.opacity = '0.55';
    });
    if (faculty) {
      faculty.disabled = true;
      faculty.value = 'all';
      faculty.title = 'Faculty eligibility will be available once the database supports it.';
    }
    search.addEventListener('input', render);
    [location, stipend].forEach(control => control.addEventListener('change', render));
    $('apply-search-btn').addEventListener('click', render);
    $('clear-attachment-filters').addEventListener('click', () => {
      search.value = '';
      location.value = 'all';
      stipend.value = 'any';
      render();
    });
    document.querySelectorAll('#tab-group .tab-btn').forEach(control => {
      control.addEventListener('click', () => {
        sortMode = control.dataset.tab || 'recent';
        document.querySelectorAll('#tab-group .tab-btn').forEach(b => {
          b.classList.toggle('bg-surface-container-lowest', b === control);
          b.classList.toggle('shadow-sm', b === control);
        });
        render();
      });
    });
    load();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();

}

if ('attachment-details.html' === location.pathname.split('/').pop()) {
/* AttachLink Stage 6D — original Stitch-styled organization detail screen, MySQL data.
   No sample Econet/UZ data is shown or saved. All content uses textContent. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const API = new URL('../../backend/api/', location.href);
  const rawId = new URLSearchParams(location.search).get('id') || '';
  const id = /^\d+$/.test(rawId) && Number.isSafeInteger(Number(rawId)) && Number(rawId) > 0
    ? Number(rawId) : null;
  const page = $('listing-page');
  const feedback = $('listing-feedback');
  let listing = null;

  const txt = (key, value) => {
    const node = $(key);
    if (node) node.textContent = value === undefined || value === null ? '' : String(value);
  };
  const nonempty = (value, fallback = 'Not specified') => {
    const v = String(value ?? '').trim(); return v || fallback;
  };
  const money = value => (value === null || value === undefined || value === '')
    ? 'Not specified' : (Number.isFinite(Number(value))
      ? '$' + Number(value).toFixed(2) + ' USD / month' : 'Not specified');
  function dateFmt(value) {
    if (!value) return 'Not specified';
    const s = String(value);
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T12:00:00' : s.replace(' ', 'T'));
    return Number.isNaN(d.valueOf()) ? 'Not specified' : d.toLocaleDateString('en-ZW', {day:'numeric', month:'short', year:'numeric'});
  }
  function initials(value) {
    const words = String(value || '').trim().split(/\s+/).filter(Boolean);
    return (words.slice(0,2).map(w=>w[0]).join('') || 'AL').toUpperCase();
  }
  async function api(path, options = {}) {
    const response = await fetch(new URL(path, API), {
      method: options.method || 'GET', credentials: 'same-origin', cache:'no-store',
      headers: {'Accept': 'application/json', ...(options.body ? {'Content-Type':'application/json'} : {})},
      ...(options.body ? {body: JSON.stringify(options.body)} : {})
    });
    if (response.status === 401) {
      location.replace('login.html?session=expired');
      throw new Error('Your student session has expired.');
    }
    let data;
    try { data = await response.json(); }
    catch (_) { throw new Error('The server did not return JSON.'); }
    if (!response.ok || data.ok !== true) throw new Error(data.message || ('Request failed: HTTP ' + response.status));
    return data;
  }
  function showError(message) {
    feedback.hidden = false;
    feedback.textContent = message;
    page.hidden = true;
    page.style.display = 'none';
  }
  async function loadListing() {
    if (!id) {
      showError('Open an available listing from Find Openings.');
      return;
    }
    try {
      const response = await api('listings/detail.php?id=' + encodeURIComponent(id));
      if (!response.listing || typeof response.listing !== 'object') throw new Error('No listing details were returned.');
      listing = response.listing;
      const org = nonempty(listing.organization, 'Organization not supplied');
      const name = nonempty(listing.title, 'Attachment opening');
      txt('crumb-org',org);
      txt('crumb-title',name);
      txt('org-name',org);
      txt('org-monogram',initials(org));
      if (Number(listing.has_company_logo)) window.AttachLinkCompanyLogo(document.getElementById('org-monogram'),listing.company_id);
      txt('listing-title',name);
      txt('listing-city',nonempty(listing.city));
      txt('listing-stipend',money(listing.stipend_usd));
      txt('listing-reference','#' + String(listing.id));
      txt('listing-deadline',dateFmt(listing.closing_date));
      txt('listing-description',nonempty(listing.description,'No role overview supplied for this opening.'));
      const details=[listing.requirements,listing.available_positions&&('Available positions: '+listing.available_positions),listing.required_skills&&('Required skills: '+listing.required_skills.split('\n').join(', '))].filter(Boolean);
      txt('listing-requirements',details.join(' | ')||'No requirements supplied for this opening.');
      txt('org-description',nonempty(listing.organization_description,'No organization description available.'));
      txt('quick-org',org);
      txt('quick-org-location',nonempty(listing.organization_location,nonempty(listing.city)));
      txt('quick-created',dateFmt(listing.created_at));
      const savedButton = $('listing-save');
      if (savedButton) {
        savedButton.dataset.saveDb = String(listing.id);
        savedButton.disabled = false;
        window.AttachLinkSaved?.paint();
      }
      document.title = name + ' | AttachLink';
      feedback.hidden = true;
      page.hidden = false;
      page.style.display = '';
    } catch (error) {
      showError(error.message + ' Use Find Openings to select a listing available to your institution.');
    }
  }
  $('share-listing').addEventListener('click', async e => {
    if (!listing) return;
    const button = e.currentTarget;
    const label = button.querySelector('span');
    const url = new URL('attachment-details.html?id=' + encodeURIComponent(String(listing.id)), location.href).href;
    const title = String(listing.title || 'Attachment Opening');
    if (navigator.share) {
      try {
        await navigator.share({title, text: 'AttachLink attachment opportunity', url});
        return;
      } catch (error) {
        if (error && error.name === 'AbortError') return;
        // Fall back to the clipboard if web sharing is not available.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      if (label) label.textContent = 'Link Copied!';
      setTimeout(() => {if (label) label.textContent = 'Share Opening';}, 2500);
    } catch (_) {
      // Manual copy is supported even if clipboard permissions are disabled.
      window.prompt('Copy the listing link:', url);
    }
  });
  loadListing();
})();

}

if ('attachment-details.html' === location.pathname.split('/').pop()) {
/* AttachLink Stage 10D. Adds uploads to the EXISTING Stitch application card.
   No original layout, CSS, listing details, or Save/Share code is replaced. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
function ready(){
 const apply=$('listing-apply'), cover=$('listing-cover-letter'), feedback=$('application-feedback');
 if(!apply||!cover||!feedback)return;
 const fields=[
  ['national_id','Certified copy of national ID'],
  ['academic_certificates','Academic certificates'],
  ['stamped_letter','Attachment letter'],
  ['birth_certificate','Birth certificate'],
  ['transcript','Academic transcripts']
 ];
 const section=document.createElement('section');
 section.id='al-stage10d-documents';section.className='flex flex-col gap-3 rounded-xl bg-surface-container-low p-4';
 const heading=document.createElement('h3');heading.className='font-title-md text-title-md text-primary font-semibold';heading.textContent='Documents required for application';
 const info=document.createElement('p');info.className='font-body-sm text-body-sm text-on-surface-variant';info.textContent='All five uploads are required. If you have multiple certificates or transcripts, combine each group into one PDF. PDF, JPG or PNG, up to 5 MB per upload.';
 section.append(heading,info);
 const savedDocuments=new Map();
 const vaultLink=document.createElement('a');
 vaultLink.href='profile.html#vault-title';
 vaultLink.className='text-primary underline';
 vaultLink.textContent='Manage saved application documents';
 section.append(vaultLink);
 const inputs=new Map();
 const labels=new Map();
 for(const [key,title] of fields){
  const label=document.createElement('label');label.className='flex flex-col gap-1 font-label-md text-label-md text-on-surface';
  const span=document.createElement('span');span.textContent=title+' *';
  const input=document.createElement('input');input.type='file';input.name=key;input.accept='.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';input.required=true;
  input.className='w-full p-2 rounded-lg bg-surface-container-lowest text-on-surface border border-outline-variant';
  label.append(span,input);section.append(label);inputs.set(key,input);labels.set(key,span);
 }
 fetch('../../backend/api/student/document-vault.php',{cache:'no-store'})
  .then(response=>response.ok?response.json():null)
  .then(result=>{
   for(const document of result?.documents??[]) savedDocuments.set(document.document_type,document.original_name);
   for(const [key,title] of fields){
    if(!savedDocuments.has(key))continue;
    labels.get(key).textContent=title+' - saved file will be attached unless you choose another';
    inputs.get(key).required=false;
   }
  }).catch(()=>{});
 const progress=document.createElement('progress');
 progress.max=100;progress.hidden=true;
 progress.setAttribute('aria-label','Application upload progress');
 progress.className='w-full';
 section.append(progress);
 feedback.setAttribute('role','status');
 cover.insertAdjacentElement('afterend',section);
 function upload(url,data){
  return new Promise((resolve,reject)=>{
   const request=new XMLHttpRequest();
   request.open('POST',url);
   request.responseType='json';
   request.setRequestHeader('Accept','application/json');
   request.upload.onprogress=event=>{
    if(event.lengthComputable){
     progress.value=Math.floor(event.loaded/event.total*100);
     feedback.textContent=progress.value===100?'Upload complete. Recording your application?':'Uploading documents ('+progress.value+'%)?';
    }
   };
   request.onload=()=>{
    if(request.status===201&&request.response?.ok)resolve(request.response);
    else reject(Error(request.response?.message||(request.status===413?'The upload is too large. Use smaller files.':'The upload could not be saved. Please try again.')));
   };
   request.onerror=()=>reject(Error('The connection dropped during upload. Check your connection and try again.'));
   request.send(data);
  });
 }
 // Submit the application with its required document pack.
 document.addEventListener('click',async event=>{
  const target=event.target instanceof Element?event.target.closest('#listing-apply'):null;
  if(!target || !section.isConnected || apply.disabled)return;
  event.preventDefault();event.stopImmediatePropagation();
  const id=new URLSearchParams(location.search).get('id');
  if(!id||!/^[1-9]\d*$/.test(id)){feedback.textContent='Choose an opening first.';return;}
  const data=new FormData();data.set('listing_id',id);data.set('cover_letter',cover.value.trim());
  if(savedDocuments.size)data.set('use_vault','1');
  for(const [key,title] of fields){
   const file=inputs.get(key).files[0];
   if(!file&&!savedDocuments.has(key)){feedback.textContent='Please attach: '+title;inputs.get(key).focus();return;}
   if(file){
    if(!file.size||file.size>5*1024*1024){feedback.textContent=title+' must be between 1 byte and 5 MB.';inputs.get(key).focus();return;}
    if(!/\.(pdf|jpe?g|png)$/i.test(file.name)||file.type&&!['application/pdf','image/jpeg','image/png'].includes(file.type)){
     feedback.textContent=title+' must be a PDF, JPG or PNG file.';inputs.get(key).focus();return;
    }
    data.set(key,file,file.name);
   }
  }
  apply.disabled=true;progress.value=0;progress.hidden=false;feedback.textContent='Uploading your application and document pack…';
  try{
   const base=new URL('../../backend/api/',location.href);
   const tokenResponse=await fetch(new URL('auth/csrf.php',base),{credentials:'same-origin',cache:'no-store'});
   const token=await tokenResponse.json();if(!tokenResponse.ok||!token.csrf_token)throw Error('Login session expired. Sign in again.');
   data.set('csrf_token',token.csrf_token);
   const result=await upload(new URL('student/apply-with-documents.php',base),data);
   feedback.textContent='Application #'+result.application_id+' submitted with '+result.document_count+' private documents.';
   apply.textContent='Application Submitted';
   document.dispatchEvent(new Event('attachlink:application-submitted'));
  }catch(error){feedback.textContent=error.message||String(error);apply.disabled=false;}
  finally{progress.hidden=true;}
 },true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();

}

if ('saved-openings.html' === location.pathname.split('/').pop()) {
/* AttachLink Stage 6F — reuse existing Saved Openings Stitch cards with MySQL data. */
(() => {
  'use strict';
  const host = document.getElementById('saved-results');
  const search = document.getElementById('saved-search');
  if (!host || !search) return;
  const S = window.AttachLinkSaved;
  if (!S) return;
  const make = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className=cls;
    if (text !== undefined) node.textContent=String(text);
    return node;
  };
  function render() {
    host.replaceChildren();
    if (!S.loaded) {
      host.append(make('div','al-empty','Loading saved openings…'));
      return;
    }
    const term = search.value.trim().toLocaleLowerCase();
    const rows = S.saved.filter(row =>
      [row.title,row.organization,row.city].some(value=>String(value||'').toLocaleLowerCase().includes(term))
    );
    if (!rows.length) {
      const empty=make('div','al-empty',term ? 'No saved openings match your search.' : 'No saved openings yet. Save an opening on the dashboard or its details page.');
      empty.style.gridColumn='1 / -1';
      host.append(empty);
      return;
    }
    rows.forEach(row => {
      const card=make('article','al-panel');
      const top=make('div','flex items-start gap-4');
      const mono=make('div','w-12 h-12 flex items-center justify-center shrink-0 rounded-xl bg-primary text-white font-bold', String(row.organization||'AL').split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase() || 'AL');
      if (Number(row.has_company_logo)) window.AttachLinkCompanyLogo(mono,row.company_id);
      const text=make('div','');
      text.append(
        make('p','font-semibold text-primary',row.organization||'Organization'),
        make('h2','font-bold text-lg',row.title||'Attachment opening'),
        make('p','al-muted mt-2',row.city||'Location not specified'),
        make('p','font-semibold mt-2',row.stipend_usd==null?'Stipend not specified':'$'+Number(row.stipend_usd).toFixed(2)+' USD/month')
      );
      top.append(mono,text);card.append(top);
      const actions=make('div','flex flex-wrap gap-2 mt-5');
      const link=make('a','al-btn al-btn-primary','View details');
      link.href='attachment-details.html?id='+encodeURIComponent(String(row.listing_id));
      const remove=make('button','al-btn al-btn-soft','★ Saved');
      remove.type='button';remove.dataset.saveDb=String(row.listing_id);
      actions.append(link,remove);card.append(actions);host.append(card);
    });
    S.paint();
  }
  document.addEventListener('attachlink:db-saved-updated',render);
  search.addEventListener('input',render);
  render();
})();

}
