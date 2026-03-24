/**
 * Page interactions: home selection, immersive law/slider, abstraction captions, project split controls.
 * Depends on sdv-shared.js (window.SDV). content-loader.js sets globals and dispatches sdv:home,
 * sdv:materials, sdv:captions, sdv:immersive-ready.
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

  var SLUG_DANCE = 'the-spontaneous-dance-falls';
  var SLUG_NEEDLE = 'under-the-needles-eye';
  var SLUG_OVER = 'overlocked';

  function immersiveSlugFromPath() {
    var p = window.location.pathname || '';
    var m = p.match(/\/immersive\/([^/]+)\/?$/);
    return m && m[1] ? String(m[1]) : '';
  }

  var OVERLAY_VIDEO_BY_SLUG = {
    'the-spontaneous-dance-falls': 'images/captions/dance_falls_film_loop.mp4',
    'under-the-needles-eye': 'images/captions/needle_film_loop.mp4',
    'overlocked': 'images/captions/overlocked_film_loop.mp4',
  };
  var OVERLAY_IMAGE_BY_SLUG = {
    'the-spontaneous-dance-falls': 'images/home/fall.jpg',
    'under-the-needles-eye': 'images/home/needle.jpg',
    'overlocked': 'images/home/overlocked.jpg',
  };

  /** Fallback when Sanity captions document is unavailable; `project` matches caption schema (slug string). */
  var CAPTIONS_FALLBACK = [
    { project: SLUG_DANCE, text: 'Project 1 Caption [TBD].' },
    { project: SLUG_OVER, text: 'There were opportunities back then, it was the land of opportunities.' },
    { project: SLUG_OVER, text: 'People work hard for their money here.' },
    { project: SLUG_OVER, text: 'We have to have a whip, the clock is our whip.' },
    { project: SLUG_NEEDLE, text: 'The witches spun with the intention of remembering.' },
    { project: SLUG_NEEDLE, text: 'An I for an eye.' },
  ];

  function getOverlayVideoUrl(relativePath) {
    try {
      return new URL(relativePath, window.location.href).href;
    } catch (e) {
      return relativePath;
    }
  }

  var currentSlug = '';
  /** Default home crosshair / hero frame (matches css :root --line). */
  var HOME_LINE_DEFAULT = '#7e7777';
  /** Default project line colors on home page (unless overridden by CMS) . */
  var HOME_LINE_BY_CONTEXT = {
    'the-spontaneous-dance-falls': '#3f3739',
    'under-the-needles-eye': '#713b38',
    overlocked: '#1851a3',
  };
  var captionIndex = 0;
  var captionInterval = null;
  var currentCaptionPool = [];
  var currentProject2Slide = 0;
  var lawOpenState = [];

  function initImmersiveInteractions(slug) {
    if (slug === SLUG_DANCE) {
      initProject1Immersive();
    } else if (slug === SLUG_NEEDLE) {
      initProject2Immersive();
    } else if (slug === SLUG_OVER) {
      initOverlockedFlyer();
    }
  }

  function initProject1Immersive() {
    var main = document.getElementById('immersive-inner');
    var inset = document.getElementById('immersive-inner-inset');
    if (!main) return;

    var mainLayout = main.querySelector('.law-layout');
    if (!mainLayout) return;
    var mainFragments = mainLayout.querySelectorAll('.law-fragment');
    if (!mainFragments.length) return;

    lawOpenState = [];
    for (var i = 0; i < mainFragments.length; i++) lawOpenState[i] = null;

    function bindFragmentClicks(root) {
      if (!root) return;
      var layout = root.querySelector('.law-layout');
      if (!layout) return;
      var buttons = layout.querySelectorAll('.law-fragment');
      buttons.forEach(function (btn, index) {
        btn.addEventListener('click', function () {
          var src = btn.getAttribute('data-image');
          if (!src) return;
          lawOpenState[index] = (lawOpenState[index] === src) ? null : src;
          syncLawState();
        });
      });
    }

    bindFragmentClicks(main);
    bindFragmentClicks(inset);

    syncLawState();

    initLawScroll(mainLayout);
    if (inset) {
      var insetLayout = inset.querySelector('.law-layout');
      if (insetLayout) initLawScroll(insetLayout);
    }
  }

  function getProject2Roots() {
    var main = document.getElementById('immersive-inner');
    var inset = document.getElementById('immersive-inner-inset');
    var roots = [];
    if (main) {
      var s = main.querySelector('.immersive-story');
      if (s) roots.push(s);
    }
    if (inset) {
      var t = inset.querySelector('.immersive-story');
      if (t) roots.push(t);
    }
    return roots;
  }

  function getProject2Images(root) {
    var wrap = root.querySelector('.immersive-story__image-wrap');
    if (!wrap) return null;
    var imgA = root.querySelector('.immersive-story__image--a');
    var imgB = root.querySelector('.immersive-story__image--b');
    if (!imgA || !imgB) return null;
    var frontKey = wrap.dataset.storyFront || 'a';
    return {
      wrap: wrap,
      imgA: imgA,
      imgB: imgB,
      front: frontKey === 'b' ? imgB : imgA,
      back: frontKey === 'b' ? imgA : imgB,
    };
  }

  function setProject2Front(root, which) {
    var imgs = getProject2Images(root);
    if (!imgs) return;
    imgs.wrap.dataset.storyFront = which;
    imgs.imgA.classList.toggle('is-front', which === 'a');
    imgs.imgB.classList.toggle('is-front', which === 'b');
  }

  function getSliderSlides() {
    var g = window.SDV_IMMERSIVE_SLIDER;
    if (g && Array.isArray(g.slides) && g.slides.length) return g.slides;
    return [];
  }

  function renderProject2Slide(index, options) {
    var slides = getSliderSlides();
    if (!slides.length) return;
    var total = slides.length;
    var nextIndex = index;
    if (nextIndex < 0) nextIndex = total - 1;
    if (nextIndex >= total) nextIndex = 0;
    currentProject2Slide = nextIndex;

    var roots = getProject2Roots();
    if (!roots.length) return;

    var immediate = options && options.immediate;
    var slide = slides[currentProject2Slide] || {};
    var newSrc = slide.src || '';
    var newAlt = 'Under the Needle\u2019s Eye, frame ' + (currentProject2Slide + 1);
    var newHtml = slide.captionHtml || '';

    function updateTextAll() {
      roots.forEach(function (r) {
        var te = r.querySelector('.immersive-story__text');
        if (te) te.innerHTML = newHtml;
      });
    }

    if (immediate) {
      roots.forEach(function (root) {
        var imgs = getProject2Images(root);
        if (!imgs) return;
        imgs.front.src = newSrc;
        imgs.front.alt = newAlt;
        imgs.front.classList.add('is-front');
        imgs.back.classList.remove('is-front');
        imgs.back.src = '';
        imgs.wrap.dataset.storyFront = imgs.front === imgs.imgA ? 'a' : 'b';
      });
      updateTextAll();
      return;
    }

    roots.forEach(function (root) {
      var imgs = getProject2Images(root);
      if (!imgs) return;

      var back = imgs.back;
      back.src = newSrc;
      back.alt = newAlt;

      function doTransition() {
        imgs.front.classList.add('is-transitioning');
        setTimeout(function () {
          imgs.front.classList.remove('is-transitioning');
          var newFront = imgs.front === imgs.imgA ? 'b' : 'a';
          setProject2Front(root, newFront);
          updateTextAll();
        }, 700);
      }

      if (back.complete) {
        doTransition();
      } else {
        back.addEventListener('load', function onLoad() {
          back.removeEventListener('load', onLoad);
          doTransition();
        });
      }
    });
  }

  function goProject2Prev() {
    renderProject2Slide(currentProject2Slide - 1);
  }

  function goProject2Next() {
    renderProject2Slide(currentProject2Slide + 1);
  }

  function initProject2Immersive() {
    var roots = getProject2Roots();
    if (!roots.length) return;

    roots.forEach(function (root) {
      if (root.dataset.bound === '1') return;
      root.dataset.bound = '1';

      var prevBtn = root.querySelector('.immersive-story__nav--prev');
      var nextBtn = root.querySelector('.immersive-story__nav--next');

      if (prevBtn) prevBtn.addEventListener('click', goProject2Prev);
      if (nextBtn) nextBtn.addEventListener('click', goProject2Next);
    });

    currentProject2Slide = 0;
    renderProject2Slide(0, { immediate: true });
  }

  /* Loupe bitmap scale = base × scan zoom (user cannot change base). */
  var FLYER_LOUPE_BASE_MAG = 3.75;
  var FLYER_LENS_MIN = 36;
  var FLYER_LENS_MAX = 160;
  var FLYER_LENS_DEFAULT = 64;
  var FLYER_IMG_ZOOM_MIN = 0.45;
  var FLYER_IMG_ZOOM_MAX = 3.5;
  var PAN_SLACK_ZOOMED_IN = 28;
  var PAN_MIN_OVERLAP_ZOOMED_OUT = 56;
  var FLYER_SCAN_FRONT = 'images/uploads/overlocked-scan-front.jpg';
  var FLYER_SCAN_BACK = 'images/uploads/overlocked-scan-back.jpg';
  var FLYER_PERSIST_KEY = 'sdv:overlocked-flyer-v1';

  function loadOverlockedFlyerPersisted() {
    try {
      var raw = sessionStorage.getItem(FLYER_PERSIST_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || o.v !== 1 || typeof o !== 'object') return null;
      return o;
    } catch (err) {
      return null;
    }
  }

  /** One global listener calls into latest init (immersive re-entry). */
  var overlockedFlyerUi = {
    dispatchKey: function () { },
    onResize: function () { },
    flyerZoomIn: function () { },
    flyerZoomOut: function () { },
    flyerLensSmaller: function () { },
    flyerLensLarger: function () { },
    flyerResetRotation: function () { },
    flyerSnapRotation: function () { },
    flyerFlipSide: function () { },
    flyerActionClickBound: false,
    hudToggleBound: false,
  };
  var overlockedFlyerDrag = {
    active: false,
    lastX: 0,
    lastY: 0,
    inst: null,
    pointerId: null,
  };
  var overlockedFlyerRotate = {
    active: false,
    inst: null,
    pointerId: null,
    lastRad: null,
  };
  var overlockedFlyerGlobalBound = false;

  function initOverlockedFlyer() {
    var roots = document.querySelectorAll('.immersive-flyer[data-flyer-root]');
    if (!roots.length) return;
    if (roots[0].getAttribute('data-flyer-bound') === '1') return;
    for (var ri = 0; ri < roots.length; ri++) {
      roots[ri].setAttribute('data-flyer-bound', '1');
    }

    var state = {
      panX: 0,
      panY: 0,
      /* Below 1 so the mat shows; a bit smaller to clear Overview + abstraction chrome */
      imgZoom: 0.85,
      /* Any angle (degrees); CSS rotate + inverse for loupe hit-test */
      rotationDeg: 0,
      lensR: FLYER_LENS_DEFAULT,
      ptr: false,
      ptrClientX: 0,
      ptrClientY: 0,
      sxf: 0.5,
      syf: 0.5,
      /* Which physical side of the sheet is shown (same pan/zoom/rotation for both scans). */
      side: 'front',
    };

    var persistedFlyer = loadOverlockedFlyerPersisted();
    if (persistedFlyer) {
      if (persistedFlyer.side === 'front' || persistedFlyer.side === 'back') {
        state.side = persistedFlyer.side;
      }
      if (typeof persistedFlyer.panX === 'number' && isFinite(persistedFlyer.panX)) {
        state.panX = persistedFlyer.panX;
      }
      if (typeof persistedFlyer.panY === 'number' && isFinite(persistedFlyer.panY)) {
        state.panY = persistedFlyer.panY;
      }
      if (typeof persistedFlyer.imgZoom === 'number' && isFinite(persistedFlyer.imgZoom)) {
        state.imgZoom = Math.min(
          FLYER_IMG_ZOOM_MAX,
          Math.max(FLYER_IMG_ZOOM_MIN, persistedFlyer.imgZoom),
        );
      }
      if (typeof persistedFlyer.rotationDeg === 'number' && isFinite(persistedFlyer.rotationDeg)) {
        state.rotationDeg = persistedFlyer.rotationDeg;
      }
      if (typeof persistedFlyer.lensR === 'number' && isFinite(persistedFlyer.lensR)) {
        state.lensR = Math.min(
          FLYER_LENS_MAX,
          Math.max(FLYER_LENS_MIN, persistedFlyer.lensR),
        );
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

    function writeOverlockedFlyerPersist() {
      try {
        sessionStorage.setItem(
          FLYER_PERSIST_KEY,
          JSON.stringify({
            v: 1,
            side: state.side,
            panX: state.panX,
            panY: state.panY,
            imgZoom: state.imgZoom,
            rotationDeg: state.rotationDeg,
            lensR: state.lensR,
          }),
        );
      } catch (errW) { }
    }

    var persistTimer = null;
    function schedulePersistOverlockedFlyer() {
      if (persistTimer) clearTimeout(persistTimer);
      persistTimer = setTimeout(function () {
        persistTimer = null;
        writeOverlockedFlyerPersist();
      }, 200);
    }

    if (!overlockedFlyerUi._flyerBeforeUnloadBound) {
      overlockedFlyerUi._flyerBeforeUnloadBound = true;
      window.addEventListener('beforeunload', function () {
        if (persistTimer) {
          clearTimeout(persistTimer);
          persistTimer = null;
        }
        writeOverlockedFlyerPersist();
      });
    }

    function applyFlyerScanSide() {
      var rel = state.side === 'back' ? FLYER_SCAN_BACK : FLYER_SCAN_FRONT;
      var url = assetUrl(rel);
      var file = rel.replace(/^.*\//, '');
      instances.forEach(function (inst) {
        inst.root.querySelectorAll('img').forEach(function (im) {
          var cur = im.src.split('?')[0].replace(/^.*\//, '');
          if (cur === file) return;
          im.src = url;
        });
      });
    }

    function preloadFlyerBothScans() {
      var uFront = assetUrl(FLYER_SCAN_FRONT);
      var uBack = assetUrl(FLYER_SCAN_BACK);
      var a = new Image();
      a.src = uFront;
      var b = new Image();
      b.src = uBack;
    }

    applyFlyerScanSide();
    preloadFlyerBothScans();

    function clearDraggingUi() {
      instances.forEach(function (inst) {
        if (inst.viewport) inst.viewport.classList.remove('is-dragging');
      });
    }

    function applyTransforms() {
      instances.forEach(function (inst) {
        if (!inst.pan || !inst.sheet) return;
        inst.pan.style.transform =
          'translate(' + state.panX + 'px,' + state.panY + 'px)';
        inst.sheet.style.transform =
          'rotate(' +
          state.rotationDeg +
          'deg) scale(' +
          state.imgZoom +
          ')';
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

    /**
     * Pointer → normalized bitmap coords [0,1]. Uses layout-center pivot + img box for object-fit
     * (same box the browser paints into), so UVs don’t run ahead of the visible scan.
     */
    function pointerToImageNorm(px, py, sheet, img) {
      var oc = sheetTransformOriginClient(sheet);
      var dx = px - oc.cx;
      var dy = py - oc.cy;
      var z = state.imgZoom;
      if (z < 1e-6) z = 1e-6;
      var rad = (state.rotationDeg * Math.PI) / 180;
      var cos = Math.cos(rad);
      var sin = Math.sin(rad);
      /* Sheet is rotate(θ) scale(z); CSS applies scale then rotate, so
         screen delta = R * (z * local). Invert: local = R^-1 * screen / z. */
      var lx = (dx * cos + dy * sin) / z;
      var ly = (-dx * sin + dy * cos) / z;
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
      var sxf;
      var syf;
      if (box) {
        sxf = (relx - box.imgLeft) / box.dispW;
        syf = (rely - box.imgTop) / box.dispH;
      } else {
        sxf = relx / boxW;
        syf = rely / boxH;
      }
      return {
        sxf: Math.min(1, Math.max(0, sxf)),
        syf: Math.min(1, Math.max(0, syf)),
      };
    }

    function syncAfterRotationChange() {
      clampPan();
      applyTransforms();
      updateLoupe();
      schedulePersistOverlockedFlyer();
    }

    function unwrapAngleDelta(dRad) {
      while (dRad > Math.PI) dRad -= 2 * Math.PI;
      while (dRad < -Math.PI) dRad += 2 * Math.PI;
      return dRad;
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

    function updateLoupe() {
      var Seff = FLYER_LOUPE_BASE_MAG * state.imgZoom;
      var R = state.lensR;
      if (!state.ptr) {
        instances.forEach(function (inst) {
          if (inst.loupe) inst.loupe.setAttribute('hidden', '');
        });
        return;
      }

      instances.forEach(function (inst) {
        if (!inst.loupe || !inst.loupeStrip || !inst.sheet || !inst.loupeDisk || !inst.viewport) return;
        var img = inst.sheet.querySelector('.immersive-flyer__img');
        if (!img) return;
        var vr = inst.viewport.getBoundingClientRect();
        var px = state.ptrClientX;
        var py = state.ptrClientY;

        var norm = pointerToImageNorm(px, py, inst.sheet, img);
        state.sxf = norm.sxf;
        state.syf = norm.syf;

        var iw = inst.sheet.offsetWidth;
        var ih = inst.sheet.offsetHeight;
        if (!iw || !ih) return;

        /* Strip img is 100%×100% of iw×ih; map UV with same iw/ih contain (not figure/img offsets). */
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

        inst.loupeDisk.style.width = 2 * R + 'px';
        inst.loupeDisk.style.height = 2 * R + 'px';
        inst.loupeDisk.style.left = -R + 'px';
        inst.loupeDisk.style.top = -R + 'px';
        inst.loupeDisk.style.transformOrigin = 'center center';
        inst.loupeDisk.style.transform = 'rotate(' + state.rotationDeg + 'deg)';
        /*
         * Place the wireframe ring so the small circle in the SVG is externally tangent to the
         * lens disk (radius R) along the SE diagonal — same at every lens size.
         * SVG: circle cx=cy=10 r=5 in viewBox 24; ring element is 26×26px.
         */
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

        /* Pointer stays on the small-glass center (same hit target as before). */
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

    function onPointerMoveStage(e, inst) {
      syncPointerFromEvent(e, inst);

      if (overlockedFlyerRotate.active && overlockedFlyerRotate.inst === inst) {
        e.preventDefault();
        applyTransforms();
        var oc = sheetTransformOriginClient(inst.sheet);
        var rad = Math.atan2(e.clientY - oc.cy, e.clientX - oc.cx);
        var dRad = unwrapAngleDelta(rad - overlockedFlyerRotate.lastRad);
        state.rotationDeg += (dRad * 180) / Math.PI;
        overlockedFlyerRotate.lastRad = rad;
        clampPan();
        applyTransforms();
        updateLoupe();
        return;
      }

      if (overlockedFlyerDrag.active && overlockedFlyerDrag.inst === inst) {
        e.preventDefault();
        var dx = e.clientX - overlockedFlyerDrag.lastX;
        var dy = e.clientY - overlockedFlyerDrag.lastY;
        overlockedFlyerDrag.lastX = e.clientX;
        overlockedFlyerDrag.lastY = e.clientY;
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
          if (e.altKey) {
            overlockedFlyerRotate.active = true;
            overlockedFlyerRotate.inst = inst;
            overlockedFlyerRotate.pointerId = e.pointerId;
            applyTransforms();
            var oc0 = sheetTransformOriginClient(inst.sheet);
            overlockedFlyerRotate.lastRad = Math.atan2(
              e.clientY - oc0.cy,
              e.clientX - oc0.cx,
            );
            inst.viewport.classList.add('is-dragging');
            try {
              inst.stage.setPointerCapture(e.pointerId);
            } catch (err) { }
            syncPointerFromEvent(e, inst);
            return;
          }
          overlockedFlyerDrag.active = true;
          overlockedFlyerDrag.inst = inst;
          overlockedFlyerDrag.pointerId = e.pointerId;
          overlockedFlyerDrag.lastX = e.clientX;
          overlockedFlyerDrag.lastY = e.clientY;
          inst.viewport.classList.add('is-dragging');
          try {
            inst.stage.setPointerCapture(e.pointerId);
          } catch (err) { }
          syncPointerFromEvent(e, inst);
        },
        true,
      );

      inst.stage.addEventListener('pointermove', function (e) {
        onPointerMoveStage(e, inst);
      });

      inst.stage.addEventListener('pointerleave', function () {
        if (!overlockedFlyerDrag.active && !overlockedFlyerRotate.active) {
          state.ptr = false;
          updateLoupe();
        }
      });

      inst.stage.addEventListener('pointerenter', function (e) {
        syncPointerFromEvent(e, inst);
        updateLoupe();
      });

      inst.stage.addEventListener('pointerup', function (e) {
        if (overlockedFlyerRotate.active && overlockedFlyerRotate.inst === inst) {
          try {
            inst.stage.releasePointerCapture(e.pointerId);
          } catch (errR) { }
          overlockedFlyerRotate.active = false;
          overlockedFlyerRotate.inst = null;
          overlockedFlyerRotate.pointerId = null;
          overlockedFlyerRotate.lastRad = null;
          clearDraggingUi();
          schedulePersistOverlockedFlyer();
          return;
        }
        if (!overlockedFlyerDrag.active || overlockedFlyerDrag.inst !== inst) return;
        try {
          inst.stage.releasePointerCapture(e.pointerId);
        } catch (err2) { }
        overlockedFlyerDrag.active = false;
        overlockedFlyerDrag.inst = null;
        overlockedFlyerDrag.pointerId = null;
        clearDraggingUi();
        schedulePersistOverlockedFlyer();
      });

      inst.stage.addEventListener('pointercancel', function () {
        overlockedFlyerRotate.active = false;
        overlockedFlyerRotate.inst = null;
        overlockedFlyerRotate.pointerId = null;
        overlockedFlyerRotate.lastRad = null;
        overlockedFlyerDrag.active = false;
        overlockedFlyerDrag.inst = null;
        overlockedFlyerDrag.pointerId = null;
        clearDraggingUi();
      });

      inst.stage.addEventListener(
        'lostpointercapture',
        function () {
          overlockedFlyerRotate.active = false;
          overlockedFlyerRotate.inst = null;
          overlockedFlyerRotate.pointerId = null;
          overlockedFlyerRotate.lastRad = null;
          overlockedFlyerDrag.active = false;
          overlockedFlyerDrag.inst = null;
          overlockedFlyerDrag.pointerId = null;
          clearDraggingUi();
        },
      );

      inst.stage.addEventListener(
        'wheel',
        function (e) {
          if (e.altKey) {
            e.preventDefault();
            var factor = e.deltaY < 0 ? 1.09 : 1 / 1.09;
            state.imgZoom = Math.min(
              FLYER_IMG_ZOOM_MAX,
              Math.max(FLYER_IMG_ZOOM_MIN, state.imgZoom * factor),
            );
            clampPan();
            applyTransforms();
            updateLoupe();
            schedulePersistOverlockedFlyer();
            return;
          }
          if (!e.shiftKey) return;
          e.preventDefault();
          var d = e.deltaY > 0 ? -5 : 5;
          state.lensR = Math.min(FLYER_LENS_MAX, Math.max(FLYER_LENS_MIN, state.lensR + d));
          updateLoupe();
          schedulePersistOverlockedFlyer();
        },
        { passive: false },
      );

    });

    function flyerApplyZoomFactor(factor) {
      state.imgZoom = Math.min(
        FLYER_IMG_ZOOM_MAX,
        Math.max(FLYER_IMG_ZOOM_MIN, state.imgZoom * factor),
      );
      clampPan();
      applyTransforms();
      updateLoupe();
      schedulePersistOverlockedFlyer();
    }

    overlockedFlyerUi.flyerZoomIn = function () {
      if (currentSlug !== SLUG_OVER) return;
      flyerApplyZoomFactor(1.12);
    };
    overlockedFlyerUi.flyerZoomOut = function () {
      if (currentSlug !== SLUG_OVER) return;
      flyerApplyZoomFactor(1 / 1.12);
    };
    overlockedFlyerUi.flyerLensSmaller = function () {
      if (currentSlug !== SLUG_OVER) return;
      state.lensR = Math.max(FLYER_LENS_MIN, state.lensR - 8);
      updateLoupe();
      schedulePersistOverlockedFlyer();
    };
    overlockedFlyerUi.flyerLensLarger = function () {
      if (currentSlug !== SLUG_OVER) return;
      state.lensR = Math.min(FLYER_LENS_MAX, state.lensR + 8);
      updateLoupe();
      schedulePersistOverlockedFlyer();
    };
    overlockedFlyerUi.flyerFlipSide = function () {
      if (currentSlug !== SLUG_OVER) return;
      state.side = state.side === 'back' ? 'front' : 'back';
      applyFlyerScanSide();
      clampPan();
      applyTransforms();
      updateLoupe();
      writeOverlockedFlyerPersist();
    };
    overlockedFlyerUi.flyerResetRotation = function () {
      if (currentSlug !== SLUG_OVER) return;
      state.rotationDeg = 0;
      syncAfterRotationChange();
    };
    overlockedFlyerUi.flyerSnapRotation = function () {
      if (currentSlug !== SLUG_OVER) return;
      state.rotationDeg = Math.round(state.rotationDeg / 90) * 90;
      syncAfterRotationChange();
    };

    overlockedFlyerUi.dispatchKey = function (e) {
      if (currentSlug !== SLUG_OVER) return;
      if (!document.querySelector('.immersive-flyer[data-flyer-root]')) return;
      var target = document.activeElement;
      if (
        target &&
        (target.matches('input, textarea, select') || target.isContentEditable)
      ) {
        return;
      }
      if (e.altKey) {
        if (e.key === '=' || e.key === '+') {
          overlockedFlyerUi.flyerZoomIn();
          e.preventDefault();
          return;
        }
        if (e.key === '-' || e.key === '_') {
          overlockedFlyerUi.flyerZoomOut();
          e.preventDefault();
          return;
        }
      }
      if (e.key === '[') {
        overlockedFlyerUi.flyerLensSmaller();
        e.preventDefault();
      } else if (e.key === ']') {
        overlockedFlyerUi.flyerLensLarger();
        e.preventDefault();
      } else if (
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        (e.key === 'f' || e.key === 'F')
      ) {
        overlockedFlyerUi.flyerFlipSide();
        e.preventDefault();
      } else if (
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        (e.key === 'r' || e.key === 'R')
      ) {
        if (e.shiftKey) {
          overlockedFlyerUi.flyerSnapRotation();
        } else {
          overlockedFlyerUi.flyerResetRotation();
        }
        e.preventDefault();
      }
    };

    overlockedFlyerUi.onResize = function () {
      if (currentSlug !== SLUG_OVER) return;
      clampPan();
      applyTransforms();
      updateLoupe();
      schedulePersistOverlockedFlyer();
    };

    overlockedFlyerUi.endDrag = function () {
      clearDraggingUi();
    };

    if (!overlockedFlyerGlobalBound) {
      overlockedFlyerGlobalBound = true;
      document.addEventListener('keydown', function (e) {
        overlockedFlyerUi.dispatchKey(e);
      });
      window.addEventListener('resize', function () {
        overlockedFlyerUi.onResize();
      });
      document.addEventListener('pointerup', function (e) {
        if (overlockedFlyerRotate.active) {
          var instR = overlockedFlyerRotate.inst;
          var pidR = overlockedFlyerRotate.pointerId;
          overlockedFlyerRotate.active = false;
          overlockedFlyerRotate.inst = null;
          overlockedFlyerRotate.pointerId = null;
          overlockedFlyerRotate.lastRad = null;
          if (overlockedFlyerUi.endDrag) overlockedFlyerUi.endDrag();
          if (instR && instR.stage && pidR != null) {
            try {
              instR.stage.releasePointerCapture(pidR);
            } catch (relR) { }
          }
          schedulePersistOverlockedFlyer();
          return;
        }
        if (!overlockedFlyerDrag.active) return;
        var inst = overlockedFlyerDrag.inst;
        var pid = overlockedFlyerDrag.pointerId;
        overlockedFlyerDrag.active = false;
        overlockedFlyerDrag.inst = null;
        overlockedFlyerDrag.pointerId = null;
        if (overlockedFlyerUi.endDrag) overlockedFlyerUi.endDrag();
        if (inst && inst.stage && pid != null) {
          try {
            inst.stage.releasePointerCapture(pid);
          } catch (rel) { }
        }
        schedulePersistOverlockedFlyer();
      });
    }

    instances.forEach(function (inst) {
      if (!inst.sheet) return;
      inst.sheet.querySelectorAll('img').forEach(function (im) {
        im.addEventListener('load', function () {
          clampPan();
          applyTransforms();
          updateLoupe();
        });
      });
    });

    if (!overlockedFlyerUi.flyerActionClickBound) {
      overlockedFlyerUi.flyerActionClickBound = true;
      document.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-flyer-action]');
        if (!btn || currentSlug !== SLUG_OVER) return;
        e.preventDefault();
        var act = btn.getAttribute('data-flyer-action');
        if (act === 'zoom-in') {
          overlockedFlyerUi.flyerZoomIn();
        } else if (act === 'zoom-out') {
          overlockedFlyerUi.flyerZoomOut();
        } else if (act === 'lens-smaller') {
          overlockedFlyerUi.flyerLensSmaller();
        } else if (act === 'lens-larger') {
          overlockedFlyerUi.flyerLensLarger();
        } else if (act === 'reset-rotation') {
          overlockedFlyerUi.flyerResetRotation();
        } else if (act === 'snap-rotation') {
          overlockedFlyerUi.flyerSnapRotation();
        } else if (act === 'flip-side') {
          overlockedFlyerUi.flyerFlipSide();
        }
      });
    }

    if (!overlockedFlyerUi.hudToggleBound) {
      overlockedFlyerUi.hudToggleBound = true;
      document.addEventListener('click', function (e) {
        var tg = e.target.closest('.immersive-flyer__hud-toggle');
        if (!tg || currentSlug !== SLUG_OVER) return;
        e.preventDefault();
        var root = tg.closest('[data-flyer-root]');
        if (!root) return;
        var hidden = root.classList.toggle('is-flyer-help-hidden');
        tg.setAttribute('aria-expanded', hidden ? 'false' : 'true');
        tg.setAttribute(
          'title',
          hidden ? 'Show on-screen controls' : 'Hide on-screen controls',
        );
        tg.setAttribute(
          'aria-label',
          hidden ? 'Show on-screen controls' : 'Hide on-screen controls',
        );
      });
    }

    clampPan();
    applyTransforms();
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        clampPan();
        applyTransforms();
        updateLoupe();
      });
    });
  }

  var immersiveChromeDockBound = false;

  function bindImmersiveChromeDock() {
    if (immersiveChromeDockBound) return;
    var page = document.querySelector(
      '.immersive-page[data-slug="overlocked"], .immersive-page[data-slug="under-the-needles-eye"]',
    );
    if (!page || !document.getElementById('immersive-chrome-dock')) return;
    immersiveChromeDockBound = true;

    document.addEventListener('keydown', function onImmersiveChromeEscape(e) {
      if (e.key !== 'Escape') return;
      var p = document.querySelector(
        '.immersive-page[data-slug="overlocked"].is-chrome-collapsed, .immersive-page[data-slug="under-the-needles-eye"].is-chrome-collapsed',
      );
      if (!p) return;
      var t = e.target;
      if (
        t &&
        (t.matches('input, textarea, select') || t.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      p.classList.remove('is-chrome-collapsed');
      var toggle = document.getElementById('chrome-toggle-btn');
      if (toggle) {
        toggle.setAttribute('aria-pressed', 'false');
        toggle.setAttribute(
          'aria-label',
          'Hide interface. Press Escape to show again.',
        );
        toggle.title = 'Hide interface (Escape to show)';
      }
    });

    document.addEventListener('click', function onChromeToggleClick(e) {
      var tg = e.target.closest('#chrome-toggle-btn');
      if (!tg) return;
      var pg = tg.closest('.immersive-page');
      if (!pg) return;
      var collapsed = pg.classList.toggle('is-chrome-collapsed');
      tg.setAttribute('aria-pressed', collapsed ? 'true' : 'false');
      if (collapsed) {
        tg.setAttribute('aria-label', 'Show interface');
        tg.title = 'Show interface (Escape)';
      } else {
        tg.setAttribute(
          'aria-label',
          'Hide interface. Press Escape to show again.',
        );
        tg.title = 'Hide interface (Escape to show)';
      }
    });

    document.addEventListener('click', function onStoryDockClick(e) {
      var b = e.target.closest('[data-story-action]');
      if (!b || currentSlug !== SLUG_NEEDLE) return;
      e.preventDefault();
      var a = b.getAttribute('data-story-action');
      if (a === 'prev') goProject2Prev();
      else if (a === 'next') goProject2Next();
    });
  }

  var project2KeyboardBound = false;
  function initProject2Keyboard() {
    if (project2KeyboardBound) return;
    project2KeyboardBound = true;
    document.addEventListener('keydown', function onKey(e) {
      var page = document.querySelector('.immersive-page');
      if (!page) return;
      if (currentSlug !== SLUG_NEEDLE) return;
      var target = document.activeElement;
      if (target && (target.matches('input, textarea, select') || target.isContentEditable)) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goProject2Prev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goProject2Next();
      }
    });
  }

  function syncLawState() {
    var main = document.getElementById('immersive-inner');
    var inset = document.getElementById('immersive-inner-inset');
    [main, inset].forEach(function (root) {
      if (!root) return;
      var layout = root.querySelector('.law-layout');
      if (!layout) return;
      var slots = layout.querySelectorAll('.law-image-inline');
      var buttons = layout.querySelectorAll('.law-fragment');
      for (var i = 0; i < lawOpenState.length; i++) {
        var src = lawOpenState[i] || null;
        if (slots[i]) {
          slots[i].innerHTML = src
            ? '<img src="' + String(src).replace(/"/g, '&quot;') + '" alt="" />'
            : '';
        }
        if (buttons[i]) buttons[i].classList.toggle('is-active', !!src);
      }
    });
  }

  function initLawScroll(layout) {
    if (!layout || layout.dataset.lawScrollBound === '1') return;
    layout.dataset.lawScrollBound = '1';

    var scrollContainer = layout.closest('.immersive-main') || layout.closest('.abstraction-inset');
    if (!scrollContainer) return;

    var lastY = scrollContainer.scrollTop;
    var resetTimer = null;
    var fragments = layout.querySelectorAll('.law-fragment');
    if (!fragments.length) return;

    function applyTilt(deltaY) {
      if (!deltaY) return;
      var dir = deltaY > 0 ? 1 : -1;
      var intensity = Math.min(1, Math.abs(deltaY) / 40);
      var maxTranslate = 10;
      var maxRotate = 6;
      var offset = dir * maxTranslate * intensity;
      var angle = dir * maxRotate * intensity;

      fragments.forEach(function (btn, index) {
        var phase = index % 2 === 0 ? 1 : -1;
        btn.style.transform = 'translateY(' + (offset * phase) + 'px) rotate(' + (angle * phase) + 'deg)';
      });
    }

    function resetTilt() {
      fragments.forEach(function (btn) {
        btn.style.transform = '';
      });
    }

    function onScroll() {
      var y = scrollContainer.scrollTop;
      var delta = y - lastY;
      lastY = y;

      applyTilt(delta);

      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = setTimeout(function () {
        resetTilt();
      }, 260);
    }

    scrollContainer.addEventListener('scroll', onScroll);
  }

  function setAbstractionMode(on) {
    var panel = document.getElementById('immersive-abstraction');
    var page = document.querySelector('.immersive-page');
    if (!panel) return;
    if (on) {
      panel.classList.add('is-on');
      panel.setAttribute('aria-hidden', 'false');
      if (page) page.classList.add('is-abstracted');
      startCaptionRotation();
      if (currentSlug === SLUG_DANCE || currentSlug === SLUG_OVER) {
        var mainScroll = document.getElementById('immersive-content');
        var insetScroll = document.getElementById('abstraction-inset');
        if (mainScroll && insetScroll) {
          requestAnimationFrame(function () {
            insetScroll.scrollTop = mainScroll.scrollTop;
          });
        }
      }
    } else {
      if (currentSlug === SLUG_DANCE || currentSlug === SLUG_OVER) {
        var mainScroll2 = document.getElementById('immersive-content');
        var insetScroll2 = document.getElementById('abstraction-inset');
        if (mainScroll2 && insetScroll2) {
          mainScroll2.scrollTop = insetScroll2.scrollTop;
        }
      }
      panel.classList.remove('is-on');
      panel.setAttribute('aria-hidden', 'true');
      if (page) page.classList.remove('is-abstracted');
      stopCaptionRotation();
      hideBackdrop();
    }
  }

  function shuffleArray(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  /**
   * Returns a project slug string for caption routing (matches Sanity captions `project` field).
   */
  function normalizeCaptionProject(raw) {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'object') {
      if (raw.value !== undefined && raw.value !== null) return normalizeCaptionProject(raw.value);
      if (raw.label !== undefined && raw.label !== null) return normalizeCaptionProject(raw.label);
      return null;
    }
    var s = String(raw).trim();
    if (!s) return null;
    if (s === SLUG_DANCE || s === SLUG_NEEDLE || s === SLUG_OVER) return s;
    // Presentation / Stega can add invisible characters so strict equality fails
    var slugMatch = s.match(/(the-spontaneous-dance-falls|under-the-needles-eye|overlocked)/);
    if (slugMatch) return slugMatch[1];
    return null;
  }

  function normalizeCaptions(list) {
    if (!Array.isArray(list)) return [];
    return list.map(function (c) {
      if (!c) return null;
      var slug = normalizeCaptionProject(c.project);
      if (!slug) return null;
      var text = (c.text === null || c.text === undefined) ? '' : String(c.text);
      if (!text.trim()) return null;
      return { project: slug, text: text };
    }).filter(Boolean);
  }

  function getCaptionsForCurrentContext() {
    var fromSanity = window.SDV_CAPTIONS && Array.isArray(window.SDV_CAPTIONS) ? window.SDV_CAPTIONS : null;
    var source =
      fromSanity && fromSanity.length ? fromSanity : CAPTIONS_FALLBACK;
    var normalized = normalizeCaptions(source);
    var other = normalized.filter(function (c) { return c.project !== currentSlug; });
    return shuffleArray(other);
  }

  function startCaptionRotation() {
    stopCaptionRotation();
    currentCaptionPool = getCaptionsForCurrentContext();
    captionIndex = 0;
    updateCaptionDisplay();
    if (currentCaptionPool.length === 0) return;
    captionInterval = setInterval(function () {
      captionIndex = (captionIndex + 1) % currentCaptionPool.length;
      updateCaptionDisplay();
    }, 4000);
  }

  function updateCaptionDisplay() {
    var btn = document.getElementById('caption-current');
    if (!btn) return;
    var c = currentCaptionPool[captionIndex];
    if (c) {
      btn.textContent = c.text;
      btn.dataset.captionSlug = c.project;
    } else {
      btn.textContent = '';
      btn.removeAttribute('data-caption-slug');
    }
  }

  function stopCaptionRotation() {
    if (captionInterval) {
      clearInterval(captionInterval);
      captionInterval = null;
    }
  }

  function showBackdrop(targetSlug) {
    var backdrop = document.getElementById('abstraction-backdrop');
    var img = document.getElementById('abstraction-backdrop-img');
    var video = document.getElementById('abstraction-backdrop-video');
    var zoomBtn = document.getElementById('backdrop-zoom-btn');
    var page = document.querySelector('.immersive-page');
    if (!backdrop) return;
    var slug = normalizeCaptionProject(targetSlug) || SLUG_DANCE;
    var videoSrc = OVERLAY_VIDEO_BY_SLUG[slug];

    backdrop.dataset.targetSlug = slug;
    backdrop.removeAttribute('hidden');
    if (zoomBtn) {
      zoomBtn.dataset.targetSlug = slug;
      zoomBtn.removeAttribute('hidden');
    }
    if (videoSrc && video) {
      if (page) page.classList.add('backdrop-visible', 'backdrop-video');
      if (img) img.style.display = 'none';
      video.style.display = 'block';
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.src = getOverlayVideoUrl(assetUrl(videoSrc));
      video.load();
      video.play().catch(function () { });
      video.addEventListener('canplay', function onCanPlay() {
        video.removeEventListener('canplay', onCanPlay);
        video.play().catch(function () { });
      }, { once: true });
    } else {
      if (page) page.classList.add('backdrop-visible');
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.style.display = 'none';
      }
      if (img) {
        img.style.display = '';
        img.src = assetUrl(OVERLAY_IMAGE_BY_SLUG[slug] || OVERLAY_IMAGE_BY_SLUG[SLUG_NEEDLE]);
      }
    }
  }

  function hideBackdrop() {
    var backdrop = document.getElementById('abstraction-backdrop');
    var video = document.getElementById('abstraction-backdrop-video');
    var zoomBtn = document.getElementById('backdrop-zoom-btn');
    var page = document.querySelector('.immersive-page');
    if (backdrop) backdrop.setAttribute('hidden', '');
    if (zoomBtn) zoomBtn.setAttribute('hidden', '');
    if (page) page.classList.remove('backdrop-visible', 'backdrop-video');
    if (video) {
      video.pause();
      video.removeAttribute('src');
    }
  }

  function homeProjectsList() {
    return (window.SDV_HOME_PROJECTS && Array.isArray(window.SDV_HOME_PROJECTS)) ? window.SDV_HOME_PROJECTS : [];
  }

  function sanitizeHomeLineColor(raw) {
    var s = raw == null ? '' : String(raw).trim();
    if (!s) return '';
    return /^#[0-9A-Fa-f]{6}$/.test(s) ? s : '';
  }

  function updateHomeProject() {
    var img = document.getElementById('home-project-image');
    var view = document.querySelector('.view--home');
    var wrap = document.querySelector('.home-image-wrap');
    var list = homeProjectsList();
    var row = currentSlug ? list.find(function (p) { return p.slug === currentSlug; }) : null;

    if (!img || !view || !wrap) return;

    if (!row) {
      if (currentSlug) currentSlug = '';
      view.classList.add('is-home-idle');
      wrap.classList.remove('is-project-selected');
      img.setAttribute('hidden', '');
      img.removeAttribute('src');
      document.documentElement.style.setProperty('--home-line-accent', HOME_LINE_DEFAULT);
      document.querySelectorAll('.home-project').forEach(function (btn) {
        btn.classList.remove('is-active');
      });
      return;
    }

    view.classList.remove('is-home-idle');
    wrap.classList.add('is-project-selected');
    img.removeAttribute('hidden');
    if (row.splashUrl) {
      img.src = row.splashUrl;
    } else {
      img.src = assetUrl(OVERLAY_IMAGE_BY_SLUG[row.slug] || 'images/home/fall.jpg');
    }
    var lineCol =
      sanitizeHomeLineColor(row.homeLineColor) || HOME_LINE_BY_CONTEXT[row.slug] || '';
    document.documentElement.style.setProperty('--home-line-accent', lineCol || HOME_LINE_DEFAULT);

    document.querySelectorAll('.home-project').forEach(function (btn) {
      var s = btn.getAttribute('data-slug') || '';
      btn.classList.toggle('is-active', s === currentSlug);
    });
  }

  function getHomeMaterialsData() {
    var all = (window.SDV_ALL_MATERIALS && Array.isArray(window.SDV_ALL_MATERIALS)) ? window.SDV_ALL_MATERIALS : [];
    var bySlug = (window.SDV_PROJECT_MATERIALS && typeof window.SDV_PROJECT_MATERIALS === 'object') ? window.SDV_PROJECT_MATERIALS : {};
    return { all: all, bySlug: bySlug };
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

    document.querySelectorAll('.home-project').forEach(function (btn) {
      var slug = btn.getAttribute('data-slug') || '';
      var host = btn.querySelector('.home-project-material-icons');
      if (!host) return;

      if (!selected.size) {
        host.innerHTML = '';
        return;
      }

      var mats = (data.bySlug[slug] && Array.isArray(data.bySlug[slug].materials)) ? data.bySlug[slug].materials : [];
      var html = '';
      mats.forEach(function (m) {
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
        parsed.forEach(function (k) { if (k) selected.add(String(k)); });
      }
    } catch (e) { }

    var allowed = new Set(data.all.map(function (m) { return m.key; }));
    Array.from(selected).forEach(function (k) { if (!allowed.has(k)) selected.delete(k); });

    function labelForKey(key) {
      var hit = data.all.find(function (m) { return m.key === key; });
      return hit ? hit.label : key;
    }

    function selectedSummary() {
      if (!selected.size) return 'None selected';
      return data.all
        .filter(function (m) { return selected.has(m.key); })
        .map(function (m) { return m.label; })
        .join(', ');
    }

    function rerender() {
      renderHomeMaterialIcons(Array.from(selected));
      if (host.dataset.bound === '1') {
        host.querySelectorAll('.home-material-btn').forEach(function (btn) {
          btn.classList.toggle('is-on', selected.has(btn.dataset.materialKey));
          btn.setAttribute('aria-pressed', selected.has(btn.dataset.materialKey) ? 'true' : 'false');
        });
        var status = host.querySelector('.home-material-status');
        if (status) status.textContent = selectedSummary();
      }
      try {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(selected)));
      } catch (e) { }
    }

    if (host.dataset.bound === '1') {
      rerender();
      return;
    }
    host.dataset.bound = '1';

    var html = '' +
      '<div class="home-material-meta">' +
      '  <div class="home-material-title">Materials</div>' +
      '  <div class="home-material-status" aria-live="polite"></div>' +
      '</div>' +
      '<div class="home-material-row" role="group" aria-label="Filter by material">';
    data.all.forEach(function (m) {
      html += (
        '<button type="button" class="home-material-btn" data-material-key="' + m.key + '" aria-pressed="false" title="' +
        String(m.label).replace(/"/g, '&quot;') + '" aria-label="' + String(m.label).replace(/"/g, '&quot;') + '">' +
        materialIconSvg(m.key) +
        '</button>'
      );
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
      if (status) status.textContent = (selected.has(key) ? 'Selected: ' : 'Filter: ') + labelForKey(key);
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
      if (status) status.textContent = (selected.has(key) ? 'Selected: ' : 'Filter: ') + labelForKey(key);
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
      if (selected.has(key)) selected.delete(key); else selected.add(key);
      rerender();
    });

    rerender();
  }

  function initHomePage() {
    var homeImg = document.getElementById('home-project-image');
    if (!homeImg) return;

    var nav = document.querySelector('.home-projects');
    if (nav && nav.dataset.delegationBound !== '1') {
      nav.dataset.delegationBound = '1';
      nav.addEventListener('click', function (e) {
        var btn = e.target && e.target.closest ? e.target.closest('.home-project') : null;
        if (!btn) return;
        var s = btn.getAttribute('data-slug');
        if (s) currentSlug = s;
        updateHomeProject();
      });
    }

    function goToCurrentProject() {
      if (!currentSlug) return;
      window.location.href = withPreviewQuery('project/' + currentSlug + '/');
    }

    document.querySelector('.home-zoom-btn')?.addEventListener('click', function () {
      goToCurrentProject();
    });

    var imageWrap = document.querySelector('.home-image-wrap');
    if (imageWrap && imageWrap.dataset.openProjectBound !== '1') {
      imageWrap.dataset.openProjectBound = '1';
      imageWrap.addEventListener('click', function () {
        goToCurrentProject();
      });
    }

    updateHomeProject();
    renderHomeMaterialToggle();
  }

  function bindImmersiveChromeOnce() {
    var root = document.querySelector('.immersive-page');
    if (!root || root.dataset.appImmersiveUiBound === '1') return;
    root.dataset.appImmersiveUiBound = '1';

    var pathSlug = immersiveSlugFromPath();
    if (pathSlug) currentSlug = pathSlug;

    initProject2Keyboard();

    setAbstractionMode(false);
    hideBackdrop();
    startCaptionRotation();

    bindImmersiveChromeDock();

    document.getElementById('abstraction-btn')?.addEventListener('click', function () {
      var panel = document.getElementById('immersive-abstraction');
      var isOn = panel && panel.classList.contains('is-on');
      setAbstractionMode(!isOn);
    });

    document.getElementById('caption-current')?.addEventListener('click', function () {
      var slug = this.dataset.captionSlug;
      if (!slug) return;
      showBackdrop(slug);
    });

    document.getElementById('abstraction-backdrop')?.addEventListener('click', function () {
      var slug = this.dataset.targetSlug || currentSlug;
      hideBackdrop();
      window.location.href = withPreviewQuery('../../immersive/' + slug + '/');
    });

    document.getElementById('backdrop-zoom-btn')?.addEventListener('click', function (e) {
      e.preventDefault();
      var slug = this.dataset.targetSlug || currentSlug;
      hideBackdrop();
      window.location.href = withPreviewQuery('../../project/' + slug + '/');
    });
  }

  function onImmersiveReady(ev) {
    var slug = (ev && ev.detail && ev.detail.slug) ? String(ev.detail.slug) : immersiveSlugFromPath();
    if (!document.querySelector('.immersive-page')) return;
    currentSlug = slug || currentSlug;
    document.querySelectorAll('.immersive-story').forEach(function (el) {
      el.removeAttribute('data-bound');
    });
    initImmersiveInteractions(slug);
    stopCaptionRotation();
    startCaptionRotation();
  }

  function initImmersivePage() {
    if (!document.querySelector('.immersive-page')) return;
    bindImmersiveChromeOnce();
  }

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

    up.addEventListener('click', function () { shift('up'); });
    down.addEventListener('click', function () { shift('down'); });

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

  function onHomeReady() {
    var list = homeProjectsList();
    if (!list.length) {
      currentSlug = '';
      updateHomeProject();
      renderHomeMaterialToggle();
      return;
    }
    if (currentSlug && !list.some(function (p) { return p.slug === currentSlug; })) {
      currentSlug = '';
    }
    updateHomeProject();
    renderHomeMaterialToggle();
  }

  document.addEventListener('DOMContentLoaded', function () {
    initHomePage();
    initImmersivePage();
    initProjectSplitFocusToggle();
  });

  window.addEventListener('sdv:home', onHomeReady);

  window.addEventListener('sdv:materials', function () {
    if (!document.getElementById('home-project-image')) return;
    renderHomeMaterialToggle();
  });

  window.addEventListener('sdv:captions', function () {
    if (!document.querySelector('.immersive-page')) return;
    startCaptionRotation();
  });

  window.addEventListener('sdv:immersive-ready', onImmersiveReady);
})();
