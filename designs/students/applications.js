/* AttachLink Stage 6E — My Applications reads ONLY current student's MySQL records.
   Stitch HTML/CSS and visual layout remain unchanged. */
document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  const DB=window.AttachLinkDBApplications;
  const $=id=>document.getElementById(id);
  const list=$('applications-list');
  const tabs=[...document.querySelectorAll('#filter-tabs button')];
  const search=$('application-search');
  const sort=$('application-sort');
  let filter='all';
  let rows=[];
  function safe(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function group(value){const s=String(value||'submitted').toLowerCase();
    if(s.includes('offer')||s.includes('accept'))return 'offers';
    if(s.includes('shortlist')||s.includes('interview'))return 'shortlisted';
    if(s.includes('withdraw')||s.includes('reject')||s.includes('clos')||s.includes('fill'))return 'closed';
    return 'review';
  }
  function dateFmt(value){if(!value)return 'Date not recorded';
    const date=new Date(String(value).replace(' ','T'));
    return Number.isNaN(date.valueOf())?'Date not recorded':date.toLocaleDateString('en-ZW',{year:'numeric',month:'short',day:'numeric'});
  }
  function render(){
    const count=type=>rows.filter(a=>group(a.status)===type).length;
    $('count-active').textContent=String(rows.filter(a=>group(a.status)!=='closed').length);
    $('count-offers').textContent=String(count('offers'));
    $('count-shortlisted').textContent=String(count('shortlisted'));
    $('count-review').textContent=String(count('review'));
    $('count-closed').textContent=String(count('closed'));
    if($('nav-count'))$('nav-count').textContent=String(rows.length);
    const labels={all:'All',offers:'Offers Received',shortlisted:'Shortlisted',review:'Submitted',closed:'Closed / Filled'};
    tabs.forEach(tab=>{const active=tab.dataset.filter===filter;
      tab.classList.toggle('bg-primary',active);tab.classList.toggle('text-on-primary',active);
      tab.classList.toggle('bg-surface-container-lowest',!active);tab.classList.toggle('text-on-surface-variant',!active);
      tab.textContent=labels[tab.dataset.filter]+' ('+(tab.dataset.filter==='all'?rows.length:count(tab.dataset.filter))+')';
    });
    const term=search.value.trim().toLowerCase();
    const shown=rows.filter(a=>(filter==='all'||group(a.status)===filter)&&
      [a.listing_title,a.organization,a.listing_city].join(' ').toLowerCase().includes(term));
    shown.sort((a,b)=>sort.value==='company'?String(a.organization||'').localeCompare(String(b.organization||'')):
      sort.value==='oldest'?new Date(a.submitted_at||0)-new Date(b.submitted_at||0):
      new Date(b.submitted_at||0)-new Date(a.submitted_at||0));
    if(!shown.length){
      list.innerHTML=`<div class="bg-surface-container-lowest rounded-2xl p-10 shadow-sm text-center">
        <h2 class="font-headline-sm text-headline-sm mt-3">${rows.length?'No matching applications':'No applications yet'}</h2>
        <p class="font-body-md text-body-md text-outline mt-2">${rows.length?'Try another filter or search.':'Find an opening to start your first application.'}</p>
        <a href="dashboard.html" class="inline-block mt-5 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg">Find Openings</a></div>`;
      return;
    }
    list.innerHTML=shown.map(a=>{
      const org=String(a.organization||'Organization');
      const orgParts=org.trim().split(/\s+/).filter(Boolean);
      const monogram=(orgParts.slice(0,2).map(w=>w[0]).join('')||'AL').toUpperCase();
      const withdraw=['submitted','reviewing'].includes(a.status)
        ? `<button type="button" class="underline text-primary" data-withdraw="${safe(a.application_id)}">Withdraw application</button>` : '';
      const state=String(a.status||'submitted').replace(/_/g,' ').toUpperCase();
      const displayDate=dateFmt(a.submitted_at);
      const href='attachment-details.html?id='+encodeURIComponent(String(a.listing_id));
      const detailLink=String(a.listing_status||'').toLowerCase()==='published'
        ?`<a href="${href}" class="px-4 py-2.5 rounded-xl bg-surface-container-low text-on-surface font-label-md text-label-md hover:bg-surface-container shrink-0">View Details</a>`
        :`<span class="px-4 py-2.5 rounded-xl bg-surface-container-low text-on-surface-variant font-label-md text-label-md">Listing unavailable</span>`;
      return `<article class="bg-surface-container-lowest rounded-2xl p-6 lg:p-8 shadow-sm"><div class="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div class="flex items-start gap-4"><div class="w-14 h-14 rounded-xl bg-surface-container-high flex items-center justify-center text-primary font-headline-md font-bold shrink-0" data-company-logo="${safe(a.company_id)}" data-logo-available="${Number(a.has_company_logo)}">${safe(monogram)}</div>
        <div><span class="inline-flex px-2.5 py-1 rounded-md bg-secondary-fixed text-on-secondary-fixed font-label-caps text-label-caps">${safe(state)}</span>
        <h2 class="font-headline-sm text-headline-sm mt-2">${safe(a.listing_title||'Attachment')}</h2>
        <p class="font-body-md text-body-md text-on-surface-variant mt-1">${safe(org)} · ${safe(a.listing_city||'Location not specified')}</p>
        <p class="font-body-sm text-body-sm text-outline mt-2">Application #${safe(a.application_id)} · Submitted ${safe(displayDate)}</p></div></div><div class="flex flex-wrap gap-3 items-center">${detailLink}${withdraw}</div></div>
        </article>`;
    }).join('');
    list.querySelectorAll('[data-company-logo][data-logo-available="1"]').forEach(host=>window.AttachLinkCompanyLogo(host,host.dataset.companyLogo));
  }
  list.addEventListener('click',async event=>{
    const button=event.target.closest('[data-withdraw]');
    if(!button || !confirm('Withdraw this application?'))return;
    button.disabled=true;
    try{
      const root='../../backend/api/';
      const csrf=await fetch(root+'auth/csrf.php').then(response=>response.json());
      const response=await fetch(root+'student/withdraw-application.php',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({csrf_token:csrf.csrf_token,application_id:Number(button.dataset.withdraw)})
      });
      const result=await response.json();
      if(!response.ok)throw Error(result.message);
      await update(true);
      statusBox.textContent=result.message;
    }catch(error){statusBox.textContent=error.message;}
    finally{button.disabled=false;}
  });
  tabs.forEach(tab=>tab.addEventListener('click',()=>{filter=tab.dataset.filter;render()}));
  search.addEventListener('input',render);
  sort.addEventListener('change',render);
  $('export-applications').addEventListener('click',()=>{
    if(!rows.length){alert('No applications to export yet.');return}
    const cols=['application_id','listing_id','listing_title','organization','listing_city','status','submitted_at'];
    const csv=[cols.join(','),...rows.map(a=>cols.map(k=>'"'+String(a[k]??'').replace(/"/g,'""').replace(/^[=+@\-\t\r]/,'\'\$&')+'"').join(','))].join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const anchor=document.createElement('a');anchor.href=url;anchor.download='attachlink-my-applications.csv';anchor.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  const statusBox=document.createElement('p');statusBox.className='font-body-sm text-body-sm text-outline mt-3';statusBox.setAttribute('role','status');
  list.before(statusBox);
  async function update(force){
    try{const result=await DB.load(!!force);rows=result.applications;statusBox.textContent='';render()}
    catch(error){statusBox.textContent='Could not load your applications: '+error.message;
      list.replaceChildren(); // Never fall back to another student's browser demo data.
      ['count-active','count-offers','count-shortlisted','count-review','count-closed','nav-count'].forEach(id=>{if($(id))$(id).textContent='—'});
    }
  }
  document.addEventListener('attachlink:db-applications-updated',()=>update(false));
  update(true);
});
