/**
 * AttachLink: student identity from the authenticated PHP session.
 * Only changes text content, never the Stitch layout, classes or CSS.
 * Requires the Stage 5 GET backend/api/student/account.php endpoint.
 * No account identity is read from or written to localStorage.
 */
(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const pageIsProfile = !!$('#profile-name');
  const pageIsDashboard = !pageIsProfile && !!$('main h1') &&
    $('main h1').textContent.includes('Welcome back');
  if (!pageIsProfile && !pageIsDashboard) return;

  function showWithIcon(element, text) {
    if (!element) return;
    // Keep the original Stitch Material icon, but remove sample identity text.
    const icon = element.querySelector('.material-symbols-outlined');
    const value = element.querySelector('.al-profile-value');
    if (value) {
      value.textContent = text;
      [...element.children].forEach(child => {
        if (child !== value && child !== icon) child.remove();
      });
    } else {
      [...element.childNodes].forEach(node => {
        if (node !== icon) node.remove();
      });
      element.appendChild(document.createTextNode(' ' + text));
    }
  }

  function setDirectText(element, text) {
    if (!element) return;
    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) node.remove();
    }
    element.appendChild(document.createTextNode(' ' + text));
  }

  function updateIdentity(account) {
    const name = [account.first_name, account.last_name].filter(Boolean).join(' ').trim() || 'Student';
    const institution = (account.institution || '').trim() || 'Institution not provided';
    const programme = (account.programme || '').trim() || 'Programme not provided';
    const level = (account.study_level || '').trim();
    const study = [level, programme, institution].filter(Boolean).join(' • ');

    $$('[data-al-name]').forEach(el => el.textContent = name);

    if (pageIsProfile) {
      $('#profile-name').textContent = name;
      const course = $('[data-profile="course"]');
      if (course) course.textContent = study;
      showWithIcon($('[data-profile="phone"]'), account.phone || 'Phone not yet provided');
      showWithIcon($('[data-profile="email"]'), account.email || 'Email unavailable');
      showWithIcon($('[data-profile="location"]'), account.city || 'City not yet provided');

      // These badges must not claim that the user's new account is UZ-verified.
      const identityRow = $('#profile-name')?.parentElement;
      if (identityRow) {
        for (const span of identityRow.querySelectorAll('span')) {
          if (span.textContent.includes('Verified Student')) setDirectText(span, 'Verification not yet connected');
          if (span.textContent.includes('UZ ID:')) span.textContent = 'Account profile';
        }
      }
      const avatar = $('img[data-alt^="Portrait photo of Takudzwa"]');
      if (avatar) avatar.alt = 'Sample profile avatar (not uploaded by this student)';
      const pip = $('[title="Identity Verified by University Registrar"]');
      if (pip) pip.title = 'Demo identity badge — not verified by a university';

      const demo = $('.al-demo-banner');
      if (demo) demo.hidden = true;
    }

    if (pageIsDashboard) {
      const h1 = $('main h1');
      if (h1) h1.textContent = 'Welcome back, ' + name;
      const hero = h1?.closest('.flex.flex-col');
      const schoolLine = hero?.querySelector('p');
      if (schoolLine) schoolLine.textContent = [institution, programme].filter(Boolean).join(' • ');
      const studyBadge = h1?.parentElement?.querySelector('span');
      if (studyBadge) setDirectText(studyBadge, [level, programme].filter(Boolean).join(' • ') || 'Student account');
    }
  }

  function maskOldIdentity() {
    $$('[data-al-name]').forEach(el => el.textContent = 'Loading profile…');
    if (pageIsProfile) {
      $('#profile-name').textContent = 'Loading your profile…';
      const course = $('[data-profile="course"]');
      if (course) course.textContent = 'Loading course information…';
      ['phone','email','location'].forEach(field => showWithIcon($(`[data-profile="${field}"]`), 'Loading…'));
    }
    if (pageIsDashboard) {
      const h1 = $('main h1');
      if (h1) h1.textContent = 'Welcome back';
      const hero = h1?.closest('.flex.flex-col');
      const schoolLine = hero?.querySelector('p');
      if (schoolLine) schoolLine.textContent = 'Loading your academic details…';
      const studyBadge = h1?.parentElement?.querySelector('span');
      if (studyBadge) setDirectText(studyBadge, 'Loading…');
    }
  }

  function showError() {
    const message = 'Could not load your account. Sign in again and retry.';
    if (pageIsProfile) {
      $('#profile-name').textContent = 'Account unavailable';
      const course = $('[data-profile="course"]');
      if (course) course.textContent = message;
      ['phone','email','location'].forEach(field => showWithIcon($(`[data-profile="${field}"]`), 'Unavailable'));
    } else {
      const h1 = $('main h1');
      if (h1) h1.textContent = 'Your account could not be loaded';
      const hero = h1?.closest('.flex.flex-col');
      const p = hero?.querySelector('p');
      if (p) p.textContent = message;
    }
    $$('[data-al-name]').forEach(el => el.textContent = 'Account unavailable');
  }

  function useMySqlEditForm() {
    const editButton = $('#edit-profile-btn');
    if (!editButton) return;
    // Prevent the older localStorage modal from misleading users into
    // thinking account edits were saved to MySQL.
    editButton.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.assign('account.html');
    }, true);
    editButton.title = 'Edit account details';
  }

  async function load() {
    maskOldIdentity();
    useMySqlEditForm();
    try {
      const url = new URL('../../backend/api/student/account.php', window.location.href);
      const response = await fetch(url.href, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Accept': 'application/json' }
      });
      if (response.status === 401) {
        window.location.replace('login.html?session=expired');
        return;
      }
      if (!response.ok) throw new Error('Student account request failed: ' + response.status);
      const data = await response.json();
      if (!data || data.ok !== true || !data.account) throw new Error('Invalid student account response');
      updateIdentity(data.account);
    } catch (error) {
      console.error('AttachLink profile: unable to fetch authenticated account', error);
      showError();
    }
  }

  // The existing Stitch scripts register their own DOMContentLoaded handlers.
  // Run afterwards so older localStorage demo name rendering cannot win.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load, { once: true });
  } else {
    load();
  }
})();
