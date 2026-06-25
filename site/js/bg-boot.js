/**
 * Apply last-known page background before CSS paints to reduce flash of default --bg.
 * content-loader.js updates sessionStorage when Sanity colors load.
 */
(function () {
  'use strict';
  var PREFIX = 'sdv.bg';
  try {
    var path = String(window.location.pathname || '/');
    var storageKey = PREFIX;
    var projectMatch = path.match(/\/project\/([^/]+)/);
    var immersiveMatch = path.match(/\/immersive\/([^/]+)/);
    if (projectMatch) storageKey = PREFIX + '.project.' + projectMatch[1];
    else if (immersiveMatch) storageKey = PREFIX + '.immersive.' + immersiveMatch[1];

    var cached = sessionStorage.getItem(storageKey) || sessionStorage.getItem(PREFIX);
    if (cached && /^#[0-9a-fA-F]{6}$/.test(cached)) {
      document.documentElement.style.setProperty('--bg', cached);
    }
  } catch (e) { }
})();
