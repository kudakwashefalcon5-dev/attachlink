/* AttachLink Stage 10: connect the EXISTING Stitch student Messages panel to the session-bound MySQL API.
 * HTML layout/styles are untouched. Do not use browser demo messages for real delivery. */
(() => {
  'use strict';
  const apiBase = new URL('../../backend/api/', location.href);
  const $ = id => document.getElementById(id);
  let contacts = [], activeId = 0, myId = 0, csrf = null, sending = false, supportAi = false;
  const dom = {threads:$('thread-list'),heading:$('thread-heading'),list:$('message-list'),form:$('chat-form'),input:$('message-text')};
  if (!Object.values(dom).every(Boolean)) return;
  function el(tag,cls,txt){const x=document.createElement(tag);if(cls)x.className=cls;if(txt!==undefined)x.textContent=String(txt);return x;}
  function status(msg){let x=$('stage10-message-status');if(!x){x=el('p','al-muted');x.id='stage10-message-status';dom.form.append(x);}x.textContent=msg;}
  async function api(path, data){
    const opts={credentials:'same-origin',cache:'no-store',headers:{'Accept':'application/json'}};
    if(data){
      if(!csrf)csrf=(await api('auth/csrf.php')).csrf_token;
      if(!csrf)throw Error('Could not verify your login security token.');
      opts.method='POST';opts.headers['Content-Type']='application/json';opts.body=JSON.stringify({...data,csrf_token:csrf});
    }
    const res=await fetch(new URL(path,apiBase),opts);
    const j=await res.json().catch(()=>({ok:false,message:'The local server did not return JSON.'}));
    if(res.status===401){location.replace('login.html?session=expired');throw Error('Your session expired.');}
    if(!res.ok||j.ok!==true)throw Error(j.message||('HTTP '+res.status));
    return j;
  }
  function renderContacts(){
    dom.threads.replaceChildren();
    if(!contacts.length)dom.threads.append(el('p','al-muted p-4','No message contacts yet. Apply for an opening to connect with that employer, or contact Support.'));
    for(const contact of contacts){
      const b=el('button','w-full text-left p-4 hover:bg-surface-container-low border-b border-gray-100');
      b.type='button'; b.style.background=activeId===contact.id?'#e9f9f6':'';
      b.append(el('div','font-semibold text-sm',contact.name+(contact.unread?' ('+contact.unread+' new)':'')),el('p','al-muted mt-1',contact.role==='employer'?'Employer account':contact.role==='admin'?'Support':'Student applicant'));
      b.addEventListener('click',()=>openThread(contact.id));dom.threads.append(b);
    }
  }
  const history=window.AttachLinkThreadHistory(api,status);
  function renderMessages(data, older=false){
    const previousHeight=dom.list.scrollHeight;
    const previousTop=dom.list.scrollTop;
    dom.input.disabled=!Number(data.contact.can_send);
    dom.form.querySelector('button[type="submit"]').disabled=dom.input.disabled;
    const description=data.contact.role==='admin'
      ? (supportAi?'AI-assisted support · Ask for a person at any time':'Support')
      : 'Conversation · '+data.contact.role;
    myId=data.me_id;dom.heading.replaceChildren();dom.heading.append(el('h2','font-bold text-lg',data.contact.name),el('p','al-muted',description));
    dom.list.replaceChildren();
    if(!data.messages.length)dom.list.append(el('p','al-muted','No messages in this conversation yet.'));
    for(const m of [...data.messages].reverse()){
      const mine=Number(m.sender_id)===myId;
      const bubble=el('div','rounded-xl p-3 text-sm max-w-[86%]');
      bubble.style.alignSelf=mine?'flex-end':'flex-start'; bubble.style.background=mine?'#d6f4ef':'#f2f3ff';
      const text=el('p','',m.body);text.style.whiteSpace='pre-wrap';
      if(m.support_status==='ai_reply')bubble.append(el('p','font-semibold mb-1','AI Support Assistant'));
      bubble.append(text,el('p','al-muted mt-2',m.created_at||''));dom.list.append(bubble);
    }
    history.addButton(dom.list,data,renderMessages);
    dom.list.scrollTop=older?previousTop+dom.list.scrollHeight-previousHeight:dom.list.scrollHeight;
  }
  async function loadContacts(preserve=true){
    const result=await api('messages.php');
    supportAi=result.support_ai===true;
    contacts=result.contacts||[];
    if(!preserve||!contacts.some(c=>c.id===activeId)){
      const requested=Number(new URLSearchParams(location.search).get('peer_id'));
      activeId=contacts.find(contact=>Number(contact.id)===requested)?.id||contacts[0]?.id||0;
    }
    renderContacts();
    return activeId;
  }
  async function openThread(id){
    if(!contacts.some(c=>c.id===id))return;
    activeId=id;history.select(id);renderContacts();status('Loading conversation…');
    try{
      const thread=await api('messages.php?with='+encodeURIComponent(id));
      if(activeId!==id)return;
      renderMessages(history.update(thread));
      if(thread.messages.length)await api('messages.php',{action:'read',peer_id:id,through_id:thread.messages[0].id});

      await loadContacts();
      status(Number(thread.contact.can_send)?'':'This conversation is read-only.');
    }catch(err){status('Could not open conversation: '+err.message);}
  }
  async function init(){
    // The old inline practice handler was registered on the form at bubble phase.
    // Capture the real submit here and stop it before any demo-localStorage handler runs.
    dom.form.addEventListener('submit',async e=>{
      e.preventDefault();e.stopImmediatePropagation();
      if(sending)return;
      if(!activeId){status('Choose a contact first.');return;}
      const body=dom.input.value.trim();if(body.length<2){status('Enter at least two characters.');return;}
      sending=true;const b=dom.form.querySelector('button[type="submit"]');if(b)b.disabled=true;
      try{
        const peer=activeId;
        const contact=contacts.find(item=>item.id===peer);
        const result=await api('messages.php',{recipient_id:peer,body,allow_support_ai:supportAi&&contact?.role==='admin'});
        if(activeId===peer){
          dom.input.value='';
          await openThread(peer);
          status(result.support_result==='needs_human'?'Sent to an administrator for a reply.':result.support_result==='ai_answered'?'The AI Support Assistant replied.':'Message sent.');
        }
      }
      catch(err){status('Message not sent: '+err.message);}
      finally{sending=false;if(b)b.disabled=dom.input.disabled;}
    },true);
    const lead=document.querySelector('main .al-sub');if(lead)lead.textContent='Message employers linked to your applications or contact the AttachLink administrator.';
    const desc=dom.threads.parentElement.querySelector('.al-muted');if(desc)desc.textContent='Your authorized Conversations';
    const label=dom.form.querySelector('label');if(label)label.textContent='Your message';
    const button=dom.form.querySelector('button[type="submit"]');if(button)button.textContent='Send message';
    dom.input.placeholder='Write a message…';
    const note=document.querySelector('.al-demo-note');if(note)note.textContent='Messages are delivered in AttachLink.';
    const footer=document.querySelector('footer');if(footer)footer.textContent='AttachLink Zimbabwe · Student messages';
    dom.threads.replaceChildren();dom.heading.replaceChildren();dom.list.replaceChildren();status('Loading contacts…');
    try{const id=await loadContacts(false);if(id)await openThread(id);else{dom.heading.append(el('h2','font-bold text-lg','No conversation selected'));dom.list.append(el('p','al-muted','No eligible employer conversations yet.'));status('Submit an application to start a conversation with its employer.');}}
    catch(err){dom.threads.replaceChildren(el('p','al-muted p-4','Unable to load contacts.'));status('Unable to connect to messaging: '+err.message);}
  }
  let polling = false;
  setInterval(async () => {
    if (document.hidden || sending || polling) return;
    polling = true;
    try { const id = activeId; await loadContacts(); if (activeId && (activeId === id || !id)) await openThread(activeId); } catch (error) { status(error.message); } finally { polling = false; }
  }, 12000);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
