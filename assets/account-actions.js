(async () => {
    const form = document.querySelector('#account-form');
    const heading = document.querySelector('#account-heading');
    const status = document.querySelector('#account-status');
    const button = form.querySelector('button');
    const params = new URLSearchParams(location.search);
    const requested = params.get('action');
    const action = ['reset','verify','settings'].includes(requested) ? requested : 'forgot';
    const accountLink = new URLSearchParams(location.hash.slice(1)).get('token');
    async function api(path, data) {
        const options = {credentials:'same-origin',cache:'no-store'};
        if (data) {
            const {csrf_token} = await api('auth/csrf');
            Object.assign(options,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,csrf_token})});
        }
        const response = await fetch('backend/api/'+path+'.php',options);
        const result = await response.json().catch(()=>{throw Error('Could not reach AttachLink. Please try again.');});
        if (!response.ok) throw Error(result.message);
        return result;
    }
    const display = (label, text) => {
        heading.textContent = label;
        button.textContent = text;
        form.querySelector('#email-label').hidden = action !== 'forgot';
        form.elements.email.disabled = action !== 'forgot';
        form.querySelector('#password-label').hidden = action !== 'reset';
        form.elements.new_password.disabled = action !== 'reset';
        form.hidden = false;
    };
    if (action === 'verify') display('Verify your email address','Verify email');
    else if (action === 'reset') display('Choose a new password','Reset password');
    else if (action === 'settings') {
        display('Email settings','Resend verification email');
        button.hidden = true;
        try {
            const {user} = await api('auth/me');
            status.textContent = user.email_verified_at ? 'Your email address is verified.' : 'Verify your email address to apply for or publish openings.';
            button.hidden = Boolean(user.email_verified_at);
            if (['student','employer'].includes(user.role)) {
                const {email_notifications} = await api('email-preferences');
                const label = document.createElement('label');
                const preference = document.createElement('input');
                const feedback = document.createElement('p');
                feedback.setAttribute('role','status');
                preference.type = 'checkbox';
                preference.checked = email_notifications;
                label.append(preference,' Receive email notifications');
                form.after(label,feedback);
                preference.onchange = async () => {
                    preference.disabled = true;
                    try {
                        await api('email-preferences',{email_notifications:preference.checked});
                        feedback.textContent = 'Email preference saved.';
                    } catch (error) {
                        preference.checked = !preference.checked;
                        feedback.textContent = error.message;
                    } finally { preference.disabled = false; }
                };
            }
        } catch (error) { status.textContent = 'Sign in to manage your email settings.'; }
    } else display('Reset your password','Email me a reset link');
    form.onsubmit = async event => {
        event.preventDefault();
        button.disabled = true;
        try {
            const path = {reset:'reset-password',verify:'verify-email',settings:'resend-verification'}[action] || 'forgot-password';
            const result = await api('auth/'+path,{...Object.fromEntries(new FormData(form)),token:accountLink});
            status.textContent = result.message;
            if (action === 'reset' || action === 'verify') {
                form.hidden = true;
                history.replaceState(null, '', location.pathname+'?'+params);
            }
        } catch (error) { status.textContent = error.message; }
        finally { button.disabled = false; }
    };
})();
