/**
 * Presentation preview bootstrap: early Studio handshake, visual-editing bundle, comlink.
 * Build the bundle with `npm run build:visual-editing` in sanity-studio.
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

  try {
    global.document.documentElement.classList.add('sdv-preview');
  } catch (e) { }

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

  function pathUrl() {
    return (
      '' +
      (global.location.pathname || '') +
      (global.location.search || '') +
      (global.location.hash || '')
    );
  }

  function installVisualEditing(mod) {
    if (global.__SDV_VE_INSTALLED) return;
    var enable = mod.enableVisualEditing || (mod.default && mod.default.enableVisualEditing);
    if (!enable) {
      console.warn('[sdv] enableVisualEditing missing from visual editing bundle');
      return;
    }
    global.__SDV_VE_INSTALLED = true;
    global.__SDV_VE_DISABLE = enable({
      zIndex: 2147483000,
      history: {
        subscribe: function (navigate) {
          global.__SDV_VE_NAVIGATE = navigate;
          function syncToPresentation() {
            try {
              navigate({ type: 'push', url: pathUrl() });
            } catch (e) { }
          }
          queueMicrotask(syncToPresentation);
          var retryT = setTimeout(syncToPresentation, 120);
          function onPopState() {
            syncToPresentation();
          }
          global.addEventListener('popstate', onPopState);
          global.addEventListener('hashchange', syncToPresentation);
          function onPageShow(ev) {
            if (ev && ev.persisted) syncToPresentation();
          }
          global.addEventListener('pageshow', onPageShow);
          return function () {
            clearTimeout(retryT);
            global.removeEventListener('popstate', onPopState);
            global.removeEventListener('hashchange', syncToPresentation);
            global.removeEventListener('pageshow', onPageShow);
          };
        },
        update: function (update) {
          switch (update.type) {
            case 'push':
              return global.history.pushState(null, '', update.url);
            case 'pop':
              return global.history.back();
            case 'replace':
              return global.history.replaceState(null, '', update.url);
            default:
              console.warn('[sdv] Unhandled visual-editing history update', update);
          }
        },
      },
      refresh: function (payload) {
        if (global.__SDV_VE_REFRESH) {
          return global.__SDV_VE_REFRESH(payload);
        }
        if (payload && payload.source === 'manual') {
          global.location.reload();
          return Promise.resolve();
        }
        return Promise.resolve();
      },
    });
    try {
      global.dispatchEvent(new CustomEvent('sdv:visual-editing-ready'));
    } catch (e) { }
  }

  global.SDVVisualEditingReady = new Promise(function (resolve, reject) {
    function finish() {
      if (global.SDVVisualEditing && typeof global.SDVVisualEditing.enableVisualEditing === 'function') {
        installVisualEditing(global.SDVVisualEditing);
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
        finish();
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

  global.SDVVisualEditingReady.catch(function (err) {
    console.warn(
      '[sdv] Visual editing bundle failed:',
      err && err.message ? err.message : err,
      '— run npm run build:visual-editing in sanity-studio',
    );
  });
})(window);
