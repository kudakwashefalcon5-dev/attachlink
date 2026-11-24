(() => {
  'use strict';
  const root=document.getElementById('al-interview-assistant');
  if(!root) return;
  const qs=s=>root.querySelector(s);
  const thread=qs('#al-ai-thread'), form=qs('#al-ai-form'), input=qs('#al-ai-input');
  const send=qs('#al-ai-send'), status=qs('#al-ai-status'), track=qs('#al-ai-track');
  const setup=qs('#al-ai-setup'), start=qs('#al-ai-start'), reset=qs('#al-ai-clear');
  const url='../../backend/api/student/interview-ai.php';
  let configured=false, token='', busy=false, history=[];
  const prompts=root.querySelectorAll('[data-ai-prompt]');
  const welcome='Choose an interview focus and start a practice question, or ask for interview advice.';
  const bank={
    general:['Tell me about yourself and why you chose your field of study.','Why are you interested in an industrial attachment with this company?','What strengths would you bring to an attachment team?'],
    technical:['A user says their computer has no internet access. How would you diagnose the problem step by step?','What is the difference between a switch and a router?','A Windows laptop keeps restarting unexpectedly. How would you investigate?'],
    behavioural:['Describe a time you solved a difficult problem under pressure.','How would you respond to critical feedback from your supervisor?','Tell me about a time you worked successfully in a team.'],
    software:['Explain how a frontend communicates with a PHP/MySQL backend.','How would you validate and safely process a registration form?','What steps would you follow to debug a failing API request?']
  };
  let index={general:0,technical:0,behavioural:0,software:0};
  function bubble(who, text){
    const el=document.createElement('div'); el.className='al-ai-bubble is-'+who;
    if(who==='assistant'){
      const parts=text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g);
      parts.forEach((part,index)=>{
        if(index%2===0){el.append(part);return;}
        const bold=part.startsWith('**');
        const emphasis=document.createElement(bold?'strong':'em');
        emphasis.textContent=bold?part.slice(2,-2):part.slice(1,-1);
        el.append(emphasis);
      });
    }else{
      el.textContent=text;
    }
    thread.appendChild(el);
    thread.scrollTop=thread.scrollHeight;
    return el;
  }
  function state(label,live=false){status.textContent=label;status.classList.toggle('is-live',live);}
  function setBusy(value){
    busy=value;
    send.disabled=value||!configured;
    input.disabled=value||!configured;
    start.disabled=value;
    reset.disabled=value;
    track.disabled=value;
    prompts.forEach(button=>{button.disabled=value;});
  }
  async function check(){
    state('Checking AI connection');
    setBusy(true);
    try{
      const r=await fetch(url,{credentials:'same-origin',cache:'no-store'});
      const v=await r.json();
      if(!r.ok || !v.ok) throw Error(v.message||'Student login required');
      configured=!!v.configured;token=v.csrf_token||'';
      setup.hidden=configured;
      state(configured?'AI configured':'AI not yet configured',configured);
      input.placeholder=configured?'Type an answer or ask for interview advice...':'AI chat is not configured yet. Use a sample practice question.';
    }catch(err){
      configured=false;
      setup.hidden=false;
      state('AI connection unavailable');
      bubble('system','Could not check the AI connection. You can still try a sample question.');
    }finally{setBusy(false);}
  }
  function practiceQuestion(){
    const kind=track.value in bank?track.value:'general';
    const pool=bank[kind];const q=pool[index[kind]%pool.length];index[kind]++;
    bubble('system','Sample practice question\n'+q);
  }
  async function ask(message, newInterview=false){
    if(!configured || busy || !token || !message.trim()) return;
    const previous=newInterview?[]:history;
    const pending=bubble('user',newInterview?'Let’s start a mock interview.':message);
    const typing=bubble('system','Coach is typing…');
    typing.classList.add('is-typing');
    setBusy(true);
    state('Coach is responding',true);
    try{
      const response=await fetch(url,{
        method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({message,track:track.value,history:previous,csrf_token:token})
      });
      const data=await response.json();
      if(!response.ok||!data.ok) throw Error(data.message||'Unable to get AI feedback.');
      typing.remove();
      if(newInterview) thread.replaceChildren(pending);
      history=[...previous,{role:'user',text:message},{role:'assistant',text:Array.from(data.reply).slice(0,1400).join('')}].slice(-8);
      bubble('assistant',data.reply);
      input.value='';
    }catch(err){
      typing.remove();
      pending.remove();
      bubble('system',err instanceof SyntaxError?'The AI coach could not respond. Please try again.':err.message);
    }finally{
      state('AI configured',true);
      setBusy(false);
      input.focus();
    }
  }
  form.addEventListener('submit',event=>{event.preventDefault();ask(input.value.trim());});
  start.addEventListener('click',()=>{
    if(configured) ask('Start a mock interview. Ask one question at a time.',true);
    else practiceQuestion();
  });
  reset.addEventListener('click',()=>{
    history=[];input.value='';thread.replaceChildren();bubble('system',welcome);
  });
  track.addEventListener('change',()=>{history=[];input.value='';thread.replaceChildren();bubble('system',welcome);});
  prompts.forEach(button=>button.addEventListener('click',()=>{
    const text=button.dataset.aiPrompt||'';
    if(configured) ask(text,button.hasAttribute('data-ai-mock'));
    else practiceQuestion();
  }));
  bubble('system',welcome);
  check();
})();
