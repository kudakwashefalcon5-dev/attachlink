(()=>{
'use strict';
const A=window.AttachLink,$=s=>document.querySelector(s);
if(!A||!$('#cv-form')||!$('#cv-preview'))return;
const E=A.esc;
const ids=['name','email','phone','location','summary','education','skills','experience','projects','awards'];
const fromProfile=['name','email','phone','location','education'];
const layoutOptions=[...document.querySelectorAll('input[name="cv-layout"]')];
const selectedLayout=()=>layoutOptions.find(option=>option.checked)?.value||'classic';
const empty=()=>Object.fromEntries(ids.map(k=>[k,'']));
let accountId=null;
let studentName='';
let loading=true;
const lines=value=>String(value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
const lineList=value=>{const ar=lines(value);return ar.length?'<ul>'+ar.map(x=>'<li>'+E(x)+'</li>').join('')+'</ul>':'';};
function fromForm(){return Object.fromEntries(ids.map(k=>[k,$('#cv-'+k).value.trim()]));}
function setForm(values){
 for(const key of ids)$('#cv-'+key).value=String(values[key]||'');
 const option=layoutOptions.find(item=>item.value===values.layout)||layoutOptions[0];
 if(option)option.checked=true;
}
function render(){
 const d=fromForm(),skills=d.skills.split(',').map(s=>s.trim()).filter(Boolean);
 const preview=$('#cv-preview');
 const contact=[d.email,d.phone,d.location].filter(Boolean).map(E).join(' · ');
 const section=(heading,content)=>content?`<section class="cv-section"><h3>${heading}</h3>${content}</section>`:'';
 const education=section('Education',lineList(d.education));
 const skillSection=section('Skills',skills.length?`<p>${skills.map(E).join(' · ')}</p>`:'');
 preview.dataset.layout=selectedLayout();
 preview.innerHTML=`<header class="cv-document-header"><h2>${E(d.name||'Your Name')}</h2>${contact?`<p class="cv-contact">${contact}</p>`:''}</header>
 ${section('Professional Profile',d.summary?`<p class="cv-summary">${E(d.summary)}</p>`:'')}
 <div class="cv-qualifications">${education}${skillSection}</div>
 ${section('Experience & Activities',lineList(d.experience))}
 ${section('Projects',lineList(d.projects))}
 ${section('Certifications & Achievements',lineList(d.awards))}`;
}
function accountDetails(account){
 const t=x=>typeof x==='string'?x.trim():'';
 return {
  name:[t(account.first_name),t(account.last_name)].filter(Boolean).join(' '),
  email:t(account.email),
  phone:t(account.phone),
  location:t(account.city),
  education:[t(account.study_level),t(account.programme),t(account.institution)].filter(Boolean).join(' • ')
 };
}
async function api(path,data){
 const options={credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}};
 if(data){
  const token=(await api('auth/csrf.php')).csrf_token;
  options.method='POST'; options.headers['Content-Type']='application/json';
  options.body=JSON.stringify({...data,csrf_token:token});
 }
 const response=await fetch('../../backend/api/'+path,options);
 const result=await response.json();
 if(response.status===401)location.replace('login.html?session=expired');
 if(!response.ok||!result.ok)throw Error(result.message||'Request failed.');
 return result;
}
async function getProfile(){return (await api('student/account.php')).account;}
function setHeaderName(name){
 studentName=name||'Student';
 document.querySelectorAll('[data-al-name]').forEach(el=>el.textContent=studentName);
}
async function initialise(){
 try{
  const account=await getProfile();
  if(!account)return;
  accountId=account.id;
  const {cv}=await api('student/cv.php');
  const values=cv?{...cv,name:cv.full_name}:{...empty(),...accountDetails(account)};
  setForm(values);
  setHeaderName(values.name);
 }catch(error){
  console.error('AttachLink CV: MySQL profile could not be loaded',error);
  A.toast('Could not load your profile. Sign in again and retry.');
 }finally{loading=false;render();}
}
$('#cv-form').addEventListener('input',render);
for(const option of layoutOptions)option.addEventListener('change',render);
$('#cv-form').addEventListener('submit',async e=>{
 e.preventDefault();
 if(loading||!accountId){A.toast('Sign in to load your student profile before saving a CV.');return;}
 const values=fromForm();
 const save=e.submitter;
 if(save)save.disabled=true;
 try{await api('student/cv.php',{...values,full_name:values.name,layout:selectedLayout()});A.toast('CV draft saved.');}
 catch(error){A.toast(error.message);}
 finally{if(save)save.disabled=false;}
});
$('#cv-refresh').addEventListener('click',async()=>{
 if(loading)return;
 if(!confirm('Refresh the name, email, phone, location and education from My Profile? Your CV summary, skills, experience and projects will stay the same.'))return;
 try{
  const account=await getProfile();
  if(!account)return;
  if(accountId!==account.id){
   // Another account signed in: reload its own draft, never combine two users' CVs.
   location.reload();return;
  }
  const details=accountDetails(account);
  for(const k of fromProfile)$('#cv-'+k).value=details[k];
  setHeaderName(details.name);
  render();A.toast('Profile details loaded. Save your CV draft when ready.');
 }catch(error){console.error('AttachLink CV: refresh failed',error);A.toast('Unable to refresh My Profile. Check your login and XAMPP.');}
});
$('#cv-print').addEventListener('click',()=>window.print());
// Keep the original CV editor visible, but never show a previous student's sample data.
setForm(empty());
render();
// attachlink-common.js may refresh the demo header on DOMContentLoaded.
document.addEventListener('DOMContentLoaded',()=>{if(studentName)setHeaderName(studentName);});
initialise();
})();
