(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const root='../../backend/api/';
  const visibility=$('visibility-toggle');
  const sms=$('sms-toggle');
  const modal=$('al-modal');
  const fields=$('al-form-fields');
  const edit=$('edit-preferences-btn');
  const notice=document.createElement('p');
  notice.setAttribute('role','status');
  edit.after(notice);
  const names={sectors:'Preferred sectors',stipend:'Minimum monthly stipend (USD)',work_model:'Preferred work model',relocation:'Relocation destinations'};
  let saved;
  async function request(path,data){
    const options={credentials:'same-origin',cache:'no-store'};
    if(data){
      const {csrf_token}=await request('auth/csrf.php');
      Object.assign(options,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,csrf_token})});
    }
    const response=await fetch(root+path,options);
    const result=await response.json();
    if(!response.ok||!result.ok)throw new Error(result.message||'Preferences unavailable.');
    return result;
  }
  function display(){
    visibility.checked=saved.recruiter_visible;
    $('al-sectors').textContent=saved.sectors||'Not specified';
    $('al-stipend').textContent=saved.stipend==null?'Not specified':'$'+saved.stipend+' USD';
    $('al-work-model').textContent=saved.work_model||'Not specified';
    $('al-relocation').textContent=saved.relocation||'Not specified';
  }
  function describe(input,text){
    const row=input.closest('.flex.items-start.justify-between');
    const line=row?.querySelector('p');
    if(line)line.textContent=text;
    input.setAttribute('aria-label',text);
  }
  visibility.disabled=true; sms.disabled=true; sms.checked=false; edit.disabled=true;
  describe(visibility,'Share your email and location with employers reviewing your applications.');
  describe(sms,'SMS alerts are unavailable until a provider is configured.');
  function close(){modal.classList.remove('open');edit.focus();}
  async function save(values){
    visibility.disabled=true;edit.disabled=true;
    try{saved=(await request('student/preferences.php',values)).preferences;notice.textContent='Preferences saved.';return true;}
    catch(error){notice.textContent=error.message;return false;}
    finally{display();visibility.disabled=false;edit.disabled=false;}
  }
  visibility.onchange=()=>save({...saved,stipend:String(saved.stipend??''),recruiter_visible:visibility.checked});
  edit.onclick=()=>{
    $('al-modal-title').textContent='Edit Placement Preferences';
    fields.replaceChildren();
    for(const [key,label] of Object.entries(names)){
      const wrap=document.createElement('label');
      wrap.className='al-field';wrap.textContent=label;
      const input=document.createElement('input');
      input.name=key;input.value=saved[key]??'';
      input.maxLength=key==='work_model'?80:255;
      if(key==='stipend'){input.type='number';input.min='0';input.step='0.01';}
      wrap.append(input);fields.append(wrap);
    }
    modal.classList.add('open');fields.querySelector('input').focus();
  };
  $('al-cancel').onclick=close;
  modal.onclick=event=>{if(event.target===modal)close();};
  modal.onkeydown=event=>{if(event.key==='Escape')close();};
  $('al-form').onsubmit=async event=>{
    event.preventDefault();
    const submit=event.submitter;submit.disabled=true;
    try{if(await save({...Object.fromEntries(new FormData(event.target)),recruiter_visible:saved.recruiter_visible}))close();}
    finally{submit.disabled=false;}
  };
  request('student/preferences.php').then(result=>{saved=result.preferences;display();visibility.disabled=false;edit.disabled=false;}).catch(error=>{notice.textContent=error.message;});
})();

/* AttachLink Stage 16 — Replaces ONLY the outdated academic timeline panel.
   Application data comes from the authenticated student's MySQL API.
   The original profile layout and other scripts remain untouched. */
(() => {
  'use strict';
  const API = '../../backend/api/student/applications.php';
  const PAGE_SIZE = 50;
  const MAX_PAGES = 20;

  function el(tag, cls, value) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (value !== undefined) node.textContent = String(value);
    return node;
  }
  function link(text, href, cls) {
    const a = el('a', cls || '', text);
    a.href = href;
    return a;
  }
  function statusKey(raw) { return String(raw || 'submitted').trim().toLowerCase(); }
  function statusLabel(raw) {
    const labels = {
      submitted: 'Submitted', reviewing: 'Under review', shortlisted: 'Shortlisted',
      interview: 'Interview', accepted: 'Accepted', offered: 'Offer received',
      rejected: 'Rejected', withdrawn: 'Withdrawn'
    };
    const key = statusKey(raw);
    return labels[key] || key.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  function tone(raw) {
    const s = statusKey(raw);
    if (s === 'accepted' || s === 'offered') return 'positive';
    if (s === 'rejected' || s === 'withdrawn') return 'muted';
    if (s === 'shortlisted' || s === 'interview') return 'highlight';
    return 'pending';
  }
  function dateLabel(raw) {
    if (!raw) return 'Date not recorded';
    const d = new Date(String(raw).replace(' ', 'T'));
    return Number.isNaN(d.getTime()) ? 'Date not recorded' : d.toLocaleDateString('en-ZW', {day:'numeric', month:'short', year:'numeric'});
  }

  function createPanel(oldSection) {
    const section = el('section', 'al-attachment-activity bg-surface-container-lowest rounded-xl p-space-xl shadow-sm');
    section.id = 'attachment-activity-overview';
    section.setAttribute('aria-labelledby', 'al-activity-title');
    const header = el('div', 'al-activity-header');
    const headText = el('div');
    const h2 = el('h2', 'al-activity-title', 'My Attachment Activity');
    h2.id = 'al-activity-title';
    headText.append(h2, el('p','al-activity-subtitle', 'Your application progress, directly from your AttachLink account.'));
    const badge = document.createDocumentFragment();
    header.append(headText,badge);

    const status = el('p', 'al-activity-status', 'Loading your applications…');
    status.setAttribute('role','status');
    status.setAttribute('aria-live','polite');
    const metrics = el('div', 'al-activity-metrics');
    const recent = el('div', 'al-activity-recent');
    const actions = el('div', 'al-activity-actions');
    actions.append(
      link('View My Applications', 'my-applications.html', 'al-activity-primary'),
      link('Find Openings', 'dashboard.html', 'al-activity-secondary')
    );
    const refresh = el('button', 'al-activity-refresh', 'Refresh');
    refresh.type='button';
    refresh.setAttribute('aria-label','Refresh application overview');
    actions.append(refresh);
    section.append(header,status,metrics,recent,actions);
    oldSection.replaceWith(section);
    return {section,status,metrics,recent,refresh};
  }

  function metric(label,value,detail) {
    const card = el('div', 'al-activity-metric');
    card.append(el('span','al-activity-metric-label', label),
                el('strong','al-activity-metric-number',value),
                el('span','al-activity-metric-note',detail));
    return card;
  }

  function render(ui, records, incomplete) {
    const counts = {
      total: records.length,
      reviewing: records.filter(a => ['submitted','reviewing'].includes(statusKey(a.status))).length,
      interviewing: records.filter(a => ['shortlisted','interview'].includes(statusKey(a.status))).length,
      accepted: records.filter(a => ['accepted','offered'].includes(statusKey(a.status))).length
    };
    ui.metrics.replaceChildren(
      metric('Applications sent', incomplete ? `${counts.total}+` : counts.total, 'Submitted through AttachLink'),
      metric('Awaiting decision', counts.reviewing, 'Submitted or under review'),
      metric('Next-stage reviews', counts.interviewing, 'Shortlisted or interview'),
      metric('Accepted / offers', counts.accepted, 'Employer decisions')
    );
    ui.recent.replaceChildren();
    const h3=el('h3','al-activity-recent-title','Recent applications');
    ui.recent.append(h3);
    if (!records.length) {
      const empty=el('div','al-activity-empty');
      empty.append(el('strong','','No applications yet'), el('p','','Explore test vacancies and submit an application to track its progress here.'));
      ui.recent.append(empty);
    } else {
      const list=el('div','al-activity-list');
      const sorted=[...records].sort((a,b)=>String(b.submitted_at||'').localeCompare(String(a.submitted_at||'')) || Number(b.application_id||0)-Number(a.application_id||0));
      for (const a of sorted.slice(0,3)) {
        const row=el('div','al-activity-row');
        const info=el('div','al-activity-row-info');
        info.append(el('strong','al-activity-row-title',a.listing_title || 'Attachment opportunity'),
          el('span','al-activity-row-detail',`${a.organization || 'Organization'} · ${dateLabel(a.submitted_at)}`));
        row.append(info,el('span',`al-activity-pill al-activity-pill--${tone(a.status)}`, statusLabel(a.status)));
        list.append(row);
      }
      ui.recent.append(list);
      const note=counts.accepted ? 'You have an accepted application or offer. Review its details and follow up with the employer.' :
        (counts.interviewing ? 'You have an application at the shortlist or interview stage. Check Messages for updates.' :
        'Check My Applications and Messages for employer updates.');
      ui.recent.append(el('p','al-activity-next', note));
    }
    ui.status.textContent = incomplete ? 'Showing the most recent 1,000 applications; older records are not counted.' : 'Updated from your current student account. Test-system records.';
    ui.status.classList.remove('al-activity-status--error');
  }

  async function fetchApplications() {
    const records=[];
    let incomplete=false;
    for(let page=1; page<=MAX_PAGES; page++) {
      const url=`${API}?page=${page}&limit=${PAGE_SIZE}`;
      const response=await fetch(url,{method:'GET',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
      if(!response.ok) {
        if(response.status===401 || response.status===403) throw new Error('Please sign in with your student account.');
        throw new Error(`Could not reach the applications service (HTTP ${response.status}).`);
      }
      const contentType=response.headers.get('content-type')||'';
      if(!contentType.includes('json')) throw new Error('Please check your login session; the server did not return account data.');
      const payload=await response.json();
      if(!payload || payload.ok!==true || !Array.isArray(payload.applications)) throw new Error('The applications service returned an unexpected response.');
      records.push(...payload.applications);
      if(!payload.has_more) return {records,incomplete:false};
      if(page===MAX_PAGES) incomplete=true;
    }
    return {records,incomplete};
  }

  function start() {
    const heading=Array.from(document.querySelectorAll('h2'))
      .find(node => /academic\s*(?:&|and)\s*attachment\s*timeline/i.test((node.textContent||'').trim()));
    const oldSection=heading?.closest('section');
    if(!oldSection || document.getElementById('attachment-activity-overview')) return;
    const ui=createPanel(oldSection);
    let busy=false;
    async function update() {
      if(busy)return;
      busy=true;ui.refresh.disabled=true;
      ui.status.textContent='Loading your applications…';
      try{const {records,incomplete}=await fetchApplications();render(ui,records,incomplete);}
      catch(error){
        ui.metrics.replaceChildren();ui.recent.replaceChildren();
        ui.status.classList.add('al-activity-status--error');
        ui.status.textContent=`Unable to load your application activity. ${error.message || 'Please try again.'}`;
      }
      finally{busy=false;ui.refresh.disabled=false;}
    }
    ui.refresh.addEventListener('click',update);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});
    update();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();

/*
 * AttachLink Stage 17 — student-controlled skills (any course or department).
 * Additive integration. It changes ONLY the existing skills section.
 * Never imports the original Computer Science demo skills or other students' localStorage.
 * A skill is self-declared, NOT institutionally verified.
 */
(() => {
  'use strict';

  function start() {
    const addButton = document.querySelector('#add-skill-btn');
    const section = addButton && addButton.closest('section');
    if (!addButton || !section || section.dataset.alSkillsManaged === 'true') return;
    section.dataset.alSkillsManaged = 'true';

    const title = section.querySelector('h2');
    if (title) title.textContent = 'Skills & Competencies';
    addButton.innerHTML = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg><span>Add Skill</span>';
    addButton.setAttribute('aria-label', 'Add skill');

    // Replace ONLY the original static skills category grid. No other Profile content is touched.
    const staticGrid = Array.from(section.children).find(el =>
      el.classList && el.classList.contains('flex-col') && el.classList.contains('gap-space-md'));
    const list = document.createElement('div');
    list.id = 'al-skills-live';
    list.className = 'flex flex-col gap-space-md';
    list.setAttribute('aria-live', 'polite');
    if (staticGrid) staticGrid.replaceWith(list);
    else section.append(list);
    // Stage 5's old browser-only custom skills are hidden by CSS (not erased).
    // Never migrate these because they might be demo or belong to a different user.

    const note = document.createElement('p');
    note.className = 'al-skills-note';
    note.textContent = 'Add the skills that match your own course, training or experience. These are student-listed skills, not officially verified.';
    list.before(note);

    const status = document.createElement('p');
    status.className = 'al-skills-status';
    status.id = 'al-skills-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    list.after(status);

    const dialog = document.createElement('dialog');
    dialog.id = 'al-skill-dialog';
    dialog.innerHTML = `
      <form id="al-skill-form" novalidate>
        <div class="al-skill-dialog-head">
          <h3 id="al-skill-dialog-title">Add a skill</h3>
          <button type="button" class="al-skills-quiet" id="al-skill-close" aria-label="Close">×</button>
        </div>
        <p class="al-skill-help">Include anything relevant to your programme, trade or experience. You choose the category.</p>
        <label class="al-skill-field" for="al-skill-category">Category
          <input id="al-skill-category" maxlength="80" required placeholder="e.g. Healthcare, Electrical, Agriculture, Communication" autocomplete="off" />
        </label>
        <label class="al-skill-field" for="al-skill-name">Skill or competency
          <input id="al-skill-name" maxlength="100" required placeholder="e.g. Patient care, Welding, Data entry, Teamwork" autocomplete="off" />
        </label>
        <p class="al-skill-form-error" id="al-skill-form-error" role="alert"></p>
        <div class="al-skill-dialog-actions">
          <button type="button" id="al-skill-cancel" class="al-skill-cancel">Cancel</button>
          <button type="submit" id="al-skill-submit" class="al-skill-save">Save skill</button>
        </div>
      </form>`;
    document.body.append(dialog);
    const form = dialog.querySelector('form');
    const categoryInput = dialog.querySelector('#al-skill-category');
    const nameInput = dialog.querySelector('#al-skill-name');
    const errorBox = dialog.querySelector('#al-skill-form-error');
    const saveBtn = dialog.querySelector('#al-skill-submit');
    let editId = null;
    let skills = [];
    let busy = false;
    const endpoint = new URL('../../backend/api/student/skills.php', location.href).href;
    const csrfEndpoint = new URL('../../backend/api/auth/csrf.php', location.href).href;

    function say(message, isError = false) {
      status.textContent = message;
      status.classList.toggle('al-skill-error', isError);
    }
    function el(tag, className, value) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (value !== undefined) node.textContent = value;
      return node;
    }
    function closeDialog() {
      if (dialog.open) dialog.close();
    }
    function openEditor(skill = null) {
      editId = skill ? Number(skill.id) : null;
      dialog.querySelector('#al-skill-dialog-title').textContent = editId ? 'Edit your skill' : 'Add a skill';
      categoryInput.value = skill ? skill.category : '';
      nameInput.value = skill ? skill.name : '';
      errorBox.textContent = '';
      saveBtn.textContent = editId ? 'Save changes' : 'Save skill';
      if (!dialog.open) dialog.showModal();
      categoryInput.focus();
    }

    // Capture before Stage 5's old Add Verified Skill click handler opens its browser-only prompt.
    document.addEventListener('click', event => {
      if (!event.target.closest || !event.target.closest('#add-skill-btn')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openEditor();
    }, true);
    dialog.querySelector('#al-skill-close').addEventListener('click', closeDialog);
    dialog.querySelector('#al-skill-cancel').addEventListener('click', closeDialog);
    dialog.addEventListener('click', event => { if (event.target === dialog) closeDialog(); });

    async function getJSON(url, init) {
      const response = await fetch(url, {
        credentials: 'same-origin', cache: 'no-store',
        headers: { Accept: 'application/json', ...(init?.headers || {}) }, ...(init || {})
      });
      let payload;
      try { payload = await response.json(); }
      catch { throw new Error('The server did not return JSON. Check PHP and the request URL.'); }
      if (response.status === 401) throw new Error('Your login session has expired. Please sign in again.');
      if (!response.ok || !payload || payload.ok !== true) {
        throw new Error(payload?.message || `Request failed (HTTP ${response.status}).`);
      }
      return payload;
    }
    async function write(data) {
      const token = await getJSON(csrfEndpoint);
      return getJSON(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, csrf_token: token.csrf_token })
      });
    }

    function draw() {
      list.replaceChildren();
      if (!skills.length) {
        const empty = el('div', 'al-skills-empty');
        empty.append(el('strong', '', 'You have not added any skills yet.'));
        empty.append(el('p', '', 'Use “Add Skill” to describe your own abilities. The system does not assign Computer Science skills or make verification claims.'));
        list.append(empty);
        return;
      }
      const groups = new Map();
      skills.forEach(skill => {
        if (!groups.has(skill.category)) groups.set(skill.category, []);
        groups.get(skill.category).push(skill);
      });
      for (const [category, group] of groups) {
        const card = el('div', 'bg-surface-container-low p-space-md rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-space-md al-skill-group');
        const heading = el('div', 'flex flex-col gap-0.5 md:w-1/3');
        heading.append(el('span', 'font-title-md text-title-md text-on-surface', category));
        heading.append(el('span', 'font-body-sm text-body-sm text-outline', `${group.length} student-listed skill${group.length === 1 ? '' : 's'}`));
        card.append(heading);
        const chips = el('div', 'flex flex-wrap items-center gap-2 flex-1 al-skill-chips');
        group.forEach(skill => {
          const chip = el('div', 'al-skill-chip');
          chip.append(el('span', 'al-skill-dot'));
          chip.append(el('span', 'al-skill-label', skill.name));
          const editButton = el('button', 'al-skill-icon-btn', 'Edit');
          editButton.type = 'button';
          editButton.setAttribute('aria-label', `Edit ${skill.name}`);
          editButton.addEventListener('click', () => openEditor(skill));
          chip.append(editButton);
          const removeButton = el('button', 'al-skill-remove-btn', '×');
          removeButton.type = 'button';
          removeButton.title = 'Remove skill';
          removeButton.setAttribute('aria-label', `Remove ${skill.name}`);
          removeButton.addEventListener('click', async () => {
            if (!confirm(`Remove “${skill.name}” from your profile?`)) return;
            if (busy) return;
            busy = true; removeButton.disabled = true;
            try {
              const response = await write({ action: 'delete', id: skill.id });
              skills = response.skills;
              draw();
              say('Skill removed.');
            } catch (err) {
              say(err.message, true);
              removeButton.disabled = false;
            } finally { busy = false; }
          });
          chip.append(removeButton);
          chips.append(chip);
        });
        card.append(chips);
        list.append(card);
      }
    }
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy) return;
      const category = categoryInput.value.trim().replace(/\s+/g, ' ');
      const name = nameInput.value.trim().replace(/\s+/g, ' ');
      if (!category || !name) { errorBox.textContent = 'Enter a category and a skill.'; return; }
      busy = true;
      saveBtn.disabled = true;
      errorBox.textContent = '';
      try {
        const response = await write({ action: editId ? 'update' : 'add', ...(editId ? {id: editId} : {}), category, name });
        skills = response.skills;
        draw();
        closeDialog();
        say('Skills saved.');
      } catch (err) {
        errorBox.textContent = err.message;
      } finally { busy = false; saveBtn.disabled = false; }
    });

    (async () => {
      say('Loading your saved skills…');
      try {
        const response = await getJSON(endpoint);
        skills = Array.isArray(response.skills) ? response.skills : [];
        draw();
        say(skills.length ? 'Your skills are visible on this profile.' : 'No skills added yet.');
      } catch (err) {
        skills = [];
        draw();
        say(`Could not load skills: ${err.message}`, true);
      }
    })();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();

/* AttachLink Stage 17C — move the existing sign-out button into a standalone action.
   No Stitch HTML structures are replaced. Uses existing authenticated PHP logout API. */
(() => {
  'use strict';

  function install() {
    if (document.getElementById('al-stage17c-signout-wrap')) return;

    const button = document.getElementById('signout-btn') ||
      Array.from(document.querySelectorAll('button')).find(el =>
        /sign\s*out\s*from\s*attachlink/i.test(el.textContent || ''));
    if (!button) return;

    const privacySection = button.closest('section');
    if (!privacySection || !/account\s*&\s*privacy\s*controls/i.test(privacySection.textContent || '')) {
      console.warn('[AttachLink] Sign-out button was found outside the expected Profile privacy panel. No changes made.');
      return;
    }

    const previousRow = button.parentElement;
    const style = document.createElement('style');
    style.id = 'al-stage17c-signout-styles';
    style.textContent = `
      #al-stage17c-signout-wrap { margin-top: 18px; width: 100%; }
      #al-stage17c-signout-wrap .al-stage17c-btn {
        box-sizing: border-box; display: flex; justify-content: center; align-items: center;
        gap: 12px; width: 100%; min-height: 54px; padding: 14px 20px;
        border: 1.5px solid #c53b38; border-radius: 14px;
        background: #fff2f1; color: #a32223; font: inherit; font-size: 15px;
        font-weight: 700; line-height: 1.4; text-align: center; cursor: pointer;
        box-shadow: 0 2px 9px rgba(114,29,34,0.05); transition: background .18s, box-shadow .18s;
      }
      #al-stage17c-signout-wrap .al-stage17c-btn:hover { background: #ffe6e3; box-shadow: 0 3px 13px rgba(114,29,34,.11); }
      #al-stage17c-signout-wrap .al-stage17c-btn:focus-visible { outline: 3px solid #1b8881; outline-offset: 3px; }
      #al-stage17c-signout-wrap .al-stage17c-btn:disabled { opacity: .65; cursor: progress; }
      #al-stage17c-signout-wrap svg { width: 20px; height: 20px; flex: none; }
      #al-stage17c-signout-status { min-height: 0; margin-top: 8px; color: #a32223; font-size: 13px; }
      #al-stage17c-signout-status:empty { display: none; }
      @media (max-width: 520px) { #al-stage17c-signout-wrap .al-stage17c-btn { font-size: 14px; } }
    `;
    document.head.appendChild(style);

    const wrapper = document.createElement('div');
    wrapper.id = 'al-stage17c-signout-wrap';
    const status = document.createElement('div');
    status.id = 'al-stage17c-signout-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    // Keep the original element to preserve references while changing presentation only.
    button.id = 'signout-btn';
    button.type = 'button';
    button.classList.add('al-stage17c-btn');
    button.setAttribute('aria-label', 'Sign out from AttachLink');
    button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-6"/></svg><span>Sign Out from AttachLink</span>`;

    wrapper.append(button, status);
    privacySection.insertAdjacentElement('afterend', wrapper);
    if (previousRow && previousRow !== wrapper) {
      // The build-number label remains in the privacy card, right aligned.
      if (previousRow.textContent.trim()) previousRow.style.justifyContent = 'flex-end';
      else previousRow.remove();
    }

    // Capture phase takes priority over the older demo handler that only redirected to login.html.
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (button.disabled) return;
      if (!window.confirm('Sign out of your AttachLink account?')) return;

      button.disabled = true;
      status.textContent = 'Signing out…';
      try {
        const csrfResponse = await fetch('../../backend/api/auth/csrf.php', {
          method: 'GET', credentials: 'same-origin', cache: 'no-store', headers: { 'Accept': 'application/json' }
        });
        const csrf = await csrfResponse.json();
        if (!csrfResponse.ok || csrf.ok !== true || !csrf.csrf_token) throw new Error('Could not verify your session.');

        const response = await fetch('../../backend/api/auth/logout.php', {
          method: 'POST', credentials: 'same-origin', cache: 'no-store',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ csrf_token: csrf.csrf_token })
        });
        const result = await response.json();
        if (!response.ok || result.ok !== true) throw new Error(result.message || 'Unable to sign out.');

        // Do not delete browser-saved drafts or profile settings: the PHP session is now destroyed.
        window.location.replace('login.html');
      } catch (error) {
        status.textContent = (error && error.message) || 'Unable to sign out. Please try again.';
        button.disabled = false;
      }
    }, { capture: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
