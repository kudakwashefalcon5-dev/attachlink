/* AttachLink Stage 10E — document form layout only.
   Preserves the existing Stitch HTML, IDs, session, Stage 6 listing APIs,
   Stage 10D document uploader and form submission listener.
   Requires: stage10d-application-documents.js already installed.
*/
(() => {
  'use strict';
  const SCRIPT_NAME = 'stage10e-application-layout.js';
  const CLASS = 'al10e';
  const scriptUrl = document.currentScript && document.currentScript.src;

  // Use a separate same-origin stylesheet, not a development CDN.
  if (scriptUrl && !document.getElementById(`${CLASS}-css`)) {
    const stylesheet = document.createElement('link');
    stylesheet.id = `${CLASS}-css`;
    stylesheet.rel = 'stylesheet';
    stylesheet.href = new URL('stage10e-application-layout.css', scriptUrl).href;
    document.head.appendChild(stylesheet);
  }

  function matchesHeading(element, phrase) {
    return Array.from(element.querySelectorAll('h1,h2,h3'))
      .some(heading => heading.textContent.trim().toLowerCase().includes(phrase));
  }

  function mount() {
    const grid = document.getElementById('listing-page');
    const button = document.getElementById('listing-apply');
    const documentPack = document.getElementById('al-stage10d-documents');
    if (!grid || !button || !documentPack) return false;
    if (grid.dataset.al10eReady === 'true') return true;

    const left = Array.from(grid.children).find(child => child.tagName.toLowerCase() === 'section');
    const right = Array.from(grid.children).find(child => child.tagName.toLowerCase() === 'aside');
    if (!left || !right) return false;
    const applicationCard = button.closest('section');
    const overview = Array.from(left.children).find(child => matchesHeading(child, 'role overview'));
    const requirements = Array.from(left.children).find(child => matchesHeading(child, 'requirements'));
    if (!applicationCard || !overview || !requirements || !right.contains(applicationCard)) return false;

    // MOVE the actual nodes, never copy or recreate the upload inputs.
    // This retains every existing event listener and FormData file selection.
    left.insertBefore(applicationCard, overview);
    const rightAnchor = right.firstElementChild;
    right.insertBefore(overview, rightAnchor);
    right.insertBefore(requirements, rightAnchor);

    applicationCard.classList.add('al10e-application-card');
    overview.classList.add('al10e-info-card');
    requirements.classList.add('al10e-info-card');
    documentPack.classList.add('al10e-document-pack');
    grid.classList.add('al10e-detail-layout');

    const title = applicationCard.querySelector('h2');
    if (title) title.classList.add('al10e-application-title');

    // Put uploads ahead of the optional cover letter without changing its ID.
    const coverLetter = document.getElementById('listing-cover-letter');
    if (coverLetter && applicationCard.contains(coverLetter)) {
      const coverLabel = coverLetter.previousElementSibling;
      const anchor = coverLabel && coverLabel.tagName === 'LABEL' ? coverLabel : coverLetter;
      applicationCard.insertBefore(documentPack, anchor);
      if (coverLabel && coverLabel.tagName === 'LABEL') coverLabel.classList.add('al10e-cover-label');
      coverLetter.classList.add('al10e-cover-textarea');
    }

    const heading = documentPack.querySelector('h3');
    if (heading) heading.textContent = 'Application documents';
    const intro = documentPack.querySelector('p');
    if (intro) intro.textContent = 'Attach clear, legible copies. Five documents are required. Additional certificates are optional. PDF, JPG or PNG • maximum 5 MB per file.';

    const labels = Array.from(documentPack.querySelectorAll('label'))
      .filter(label => label.querySelector('input[type="file"]'));
    const compulsory = labels.filter(label => label.querySelector('input[type="file"]').required);
    const optional = labels.filter(label => !label.querySelector('input[type="file"]').required);

    const progress = document.createElement('div');
    progress.className = 'al10e-upload-progress';
    progress.setAttribute('role', 'status');
    progress.setAttribute('aria-live', 'polite');

    const bar = document.createElement('div');
    bar.className = 'al10e-progress-track';
    const fill = document.createElement('div');
    fill.className = 'al10e-progress-fill';
    bar.appendChild(fill);
    const progressText = document.createElement('span');
    progressText.className = 'al10e-progress-caption';
    progress.append(progressText, bar);
    if (intro) intro.insertAdjacentElement('afterend', progress);
    else documentPack.prepend(progress);

    // Each existing native file input remains untouched, so Stage 10D works.
    const requiredGrid = document.createElement('div');
    requiredGrid.className = 'al10e-upload-grid';
    compulsory.forEach((label, index) => decorateField(label, true, index + 1, requiredGrid));
    documentPack.appendChild(requiredGrid);

    if (optional.length) {
      const extras = document.createElement('details');
      extras.className = 'al10e-optional-area';
      const summary = document.createElement('summary');
      summary.textContent = 'Additional certificates (optional)';
      const optionalGrid = document.createElement('div');
      optionalGrid.className = 'al10e-upload-grid al10e-optional-grid';
      optional.forEach((label, index) => decorateField(label, false, index + 1, optionalGrid));
      extras.append(summary, optionalGrid);
      documentPack.appendChild(extras);
    }

    function update() {
      const count = compulsory.filter(label => {
        const input = label.querySelector('input[type="file"]');
        return input && input.files && input.files.length > 0;
      }).length;
      progressText.textContent = `${count} of ${compulsory.length} required documents selected`;
      fill.style.width = compulsory.length ? `${100 * count / compulsory.length}%` : '0%';
      progress.classList.toggle('al10e-all-attached', count === compulsory.length && count > 0);
    }

    // Only the visual status is updated. Validation and upload remain with Stage 10D.
    labels.forEach(label => {
      const input = label.querySelector('input[type="file"]');
      const state = label.querySelector('.al10e-file-state');
      const refresh = () => {
        const file = input.files && input.files[0];
        label.classList.toggle('al10e-has-file', Boolean(file));
        if (state) {
          state.textContent = file
            ? `${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB`
            : 'No file selected';
          if (file) state.title = file.name;
        }
        update();
      };
      input.addEventListener('change', refresh);
      refresh();
    });

    grid.dataset.al10eReady = 'true';
    console.info('[AttachLink Stage 10E] Form layout activated (left); role overview and requirements moved right.');
    return true;
  }

  function decorateField(label, required, number, destination) {
    label.classList.add('al10e-upload-field');
    const name = label.querySelector('span');
    if (name) {
      name.classList.add('al10e-upload-name');
      // Asterisk remains visible to assistive technologies; no duplicate title.
      const chip = document.createElement('small');
      chip.className = 'al10e-field-chip';
      chip.textContent = required ? 'Required' : 'Optional';
      name.appendChild(chip);
    }
    const state = document.createElement('span');
    state.className = 'al10e-file-state';
    state.textContent = 'No file selected';
    label.appendChild(state);
    destination.appendChild(label);
  }

  function init() {
    if (mount()) return;
    // Handles older script ordering without running continuously.
    const root = document.getElementById('listing-page');
    if (!root) return;
    const observer = new MutationObserver(() => {
      if (mount()) observer.disconnect();
    });
    observer.observe(root, {childList:true, subtree:true});
    window.addEventListener('pagehide', () => observer.disconnect(), {once:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
