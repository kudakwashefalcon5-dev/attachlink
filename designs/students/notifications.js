(() => {
  'use strict';
  const list=document.getElementById('notification-list');
  const all=document.getElementById('mark-all');
  const clear=document.getElementById('clear-activity');
  const base='../../backend/api/';
  let hideRead=false;
  function element(tag,label,classes){
    const element=document.createElement(tag);
    element.textContent=label;
    if(classes)element.className=classes;
    return element;
  }
  async function api(path,body){
    const options={credentials:'same-origin',cache:'no-store'};
    if(body){
      const token=await api('auth/csrf.php');
      options.method='POST';
      options.headers={'Content-Type':'application/json'};
      options.body=JSON.stringify({...body,csrf_token:token.csrf_token});
    }
    const response=await fetch(base+path,options);
    const result=await response.json();
    if(!response.ok||!result.ok)throw new Error(result.message||'Could not load notifications.');
    return result;
  }
  async function draw(){
    const {notifications,unread_count}=await api('notifications.php');
    for(const badge of document.querySelectorAll('[data-al-unread]')){
      badge.textContent=String(unread_count);
      badge.hidden=unread_count===0;
    }
    const visible=notifications.filter(row=>!hideRead||!Number(row.is_read));
    list.replaceChildren();
    if(!visible.length)list.append(element('p','No notifications to display.','al-empty'));
    for(const row of visible){
      const read=Boolean(Number(row.is_read));
      const card=element('div','','rounded-xl border p-4 flex flex-wrap justify-between gap-3');
      card.style.background=read?'#fafbfe':'#eaf9f6';
      const body=element('div','');
      body.append(element('h3',row.title,'font-bold text-sm'),element('p',row.message,'text-sm mt-1'),element('p',row.created_at,'al-muted mt-2'));
      card.append(body);
      if(!read){
        const mark=element('button','Mark read','al-btn al-btn-soft');
        mark.type='button';
        mark.onclick=()=>update({id:row.id});
        card.append(mark);
      }
      list.append(card);
    }
  }
  function error(message){list.replaceChildren(element('p',message,'al-empty'));}
  async function update(data){
    try{await api('notifications.php',data);await draw();}
    catch(failure){error(failure.message);}
  }
  all.onclick=()=>update({action:'read_all'});
  clear.textContent='Hide read notifications';
  clear.onclick=()=>{
    hideRead=!hideRead;
    clear.textContent=hideRead?'Show read notifications':'Hide read notifications';
    draw().catch(failure=>error(failure.message));
  };
  list.textContent='Loading notifications...';
  draw().catch(failure=>error(failure.message));
})();
