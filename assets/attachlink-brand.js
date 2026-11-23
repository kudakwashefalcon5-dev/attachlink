/* Use the bundled brand image on portal pages that already include this script. */
(() => {
  const script = document.currentScript;
  if (!script) return;
  const logo = new URL('../designs/employers/attachlink-logo.svg', script.src);
  for (const image of document.querySelectorAll('img[alt="AttachLink Logo" i]')) {
    image.src = logo.href;
  }
})();
