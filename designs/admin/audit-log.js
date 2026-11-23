(() => {
    const form = document.querySelector('#audit-filter');
    const list = document.querySelector('#audit-events');
    const status = document.querySelector('#audit-status');
    const more = document.querySelector('#audit-more');
    let cursor = null;
    let busy = false;
    async function load(reset) {
        if (busy) return;
        busy = true;
        more.disabled = true;
        try {
            const params = new URLSearchParams(new FormData(form));
            if (!reset && cursor) params.set('before',cursor);
            const response = await fetch('../../backend/api/admin/audit-log.php?'+params);
            const result = await response.json();
            if (!response.ok) throw Error(result.message);
            if (reset) list.replaceChildren();
            for (const event of result.events) {
                const item = document.createElement('li');
                item.textContent = event.created_at+' | '+event.action+' | Actor '+event.admin_id+' | '+event.target_type+' '+(event.target_id??'')+' | '+event.detail;
                list.append(item);
            }
            cursor = result.next_before;
            more.hidden = !cursor;
            status.textContent = list.children.length ? '' : 'No matching audit events.';
        } catch (error) { status.textContent = error.message; }
        finally { more.disabled = false; busy = false; }
    }
    form.onsubmit = event => { event.preventDefault(); load(true); };
    more.onclick = () => load(false);
    function bindAction(id, destination, payload, confirmation) {
        const actionForm=document.querySelector(id);
        actionForm.onsubmit=async event=>{
            event.preventDefault();
            const button=event.submitter;
            if (confirmation && !confirm(confirmation(button))) return;
            const feedback=actionForm.querySelector('[role=status]');
            button.disabled=true;
            try {
                const {csrf_token}=await fetch('../../backend/api/auth/csrf.php').then(response=>response.json());
                const response=await fetch('../../backend/api/admin/'+destination(button)+'.php',{
                    method:'POST',headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({csrf_token,...Object.fromEntries(new FormData(actionForm)),...payload})
                });
                const result=await response.json();
                if (!response.ok) throw Error(result.message);
                actionForm.reset();
                feedback.textContent=result.message+(result.user_id?' Account ID '+result.user_id+'.':'');
                load(true);
            } catch (error) { feedback.textContent=error.message; }
            finally { button.disabled=false; }
        };
    }
    bindAction('#verify-user-email',button=>button.value,{},button=>button.textContent+' for this account?');
    bindAction('#admin-create',()=> 'admin-accounts',{action:'create'});
    bindAction('#admin-deactivate',()=> 'admin-accounts',{action:'deactivate'},()=> 'Deactivate this administrator?');
    async function retention() {
        try {
            const response=await fetch('../../backend/api/admin/retention.php');
            const result=await response.json();
            if (!response.ok) throw Error(result.message);
            const report=document.querySelector('#retention-report');
            const labels={
                pending_file_removals:'Pending file removals',
                saved_vault_documents:'Saved vault documents',
                expired_resets_over_30_days:'Reset tokens expired over 30 days ago',
                mail_over_90_days:'Completed mail records older than 90 days',
                audit_over_365_days:'Audit events older than 365 days',
                students_without_recorded_consent:'Students without recorded consent'
            };
            for (const [key,label] of Object.entries(labels)) {
                const name=document.createElement('dt');
                const value=document.createElement('dd');
                name.textContent=label;
                value.textContent=result.status[key];
                report.append(name,value);
            }
        } catch (error) { document.querySelector('#retention-status').textContent=error.message; }
    }
    retention();
    load(true);
})();
