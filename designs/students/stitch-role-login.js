/* Stage 10C: uses the EXISTING Stitch Student/Company login interface; no HTML layout changes. */
(()=>{'use strict';
 if(typeof window.switchRole!=='function'||typeof window.handleSignIn!=='function'||typeof window.requestAuth!=='function')return;
 const previousRole=window.switchRole,previousSignIn=window.handleSignIn;
 const recruiterActive=()=>document.getElementById('roleRecruiter')?.classList.contains('bg-primary-container');
 window.switchRole=function(role){previousRole(role);if(role==='recruiter'){
   if(typeof window.switchAuthMethod==='function')window.switchAuthMethod('email');
   if(typeof window.showLoginMessage==='function')window.showLoginMessage('Company accounts: sign in using your registered email and password.',true);
 }};
 window.handleSignIn=async function(){
   if(!recruiterActive())return previousSignIn(); // original student login stays exactly as it was
   const email=document.getElementById('emailInput')?.value.trim()||'';
   const password=document.getElementById('passwordInput')?.value||'';
   const msg=(t,ok=false)=>window.showLoginMessage?.(t,ok);
   if(!email||!document.getElementById('emailInput').checkValidity())return msg('Enter your registered account email address.');
   if(!password)return msg('Enter your password.');
   const btn=document.getElementById('signin-submit');if(btn)btn.disabled=true;
   try{
     msg('Checking your account...',true);
     const result=await window.requestAuth('login.php',{email,password});
     if(!result.user?.role)throw Error('The server did not return an account role.');
     msg('Signed in. Opening your '+result.user.role+' portal...',true);
     location.assign('../../backend/open-portal.php');
   }catch(e){msg(e.message||'Sign-in failed.');if(btn)btn.disabled=false;}
 };
 if(new URLSearchParams(location.search).get('role')==='recruiter')window.switchRole('recruiter');
})();
