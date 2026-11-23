/* AttachLink Stage 12: interview coach UI. No simulated text is presented as AI output. */
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
  const bank={
    general:['Tell me about yourself and why you chose your field of study.','Why are you interested in an industrial attachment with this company?','What strengths would you bring to an attachment team?'],
    technical:['A user says their computer has no internet access. How would you diagnose the problem step by step?','What is the difference between a switch and a router?','A Windows laptop keeps restarting unexpectedly. How would you investigate?'],
    behavioural:['Describe a time you solved a difficult problem under pressure.','How would you respond to critical feedback from your supervisor?','Tell me about a time you worked successfully in a team.'],
    software:['Explain how a frontend communicates with a PHP/MySQL backend.','How would you validate and safely process a registration form?','What steps would you follow to debug a failing API request?']
  };
  let index={general:0,technical:0,behavioural:0,software:0};
  function bubble(who, text){
    const el=document.createElement('div'); el.className='al-ai-bubble is-'+who;
    el.textContent=text; thread.appendChild(el);thread.scrollTop=thread.scrollHeight;
  }
  function state(label,live=false){status.textContent=label;status.classList.toggle('is-live',live);}
  function setBusy(value){busy=value;send.disabled=value||!configured;input.disabled=value;start.disabled=value;}
  async function check(){
    state('Checking AI connection');
    try{
      const r=await fetch(url,{credentials:'same-origin',cache:'no-store'});
      const v=await r.json();
      if(!r.ok || !v.ok) throw Error(v.message||'Student login required');
      configured=!!v.configured;token=v.csrf_token||'';
      setup.hidden=configured;
      state(configured?'AI available':'AI not yet configured',configured);
      send.disabled=!configured;
      input.placeholder=configured?'Type an answer or ask for interview advice...':'AI chat is not configured yet. Use a sample practice question.';
      input.disabled=!configured;
    }catch(err){configured=false;send.disabled=true;input.disabled=true;setup.hidden=false;state('AI connection unavailable');bubble('system',err.message||'Could not connect. Please sign in again.');}
  }
  function practiceQuestion(){
    const kind=track.value in bank?track.value:'general';
    const pool=bank[kind];const q=pool[index[kind]%pool.length];index[kind]++;
    bubble('assistant','Practice question (offline example):\n'+q);
    if(!configured) bubble('system','You can think through your answer now. AI-generated feedback becomes available only after the server-side AI service is configured.');
    return q;
  }
  async function ask(message){
    if(!configured || busy || !token || !message.trim()) return;
    const previous=history.slice(-8);
    bubble('user',message);
    setBusy(true);
    try{
      const response=await fetch(url,{
        method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({message,track:track.value,history:previous,csrf_token:token})
      });
      const data=await response.json();
      if(!response.ok||!data.ok) throw Error(data.message||'Unable to get AI feedback.');
      history.push({role:'user',text:message.slice(0,700)},{role:'assistant',text:data.reply.slice(0,700)});
      if(history.length>8) history=history.slice(-8);
      bubble('assistant',data.reply);
    }catch(err){bubble('system',err.message||'An error occurred.');}
    finally{setBusy(false);input.value='';input.focus();}
  }
  form.addEventListener('submit',event=>{event.preventDefault();ask(input.value.trim());});
  start.addEventListener('click',()=>{
    const q=practiceQuestion();
    if(configured){ // Real interview questions and feedback are provided via the API.
      ask('Please start a mock interview for this field. Ask me one question at a time, starting with a question like: '+q);
    }
  });
  reset.addEventListener('click',()=>{
    history=[];thread.replaceChildren();bubble('assistant','Welcome to the Interview Assistant. Choose a topic and start with a practice question. Your conversation is not saved when you leave this page.');
  });
  root.querySelectorAll('[data-ai-prompt]').forEach(button=>button.addEventListener('click',()=>{
    const text=button.dataset.aiPrompt||'';
    if(configured) ask(text);
    else practiceQuestion();
  }));
  bubble('assistant','Welcome to the Interview Assistant. Practise common, technical and behavioural interview questions. AI coaching becomes available when your administrator enables the API connection.');
  check();
})();
