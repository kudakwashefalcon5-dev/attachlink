(async () => {
    const banner=document.querySelector('#verify-email-banner');
    const button=banner.querySelector('button');
    const status=banner.querySelector('[role=status]');
    const root='../../backend/api/';
    async function api(path, options) {
        const response=await fetch(root+path,options);
        const result=await response.json();
        if (!response.ok) throw Error(result.message || 'Request failed.');
        return result;
    }
    try {
        const {user}=await api('auth/me.php');
        banner.hidden=Boolean(user.email_verified_at);
    } catch {
        return;
    }
    button.onclick=async () => {
        button.disabled=true;
        try {
            const {csrf_token}=await api('auth/csrf.php');
            const result=await api('auth/resend-verification.php',{
                method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({csrf_token})
            });
            status.textContent=result.message;
        } catch (error) { status.textContent=error.message; }
        finally { button.disabled=false; }
    };
})();
