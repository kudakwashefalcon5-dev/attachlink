/* Export, import and clear ONLY known AttachLink browser-demo keys. */
(()=>{
'use strict';
const A=window.AttachLink,$=s=>document.querySelector(s),E=A.esc;
const GROUPS=[
 {label:'Profile, document names & CV draft',keys:['attachlink_student_profile_v1','attachlink_student_documents_v1',A.KEYS.cv]},
 {label:'Saved applications & interviews',keys:[A.KEYS.apps,A.KEYS.interviews]},
 {label:'Messages & activity alerts',keys:[A.KEYS.messages,A.KEYS.notifications]},
 {label:'Saved openings',keys:[A.KEYS.saved]},
];
const ALL=[...new Set(GROUPS.flatMap(g=>g.keys))];
let incoming=null;
function present(){
 const rows=GROUPS.map(g=>{const used=g.keys.filter(k=>localStorage.getItem(k)!==null);return `<div class="al-ct-row" style="padding:11px 14px"><div class="al-ct-meta">${E(g.label)}</div><div class="font-bold">${used.length} / ${g.keys.length} sections</div></div>`;});
 $('#data-summary').innerHTML=rows.join('');
 $('#data-clear-options').innerHTML=GROUPS.map((g,i)=>`<label class="al-ct-row" style="align-items:center;padding:13px;cursor:pointer"><input type="checkbox" class="data-clear-box" value="${i}" style="width:19px;height:19px;accent-color:#0f766e"><span style="flex:1;font-size:13px;font-weight:650">${E(g.label)}</span></label>`).join('');
}
function download(content,name){const url=URL.createObjectURL(new Blob([content],{type:'application/json;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)}
$('#data-export').addEventListener('click',()=>{
 const data={};for(const key of ALL){try{const v=localStorage.getItem(key);if(v!==null)data[key]=JSON.parse(v);}catch{A.toast('Some stored data was invalid and omitted: '+key);}}
 const pack={format:'attachlink-student-demo-backup',version:1,exportedAt:new Date().toISOString(),data};
 const today=new Date().toISOString().slice(0,10);
 download(JSON.stringify(pack,null,2),'attachlink-student-backup-'+today+'.json');
 A.toast('Backup downloaded. Keep it private.');
});
$('#data-import-file').addEventListener('change',async e=>{
 incoming=null;$('#data-import').disabled=true;
 const f=e.target.files?.[0];if(!f){$('#data-import-status').textContent='No file selected.';return;}
 if(f.size>3*1024*1024){$('#data-import-status').textContent='Backup file is too large (maximum 3 MB).';return;}
 try{
  const data=JSON.parse(await f.text());
  if(!data||data.format!=='attachlink-student-demo-backup'||data.version!==1||!data.data||typeof data.data!=='object'||Array.isArray(data.data))throw Error('Not an AttachLink student backup.');
  const keys=Object.keys(data.data);
  if(!keys.length)throw Error('This backup has no records to restore.');
  if(keys.some(k=>!ALL.includes(k)))throw Error('Backup contains unsupported sections.');
  const arrayKeys=new Set([A.KEYS.apps,A.KEYS.saved,A.KEYS.messages,A.KEYS.notifications,A.KEYS.interviews]);
  for(const key of keys){const v=data.data[key];if(arrayKeys.has(key)?!Array.isArray(v):!v||typeof v!=='object'||Array.isArray(v))throw Error('Incorrect data format: '+key);}
  incoming={keys,data:data.data};
  $('#data-import-status').textContent=`Verified backup file: ${keys.length} sections found. Restore will replace matching browser records.`;
  $('#data-import').disabled=false;
 }catch(err){$('#data-import-status').textContent='Unable to read backup: '+err.message;}
});
$('#data-import').addEventListener('click',()=>{
 if(!incoming)return;
 if(!confirm('Restore '+incoming.keys.length+' sections from this file? Existing matching data in this browser will be replaced.'))return;
 const prior={};for(const k of incoming.keys)prior[k]=localStorage.getItem(k);
 try{for(const k of incoming.keys)localStorage.setItem(k,JSON.stringify(incoming.data[k]));}
 catch(err){for(const k of incoming.keys){try{if(prior[k]===null)localStorage.removeItem(k);else localStorage.setItem(k,prior[k]);}catch{}}A.toast('Restore failed. Available previous data was retained where possible.');return;}
 incoming=null;$('#data-import-file').value='';$('#data-import').disabled=true;$('#data-import-status').textContent='Backup restored. Refresh other open AttachLink tabs to see the restored data.';
 A.refreshNav();present();A.toast('Backup restored successfully.');
});
$('#data-clear').addEventListener('click',()=>{
 const selected=[...document.querySelectorAll('.data-clear-box:checked')].map(x=>GROUPS[Number(x.value)]).filter(Boolean);
 if(!selected.length){A.toast('Choose at least one section to clear.');return;}
 const keys=[...new Set(selected.flatMap(x=>x.keys))];
 if(!confirm('Permanently delete '+selected.length+' selected group(s) of AttachLink demo data from this browser? This cannot be undone without a backup.'))return;
 for(const k of keys){try{localStorage.removeItem(k);}catch{A.toast('Could not clear all selected data.');return;}}
 present();A.refreshNav();A.toast('Selected demo records cleared from this browser.');
});
window.addEventListener('storage',present);
try{present()}catch{document.getElementById('data-summary').textContent='Browser storage is not available.'}
})();
