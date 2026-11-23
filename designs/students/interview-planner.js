/* Personal interview diary. No calls to employers, calendar APIs or remote notifications. */
(()=>{
'use strict';
const A=window.AttachLink,$=s=>document.querySelector(s),esc=A.esc;
let plans=[], applications=[];
const read=()=>plans;
async function api(path,method='GET',input){
 const options={method,credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}};
 if(input){
  const {csrf_token}=await api('auth/csrf.php');
  options.headers['Content-Type']='application/json';
  options.body=JSON.stringify({...input,csrf_token});
 }
 const response=await fetch('../../backend/api/'+path,options);
 const result=await response.json();
 if(!response.ok||!result.ok)throw Error(result.message||'Unable to load your planner.');
 return result;
}
function showPlans(result){
 plans=result.plans;
 window.AttachLinkInterviewPlans=plans;
 render();
 document.dispatchEvent(new Event('attachlink:interview-plans'));
}
const fields=['company','role','date','time','type','duration','venue','notes'];
const input=n=>$('#interview-'+n);
const reset=()=>{$('#interview-form').reset();$('#interview-id').value='';$('#interview-save').textContent='Save to My Planner';};
function listApps(){
 const apps=applications,select=input('app');
 select.innerHTML='<option value="">Enter company and role manually</option>'+apps.map((a,i)=>`<option value="${i}">${esc(a.company||'Company')} · ${esc(a.title||'Role')}</option>`).join('');
}
function render(){
 const root=$('#interview-items'),data=read().slice().sort((a,b)=>(a.date+'T'+a.time).localeCompare(b.date+'T'+b.time));
 if(!data.length){root.innerHTML='<div class="al-empty">Your planner is empty. Add your first interview or mock interview using the form.</div>';return;}
 root.innerHTML=data.map(x=>`<article class="al-ct-row" data-id="${esc(x.id)}"><div style="flex:1;min-width:0"><h3 class="font-bold text-base">${esc(x.company)}</h3><p class="al-ct-muted">${esc(x.role)}</p><p class="mt-2 font-semibold text-primary">${esc(x.date)} · ${esc(x.time)} · ${esc(x.duration)} minutes</p><p class="al-ct-meta">${esc(x.type)}${x.venue?' · '+esc(x.venue):''}</p>${x.notes?`<p class="al-ct-meta mt-2" style="white-space:pre-wrap">${esc(x.notes)}</p>`:''}</div><div class="al-ct-actions"><button class="al-btn al-btn-soft" data-action="edit">Edit</button><button class="al-btn al-btn-soft" data-action="calendar">Calendar .ics</button><button class="al-btn al-btn-danger" data-action="delete">Delete</button></div></article>`).join('');
}
function saveFile(data,filename,type){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function ics(x){
 // Local DTSTART/DTEND values, so calendar app interprets the user's local clock.
 const from=new Date(`${x.date}T${x.time}:00`);
 if(Number.isNaN(from.getTime())){A.toast('Invalid interview date or time.');return;}
 const end=new Date(from.getTime()+Number(x.duration||30)*60000);
 const local=d=>`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}00`;
 const escape=v=>String(v||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/[,;]/g,c=>'\\'+c);
 const uid=String(x.id).replace(/[^\w-]/g,'')+'@attachlink.local';
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//AttachLink//Student Demo Planner//EN','BEGIN:VEVENT','UID:'+uid,'DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+/,'').replace('Z','Z'),'DTSTART:'+local(from),'DTEND:'+local(end),'SUMMARY:'+escape(x.company+' — '+x.role),'DESCRIPTION:'+escape(x.notes+' (Personal AttachLink demo plan; not confirmed by employer.)'),'LOCATION:'+escape(x.venue),'END:VEVENT','END:VCALENDAR'];
 saveFile(lines.join('\r\n')+'\r\n','attachlink-interview-'+x.date+'.ics','text/calendar;charset=utf-8');
}
$('#interview-app').addEventListener('change',e=>{const index=e.target.value;if(index==='')return;const app=applications[Number(index)];if(!app)return;input('company').value=app.company||'';input('role').value=app.title||'';});
$('#interview-form').addEventListener('submit',async e=>{
 e.preventDefault();const item={};for(const f of fields)item[f]=input(f).value.trim();
 if(!item.company||!item.role||!item.date||!item.time)return;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(item.date)||!/^\d{2}:\d{2}$/.test(item.time)){A.toast('Enter a valid date and time.');return;}
 const id=$('#interview-id').value;
 if(id)item.id=Number(id);
 const button=$('#interview-save');button.disabled=true;
 try{
  showPlans(await api('student/interviews.php','POST',item));
  A.toast('Interview plan saved.');reset();listApps();
 }catch(error){A.toast(error.message);}
 finally{button.disabled=false;}
});
$('#interview-reset').addEventListener('click',reset);
$('#interview-items').addEventListener('click',async e=>{
 const btn=e.target.closest('button[data-action]');if(!btn)return;
 const id=btn.closest('[data-id]')?.dataset.id,x=read().find(i=>String(i.id)===id);if(!x)return;
 const act=btn.dataset.action;
 if(act==='edit'){
  $('#interview-id').value=id;for(const f of fields)input(f).value=x[f]||'';input('app').value='';$('#interview-save').textContent='Update Plan';document.getElementById('interview-form').scrollIntoView({behavior:'smooth',block:'start'});input('company').focus();
 }else if(act==='calendar'){ics(x)}else if(act==='delete'){
  if(!confirm('Delete this personal interview plan?'))return;
  btn.disabled=true;
  try{showPlans(await api('student/interviews.php','DELETE',{id:Number(id)}));A.toast('Plan deleted.');}
  catch(error){A.toast(error.message);btn.disabled=false;}
 }
});
$('#interview-items').textContent='Loading your interview plans...';
Promise.all([api('student/interviews.php'),api('student/applications.php')]).then(([result,records])=>{
 applications=records.applications.map(item=>({company:item.company_name,title:item.title}));
 listApps();showPlans(result);
}).catch(error=>{$('#interview-items').textContent=error.message;});
})();
