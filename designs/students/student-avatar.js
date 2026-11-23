/**
 * AttachLink student profile picture: WhatsApp-style optional upload/crop/remove.
 * Works with the existing Stitch Profile markup. Does NOT edit page layout/CSS
 * files, and never uses an example portrait or localStorage as photo identity.
 * Uses only the authenticated student's PHP session and private avatar API.
 */
(() => {
  'use strict';
  const profileHeading = document.getElementById('profile-name');
  if (!profileHeading) return; // Only the Student Profile page.

  const sampleImage = document.querySelector('img[data-alt^="Portrait photo of"]');
  if (!sampleImage || !sampleImage.parentElement) {
    console.warn('AttachLink avatar: Stitch profile photo container not found.');
    return;
  }
  const frame = sampleImage.parentElement;
  const frameWrapper = frame.parentElement;
  const endpoint = new URL('../../backend/api/student/avatar.php', location.href).href;
  const accountEndpoint = new URL('../../backend/api/student/account.php', location.href).href;
  const csrfEndpoint = new URL('../../backend/api/auth/csrf.php', location.href).href;
  const MAX_INPUT_BYTES = 12 * 1024 * 1024; // Browser crops photo before upload.

  // Remove the demo photo immediately. Until the user's upload exists,
  // only their real first and last initials will appear.
  sampleImage.removeAttribute('src');
  sampleImage.removeAttribute('data-alt');
  sampleImage.alt = 'Your profile picture';
  sampleImage.style.display = 'none';
  frame.classList.remove('rounded-xl');
  frame.classList.add('rounded-full');
  frame.style.borderRadius = '50%';
  frame.style.overflow = 'hidden';
  sampleImage.style.width = '100%';
  sampleImage.style.height = '100%';
  sampleImage.style.objectFit = 'cover';
  frame.setAttribute('aria-label', 'Student profile picture');
  frame.style.position = 'relative';
  frame.style.cursor = 'pointer';
  frame.tabIndex = 0;
  frame.setAttribute('role', 'button');
  frame.setAttribute('aria-label', 'Profile photo options');

  const initialsElement = document.createElement('span');
  initialsElement.id = 'al-avatar-initials';
  initialsElement.className = 'al-avatar-initials';
  initialsElement.textContent = '…';
  frame.appendChild(initialsElement);

  // Repurpose the existing decorative verification badge into a camera button.
  // Uploading a picture never implies university identity verification.
  const oldPip = frameWrapper.querySelector('[title="Identity Verified by University Registrar"]') ||
    frameWrapper.querySelector('[title^="Demo identity badge"]');
  if (oldPip) oldPip.remove();
  const cameraButton = document.createElement('button');
  cameraButton.type = 'button';
  cameraButton.className = 'al-avatar-camera';
  cameraButton.title = 'Add or change profile photo';
  cameraButton.setAttribute('aria-label', 'Add or change profile photo');
  // Inline SVG does not depend on the Material Symbols font. The icon must
  // never display its ligature text ("photo_camera") over the student initials.
  cameraButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3"/></svg>';
  frameWrapper.appendChild(cameraButton);

  const filePicker = document.createElement('input');
  filePicker.type = 'file';
  filePicker.accept = 'image/jpeg,image/png,image/webp';
  filePicker.hidden = true;
  filePicker.setAttribute('aria-label', 'Choose your profile photo');
  document.body.appendChild(filePicker);

  const styles = document.createElement('style');
  styles.textContent = `
    .al-avatar-initials{display:flex;align-items:center;justify-content:center;width:100%;height:100%;
      background:linear-gradient(140deg,#08675f,#138f83);color:white;font:700 35px/1 Inter,Arial,sans-serif;
      letter-spacing:1px;user-select:none;text-transform:uppercase}
    .al-avatar-camera{position:absolute;right:-8px;bottom:-6px;z-index:5;width:33px;height:33px;
      border:3px solid #fff;border-radius:50%;background:#00695f;color:#fff;display:flex;
      align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px #0003}
    .al-avatar-camera svg{display:block;width:18px;height:18px;flex:none}
    .al-avatar-camera:hover{background:#004d44}
    .al-avatar-menu{position:fixed;z-index:10001;width:218px;padding:7px;background:white;
      border:1px solid #dce8e5;border-radius:13px;box-shadow:0 12px 40px #102e2940;
      font:14px/1.4 Inter,Arial,sans-serif;color:#173d39}
    .al-avatar-menu button{display:block;width:100%;padding:12px 13px;text-align:left;background:white;
      border:0;border-radius:8px;color:inherit;font:inherit;cursor:pointer}
    .al-avatar-menu button:hover,.al-avatar-menu button:focus-visible{background:#e9f5f3}
    .al-avatar-menu button:disabled{opacity:.4;cursor:not-allowed}
    .al-avatar-menu button.al-avatar-remove{color:#ab2434}
    .al-avatar-overlay{position:fixed;inset:0;z-index:10002;background:rgba(8,24,24,.72);
      display:flex;align-items:center;justify-content:center;padding:16px;font:15px/1.45 Inter,Arial,sans-serif}
    .al-avatar-modal{width:min(100%,420px);padding:22px;border-radius:17px;background:#fff;
      color:#1d3735;box-shadow:0 15px 55px #0005;text-align:center}
    .al-avatar-modal h2{font-size:20px;font-weight:700;margin:0 0 5px}
    .al-avatar-modal p{font-size:13px;color:#536b67;margin:6px 0 16px}
    .al-avatar-crop{display:block;width:min(70vw,290px);height:min(70vw,290px);margin:auto;
      border-radius:50%;border:4px solid #007b6a;background:#e7f3f0;touch-action:none;cursor:grab}
    .al-avatar-crop:active{cursor:grabbing}
    .al-avatar-zoom{width:min(70vw,290px);margin:17px auto 13px;accent-color:#007b6a;display:block}
    .al-avatar-buttons{display:flex;justify-content:center;gap:10px;margin-top:16px}
    .al-avatar-buttons button{border-radius:9px;padding:10px 19px;border:1px solid #cbdad7;
      background:#fff;color:#174b43;font-weight:600;cursor:pointer}
    .al-avatar-buttons button.al-avatar-primary{background:#007b6a;border-color:#007b6a;color:white}
    .al-avatar-buttons button:disabled{opacity:.55;cursor:wait}
    .al-avatar-toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);
      z-index:10003;padding:11px 18px;max-width:min(90vw,420px);border-radius:10px;
      background:#143a36;color:#fff;font:14px Inter,Arial,sans-serif;box-shadow:0 6px 20px #0003}
  `;
  document.head.appendChild(styles);

  let hasPhoto = false;
  let menu = null;
  let dialog = null;
  let activeObjectUrl = null;
  let busy = false;
  let viewerPicture = null;

  function toast(message) {
    const old = document.querySelector('.al-avatar-toast');
    if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'al-avatar-toast';
    el.setAttribute('role', 'status');
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  function initials(first, last) {
    const f = String(first || '').trim();
    const l = String(last || '').trim();
    return ((f[0] || '') + (l[0] || '')).toLocaleUpperCase() || '?';
  }

  function showInitials() {
    hasPhoto = false;
    sampleImage.style.display = 'none';
    sampleImage.removeAttribute('src');
    initialsElement.style.display = 'flex';
  }
  function showPhoto() {
    hasPhoto = true;
    const url = endpoint + '?image=1&t=' + Date.now();
    const check = new Image();
    check.onload = () => {
      sampleImage.src = url;
      sampleImage.style.display = 'block';
      initialsElement.style.display = 'none';
    };
    check.onerror = showInitials;
    check.src = url;
  }

  async function getJSON(url, options = {}) {
    const response = await fetch(url, {
      ...options, credentials: 'same-origin', cache: 'no-store',
      headers: { Accept: 'application/json', ...(options.headers || {}) }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok !== true) {
      throw new Error(payload.message || 'Request failed (' + response.status + ')');
    }
    return payload;
  }

  async function csrfToken() {
    const result = await getJSON(csrfEndpoint);
    if (typeof result.csrf_token !== 'string' || !result.csrf_token) {
      throw new Error('Sign in again to upload a picture.');
    }
    return result.csrf_token;
  }

  function closeMenu() {
    if (menu) { menu.remove(); menu = null; }
  }
  function closeDialog() {
    if (dialog) { dialog.remove(); dialog = null; }
    if (activeObjectUrl) { URL.revokeObjectURL(activeObjectUrl); activeObjectUrl = null; }
    cameraButton.focus();
  }
  function closeOnOutside(event) {
    if (menu && !menu.contains(event.target) && !cameraButton.contains(event.target) && !frame.contains(event.target)) {
      closeMenu();
    }
  }
  document.addEventListener('pointerdown', closeOnOutside);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (dialog) closeDialog();
      closeMenu();
    }
  });

  function openMenu() {
    if (busy) return;
    if (menu) { closeMenu(); return; }
    menu = document.createElement('div');
    menu.className = 'al-avatar-menu';
    menu.setAttribute('role', 'menu');
    const addOption = (text, callback, disabled = false, className = '') => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = text;
      button.disabled = disabled;
      button.className = className;
      button.setAttribute('role', 'menuitem');
      button.addEventListener('click', () => { closeMenu(); callback(); });
      menu.appendChild(button);
    };
    addOption('View profile photo', viewPhoto, !hasPhoto);
    addOption(hasPhoto ? 'Change photo' : 'Add profile photo', () => filePicker.click());
    if (hasPhoto) addOption('Remove photo', removePhoto, false, 'al-avatar-remove');
    document.body.appendChild(menu);
    const position = cameraButton.getBoundingClientRect();
    const x = Math.min(window.innerWidth - 232, Math.max(8, position.left - 120));
    const y = Math.min(window.innerHeight - menu.offsetHeight - 8, position.bottom + 9);
    menu.style.left = Math.max(8, x) + 'px';
    menu.style.top = Math.max(8, y) + 'px';
    menu.querySelector('button:not(:disabled)')?.focus();
  }

  function viewPhoto() {
    if (!hasPhoto) return;
    dialog = document.createElement('div');
    dialog.className = 'al-avatar-overlay';
    dialog.innerHTML = `<div class="al-avatar-modal" role="dialog" aria-modal="true" aria-label="Your profile photo">
      <h2>Your profile photo</h2><p>Only a photo you uploaded appears here.</p>
      <img class="al-avatar-crop" alt="Your uploaded profile photo" style="object-fit:cover" />
      <div class="al-avatar-buttons"><button type="button" data-close>Close</button>
      <button class="al-avatar-primary" type="button" data-change>Change photo</button></div></div>`;
    document.body.appendChild(dialog);
    viewerPicture = dialog.querySelector('img');
    viewerPicture.src = endpoint + '?image=1&t=' + Date.now();
    dialog.querySelector('[data-close]').addEventListener('click', closeDialog);
    dialog.querySelector('[data-change]').addEventListener('click', () => { closeDialog(); filePicker.click(); });
    dialog.addEventListener('pointerdown', event => { if (event.target === dialog) closeDialog(); });
    dialog.querySelector('[data-close]').focus();
  }

  async function removePhoto() {
    if (!confirm('Remove your profile photo? Your initials will be shown instead.')) return;
    busy = true;
    try {
      const token = await csrfToken();
      await getJSON(endpoint, { method: 'DELETE', headers: { 'X-CSRF-Token': token } });
      showInitials();
      toast('Profile photo removed.');
    } catch (error) {
      toast('Unable to remove photo: ' + error.message);
    } finally {
      busy = false;
    }
  }

  async function openCrop(file) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast('Please choose a JPEG, PNG or WebP photo.'); return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      toast('Choose a picture smaller than 12 MB.'); return;
    }
    activeObjectUrl = URL.createObjectURL(file);
    const picture = new Image();
    try {
      await new Promise((resolve, reject) => {
        picture.onload = resolve;
        picture.onerror = reject;
        picture.src = activeObjectUrl;
      });
    } catch (_) {
      toast('Unable to open this image.');
      URL.revokeObjectURL(activeObjectUrl); activeObjectUrl = null;
      return;
    }
    if (picture.naturalWidth < 32 || picture.naturalHeight < 32 ||
        picture.naturalWidth > 6000 || picture.naturalHeight > 6000 ||
        picture.naturalWidth * picture.naturalHeight > 20000000) {
      toast('Choose a picture with valid dimensions.');
      URL.revokeObjectURL(activeObjectUrl); activeObjectUrl = null;
      return;
    }
    dialog = document.createElement('div');
    dialog.className = 'al-avatar-overlay';
    dialog.innerHTML = `<div class="al-avatar-modal" role="dialog" aria-modal="true" aria-label="Crop profile photo">
      <h2>Set profile photo</h2><p>Drag to position your face, then zoom if needed.</p>
      <canvas class="al-avatar-crop" width="300" height="300" aria-label="Profile picture crop preview"></canvas>
      <label for="al-avatar-zoom">Zoom</label>
      <input class="al-avatar-zoom" id="al-avatar-zoom" type="range" min="1" max="3" step="0.02" value="1" />
      <div class="al-avatar-buttons"><button type="button" data-cancel>Cancel</button>
      <button class="al-avatar-primary" type="button" data-save>Save photo</button></div>
      </div>`;
    document.body.appendChild(dialog);
    dialog.addEventListener('pointerdown', event => { if (event.target === dialog && !busy) closeDialog(); });
    const canvas = dialog.querySelector('canvas');
    const slider = dialog.querySelector('input');
    const saveButton = dialog.querySelector('[data-save]');
    const cancelButton = dialog.querySelector('[data-cancel]');
    let zoom = 1, offsetX = 0, offsetY = 0;
    const side = 300;
    const base = Math.max(side / picture.naturalWidth, side / picture.naturalHeight);
    function clampOffset() {
      const iw = picture.naturalWidth * base * zoom;
      const ih = picture.naturalHeight * base * zoom;
      offsetX = Math.max((side - iw) / 2, Math.min((iw - side) / 2, offsetX));
      offsetY = Math.max((side - ih) / 2, Math.min((ih - side) / 2, offsetY));
    }
    function paint(target, width) {
      const context = target.getContext('2d');
      const factor = width / side;
      const iw = picture.naturalWidth * base * zoom;
      const ih = picture.naturalHeight * base * zoom;
      context.clearRect(0, 0, width, width);
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, width);
      context.drawImage(picture,
        ((side - iw) / 2 + offsetX) * factor,
        ((side - ih) / 2 + offsetY) * factor,
        iw * factor, ih * factor);
    }
    function repaint() { clampOffset(); paint(canvas, side); }
    repaint();
    let dragging = false, lastX = 0, lastY = 0;
    canvas.addEventListener('pointerdown', event => {
      dragging = true; lastX = event.clientX; lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', event => {
      if (!dragging) return;
      const rect = canvas.getBoundingClientRect();
      const scalar = side / rect.width;
      offsetX += (event.clientX - lastX) * scalar;
      offsetY += (event.clientY - lastY) * scalar;
      lastX = event.clientX; lastY = event.clientY;
      repaint();
    });
    canvas.addEventListener('pointerup', () => { dragging = false; });
    canvas.addEventListener('pointercancel', () => { dragging = false; });
    slider.addEventListener('input', () => { zoom = Number(slider.value); repaint(); });
    cancelButton.addEventListener('click', () => { if (!busy) closeDialog(); });
    saveButton.addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      saveButton.disabled = true;
      cancelButton.disabled = true;
      saveButton.textContent = 'Saving…';
      try {
        const output = document.createElement('canvas');
        output.width = output.height = 512;
        paint(output, 512);
        const blob = await new Promise((resolve, reject) => {
          output.toBlob(data => data ? resolve(data) : reject(new Error('Could not prepare picture.')), 'image/jpeg', 0.88);
        });
        const token = await csrfToken();
        const form = new FormData();
        form.append('avatar', blob, 'profile.jpg');
        form.append('csrf_token', token);
        await getJSON(endpoint, { method: 'POST', body: form });
        closeDialog();
        showPhoto();
        toast('Profile photo saved.');
      } catch (error) {
        toast('Could not save photo: ' + error.message);
      } finally {
        busy = false;
        if (dialog) {
          saveButton.disabled = false;
          cancelButton.disabled = false;
          saveButton.textContent = 'Save photo';
        }
      }
    });
    saveButton.focus();
  }

  filePicker.addEventListener('change', () => {
    const selected = filePicker.files && filePicker.files[0];
    filePicker.value = ''; // Allow re-selecting the same image after cancel.
    if (selected) openCrop(selected);
  });
  frame.addEventListener('click', openMenu);
  frame.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); openMenu();
    }
  });
  cameraButton.addEventListener('click', event => { event.stopPropagation(); openMenu(); });

  Promise.all([
    getJSON(accountEndpoint),
    getJSON(endpoint + '?status=1')
  ]).then(([accountResult, pictureResult]) => {
    const account = accountResult.account;
    if (!account) throw new Error('Student account not found');
    initialsElement.textContent = initials(account.first_name, account.last_name);
    frame.setAttribute('aria-label', initialsElement.textContent+' Profile photo options');
    if (pictureResult.has_photo) showPhoto();
    else showInitials();
  }).catch(error => {
    // Do not display a sample user's image or initials if session is invalid.
    initialsElement.textContent = '?';
    frame.setAttribute('aria-label', '? Profile photo options');
    showInitials();
    console.error('AttachLink avatar:', error);
    toast('Profile picture unavailable. Please check your login and XAMPP server.');
  });
})();
