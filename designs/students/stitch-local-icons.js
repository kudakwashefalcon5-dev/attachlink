/* AttachLink local SVG icon fallback. Uses simple original paths instead of external font files. */
(()=>{
  'use strict';
  const shapes = {
    search:'<circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/>',
    location_on:'<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    expand_more:'<path d="m6 9 6 6 6-6"/>',
    notifications:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 10h18c0-2-3-3-3-10ZM10 21h4"/>',
    person:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    account_circle:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="9" r="3"/><path d="M5 20c0-7 14-7 14 0"/>',
    school:'<path d="m2 9 10-5 10 5-10 5-10-5ZM6 11v6c4 3 8 3 12 0v-6M22 9v8"/>',
    payments:'<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20M7 15h4"/>',
    arrow_forward:'<path d="M4 12h16m-7-7 7 7-7 7"/>',
    arrow_back:'<path d="M20 12H4m7-7-7 7 7 7"/>',
    check_circle:'<circle cx="12" cy="12" r="10"/><path d="m7 12 3 3 7-7"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    bolt:'<path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z"/>',
    timer:'<circle cx="12" cy="13" r="9"/><path d="M12 13V8M9 2h6M12 13l4 2"/>',
    schedule:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 3"/>',
    calendar_today:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
    event:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 15h3"/>',
    calendar_month:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h2M14 14h2M8 18h2"/>',
    terminal:'<rect x="2" y="3" width="20" height="18" rx="2"/><path d="m6 9 4 3-4 3M12 16h6"/>',
    verified:'<path d="m12 2 3 2 4-.2.2 4 2 3-2 3-.2 4-4-.2-3 2-3-2-4 .2-.2-4-2-3 2-3 .2-4 4 .2 3-2Z"/><path d="m8 12 3 3 5-6"/>',
    verified_user:'<path d="m12 2 8 4v6c0 6-4 9-8 10-4-1-8-4-8-10V6l8-4Z"/><path d="m8 12 3 3 5-6"/>',
    workspace_premium:'<circle cx="12" cy="9" r="7"/><path d="m8 15-1 7 5-3 5 3-1-7"/>',
    auto_awesome:'<path d="m12 2 2 7 7 3-7 2-2 8-2-8-8-2 8-3 2-7Z"/>',
    home:'<path d="m2 11 10-8 10 8M5 10v11h14V10M9 21v-7h6v7"/>',
    bed:'<path d="M3 20V6M3 13h17a2 2 0 0 1 2 2v5M3 18h19M7 10h5v3H7Z"/>',
    laptop_mac:'<rect x="4" y="4" width="16" height="12" rx="1"/><path d="M2 19h20l-2-3H4l-2 3Z"/>',
    info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7h.01"/>',
    close:'<path d="M6 6 18 18M18 6 6 18"/>',
    menu:'<path d="M3 7h18M3 12h18M3 17h18"/>',
    bookmark:'<path d="M5 3h14v19l-7-4-7 4V3Z"/>',
    bookmark_border:'<path d="M5 3h14v19l-7-4-7 4V3Z"/>',
    share:'<circle cx="18" cy="5" r="3"/><circle cx="5" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8 11 7-5M8 13l7 5"/>',
    edit:'<path d="m4 20 5-.8L21 7l-4-4L5 15 4 20ZM14 6l4 4"/>',
    picture_as_pdf:'<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 8h8M8 12h7M8 16h6"/>',
    upload_file:'<path d="M5 3h10l4 4v14H5V3ZM15 3v5h4M12 19v-8m-4 4 4-4 4 4"/>',
    file_upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 17v4h16v-4"/>',
    description:'<path d="M5 2h10l4 4v16H5V2ZM15 2v5h4M8 11h8M8 15h8M8 19h6"/>',
    visibility:'<path d="M2 12c5-8 15-8 20 0-5 8-15 8-20 0Z"/><circle cx="12" cy="12" r="3"/>',
    visibility_off:'<path d="m3 3 18 18M2 12c5-8 15-8 20 0-1 2-3 4-5 5M6 6c-2 1-3 3-4 6"/><circle cx="12" cy="12" r="3"/>',
    security:'<path d="m12 2 8 4v6c0 6-4 9-8 10-4-1-8-4-8-10V6l8-4Z"/><path d="m8 12 3 3 5-6"/>',
    logout:'<path d="M9 4H4v16h5M13 8l4 4-4 4M7 12h10"/>',
    chat:'<path d="M3 4h18v14H8l-5 4V4Z"/>',
    call:'<path d="M4 3h5l2 5-3 2c2 4 5 7 9 9l2-3 4 2v4c-10 2-21-9-19-19Z"/>',
    mail:'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m3 6 9 7 9-7"/>',
    pending_actions:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    school:'<path d="m2 9 10-5 10 5-10 5-10-5ZM6 11v6c4 3 8 3 12 0v-6M22 9v8"/>',
    folder_managed:'<path d="M2 6h7l3 3h10v12H2V6Z"/><path d="M12 13v6M9 16h6"/>',
    event_available:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18m-10 7 2 2 4-4"/>',
    assignment_late:'<path d="M7 3h10v3h3v16H4V6h3V3ZM9 3v4h6V3M12 10v6m0 3v.01"/>',
    monitor_heart:'<rect x="2" y="3" width="20" height="16" rx="2"/><path d="M5 11h4l2-3 3 6 2-3h3M9 22h6"/>',
    cloud_sync:'<path d="M6 18H5a4 4 0 0 1-1-8 7 7 0 0 1 14-2 5 5 0 1 1 1 10h-2M7 21l3-3 3 3M10 18v-6"/>',
    alt_route:'<circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="12" cy="19" r="2"/><path d="M5 7v5l7 5 7-5V7"/>',
    assignment:'<rect x="5" y="4" width="14" height="18" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M8 11h8M8 15h8"/>',
    more_horiz:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    group:'<circle cx="9" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><path d="M2 20a7 7 0 0 1 14 0m0-7a7 7 0 0 1 6 7"/>',
  };
  function draw(root){
    root.querySelectorAll('.material-symbols-outlined').forEach(el=>{
      if(el.dataset.alLocalIcon) return;
      const name=(el.textContent||'').trim();
      // Icons already handled by an externally loaded Material Symbols font retain their standard look.
      if(!name||!shapes[name])return;
      el.dataset.alLocalIcon=name;
      // Use SVG, so the dashboard icons work even if the remote Google font is blocked.
      el.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+shapes[name]+'</svg>';
      el.setAttribute('aria-hidden','true');
    });
  }
  document.addEventListener('DOMContentLoaded',()=>draw(document));
})();
