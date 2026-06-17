/**
 * Presentation preview bootstrap: early Studio handshake and local visual-editing bundle.
 * Build the bundle with `npm run build:visual-editing` in studio-sdv-site.
 */
(function (global) {
  'use strict';

  function isPreview() {
    try {
      var qs = new URLSearchParams(global.location.search || '');
      return qs.get('sdvPreview') === '1' || qs.has('sanity-preview-perspective');
    } catch (e) {
      return false;
    }
  }

  if (!isPreview()) return;

  function respondToPresentationStatus(event) {
    var data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.domain !== 'sanity/channels' || data.from !== 'presentation') return;
    if (data.type !== 'presentation/status') return;
    try {
      global.parent.postMessage(
        {
          domain: 'sanity/channels',
          type: 'visual-editing/status',
          data: { origin: global.location.origin },
        },
        event.origin,
      );
    } catch (e) { }
  }

  global.addEventListener('message', respondToPresentationStatus);

  var root = 'js/';
  var scripts = global.document.getElementsByTagName('script');
  for (var i = 0; i < scripts.length; i++) {
    var src = scripts[i].src || '';
    if (src.indexOf('presentation-boot.js') !== -1) {
      root = src.replace(/presentation-boot\.js(?:\?.*)?$/, '');
      break;
    }
  }

  var bundleUrl = root + 'sanity-visual-editing.bundle.js';

  global.SDVVisualEditingReady = new Promise(function (resolve, reject) {
    function finish() {
      if (global.SDVVisualEditing && typeof global.SDVVisualEditing.enableVisualEditing === 'function') {
        resolve(global.SDVVisualEditing);
        return;
      }
      reject(new Error('Visual editing bundle loaded without enableVisualEditing export'));
    }

    try {
      var head = global.document.head || global.document.getElementsByTagName('head')[0];
      if (head && !global.document.querySelector('link[data-sdv-ve-preload]')) {
        var preload = global.document.createElement('link');
        preload.rel = 'preload';
        preload.as = 'script';
        preload.href = bundleUrl;
        preload.setAttribute('data-sdv-ve-preload', '1');
        head.appendChild(preload);
      }
    } catch (e) { }

    var existing = global.document.querySelector('script[data-sdv-ve-bundle="1"]');
    if (existing) {
      if (global.SDVVisualEditing && typeof global.SDVVisualEditing.enableVisualEditing === 'function') {
        resolve(global.SDVVisualEditing);
        return;
      }
      existing.addEventListener('load', finish);
      existing.addEventListener('error', function () {
        reject(new Error('Visual editing bundle failed to load'));
      });
      return;
    }

    var s = global.document.createElement('script');
    s.src = bundleUrl;
    s.async = false;
    s.setAttribute('data-sdv-ve-bundle', '1');
    s.onload = finish;
    s.onerror = function () {
      reject(new Error('Visual editing bundle failed to load'));
    };
    global.document.head.appendChild(s);
  });
})(window);
