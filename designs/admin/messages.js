(() => {'use strict';
const root='../../backend/api/';const $=id=>document.getElementById(id);let active=null,me=null,contacts=[],busy=false,polling=false;
async function request(path,data){const options={credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}};if(data){const token=await request('auth/csrf.php');options.method='POST';options.headers['Content-Type']='application/json';options.body=JSON.stringify({...data,csrf_token:token.csrf_token});}const response=await fetch(root+path,options);let result;try{result=await response.json()}catch{throw Error('Backend returned a non-JSON response (HTTP '+response.status+')')}if(!response.ok||result.ok===false)throw Error(result.message||result.error||'HTTP '+response.status);return result;}
function status(message,error=false){$('status').textContent=message;$('status').className=error?'error':'muted'}
function drawContacts(){const el=$('contacts');el.replaceChildren();if(!contacts.length){el.textContent='No active student or company accounts found.';return}for(const c of contacts){const b=document.createElement('button');b.className=active===c.id?'selected':'';b.textContent=c.name||'Account '+c.id;const s=document.createElement('small');s.textContent=(c.role==='employer'?'Company':c.role==='admin'?'Support':'Student')+(c.unread?' · '+c.unread+' unread':'')+(Number(c.needs_human)?' · '+c.needs_human+' need a reply':'');b.append(s);b.onclick=()=>{active=c.id;drawContacts();loadThread()};el.append(b)}}
const supportLabels={needs_human:'Needs a human reply',ai_answered:'Answered by AI',human_answered:'Answered by an administrator',ai_reply:'AI Support Assistant'};
async function loadContacts(){const data=await request('messages.php');contacts=data.contacts||[];drawContacts()}
const history=window.AttachLinkThreadHistory(request,message=>status(message,true));
function renderThread(data, older=false) {
    const container=$('messages');
    const signature=[data.contact.id,data.next_before,...data.messages.map(message=>[message.id,message.support_status].join(':'))].join(',');
    if (container.dataset.lastId===signature) return;
    const height=container.scrollHeight;
    const top=container.scrollTop;
    const atBottom=height-top-container.clientHeight<80;
    container.replaceChildren();
    for (const message of [...data.messages].reverse()) {
        const bubble=document.createElement('div');
        bubble.className='bubble'+(Number(message.sender_id)===Number(data.me_id)?' mine':'');
        bubble.textContent=message.body;
        const time=document.createElement('small');
        const label=supportLabels[message.support_status];
        time.textContent=label?label+' · '+message.created_at:message.created_at;
        bubble.append(time);
        container.append(bubble);
    }
    if (!data.messages.length) container.textContent='No messages yet.';
    history.addButton(container,data,renderThread);
    if (older) container.scrollTop=top+container.scrollHeight-height;
    else if (atBottom || !container.dataset.lastId) container.scrollTop=container.scrollHeight;
    container.dataset.lastId=signature;
}
async function loadThread() {
    if (!active || busy) return;
    const peer=active;
    busy=true;
    history.select(peer);
    try {
        const data=await request('messages.php?with='+encodeURIComponent(peer));
        if (peer!==active) return;
        $('threadTitle').textContent=data.contact.name+' | '+(data.contact.role==='employer'?'Company':data.contact.role==='admin'?'Support':'Student');
        renderThread(history.update(data));
        $('body').disabled=false;
        $('send').disabled=false;
        if (data.messages.length) await request('messages.php',{action:'read',peer_id:peer,through_id:data.messages[0].id});
    } catch(error) { status(error.message,true); }
    finally {
        busy=false;
        if (active!==peer) loadThread();
    }
}
$('sendForm').addEventListener('submit',async e=>{e.preventDefault();const body=$('body').value.trim();if(!active||body.length<2)return; $('send').disabled=true;try{await request('messages.php',{recipient_id:active,body});$('body').value='';$('messages').dataset.lastId='';await loadThread();await loadContacts();status('Message sent.')}catch(err){status(err.message,true)}finally{$('send').disabled=false}});
(async()=>{try{const identity=await request('auth/me.php');me=identity.user;await loadContacts();status('Inbox ready.')}catch(e){status('Administrator session or database error: '+e.message,true);if(/403|sign in|unauthor/i.test(e.message))$('contacts').textContent='Sign in through the Administrator portal.'}})();
setInterval(async()=>{if(document.hidden||polling)return;polling=true;try{await loadContacts();if(active)await loadThread()}catch(e){status(e.message,true)}finally{polling=false}},5000);
})();
