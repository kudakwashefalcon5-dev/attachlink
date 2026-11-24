/* AttachLink Stage 11: visual monthly planner. Does not call AI or booking services. */
(() => {
  'use strict';
  const init = () => {
    const form = document.getElementById('interview-form');
    const list = document.getElementById('interview-items');
    if (!form || !list || document.getElementById('al-interview-chart')) return;
    const now = new Date();
    let month = new Date(now.getFullYear(), now.getMonth(), 1);
    const root = document.createElement('section');
    root.id = 'al-interview-chart';
    root.className = 'al-iv-chart';
    root.setAttribute('aria-label', 'Visual interview schedule');
    root.innerHTML = `
      <header class="al-iv-head"><div>
        <p class="al-iv-eyebrow">Personal interview planning chart</p>
        <h2 class="al-iv-title">Interview Schedule</h2>
        <p class="al-iv-sub">Review interview dates saved to your account.</p>
      </div></header>
      <div class="al-iv-summary" aria-live="polite">
        <div class="al-iv-stat"><strong data-iv-stat="upcoming">0</strong><span>Upcoming</span></div>
        <div class="al-iv-stat"><strong data-iv-stat="month">0</strong><span>This month</span></div>
        <div class="al-iv-stat"><strong data-iv-stat="mock">0</strong><span>Mock interview plans</span></div>
      </div>
      <div class="al-iv-main">
        <div class="al-iv-calendar">
          <div class="al-iv-toolbar"><span class="al-iv-month" data-iv-month></span>
            <div class="al-iv-controls"><button class="al-iv-control" type="button" data-iv-nav="previous" aria-label="Previous month">‹</button><button class="al-iv-control" type="button" data-iv-nav="today">Today</button><button class="al-iv-control" type="button" data-iv-nav="next" aria-label="Next month">›</button></div>
          </div>
          <div class="al-iv-days" data-iv-days role="group" aria-label="Interview calendar"></div>
        </div>
        <aside class="al-iv-side"><h3>Upcoming interviews</h3><div data-iv-upcoming aria-live="polite"></div>
        </aside>
      </div>
      <p class="al-iv-tip">Select a day with an interview to jump to its details. Use the existing form below to add, edit or export plans.</p>
    `;
    const grid = form.closest('.al-grid.two') || form.closest('section') || form;
    grid.parentNode.insertBefore(root, grid);
    const dateKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const validDate = s => {
      if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
      const [y,m,d] = s.split('-').map(Number);
      const x = new Date(y,m-1,d);
      return x.getFullYear() === y && x.getMonth() === m-1 && x.getDate() === d;
    };
    const getEntries = () => {
      try {
        const v = window.AttachLinkInterviewPlans;
        return (Array.isArray(v) ? v : []).filter(x => x && validDate(x.date)).slice(0,500).sort((a,b) => `${a.date}T${a.time || '00:00'}`.localeCompare(`${b.date}T${b.time || '00:00'}`));
      } catch { return []; }
    };
    const el = (tag, cls, text) => {
      const node = document.createElement(tag);
      if (cls) node.className = cls;
      if (text !== undefined) node.textContent = String(text);
      return node;
    };
    const nextMonth = n => new Date(month.getFullYear(), month.getMonth()+n, 1);
    const sameMonth = (s,m) => s.slice(0,7) === dateKey(m).slice(0,7);
    function render() {
      const items = getEntries(), today = dateKey(new Date());
      const endMonth = new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
      root.querySelector('[data-iv-month]').textContent = month.toLocaleDateString('en-ZW',{month:'long',year:'numeric'});
      root.querySelector('[data-iv-stat="upcoming"]').textContent = items.filter(x => x.date >= today).length;
      root.querySelector('[data-iv-stat="month"]').textContent = items.filter(x => sameMonth(x.date,month)).length;
      root.querySelector('[data-iv-stat="mock"]').textContent = items.filter(x => /mock/i.test(x.type || '')).length;
      const calendar = root.querySelector('[data-iv-days]');
      calendar.replaceChildren();
      ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(day => calendar.appendChild(el('div','al-iv-weekday',day)));
      const first = (month.getDay() + 6) % 7;
      const count = first + endMonth <= 35 ? 35 : 42;
      for (let cell=0;cell<count;cell++) {
        const d = new Date(month.getFullYear(),month.getMonth(),cell-first+1);
        const key = dateKey(d), inMonth = d.getMonth() === month.getMonth();
        const matches = items.filter(x => x.date === key);
        const day = el(matches.length ? 'button' : 'div', `al-iv-day${inMonth?'':' is-outside'}${key===today?' is-today':''}${matches.length?' has-events':''}`);
        if (matches.length) {
          day.type='button'; day.dataset.ivDate=key;
          day.setAttribute('aria-label',`${d.toLocaleDateString('en-ZW',{day:'numeric',month:'long',year:'numeric'})}: ${matches.length} planned interview${matches.length===1?'':'s'}`);
          day.title = matches.map(x => `${x.time || ''} ${x.company || 'Interview'}`).join('\n');
        }
        day.appendChild(el('span','al-iv-num',d.getDate()));
        for (const x of matches.slice(0,2)) {
          const event = el('span',`al-iv-event${/mock/i.test(x.type || '')?' is-mock':''}`,`${x.time || ''} ${x.company || 'Interview'}`.trim());
          day.appendChild(event);
        }
        if (matches.length > 2) day.appendChild(el('span','al-iv-more',`+${matches.length-2} more`));
        calendar.appendChild(day);
      }
      const upcoming = root.querySelector('[data-iv-upcoming]');
      upcoming.replaceChildren();
      const future = items.filter(x => x.date >= today).slice(0,5);
      if (!future.length) upcoming.appendChild(el('p','al-iv-nodata','No upcoming interviews. Add a plan using the form below.'));
      for (const x of future) {
        const row = el('div','al-iv-next');
        const chip = el('div','al-iv-datechip');
        chip.appendChild(el('div','',new Date(x.date+'T12:00:00').toLocaleDateString('en-ZW',{day:'2-digit',month:'short'})));
        const body = el('div','al-iv-next-body');
        body.appendChild(el('div','al-iv-next-name',x.company || 'Interview'));
        body.appendChild(el('div','al-iv-next-meta',`${x.time || 'Time not set'} · ${x.type || 'Interview'}${x.role ? ' · '+x.role : ''}`));
        row.append(chip, body);upcoming.appendChild(row);
      }
    }
    root.addEventListener('click',e => {
      const nav=e.target.closest('button[data-iv-nav]');
      if (nav) { const dir=nav.dataset.ivNav; month=dir==='today' ? new Date(new Date().getFullYear(),new Date().getMonth(),1) : nextMonth(dir==='next'?1:-1); render();return; }
      const day=e.target.closest('button[data-iv-date]');
      if (day) {
        const x=getEntries().find(i => i.date === day.dataset.ivDate);
        if (x) {
          const row=Array.from(list.querySelectorAll('[data-id]')).find(r => r.getAttribute('data-id') === String(x.id || ''));
          (row || list).scrollIntoView({behavior:'smooth',block:'center'});
          if (row) {row.style.outline='2px solid #0f766e'; setTimeout(()=>row.style.outline='',1500);}
        }
      }
    });
    new MutationObserver(render).observe(list,{childList:true,subtree:true});
    document.addEventListener('attachlink:interview-plans',render);
    render();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
