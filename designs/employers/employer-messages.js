/* Stage 10C: employer-only MySQL messages. No sample localStorage messages. */
(()=>{'use strict';
 const base=new URL('../../backend/api/',location.href);
 const $=s=>document.querySelector(s);const host=$('#al-contact-list'),stream=$('#al-chat-messages'),form=$('#al-employer-message-form'),entry=$('#al-employer-message-text'),send=$('#al-message-send');
 if(!host||!stream||!form)return;
 let contacts=[],selected=0,csrf='',userId=0,working=false,lastSignature='',lastContactSignature='';
 const text=(tag,txt,cls='')=>{const e=document.createElement(tag);if(cls)e.className=cls;e.textContent=String(txt??'');return e;};
 const status=v=>{$('#al-message-status').textContent=v;};
 async function api(path,payload){
  const opt={credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}};
  if(payload!==undefined){
    if(!csrf){const token=await api('auth/csrf.php');csrf=token.csrf_token;if(!csrf)throw Error('Security token unavailable. Please sign in again.');}
    opt.method='POST';opt.headers['Content-Type']='application/json';opt.body=JSON.stringify({...payload,csrf_token:csrf});
  }
  let res;
  try{res=await fetch(new URL(path,base),opt);}catch(e){throw Error('Could not connect. Check your connection and try again.');}
  const data=await res.json().catch(()=>({ok:false,message:'Could not load your messages.'}));
  if(res.status===403)csrf='';
  if(!res.ok||data.ok!==true)throw Error(data.message||data.error||`HTTP ${res.status}`);
  return data;
 }
 function showContacts(){
   host.replaceChildren();
   if(!contacts.length){host.append(text('p','No authorized messaging contacts yet. A student needs an application linked to your organization, or an active administrator account.','al-message-muted'));return;}
   for(const c of contacts){const b=text('button','','al-message-contact');b.type='button';b.setAttribute('aria-current',String(c.id===selected));
     const name=text('strong',c.name+(c.unread?` · ${c.unread} new`:''));const details=text('small',c.role==='student'?'Student applicant':c.role==='admin'?'Support':'Employer');b.append(name,details);
     b.onclick=()=>openThread(c.id);host.append(b);
   }
   $('#al-unread-badge').textContent=`${contacts.reduce((n,c)=>n+(Number(c.unread)||0),0)} unread`;
 }
 async function refreshContacts(preserve=true){
   const r=await api('messages.php');
   if(r.role!=='employer')throw Error('This inbox requires an employer account. Sign in through the original AttachLink login screen.');
   contacts=r.contacts||[];
   const requested=(new URLSearchParams(location.search).get('peer_id')||new URLSearchParams(location.search).get('with'));
   const support=new URLSearchParams(location.search).get('support')==='1';
   if(!preserve||!contacts.some(x=>x.id===selected)){
     const p=requested&&/^\d+$/.test(requested)?contacts.find(c=>c.id===Number(requested)):null;
     selected=(p||(support?contacts.find(c=>c.role==='admin'):null)||(!support?contacts[0]:null))?.id||0;
   }
   showContacts();return selected;
 }
 const history=window.AttachLinkThreadHistory(api,status);
 async function openThread(id,quiet=false){
   if(!contacts.some(c=>c.id===id))return;
   selected=id;history.select(id);showContacts();
   try{
     const data=await api('messages.php?with='+encodeURIComponent(id));if(selected!==id)return;userId=data.me_id;
     $('#al-conversation-title').textContent=data.contact.name;
     $('#al-conversation-subtitle').textContent=(data.contact.role==='admin'?'Support': 'Student applicant');
     renderThread(history.update(data));
     if(data.messages.length)await api('messages.php',{action:'read',peer_id:id,through_id:data.messages[0].id});await refreshContacts();
     send.disabled=entry.disabled=!Number(data.contact.can_send);
     if(!quiet)status(Number(data.contact.can_send)?'Conversation ready.':'This conversation is read-only.');
   }catch(e){if(!quiet)status('Unable to open conversation: '+e.message);}
 }
 function renderThread(data, older=false){
     const previousHeight=stream.scrollHeight;
     const previousTop=stream.scrollTop;
     const signature=JSON.stringify([data.contact.id,data.next_before,data.messages]);
     if(signature!==lastSignature){lastSignature=signature;stream.replaceChildren();
       if(!data.messages.length)stream.append(text('p','No messages yet. Start the conversation below.','al-message-muted'));
       for(const m of [...data.messages].reverse()){const mine=Number(m.sender_id)===Number(userId);
         const bubble=text('div',m.body,'al-message-bubble'+(mine?' mine':''));bubble.append(text('small',m.created_at||''));stream.append(bubble);
       }
       history.addButton(stream,data,renderThread);
       stream.scrollTop=older?previousTop+stream.scrollHeight-previousHeight:stream.scrollHeight;
     }
 }
 form.addEventListener('submit',async e=>{
   e.preventDefault();if(working)return;
   if(!selected)return status('Select a contact first.');
   const body=entry.value.trim();if(body.length<2)return status('Enter at least 2 characters.');
   working=true;send.disabled=true;status('Sending…');
   try{await api('messages.php',{recipient_id:selected,body});entry.value='';lastSignature='';await openThread(selected);status('Message sent.');}
   catch(e){status('Message not sent: '+e.message);}finally{working=false;send.disabled=!selected||entry.disabled;}
 });
 $('#al-msg-refresh').addEventListener('click',async()=>{try{await refreshContacts();if(selected)await openThread(selected);status('Messages refreshed.');}catch(e){status('Cannot refresh: '+e.message);}});
 (async()=>{try{const id=await refreshContacts(false);if(id)await openThread(id);else{
   const support=new URLSearchParams(location.search).get('support')==='1';status(support?'No active administrator support contact is available yet.':'No eligible contacts yet. Use a student with an application to your organization.');
 }}catch(e){status('Could not load messages: '+e.message);host.replaceChildren(text('p',e.message,'al-message-muted'));}})();
 // Poll for received messages without switching conversations or replacing existing text being typed.
 let polling=false;
 setInterval(async()=>{if(document.hidden||working||polling)return;polling=true;try{const old=selected;await refreshContacts();if(selected&&selected===old)await openThread(selected,true);}catch(_){/* visible manual-refresh errors are shown when clicked */}finally{polling=false}},12000);
})();
