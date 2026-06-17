/**
 * Page interactions:
 * - Home: materials filter + INFO slide panel toggle
 * - Project: split controls + publication-tab magnifier gating + image lightbox
 * - Immersive: flyer (loupe + pan/zoom) with prev/next images from SDV_FLYER_IMAGES
 *
 * Depends on sdv-shared.js (window.SDV). content-loader.js dispatches:
 * - sdv:materials
 * - sdv:immersive-ready (detail.slug)
 * - sdv:project-tab (detail.isPublication)
 * - sdv:lightbox-open (detail.urls, detail.index)
 */
(function () {
  'use strict';

  var SDV = window.SDV;
  if (!SDV || typeof SDV.assetUrl !== 'function') {
    console.warn('[sdv] sdv-shared.js must load before app.js');
    return;
  }

  var assetUrl = SDV.assetUrl;
  var withPreviewQuery = SDV.withPreviewQuery;
  var materialIconSvg = SDV.materialIconSvg;
  var immersiveImagePreviewUrl = SDV.immersiveImagePreviewUrl;

  function immersiveSlugFromPath() {
    var p = window.location.pathname || '';
    var m = p.match(/\/immersive\/([^/]+)\/?$/);
    return m && m[1] ? String(m[1]) : '';
  }

  var currentImmersiveSlug = '';

  /* --- Home --- */

  function getHomeMaterialsData() {
    var all =
      window.SDV_ALL_MATERIALS && Array.isArray(window.SDV_ALL_MATERIALS)
        ? window.SDV_ALL_MATERIALS
        : [];
    var bySlug =
      window.SDV_PROJECT_MATERIALS && typeof window.SDV_PROJECT_MATERIALS === 'object'
        ? window.SDV_PROJECT_MATERIALS
        : {};
    return { all: all, bySlug: bySlug };
  }

  function isHomeDesktop() {
    return !!(window.matchMedia && window.matchMedia('(min-width: 600px)').matches);
  }

  function ensureProjectIconHosts() {
    document.querySelectorAll('.home-project').forEach(function (btn) {
      if (!btn.querySelector('.home-project-label')) {
        var labelText = btn.textContent || '';
        btn.textContent = '';
        var labelSpan = document.createElement('span');
        labelSpan.className = 'home-project-label';
        labelSpan.textContent = labelText;
        btn.appendChild(labelSpan);
      }
      if (btn.querySelector('.home-project-material-icons')) return;
      var wrap = document.createElement('span');
      wrap.className = 'home-project-material-icons';
      wrap.setAttribute('aria-hidden', 'true');
      btn.appendChild(wrap);
    });
  }

  function renderHomeMaterialIcons(selectedKeys) {
    ensureProjectIconHosts();
    var data = getHomeMaterialsData();
    var selected = new Set(selectedKeys || []);
    var order = {};
    (data.all || []).forEach(function (m, i) {
      if (m && m.key) order[m.key] = i;
    });

    document.querySelectorAll('.home-project').forEach(function (btn) {
      var slug = btn.getAttribute('data-slug') || '';
      var host = btn.querySelector('.home-project-material-icons');
      if (!host) return;

      if (!selected.size || !isHomeDesktop()) {
        host.innerHTML = '';
        return;
      }

      var mats =
        data.bySlug[slug] && Array.isArray(data.bySlug[slug].materials)
          ? data.bySlug[slug].materials
          : [];
      var html = '';
      mats
        .slice()
        .sort(function (a, b) {
          var ia = a && a.key && order[a.key] != null ? order[a.key] : 1e9;
          var ib = b && b.key && order[b.key] != null ? order[b.key] : 1e9;
          return ia - ib;
        })
        .forEach(function (m) {
        if (!m || !m.key) return;
        if (!selected.has(m.key)) return;
        html += materialIconSvg(m.key);
      });
      host.innerHTML = html;
    });
  }

  function renderHomeMaterialToggle() {
    var host = document.getElementById('home-material-filter');
    if (!host) return;

    var data = getHomeMaterialsData();
    if (!data.all.length) {
      host.innerHTML = '';
      return;
    }

    var storageKey = 'sdv.homeMaterials.selected';
    var selected = new Set();
    try {
      var raw = localStorage.getItem(storageKey);
      var parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) {
        parsed.forEach(function (k) {
          if (k) selected.add(String(k));
        });
      }
    } catch (e) {}

    var allowed = new Set(
      data.all.map(function (m) {
        return m.key;
      }),
    );
    Array.from(selected).forEach(function (k) {
      if (!allowed.has(k)) selected.delete(k);
    });

    function labelForKey(key) {
      var hit = data.all.find(function (m) {
        return m.key === key;
      });
      return hit ? hit.label : key;
    }

    function selectedSummary() {
      if (!selected.size) return 'None selected';
      return data.all
        .filter(function (m) {
          return selected.has(m.key);
        })
        .map(function (m) {
          return m.label;
        })
        .join(', ');
    }

    function rerender() {
      renderHomeMaterialIcons(Array.from(selected));
      if (host.dataset.bound === '1') {
        host.querySelectorAll('.home-material-btn').forEach(function (btn) {
          btn.classList.toggle('is-on', selected.has(btn.dataset.materialKey));
          btn.setAttribute(
            'aria-pressed',
            selected.has(btn.dataset.materialKey) ? 'true' : 'false',
          );
        });
        var status = host.querySelector('.home-material-status');
        if (status) status.textContent = selectedSummary();
      }
      try {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(selected)));
      } catch (e) {}
    }

    if (host.dataset.bound === '1') {
      rerender();
      return;
    }
    host.dataset.bound = '1';

    var html =
      '' +
      '<div class="home-material-meta">' +
      '  <div class="home-material-title">Materials</div>' +
      '  <div class="home-material-status" aria-live="polite"></div>' +
      '</div>' +
      '<div class="home-material-row" role="group" aria-label="Filter by material">';
    data.all.forEach(function (m) {
      html +=
        '<button type="button" class="home-material-btn" data-material-key="' +
        m.key +
        '" aria-pressed="false" title="' +
        String(m.label).replace(/"/g, '&quot;') +
        '" aria-label="' +
        String(m.label).replace(/"/g, '&quot;') +
        '">' +
        materialIconSvg(m.key) +
        '</button>';
    });
    html += '</div>';
    host.innerHTML = html;

    host.addEventListener('mouseover', function (e) {
      var t = e.target;
      var btn = t && t.closest ? t.closest('.home-material-btn') : null;
      if (!btn) return;
      var key = btn.dataset.materialKey;
      if (!key) return;
      var status = host.querySelector('.home-material-status');
      if (status)
        status.textContent = (selected.has(key) ? 'Selected: ' : 'Filter: ') + labelForKey(key);
    });

    host.addEventListener('mouseleave', function () {
      var status = host.querySelector('.home-material-status');
      if (status) status.textContent = selectedSummary();
    });

    host.addEventListener('focusin', function (e) {
      var t = e.target;
      var btn = t && t.closest ? t.closest('.home-material-btn') : null;
      if (!btn) return;
      var key = btn.dataset.materialKey;
      if (!key) return;
      var status = host.querySelector('.home-material-status');
      if (status)
        status.textContent = (selected.has(key) ? 'Selected: ' : 'Filter: ') + labelForKey(key);
    });

    host.addEventListener('focusout', function () {
      var status = host.querySelector('.home-material-status');
      if (status) status.textContent = selectedSummary();
    });

    host.addEventListener('click', function (e) {
      var t = e.target;
      var btn = t && t.closest ? t.closest('.home-material-btn') : null;
      if (!btn) return;
      var key = btn.dataset.materialKey;
      if (!key) return;
      if (selected.has(key)) selected.delete(key);
      else selected.add(key);
      rerender();
    });

    rerender();
  }

  function bindHomeIconsViewportSync() {
    if (document.documentElement.dataset.homeIconsMqBound === '1') return;
    document.documentElement.dataset.homeIconsMqBound = '1';
    if (!window.matchMedia) return;
    var mq = window.matchMedia('(min-width: 600px)');
    function onChange() {
      renderHomeMaterialToggle();
    }
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange);
    } else if (typeof mq.addListener === 'function') {
      mq.addListener(onChange);
    }
  }

  function initHomeInfoToggle() {
    var view = document.querySelector('.view--home');
    var btn = document.getElementById('home-info-btn');
    var panel = document.getElementById('home-info-panel');
    if (!view || !btn || !panel) return;
    if (btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';

    // Once info opens, project names stay hidden and the SDV mark remains (desktop).
    var INFO_PANEL_MS = 360;
    if (view.dataset.infoShelved === '1') {
      view.classList.add('is-info-shelved', 'is-info-sdv-visible');
    }

    function setOpen(next) {
      var open = !!next;
      view.classList.toggle('is-info-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      panel.setAttribute('aria-hidden', open ? 'false' : 'true');
      btn.textContent = open ? 'CLOSE' : 'INFO';

      if (open && view.dataset.infoShelved !== '1') {
        view.dataset.infoShelved = '1';
        window.setTimeout(function () {
          view.classList.add('is-info-shelved', 'is-info-sdv-visible');
        }, INFO_PANEL_MS);
      }
    }

    btn.addEventListener('click', function () {
      var open = view.classList.contains('is-info-open');
      setOpen(!open);
    });

    setOpen(false);
  }

  /* --- Project: publication tab --- */

  function initProjectPublicationGate() {
    var view = document.querySelector('.view--project');
    if (!view) return;
    if (view.dataset.pubGateBound === '1') return;
    view.dataset.pubGateBound = '1';

    function syncFromCurrentTab() {
      /* Timeline may render after this listener is registered. */
      var current = document.querySelector('.project-timeline__item[aria-current="true"]');
      var isPub = !!(current && current.dataset && current.dataset.isPublication === 'true');
      view.classList.toggle('is-publication-tab', isPub);
    }

    window.addEventListener('sdv:project-tab', function (ev) {
      var isPub = !!(ev && ev.detail && ev.detail.isPublication);
      view.classList.toggle('is-publication-tab', isPub);
    });

    syncFromCurrentTab();
    for (var i = 0; i < 20; i++) {
      setTimeout(syncFromCurrentTab, i * 50);
    }
  }

  /* --- Project: image lightbox --- */

  var lightboxState = {
    open: false,
    urls: [],
    index: 0,
    touchX: 0,
    touchY: 0,
  };

  function ensureLightbox() {
    if (document.getElementById('image-lightbox')) return;
    var el = document.createElement('div');
    el.className = 'image-lightbox';
    el.id = 'image-lightbox';
    el.setAttribute('hidden', '');
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.innerHTML =
      '' +
      '<img class="image-lightbox__img" alt="" />' +
      '<button type="button" class="image-lightbox__close" aria-label="Close image viewer">CLOSE</button>';
    document.body.appendChild(el);

    function clickInsideImage(e) {
      var img = el.querySelector('.image-lightbox__img');
      if (!img) return false;
      var rect = img.getBoundingClientRect();
      var x = typeof e.clientX === 'number' ? e.clientX : 0;
      var y = typeof e.clientY === 'number' ? e.clientY : 0;
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    }

    function sideForClick(e) {
      var img = el.querySelector('.image-lightbox__img');
      if (!img) return 'center';
      var rect = img.getBoundingClientRect();
      var x = typeof e.clientX === 'number' ? e.clientX : 0;
      var center = rect.left + rect.width / 2;
      var margin = rect.width * 0.08; // ignore clicks near center
      if (Math.abs(x - center) < margin) return 'center';
      return x < center ? 'prev' : 'next';
    }

    el.addEventListener('click', function (e) {
      if (!lightboxState.open) return;

      var t = e.target;
      if (t && t.closest && t.closest('.image-lightbox__close')) {
        e.stopPropagation();
        closeLightbox();
        return;
      }

      if (!clickInsideImage(e)) {
        closeLightbox();
        return;
      }

      var side = sideForClick(e);
      if (side === 'prev') lightboxPrev();
      else if (side === 'next') lightboxNext();
    });

    var closeBtn = el.querySelector('.image-lightbox__close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        closeLightbox();
      });
    }

    function setLightboxCursor(kind) {
      el.classList.remove('is-cursor-prev', 'is-cursor-next', 'is-cursor-default');
      if (kind === 'prev') el.classList.add('is-cursor-prev');
      else if (kind === 'next') el.classList.add('is-cursor-next');
      else el.classList.add('is-cursor-default');
    }

    /* Directional prev/next cursor over the image only. */
    el.addEventListener('mousemove', function (e) {
      if (!lightboxState.open) return;
      var img = el.querySelector('.image-lightbox__img');
      if (!img) return;
      var rect = img.getBoundingClientRect();
      var x = e.clientX;
      var y = e.clientY;
      var inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      if (!inside) {
        setLightboxCursor('default');
        return;
      }
      var center = rect.left + rect.width / 2;
      var margin = rect.width * 0.08;
      if (Math.abs(x - center) < margin) {
        setLightboxCursor('default');
        return;
      }
      setLightboxCursor(x < center ? 'prev' : 'next');
    });
    el.addEventListener('mouseleave', function () {
      setLightboxCursor('default');
    });

    el.addEventListener(
      'touchstart',
      function (e) {
        var t = e.touches && e.touches[0];
        if (!t) return;
        lightboxState.touchX = t.clientX;
        lightboxState.touchY = t.clientY;
      },
      { passive: true },
    );

    el.addEventListener(
      'touchend',
      function (e) {
        var t = e.changedTouches && e.changedTouches[0];
        if (!t) return;
        var dx = t.clientX - lightboxState.touchX;
        var dy = t.clientY - lightboxState.touchY;
        if (Math.abs(dx) < 52 || Math.abs(dx) <= Math.abs(dy)) return;
        if (dx < 0) lightboxNext();
        else lightboxPrev();
      },
      { passive: true },
    );
  }

  function lightboxEl() {
    return document.getElementById('image-lightbox');
  }

  function renderLightbox() {
    var el = lightboxEl();
    if (!el) return;
    var img = el.querySelector('.image-lightbox__img');
    var urls = lightboxState.urls || [];
    var idx = lightboxState.index || 0;
    if (!urls.length || !img) return;
    if (idx < 0) idx = 0;
    if (idx >= urls.length) idx = urls.length - 1;
    lightboxState.index = idx;
    img.src = urls[idx];
  }

  function openLightbox(urls, index) {
    ensureLightbox();
    var el = lightboxEl();
    if (!el) return;
    lightboxState.open = true;
    lightboxState.urls = Array.isArray(urls) ? urls.slice() : [];
    lightboxState.index = typeof index === 'number' ? index : 0;
    el.removeAttribute('hidden');
    el.classList.add('is-cursor-default');
    renderLightbox();
  }

  function closeLightbox() {
    var el = lightboxEl();
    if (!el) return;
    lightboxState.open = false;
    el.classList.remove('is-cursor-prev', 'is-cursor-next', 'is-cursor-default');
    el.setAttribute('hidden', '');
  }

  function lightboxPrev() {
    if (!lightboxState.urls.length) return;
    lightboxState.index =
      (lightboxState.index - 1 + lightboxState.urls.length) % lightboxState.urls.length;
    renderLightbox();
  }

  function lightboxNext() {
    if (!lightboxState.urls.length) return;
    lightboxState.index = (lightboxState.index + 1) % lightboxState.urls.length;
    renderLightbox();
  }

  function bindLightboxGlobalKeys() {
    if (document.documentElement.dataset.lightboxKeysBound === '1') return;
    document.documentElement.dataset.lightboxKeysBound = '1';
    document.addEventListener('keydown', function (e) {
      if (!lightboxState.open) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeLightbox();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        lightboxPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        lightboxNext();
      }
    });
  }

  /* --- Project: split controls --- */

  function initProjectSplitFocusToggle() {
    var split = document.getElementById('project-split');
    if (!split) return;

    var view = document.querySelector('.view--project');
    var controls = document.querySelector('.project-zoom-controls');
    if (!controls) return;

    var up = controls.querySelector('[data-split-shift="up"]');
    var down = controls.querySelector('[data-split-shift="down"]');
    if (!up || !down) return;

    if (controls.dataset.bound === '1') return;
    controls.dataset.bound = '1';

    var MODES = ['text', 'balanced', 'images'];

    function normalizeMode(raw) {
      var m = String(raw || '').toLowerCase();
      if (MODES.indexOf(m) !== -1) return m;
      return 'balanced';
    }

    function setMode(mode) {
      var m = normalizeMode(mode);
      split.dataset.split = m;
      if (view) view.dataset.split = m;
      up.disabled = m === 'text';
      down.disabled = m === 'images';
    }

    function shift(dir) {
      if (!isMobileMode()) return;
      var current = normalizeMode(split.dataset.split);
      var idx = MODES.indexOf(current);
      if (idx === -1) idx = 1;
      var next = dir === 'up' ? Math.max(0, idx - 1) : Math.min(MODES.length - 1, idx + 1);
      setMode(MODES[next]);
    }

    up.addEventListener('click', function () {
      shift('up');
    });
    down.addEventListener('click', function () {
      shift('down');
    });

    function isMobileMode() {
      return !!(window.matchMedia && window.matchMedia('(max-width: 599px)').matches);
    }

    function syncEnabledState() {
      var mobile = isMobileMode();
      up.disabled = !mobile || normalizeMode(split.dataset.split) === 'text';
      down.disabled = !mobile || normalizeMode(split.dataset.split) === 'images';
      if (!mobile) {
        setMode('balanced');
      } else {
        setMode(normalizeMode(split.dataset.split || 'balanced'));
      }
    }

    if (window.matchMedia) {
      var mq = window.matchMedia('(max-width: 599px)');
      if (mq && typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', syncEnabledState);
      } else if (mq && typeof mq.addListener === 'function') {
        mq.addListener(syncEnabledState);
      }
    }

    setMode('balanced');
    syncEnabledState();
  }

  /* --- Immersive: flyer loupe --- */

  /* Loupe magnification = base × scan zoom (base is fixed). */
  var FLYER_LOUPE_BASE_MAG = 3.75;
  var FLYER_LENS_DEFAULT = 64;
  var FLYER_IMG_ZOOM_MIN = 0.45;
  var FLYER_IMG_ZOOM_MAX = 3.5;
  var PAN_SLACK_ZOOMED_IN = 28;
  var PAN_MIN_OVERLAP_ZOOMED_OUT = 56;
  var FLYER_PERSIST_KEY = 'sdv:flyer-v3';

  function runWhenIdle(cb) {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(
        function () {
          cb();
        },
        { timeout: 5000 },
      );
    } else {
      setTimeout(cb, 2200);
    }
  }

  function isFlyerCoarsePointer() {
    try {
      return window.matchMedia('(pointer: coarse)').matches;
    } catch (e) {
      return false;
    }
  }

  var overlockedFlyerPtrMap = new Map();
  var overlockedFlyerMulti = null;
  var overlockedFlyerCoarseDocBound = false;

  function loadFlyerPersisted() {
    try {
      var raw = sessionStorage.getItem(FLYER_PERSIST_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || o.v !== 3 || typeof o !== 'object') return null;
      return o;
    } catch (err) {
      return null;
    }
  }

  /** Delegates to the active flyer instance (supports immersive re-entry). */
  var flyerUi = {
    onResize: function () {},
    prev: function () {},
    next: function () {},
    zoomIn: function () {},
    zoomOut: function () {},
    actionClickBound: false,
    globalBound: false,
  };
  var flyerDrag = {
    active: false,
    lastX: 0,
    lastY: 0,
    inst: null,
    pointerId: null,
  };

  function flyerImages() {
    var g = window.SDV_FLYER_IMAGES;
    if (g && Array.isArray(g.images)) return g.images.filter(Boolean);
    return [];
  }

  function prefetchFlyerImages(urls) {
    if (!Array.isArray(urls)) return;
    urls.forEach(function (displayUrl) {
      if (!displayUrl) return;
      var previewUrl = immersiveImagePreviewUrl(displayUrl);
      [previewUrl, displayUrl].forEach(function (u) {
        if (!u) return;
        var im = new Image();
        im.decoding = 'async';
        im.src = u;
      });
    });
  }

  function initFlyer() {
    var roots = document.querySelectorAll('.immersive-flyer[data-flyer-root]');
    if (!roots.length) return;
    if (roots[0].getAttribute('data-flyer-bound') === '1') return;
    for (var ri = 0; ri < roots.length; ri++) {
      roots[ri].setAttribute('data-flyer-bound', '1');
    }

    var state = {
      panX: 0,
      panY: 0,
      imgZoom: 0.85,
      imageReady: false,
      ptr: false,
      ptrClientX: 0,
      ptrClientY: 0,
      sxf: 0.5,
      syf: 0.5,
      imageIndex: 0,
    };

    var persisted = loadFlyerPersisted();
    if (persisted) {
      if (typeof persisted.panX === 'number' && isFinite(persisted.panX)) state.panX = persisted.panX;
      if (typeof persisted.panY === 'number' && isFinite(persisted.panY)) state.panY = persisted.panY;
      if (typeof persisted.imgZoom === 'number' && isFinite(persisted.imgZoom)) {
        state.imgZoom = Math.min(FLYER_IMG_ZOOM_MAX, Math.max(FLYER_IMG_ZOOM_MIN, persisted.imgZoom));
      }
      if (typeof persisted.imageIndex === 'number' && isFinite(persisted.imageIndex)) {
        state.imageIndex = Math.max(0, Math.floor(persisted.imageIndex));
      }
    }

    function getInstances() {
      var list = [];
      roots.forEach(function (root) {
        list.push({
          root: root,
          viewport: root.querySelector('.immersive-flyer__viewport'),
          stage: root.querySelector('.immersive-flyer__stage'),
          pan: root.querySelector('.immersive-flyer__pan'),
          sheet: root.querySelector('.immersive-flyer__sheet'),
          loupe: root.querySelector('.immersive-flyer__loupe'),
          loupeStrip: root.querySelector('.immersive-flyer__loupe-strip'),
          loupeDisk: root.querySelector('.immersive-flyer__loupe-disk'),
          loupeRing: root.querySelector('.immersive-flyer__loupe-ring'),
        });
      });
      return list;
    }

    var instances = getInstances();

    instances.forEach(function (inst) {
      if (!inst.sheet) return;
      if (inst.sheet.querySelector('.immersive-flyer__transform-origin')) return;
      var mark = document.createElement('div');
      mark.className = 'immersive-flyer__transform-origin';
      mark.setAttribute('aria-hidden', 'true');
      inst.sheet.appendChild(mark);
    });

    function writePersist() {
      try {
        sessionStorage.setItem(
          FLYER_PERSIST_KEY,
          JSON.stringify({
            v: 3,
            panX: state.panX,
            panY: state.panY,
            imgZoom: state.imgZoom,
            imageIndex: state.imageIndex,
          }),
        );
      } catch (errW) {}
    }

    var persistTimer = null;
    function schedulePersist() {
      if (persistTimer) clearTimeout(persistTimer);
      persistTimer = setTimeout(function () {
        persistTimer = null;
        writePersist();
      }, 200);
    }

    function currentImageUrl() {
      var imgs = flyerImages();
      if (!imgs.length) return '';
      var i = state.imageIndex % imgs.length;
      if (i < 0) i += imgs.length;
      state.imageIndex = i;
      return imgs[i];
    }

    function imageMatchesUrl(im, url) {
      if (!im || !url) return false;
      var attr = im.getAttribute('src') || '';
      return attr === url || im.src === url || im.currentSrc === url;
    }

    function setFlyerLoading(loading) {
      instances.forEach(function (inst) {
        if (inst.root) inst.root.classList.toggle('is-image-loading', !!loading);
      });
    }

    function assignImagePair(mainImg, loupeImg, url) {
      if (!mainImg || !url) return;
      if (!imageMatchesUrl(mainImg, url)) mainImg.setAttribute('src', url);
      if (loupeImg && !imageMatchesUrl(loupeImg, url)) loupeImg.setAttribute('src', url);
    }

    function applyCurrentImage() {
      var displayUrl = currentImageUrl();
      if (!displayUrl) {
        state.imageReady = false;
        setFlyerLoading(false);
        return;
      }

      var previewUrl = immersiveImagePreviewUrl(displayUrl);
      var useProgressive = previewUrl && previewUrl !== displayUrl;

      instances.forEach(function (inst) {
        if (!inst.sheet) return;
        var mainImg = inst.sheet.querySelector('.immersive-flyer__img');
        var loupeImg = inst.loupeStrip ? inst.loupeStrip.querySelector('img') : null;
        if (!mainImg) return;

        function markReady(isPreview) {
          mainImg.classList.remove('is-loading');
          mainImg.classList.add('is-ready');
          mainImg.classList.toggle('is-preview', !!isPreview);
          state.imageReady = !isPreview;
          setFlyerLoading(false);
          clampPan();
          applyTransforms();
          updateLoupe();
        }

        if (
          imageMatchesUrl(mainImg, displayUrl) &&
          mainImg.complete &&
          mainImg.naturalWidth &&
          !mainImg.classList.contains('is-preview')
        ) {
          assignImagePair(mainImg, loupeImg, displayUrl);
          markReady(false);
          return;
        }

        state.imageReady = false;
        state.ptr = false;
        mainImg.classList.remove('is-ready', 'is-preview');
        mainImg.classList.add('is-loading');
        setFlyerLoading(true);
        if (loupeImg) loupeImg.removeAttribute('src');

        var loadDisplay = displayUrl;

        function onDisplayReady() {
          if (currentImageUrl() !== loadDisplay) return;
          assignImagePair(mainImg, loupeImg, loadDisplay);
          markReady(false);
        }

        function startDisplayFetch() {
          if (
            imageMatchesUrl(mainImg, loadDisplay) &&
            mainImg.complete &&
            mainImg.naturalWidth &&
            !mainImg.classList.contains('is-preview')
          ) {
            onDisplayReady();
            return;
          }
          var full = new Image();
          full.decoding = 'async';
          full.onload = function () {
            if (currentImageUrl() !== loadDisplay) return;
            onDisplayReady();
          };
          full.onerror = function () {
            if (currentImageUrl() !== loadDisplay) return;
            setFlyerLoading(false);
            mainImg.classList.remove('is-loading');
          };
          full.src = loadDisplay;
        }

        if (!useProgressive) {
          assignImagePair(mainImg, loupeImg, loadDisplay);
          function onSingleLoad() {
            if (currentImageUrl() !== loadDisplay) return;
            onDisplayReady();
            mainImg.removeEventListener('load', onSingleLoad);
            mainImg.removeEventListener('error', onSingleError);
          }
          function onSingleError() {
            if (currentImageUrl() !== loadDisplay) return;
            state.imageReady = false;
            setFlyerLoading(false);
            mainImg.classList.remove('is-loading');
            mainImg.removeEventListener('load', onSingleLoad);
            mainImg.removeEventListener('error', onSingleError);
            updateLoupe();
          }
          mainImg.addEventListener('load', onSingleLoad);
          mainImg.addEventListener('error', onSingleError);
          if (mainImg.complete && mainImg.naturalWidth) onSingleLoad();
          return;
        }

        var loadPreview = previewUrl;
        assignImagePair(mainImg, loupeImg, loadPreview);

        function onPreviewLoad() {
          if (currentImageUrl() !== loadDisplay) return;
          markReady(true);
          startDisplayFetch();
          mainImg.removeEventListener('load', onPreviewLoad);
          mainImg.removeEventListener('error', onPreviewError);
        }
        function onPreviewError() {
          if (currentImageUrl() !== loadDisplay) return;
          mainImg.removeEventListener('load', onPreviewLoad);
          mainImg.removeEventListener('error', onPreviewError);
          assignImagePair(mainImg, loupeImg, loadDisplay);
          startDisplayFetch();
        }

        mainImg.addEventListener('load', onPreviewLoad);
        mainImg.addEventListener('error', onPreviewError);
        if (mainImg.complete && mainImg.naturalWidth) onPreviewLoad();
      });
    }

    function clearDraggingUi() {
      instances.forEach(function (inst) {
        if (inst.viewport) inst.viewport.classList.remove('is-dragging');
      });
    }

    function applyTransforms() {
      instances.forEach(function (inst) {
        if (!inst.pan || !inst.sheet) return;
        inst.pan.style.transform = 'translate(' + state.panX + 'px,' + state.panY + 'px)';
        inst.sheet.style.transform = 'scale(' + state.imgZoom + ')';
        inst.sheet.style.transformOrigin = 'center center';
      });
    }

    /** object-fit: contain rect inside a layout box (iw×ih). */
    function getContainedImageRect(iw, ih, nw, nh) {
      if (!nw || !nh || !iw || !ih) return null;
      var scale = Math.min(iw / nw, ih / nh);
      var dispW = nw * scale;
      var dispH = nh * scale;
      return {
        imgLeft: (iw - dispW) * 0.5,
        imgTop: (ih - dispH) * 0.5,
        dispW: dispW,
        dispH: dispH,
      };
    }

    /** True transform-origin of the sheet in client pixels (not the rotated AABB center). */
    function sheetTransformOriginClient(sheet) {
      var m = sheet.querySelector('.immersive-flyer__transform-origin');
      if (m) {
        var r = m.getBoundingClientRect();
        return { cx: r.left + r.width * 0.5, cy: r.top + r.height * 0.5 };
      }
      var sr = sheet.getBoundingClientRect();
      return {
        cx: sr.left + sr.width * 0.5,
        cy: sr.top + sr.height * 0.5,
      };
    }

    /** Sum offsetLeft/Top from el up to ancestor (pre-transform layout space). */
    function offsetInAncestor(el, ancestor) {
      var ox = 0;
      var oy = 0;
      var n = el;
      while (n && n !== ancestor) {
        ox += n.offsetLeft;
        oy += n.offsetTop;
        n = n.offsetParent;
      }
      return n === ancestor ? { ox: ox, oy: oy, ok: true } : { ox: 0, oy: 0, ok: false };
    }

    function pointerToImageNorm(px, py, sheet, img) {
      var oc = sheetTransformOriginClient(sheet);
      var dx = px - oc.cx;
      var dy = py - oc.cy;
      var z = state.imgZoom;
      if (z < 1e-6) z = 1e-6;
      var lx = dx / z;
      var ly = dy / z;
      var iw = sheet.offsetWidth;
      var ih = sheet.offsetHeight;
      if (!iw || !ih) return { sxf: 0.5, syf: 0.5 };
      var psx = lx + iw * 0.5;
      var psy = ly + ih * 0.5;
      var nw = img.naturalWidth;
      var nh = img.naturalHeight;
      if (!nw || !nh) return { sxf: 0.5, syf: 0.5 };

      var off = offsetInAncestor(img, sheet);
      var boxW;
      var boxH;
      var relx;
      var rely;
      if (off.ok) {
        boxW = img.offsetWidth;
        boxH = img.offsetHeight;
        relx = psx - off.ox;
        rely = psy - off.oy;
      } else {
        boxW = iw;
        boxH = ih;
        relx = psx;
        rely = psy;
      }
      if (!boxW || !boxH) return { sxf: 0.5, syf: 0.5 };

      var box = getContainedImageRect(boxW, boxH, nw, nh);
      var sxfRaw;
      var syfRaw;
      if (box) {
        sxfRaw = (relx - box.imgLeft) / box.dispW;
        syfRaw = (rely - box.imgTop) / box.dispH;
      } else {
        sxfRaw = relx / boxW;
        syfRaw = rely / boxH;
      }
      return {
        sxf: Math.min(1, Math.max(0, sxfRaw)),
        syf: Math.min(1, Math.max(0, syfRaw)),
        inside: sxfRaw >= 0 && sxfRaw <= 1 && syfRaw >= 0 && syfRaw <= 1,
      };
    }

    function clampPan() {
      var inst0 = instances[0];
      if (!inst0 || !inst0.stage || !inst0.sheet) return;
      var slack = PAN_SLACK_ZOOMED_IN;
      var minOv = PAN_MIN_OVERLAP_ZOOMED_OUT;
      var iter;
      for (iter = 0; iter < 8; iter++) {
        applyTransforms();
        var stR = inst0.stage.getBoundingClientRect();
        var shR = inst0.sheet.getBoundingClientRect();
        var ax = 0;
        var ay = 0;
        var zoomedOutH = shR.width <= stR.width + 0.5;
        var zoomedOutV = shR.height <= stR.height + 0.5;

        if (zoomedOutH) {
          var needW = Math.min(minOv, shR.width);
          if (shR.right < stR.left + needW) ax += stR.left + needW - shR.right;
          if (shR.left > stR.right - needW) ax += stR.right - needW - shR.left;
        } else {
          if (shR.left > stR.left + slack) ax -= shR.left - stR.left - slack;
          if (shR.right < stR.right - slack) ax += stR.right - slack - shR.right;
        }

        if (zoomedOutV) {
          var needH = Math.min(minOv, shR.height);
          if (shR.bottom < stR.top + needH) ay += stR.top + needH - shR.bottom;
          if (shR.top > stR.bottom - needH) ay += stR.bottom - needH - shR.top;
        } else {
          if (shR.top > stR.top + slack) ay -= shR.top - stR.top - slack;
          if (shR.bottom < stR.bottom - slack) ay += stR.bottom - slack - shR.bottom;
        }

        if (Math.abs(ax) < 0.25 && Math.abs(ay) < 0.25) break;
        state.panX += ax;
        state.panY += ay;
      }
    }

    function setLoupeCursor(inst, active) {
      if (!inst || !inst.viewport) return;
      if (active) inst.viewport.classList.add('is-loupe-active');
      else inst.viewport.classList.remove('is-loupe-active');
    }

    function updateLoupe() {
      var Seff = FLYER_LOUPE_BASE_MAG * state.imgZoom;
      var R = FLYER_LENS_DEFAULT;
      if (!state.ptr || !state.imageReady) {
        instances.forEach(function (inst) {
          if (inst.loupe) inst.loupe.setAttribute('hidden', '');
          setLoupeCursor(inst, false);
        });
        return;
      }

      instances.forEach(function (inst) {
        if (!inst.loupe || !inst.loupeStrip || !inst.sheet || !inst.loupeDisk || !inst.viewport)
          return;
        var img = inst.sheet.querySelector('.immersive-flyer__img');
        if (!img || !img.classList.contains('is-ready') || !img.naturalWidth) {
          inst.loupe.setAttribute('hidden', '');
          setLoupeCursor(inst, false);
          return;
        }
        var vr = inst.viewport.getBoundingClientRect();
        var px = state.ptrClientX;
        var py = state.ptrClientY;

        var norm = pointerToImageNorm(px, py, inst.sheet, img);
        if (!norm.inside) {
          inst.loupe.setAttribute('hidden', '');
          setLoupeCursor(inst, false);
          return;
        }
        state.sxf = norm.sxf;
        state.syf = norm.syf;

        var iw = inst.sheet.offsetWidth;
        var ih = inst.sheet.offsetHeight;
        if (!iw || !ih) {
          inst.loupe.setAttribute('hidden', '');
          setLoupeCursor(inst, false);
          return;
        }

        var nw = img.naturalWidth;
        var nh = img.naturalHeight;
        var stripBox = getContainedImageRect(iw, ih, nw, nh);
        var stripX;
        var stripY;
        if (stripBox) {
          stripX = stripBox.imgLeft + state.sxf * stripBox.dispW;
          stripY = stripBox.imgTop + state.syf * stripBox.dispH;
        } else {
          stripX = state.sxf * iw;
          stripY = state.syf * ih;
        }

        inst.loupe.removeAttribute('hidden');
        setLoupeCursor(inst, true);

        inst.loupeDisk.style.width = 2 * R + 'px';
        inst.loupeDisk.style.height = 2 * R + 'px';
        inst.loupeDisk.style.left = -R + 'px';
        inst.loupeDisk.style.top = -R + 'px';
        inst.loupeDisk.style.transformOrigin = 'center center';
        inst.loupeDisk.style.transform = 'none';

        var ringPx = 26;
        var ringVb = 24;
        var iconRv = 5;
        var Rsm = iconRv * (ringPx / ringVb);
        var invSqrt2 = Math.SQRT1_2;
        var glassDist = R + Rsm;
        var glassCx = glassDist * invSqrt2;
        var glassCy = glassDist * invSqrt2;
        var cxOff = (10 / ringVb) * ringPx;
        var cyOff = (10 / ringVb) * ringPx;
        if (inst.loupeRing) {
          inst.loupeRing.style.left = glassCx - cxOff + 'px';
          inst.loupeRing.style.top = glassCy - cyOff + 'px';
        }

        inst.loupeStrip.style.width = iw + 'px';
        inst.loupeStrip.style.height = ih + 'px';
        inst.loupeStrip.style.transform =
          'translate(' +
          (R - stripX * Seff) +
          'px,' +
          (R - stripY * Seff) +
          'px) scale(' +
          Seff +
          ')';

        inst.loupe.style.left = px - vr.left - glassCx + 'px';
        inst.loupe.style.top = py - vr.top - glassCy + 'px';
        inst.loupe.style.transform = 'none';
      });
    }

    function syncPointerFromEvent(e, inst) {
      state.ptrClientX = e.clientX;
      state.ptrClientY = e.clientY;
      var stg = inst.stage.getBoundingClientRect();
      var px = e.clientX;
      var py = e.clientY;
      if (px >= stg.left && px <= stg.right && py >= stg.top && py <= stg.bottom) {
        state.ptr = true;
      }
    }

    function flyerPointersOnInst(inst) {
      var pts = [];
      overlockedFlyerPtrMap.forEach(function (v) {
        if (v.inst === inst) pts.push({ x: v.x, y: v.y });
      });
      return pts;
    }

    function beginFlyerMultitouch(inst, p0, p1) {
      var midX = (p0.x + p1.x) * 0.5;
      var midY = (p0.y + p1.y) * 0.5;
      var dx = p1.x - p0.x;
      var dy = p1.y - p0.y;
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;
      overlockedFlyerMulti = {
        inst: inst,
        lastMidX: midX,
        lastMidY: midY,
        lastDist: dist,
      };
    }

    function applyFlyerMultitouchFrame(inst, p0, p1) {
      if (!overlockedFlyerMulti || overlockedFlyerMulti.inst !== inst) return;
      var midX = (p0.x + p1.x) * 0.5;
      var midY = (p0.y + p1.y) * 0.5;
      var dx = p1.x - p0.x;
      var dy = p1.y - p0.y;
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;
      var m = overlockedFlyerMulti;
      var scale = dist / m.lastDist;
      state.imgZoom = Math.min(
        FLYER_IMG_ZOOM_MAX,
        Math.max(FLYER_IMG_ZOOM_MIN, state.imgZoom * scale),
      );
      state.panX += midX - m.lastMidX;
      state.panY += midY - m.lastMidY;
      m.lastMidX = midX;
      m.lastMidY = midY;
      m.lastDist = dist;
      clampPan();
      applyTransforms();
      updateLoupe();
    }

    function bindFlyerCoarseDocumentListenersOnce() {
      if (overlockedFlyerCoarseDocBound) return;
      overlockedFlyerCoarseDocBound = true;

      document.addEventListener(
        'pointermove',
        function (e) {
          if (!document.querySelector('.immersive-page')) return;
          if (!overlockedFlyerPtrMap.has(e.pointerId)) return;
          var rec = overlockedFlyerPtrMap.get(e.pointerId);
          rec.x = e.clientX;
          rec.y = e.clientY;
          var inst = rec.inst;
          var pts = flyerPointersOnInst(inst);
          if (pts.length >= 2) {
            e.preventDefault();
            applyFlyerMultitouchFrame(inst, pts[0], pts[1]);
          } else if (pts.length === 1) {
            if (flyerDrag.active) return;
            syncPointerFromEvent(e, inst);
            updateLoupe();
          }
        },
        true,
      );

      function coarsePointerEnd(e) {
        if (!document.querySelector('.immersive-page')) return;
        if (!overlockedFlyerPtrMap.has(e.pointerId)) return;
        var rec = overlockedFlyerPtrMap.get(e.pointerId);
        var inst = rec.inst;
        overlockedFlyerPtrMap.delete(e.pointerId);
        var pts = flyerPointersOnInst(inst);
        if (pts.length < 2) {
          overlockedFlyerMulti = null;
        }
        if (pts.length === 0) {
          try {
            inst.stage.releasePointerCapture(e.pointerId);
          } catch (rel0) {}
          clearDraggingUi();
          state.ptr = false;
          updateLoupe();
          schedulePersist();
        } else if (pts.length === 1) {
          overlockedFlyerPtrMap.forEach(function (v, pid) {
            if (v.inst === inst) {
              try {
                inst.stage.setPointerCapture(pid);
              } catch (c1) {}
            }
          });
          var px = pts[0].x;
          var py = pts[0].y;
          state.ptrClientX = px;
          state.ptrClientY = py;
          var stg = inst.stage.getBoundingClientRect();
          if (px >= stg.left && px <= stg.right && py >= stg.top && py <= stg.bottom) {
            state.ptr = true;
          }
          inst.viewport.classList.add('is-dragging');
          updateLoupe();
          schedulePersist();
        }
      }

      document.addEventListener('pointerup', coarsePointerEnd, true);
      document.addEventListener('pointercancel', coarsePointerEnd, true);
    }

    function onPointerMoveStage(e, inst) {
      if (isFlyerCoarsePointer() && overlockedFlyerPtrMap.has(e.pointerId)) {
        return;
      }
      syncPointerFromEvent(e, inst);

      if (flyerDrag.active && flyerDrag.inst === inst) {
        e.preventDefault();
        var dx = e.clientX - flyerDrag.lastX;
        var dy = e.clientY - flyerDrag.lastY;
        flyerDrag.lastX = e.clientX;
        flyerDrag.lastY = e.clientY;
        state.panX += dx;
        state.panY += dy;
        clampPan();
        applyTransforms();
        updateLoupe();
        return;
      }

      if (!state.ptr) return;
      updateLoupe();
    }

    instances.forEach(function (inst) {
      if (!inst.viewport || !inst.stage || !inst.pan || !inst.sheet) return;

      inst.stage.addEventListener(
        'pointerdown',
        function (e) {
          if (e.button !== 0) return;
          if (e.shiftKey) return;
          e.preventDefault();
          if (isFlyerCoarsePointer()) {
            bindFlyerCoarseDocumentListenersOnce();
            overlockedFlyerPtrMap.set(e.pointerId, { inst: inst, x: e.clientX, y: e.clientY });
            var cnt = flyerPointersOnInst(inst).length;
            if (cnt === 1) {
              overlockedFlyerMulti = null;
              inst.viewport.classList.add('is-dragging');
              try {
                inst.stage.setPointerCapture(e.pointerId);
              } catch (errC) {}
              syncPointerFromEvent(e, inst);
              updateLoupe();
            } else if (cnt === 2) {
              flyerDrag.active = false;
              flyerDrag.inst = null;
              flyerDrag.pointerId = null;
              var releaseIds = [];
              overlockedFlyerPtrMap.forEach(function (v, pid) {
                if (v.inst === inst) releaseIds.push(pid);
              });
              for (var rj = 0; rj < releaseIds.length; rj++) {
                try {
                  inst.stage.releasePointerCapture(releaseIds[rj]);
                } catch (errRel) {}
              }
              var pts2 = flyerPointersOnInst(inst);
              if (pts2.length >= 2) beginFlyerMultitouch(inst, pts2[0], pts2[1]);
              state.ptr = false;
              clearDraggingUi();
              inst.viewport.classList.add('is-dragging');
              updateLoupe();
            }
            return;
          }
          flyerDrag.active = true;
          flyerDrag.inst = inst;
          flyerDrag.pointerId = e.pointerId;
          flyerDrag.lastX = e.clientX;
          flyerDrag.lastY = e.clientY;
          inst.viewport.classList.add('is-dragging');
          try {
            inst.stage.setPointerCapture(e.pointerId);
          } catch (err2) {}
          syncPointerFromEvent(e, inst);
        },
        true,
      );

      inst.stage.addEventListener(
        'touchmove',
        function (e) {
          if (!isFlyerCoarsePointer()) return;
          var c = 0;
          overlockedFlyerPtrMap.forEach(function (v) {
            if (v.inst === inst) c++;
          });
          if (c >= 2) e.preventDefault();
        },
        { passive: false },
      );

      inst.stage.addEventListener('pointermove', function (e) {
        onPointerMoveStage(e, inst);
      });

      inst.stage.addEventListener('pointerleave', function () {
        if (overlockedFlyerPtrMap.size) return;
        if (!flyerDrag.active) {
          state.ptr = false;
          updateLoupe();
        }
      });

      inst.stage.addEventListener('pointerenter', function (e) {
        syncPointerFromEvent(e, inst);
        updateLoupe();
      });

      inst.stage.addEventListener('pointerup', function (e) {
        if (isFlyerCoarsePointer()) return;
        if (!flyerDrag.active || flyerDrag.inst !== inst) return;
          try {
            inst.stage.releasePointerCapture(e.pointerId);
        } catch (err3) {}
        flyerDrag.active = false;
        flyerDrag.inst = null;
        flyerDrag.pointerId = null;
          clearDraggingUi();
        schedulePersist();
      });

      inst.stage.addEventListener('pointercancel', function () {
        if (isFlyerCoarsePointer()) return;
        flyerDrag.active = false;
        flyerDrag.inst = null;
        flyerDrag.pointerId = null;
        clearDraggingUi();
      });

      inst.stage.addEventListener(
        'lostpointercapture',
        function () {
          if (isFlyerCoarsePointer()) return;
          flyerDrag.active = false;
          flyerDrag.inst = null;
          flyerDrag.pointerId = null;
          clearDraggingUi();
        },
      );

      inst.stage.addEventListener(
        'wheel',
        function (e) {
          if (isFlyerCoarsePointer()) return;
            e.preventDefault();
            var factor = e.deltaY < 0 ? 1.09 : 1 / 1.09;
          applyZoomFactor(factor);
        },
        { passive: false },
      );
    });

    function applyZoomFactor(factor) {
      state.imgZoom = Math.min(FLYER_IMG_ZOOM_MAX, Math.max(FLYER_IMG_ZOOM_MIN, state.imgZoom * factor));
      clampPan();
      applyTransforms();
      updateLoupe();
      schedulePersist();
    }

    function setImageIndex(nextIndex) {
      var imgs = flyerImages();
      if (!imgs.length) return;
      var n = imgs.length;
      var i = nextIndex % n;
      if (i < 0) i += n;
      state.imageIndex = i;
      state.panX = 0;
      state.panY = 0;
      state.imgZoom = 0.85;
      state.imageReady = false;
      state.ptr = false;
      applyCurrentImage();
      applyTransforms();
      updateLoupe();
      writePersist();
    }

    flyerUi.prev = function () {
      setImageIndex(state.imageIndex - 1);
    };
    flyerUi.next = function () {
      setImageIndex(state.imageIndex + 1);
    };
    flyerUi.zoomIn = function () {
      applyZoomFactor(1.12);
    };
    flyerUi.zoomOut = function () {
      applyZoomFactor(1 / 1.12);
    };

    flyerUi.onResize = function () {
      applyCurrentImage();
        clampPan();
        applyTransforms();
        updateLoupe();
      schedulePersist();
    };

    function dispatchKey(e) {
      if (!document.querySelector('.immersive-page')) return;
      if (!document.querySelector('.immersive-flyer[data-flyer-root]')) return;
      var target = document.activeElement;
      if (target && (target.matches('input, textarea, select') || target.isContentEditable)) {
        return;
      }
      if (e.key === 'Escape') {
        state.ptr = false;
        updateLoupe();
          return;
        }
      if (e.key === 'ArrowLeft') {
          e.preventDefault();
        flyerUi.prev();
          return;
        }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        flyerUi.next();
        return;
      }
    }

    if (!flyerUi.globalBound) {
      flyerUi.globalBound = true;
      document.addEventListener('keydown', dispatchKey);
      window.addEventListener('resize', function () {
        flyerUi.onResize();
      });
    }

    if (!flyerUi.actionClickBound) {
      flyerUi.actionClickBound = true;
      document.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-flyer-action]');
        if (!btn) return;
        if (!document.querySelector('.immersive-page')) return;
        e.preventDefault();
        var act = btn.getAttribute('data-flyer-action');
        if (act === 'zoom-in') flyerUi.zoomIn();
        else if (act === 'zoom-out') flyerUi.zoomOut();
        else if (act === 'prev') flyerUi.prev();
        else if (act === 'next') flyerUi.next();
      });
    }

    applyCurrentImage();
    runWhenIdle(function () {
      applyCurrentImage();
        clampPan();
        applyTransforms();
        updateLoupe();
    });
  }

  function initImmersivePage() {
    var root = document.querySelector('.immersive-page');
    if (!root) return;
    var pathSlug = immersiveSlugFromPath();
    if (pathSlug) currentImmersiveSlug = pathSlug;
    initFlyer();
  }

  window.addEventListener('sdv:immersive-ready', function (ev) {
    var slug = (ev && ev.detail && ev.detail.slug) ? String(ev.detail.slug) : immersiveSlugFromPath();
    currentImmersiveSlug = slug || currentImmersiveSlug;
    prefetchFlyerImages(flyerImages());
    document.querySelectorAll('.immersive-flyer[data-flyer-root]').forEach(function (el) {
      el.removeAttribute('data-flyer-bound');
    });
    initFlyer();
  });

  /* --- Boot --- */

  document.addEventListener('DOMContentLoaded', function () {
    initHomeInfoToggle();
    renderHomeMaterialToggle();
    initProjectPublicationGate();
    initProjectSplitFocusToggle();
    initImmersivePage();

  window.addEventListener('sdv:materials', function () {
    renderHomeMaterialToggle();
  });

    window.addEventListener('sdv:home', function () {
      renderHomeMaterialToggle();
    });

    bindHomeIconsViewportSync();

    window.addEventListener('sdv:lightbox-open', function (ev) {
      var d = ev && ev.detail ? ev.detail : {};
      openLightbox(d.urls || [], d.index || 0);
    });

    bindLightboxGlobalKeys();
  });
})();

