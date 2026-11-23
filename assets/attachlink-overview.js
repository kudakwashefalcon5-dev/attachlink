(() => {
  'use strict';
  function node(tag, classes, value) {
    const element = document.createElement(tag);
    if (classes) element.className = classes;
    if (value !== undefined) element.textContent = value;
    return element;
  }
  function metrics(items) {
    const grid = node('div', 'al-metric-grid');
    const format = new Intl.NumberFormat();
    for (const [label, icon, value] of items) {
      const tile = node('article', 'al-metric');
      const symbol = node('span', 'al-metric-icon material-symbols-outlined', icon);
      symbol.setAttribute('aria-hidden', 'true');
      tile.append(symbol, node('span', 'al-metric-label', label), node('strong', 'al-metric-value', value == null ? '—' : format.format(Number(value))));
      grid.append(tile);
    }
    return grid;
  }
  function actions(items) {
    const nav = node('div', 'al-overview-actions');
    for (const [label, href] of items) {
      const link = node('a', '', label);
      link.href = href;
      nav.append(link);
    }
    return nav;
  }
  window.AttachLinkOverview = {node, metrics, actions};
})();
