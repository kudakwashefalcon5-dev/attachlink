/*
 * AttachLink CV Builder: keep the original Stitch CV editor + live preview.
 * The ONLY new data source is the signed-in student's MySQL account, via the
 * same account.php endpoint used by the Profile page. No Profile form is loaded.
 * No HTML/CSS elements are inserted, changed or removed by this script.
 */
(()=>{
'use strict';
const A=window.AttachLink,$=s=>document.querySelector(s);
if(!A||!$('#cv-form')||!$('#cv-preview'))return;
const E=A.esc;
const ids=['name','email','phone','location','summary','education','skills','experience','projects','awards'];
const fromProfile=['name','email','phone','location','education'];
const empty=()=>Object.fromEntries(ids.map(k=>[k,'']));
let accountId=null;
let studentName='';
let loading=true;
const lines=value=>String(value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
const lineList=value=>{const ar=lines(value);return ar.length?'<ul>'+ar.map(x=>'<li>'+E(x)+'</li>').join('')+'</ul>':'<p>—</p>';};
function fromForm(){return Object.fromEntries(ids.map(k=>[k,$('#cv-'+k).value.trim()]));}
function setForm(values){for(const key of ids)$('#cv-'+key).value=String(values[key]||'');}
function render(){
 const d=fromForm(),skills=d.skills.split(',').map(s=>s.trim()).filter(Boolean);
 // Original live-preview design and fields, preserved verbatim.
 $('#cv-preview').innerHTML=`<h2>${E(d.name||'Your Name')}</h2><p class="cv-contact">${[d.email,d.phone,d.location].filter(Boolean).map(E).join(' · ')}</p><h3>Professional Profile</h3><p style="white-space:pre-wrap">${E(d.summary||'Add a short summary about your strengths and goals.')}</p><h3>Education</h3>${lineList(d.education)}<h3>Technical & Professional Skills</h3>${skills.length?`<p>${skills.map(E).join(' · ')}</p>`:'<p>—</p>'}<h3>Experience & Activities</h3>${lineList(d.experience)}<h3>Projects</h3>${lineList(d.projects)}<h3>Certifications & Achievements</h3>${lineList(d.awards)}`;
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
$('#cv-form').addEventListener('submit',async e=>{
 e.preventDefault();
 if(loading||!accountId){A.toast('Sign in to load your student profile before saving a CV.');return;}
 const values=fromForm();
 const save=e.submitter;
 if(save)save.disabled=true;
 try{await api('student/cv.php',{...values,full_name:values.name});A.toast('CV draft saved.');}
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
