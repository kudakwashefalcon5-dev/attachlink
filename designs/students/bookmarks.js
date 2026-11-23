/* AttachLink Stage 6F — MySQL-backed saved openings, no Stitch layout changes. */
(() => {
  'use strict';
  const API = new URL('../../backend/api/', location.href);
  let saved = [];
  let ids = new Set();
  let busy = false;
  let pending = null;
  let loaded = false;
  async function getJson(url, options={}) {
    const response = await fetch(new URL(url,API), {
      method: options.method || 'GET', credentials:'same-origin', cache:'no-store',
      headers: {'Accept':'application/json', ...(options.body ? {'Content-Type':'application/json'} : {})},
      ...(options.body ? {body:JSON.stringify(options.body)} : {})
    });
    if (response.status === 401) {
      location.replace('login.html?session=expired');
      throw new Error('Please sign in as a student.');
    }
    let data;
    try {data=await response.json();} catch (_) {throw new Error('Server did not return JSON.');}
    if (!response.ok || data.ok !== true) throw new Error(data.message || ('Request failed (HTTP '+response.status+').'));
    return data;
  }
  function paint() {
    document.querySelectorAll('[data-save-db]').forEach(btn => {
      const id = String(btn.dataset.saveDb || '');
      if (!/^[1-9]\d*$/.test(id)) return;
      const active = ids.has(id);
      btn.textContent = active ? '★ Saved' : '☆ Save';
      btn.setAttribute('aria-label', active ? 'Remove from Saved Openings' : 'Save Opening');
      btn.setAttribute('aria-pressed', String(active));
      btn.title = active ? 'Remove from Saved Openings' : 'Save this opening';
    });
    document.querySelectorAll('[data-al-save-count]').forEach(node => {node.textContent = loaded ? String(saved.length) : '…';});
  }
  async function refresh() {
    if (pending) return pending;
    pending = (async () => {
      const data = await getJson('student/saved-listings.php');
      if (!Array.isArray(data.saved)) throw new Error('Invalid saved listings response.');
      saved = data.saved;
      ids = new Set(saved.map(item=>String(item.listing_id)));
      loaded = true;
      paint();
      document.dispatchEvent(new CustomEvent('attachlink:db-saved-updated', {detail:{count:saved.length,saved}}));
      return saved;
    })().finally(()=>{pending=null});
    return pending;
  }
  async function change(id, action) {
    if (!/^[1-9]\d*$/.test(String(id))) throw new Error('Invalid listing ID.');
    // Wait for the initial bookmark fetch so a stale GET cannot overwrite a POST.
    if (pending) await pending;
    const csrf = await getJson('auth/csrf.php');
    if (!csrf.csrf_token) throw new Error('Please log in again.');
    await getJson('student/saved-listings.php', {
      method:'POST',body:{listing_id:Number(id),action,csrf_token:csrf.csrf_token}
    });
    return refresh();
  }
  document.addEventListener('click', async event => {
    const btn = event.target.closest('[data-save-db]');
    if (!btn || busy) return;
    event.preventDefault();
    const id = String(btn.dataset.saveDb || '');
    if (!/^[1-9]\d*$/.test(id)) return;
    busy = true;
    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = 'Saving…';
    try {
      await change(id, ids.has(id) ? 'remove' : 'save');
    } catch (error) {
      btn.textContent = old;
      window.alert('Unable to update Saved Openings: ' + error.message);
    } finally {
      busy = false;
      btn.disabled = false;
      paint();
    }
  });
  window.addEventListener('pageshow', event=>{if(event.persisted) refresh().catch(console.warn)});
  window.addEventListener('focus', ()=>refresh().catch(console.warn));
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>refresh().catch(console.warn),{once:true});
  else refresh().catch(console.warn);
  window.AttachLinkSaved = {refresh,paint,get saved(){return saved.slice()},get loaded(){return loaded}};
})();
