/* AttachLink Stage 10D. Adds a real private-documents review panel to the ORIGINAL Stitch applicant dossier.
   Only shown for /applicant-profile.html; no page replacement or CSS change. */
(()=>{'use strict';
if(!location.pathname.endsWith('/applicant-profile.html'))return;
const appId=new URLSearchParams(location.search).get('application_id');
if(!appId||!/^[1-9]\d*$/.test(appId))return;
const BASE=new URL('../../backend/api/',location.href);
let csrf='',reviewed=false,documentCount=0,status='submitted',locked=false,loaded=false;
const el=(tag,cls,text)=>{const x=document.createElement(tag);x.className=cls||'';if(text!==undefined)x.textContent=text;return x;};
const get=async name=>{
 const r=await fetch(new URL(name,BASE),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
 const d=await r.json().catch(()=>({ok:false,message:'Backend did not return JSON.'}));
 if(!r.ok||d.ok!==true)throw Error(d.message||'HTTP '+r.status);return d;
};
const post=async(name,payload)=>{
 if(!csrf)csrf=(await get('auth/csrf.php')).csrf_token;
 const r=await fetch(new URL(name,BASE),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,csrf_token:csrf})});
 const d=await r.json().catch(()=>({ok:false,message:'Backend did not return JSON.'}));
 if(!r.ok||d.ok!==true)throw Error(d.message||'HTTP '+r.status);return d;
};
const btn=(cls,text)=>{const b=el('button',cls,text);b.type='button';return b;};
const pClass='font-body-sm text-body-sm text-on-surface-variant';
function init(){
 const tabs=document.getElementById('docTabs');if(!tabs)return;
 // The existing Stitch PDF placeholder and unverified academic seal must NOT be mistaken for actual uploads.
 const ribbon=tabs.parentElement;
 // Replace the original sample university label without changing any Stitch classes.
 const originalLetter=tabs.querySelector('#tab-letter span:last-child');
 if(originalLetter)originalLetter.textContent='Stamped Attachment Letter';
 const originalTranscript=tabs.querySelector('#tab-transcript span:last-child');
 if(originalTranscript)originalTranscript.textContent='Academic Transcript';
 const seal=ribbon?.nextElementSibling;
 const mock=seal?.nextElementSibling;
 if(seal)seal.hidden=true;
 if(mock)mock.hidden=true;
 const panel=el('section','bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md');
 panel.id='al-private-doc-review';
 const title=el('h3','font-title-md text-title-md text-primary font-semibold','Student-submitted documents');
 const message=el('p',pClass,'Loading private documents…');message.setAttribute('role','status');
 const list=el('div','flex flex-col gap-2');
 const note=el('textarea','w-full rounded-lg bg-surface-container-low p-3 text-on-surface border border-outline-variant');note.rows=2;note.placeholder='Optional employer review note';
 const mark=btn('px-4 py-2 rounded-lg bg-primary-container text-on-primary font-label-md','Mark documents reviewed');
 mark.addEventListener('click',async()=>{
  mark.disabled=true;message.textContent='Saving document review…';
  try{await post('employer/application-documents.php',{application_id:Number(appId),note:note.value.trim()});reviewed=true;message.textContent='Document pack reviewed. Final acceptance or rejection is now available.';mark.textContent='Reviewed ✓';}
  catch(e){message.textContent=e.message;mark.disabled=false;}
 });
 panel.append(title,message,list,note,mark);
 ribbon.insertAdjacentElement('afterend',panel);
 async function load(){
  try{
   const [data,detail]=await Promise.all([
     get('employer/application-documents.php?application_id='+encodeURIComponent(appId)),
     get('employer/application-detail.php?application_id='+encodeURIComponent(appId))
   ]);
   status=detail.application.status;
   documentCount=data.document_count;reviewed=!!data.reviewed;
   list.replaceChildren();
   if(!documentCount){message.textContent='Legacy test application: no documents were submitted before the new upload requirement. No documents can be verified for this application.';note.hidden=true;mark.hidden=true;}
   else{
    message.textContent=(reviewed?'Documents reviewed on '+(data.reviewed_at||'a previous date')+'.':'Review each uploaded file, then click Mark documents reviewed.');
    for(const d of data.documents){
     const row=el('div','flex flex-wrap items-center justify-between gap-2 bg-surface-container-low rounded-lg p-3');
     const label=el('span','font-label-md text-label-md text-on-surface',d.label+' — '+d.original_name);
     const link=el('a','font-label-md text-label-md text-primary hover:underline','Download / inspect');
     link.href=new URL('employer/application-documents.php?application_id='+encodeURIComponent(appId)+'&document_id='+encodeURIComponent(d.id),BASE).href;
     link.rel='noopener';link.target='_blank';row.append(label,link);list.append(row);
    }
    if(reviewed){mark.disabled=true;mark.textContent='Reviewed ✓';}
   }
   loaded=true;
   if(['accepted','rejected','withdrawn'].includes(status)){mark.disabled=true;}
  }catch(e){message.textContent='Documents could not load: '+e.message;mark.disabled=true;}
 }
 // The original Stitch tab buttons were wired to *sample* CV/transcript content; hide them until replaced.
 tabs.querySelectorAll('button').forEach(b=>{b.disabled=true;b.title='Use the real uploaded-document list below.';});
 ribbon.querySelectorAll('button').forEach(b=>{b.disabled=true;b.title='Use document downloads below.';});
 // Direct final decisions: bypass older bridge's sequential 'Start review / Shortlist' handler.
 const candidates=[...document.querySelectorAll('main button')];
 const accept=candidates.find(b=>b.classList.contains('bg-tertiary') && /Make Offer|Start review|Shortlist|Invite to interview|Accept/i.test(b.textContent));
 const reject=candidates.find(b=>b.classList.contains('bg-error-container') && /Reject/i.test(b.textContent));
 const setLabel=(b,label)=>{if(!b)return;const spans=[...b.querySelectorAll('span')];(spans.at(-1)||b).textContent=label;};
 if(accept){
   const set=()=>{const last=[...accept.querySelectorAll('span')].at(-1);if(last&&last.textContent!=='Accept application')last.textContent='Accept application';};
   set();
   new MutationObserver(set).observe(accept,{childList:true,characterData:true,subtree:true});
 }
 if(reject)setLabel(reject,'Reject application');
 document.addEventListener('click',async e=>{
  const clicked=e.target instanceof Element?e.target.closest('button'):null;
  if(clicked!==accept && clicked!==reject)return;
  e.preventDefault();e.stopImmediatePropagation();
  if(locked)return;
  if(!loaded){message.textContent='Loading the document review record. Please try again shortly.';return;}
  if(['accepted','rejected','withdrawn'].includes(status)){message.textContent='Application is already final: '+status;return;}
  if(documentCount && !reviewed){message.textContent='Review the attached documents and click Mark documents reviewed before deciding.';panel.scrollIntoView({behavior:'smooth',block:'center'});return;}
  const decision=clicked===accept?'accepted':'rejected';
  const noteField=document.getElementById('evalNote');let reviewNote=noteField?.value?.trim()||'';
  if(decision==='rejected' && reviewNote.length<10){reviewNote=prompt('Enter a rejection reason (at least 10 characters):','')||'';}
  if(decision==='rejected' && reviewNote.trim().length<10){message.textContent='Rejection requires at least 10 characters explaining the decision.';return;}
  if(!confirm('Confirm '+decision+' for this test application? This is a final decision.'))return;
  locked=true;message.textContent='Saving '+decision+' decision…';
  try{await post('employer/application-status.php',{application_id:Number(appId),status:decision,note:reviewNote});status=decision;message.textContent='Application '+decision+'. The student will see the final status in My Applications.';if(accept)accept.disabled=true;if(reject)reject.disabled=true;}
  catch(err){message.textContent=err.message;locked=false;}
 },true);
 load();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
