(() => {
    const form=document.querySelector('#delete-account');
    const root='../../backend/api/';
    form.onsubmit=async event=>{
        event.preventDefault();
        if (!confirm('Permanently delete your AttachLink account and data?')) return;
        const status=form.querySelector('[role=status]');
        const button=event.submitter;
        button.disabled=true;
        try {
            const {csrf_token}=await fetch(root+'auth/csrf.php').then(response=>response.json());
            const response=await fetch(root+'student/delete-account.php',{
                method:'POST',headers:{'Content-Type':'application/json'},
                body:JSON.stringify({csrf_token,current_password:form.elements.current_password.value,confirm:form.elements.confirm.checked})
            });
            const result=await response.json();
            if (!response.ok) throw Error(result.message);
            location.replace('login.html');
        } catch (error) { status.textContent=error.message; }
        finally { button.disabled=false; }
    };
})();
