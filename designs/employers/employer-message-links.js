/* Stage 10C: unblock the existing Stitch Messages link before Stage 8's legacy click handler. */
(()=>{'use strict';
 const studentLogin='../students/login.html';
 const msgPath='messages.html';
 document.addEventListener('click',async e=>{
   if(!(e.target instanceof Element))return;
   const anchor=e.target.closest('aside a[data-path="messages"], aside a[data-path="help-support"], a[href*="stage10-inbox.html"]');
   if(anchor){
     e.preventDefault();e.stopImmediatePropagation();
     const section=anchor.getAttribute('data-path');
     const u=new URL(msgPath,location.href);
     if(section==='help-support')u.searchParams.set('support','1');
     else{
       const old=new URL(anchor.href,location.href);
       if(old.searchParams.has('peer_id'))u.searchParams.set('peer_id',old.searchParams.get('peer_id'));
       if(old.searchParams.has('support'))u.searchParams.set('support','1');
     }
     location.assign(u.href);return;
   }
   const button=e.target.closest('button');
   if(!button)return;
   if(button.id==='employer-switch-account'){
     e.preventDefault();e.stopImmediatePropagation();
     if(!confirm('Sign out from this AttachLink account?'))return;
     try{
       const a=await fetch('../../backend/api/auth/csrf.php',{credentials:'same-origin',cache:'no-store'}).then(r=>r.json());
       if(!a.csrf_token)throw Error('Could not retrieve session token.');
       const res=await fetch('../../backend/api/auth/logout.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({csrf_token:a.csrf_token})});
       if(!res.ok)throw Error('Sign out failed (HTTP '+res.status+').');
       location.assign(studentLogin+'?logged_out=1');
     }catch(err){alert(err.message);}
     return;
   }
   // Original applicant profile has a message button blocked by a legacy Stage 8 listener.
   if(location.pathname.endsWith('/applicant-profile.html')&&/^(chat\s*)?message$/i.test(button.textContent.replace(/\s+/g,' ').trim())){
     e.preventDefault();e.stopImmediatePropagation();
     const id=new URLSearchParams(location.search).get('application_id');
     if(!id||!/^\d+$/.test(id))return alert('Open a real applicant record first.');
     try{
       const r=await fetch('../../backend/api/employer/applicant-contact.php?application_id='+encodeURIComponent(id),{credentials:'same-origin',cache:'no-store'});
       const data=await r.json();if(!r.ok||data.ok!==true)throw Error(data.message||'Applicant contact unavailable.');
       location.assign('messages.html?peer_id='+encodeURIComponent(data.contact.user_id));
     }catch(err){alert('Cannot open applicant message: '+err.message);}
   }
 },true);
 // Set real href targets too, for middle-click and accessibility; capture handles legacy event blockers.
 function setHrefs(){
   const a=document.querySelector('aside a[data-path="messages"]');if(a)a.href='messages.html';
   const h=document.querySelector('aside a[data-path="help-support"]');if(h)h.href='messages.html?support=1';
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setHrefs,{once:true});else setHrefs();
})();
