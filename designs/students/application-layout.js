// Position the application packet and cover letter beside the opening details.
(() => {
  'use strict';
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
    const documentPack = document.getElementById('al-application-packet');
    if (!grid || !button || !documentPack) return false;
    if (grid.dataset.al10eReady === 'true') return true;

    const left = Array.from(grid.children).find(child => child.tagName.toLowerCase() === 'section');
    const right = Array.from(grid.children).find(child => child.tagName.toLowerCase() === 'aside');
    if (!left || !right) return false;
    const applicationCard = button.closest('section');
    const overview = Array.from(left.children).find(child => matchesHeading(child, 'role overview'));
    const requirements = Array.from(left.children).find(child => matchesHeading(child, 'requirements'));
    if (!applicationCard || !overview || !requirements || !right.contains(applicationCard)) return false;

    // Move the existing cards and preserve their event listeners.
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

    // Show the packet before the optional cover letter.
    const coverLetter = document.getElementById('listing-cover-letter');
    if (coverLetter && applicationCard.contains(coverLetter)) {
      const coverLabel = coverLetter.previousElementSibling;
      const anchor = coverLabel && coverLabel.tagName === 'LABEL' ? coverLabel : coverLetter;
      applicationCard.insertBefore(documentPack, anchor);
      if (coverLabel && coverLabel.tagName === 'LABEL') coverLabel.classList.add('al10e-cover-label');
      coverLetter.classList.add('al10e-cover-textarea');
    }

    grid.dataset.al10eReady = 'true';
    return true;
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
