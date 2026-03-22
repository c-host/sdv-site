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
  /** When Sanity `homeLineColor` is empty; aligns with context/*.md line color notes. */
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
      if (currentSlug === SLUG_DANCE) {
        var mainScroll = document.getElementById('immersive-content');
        var insetScroll = document.getElementById('abstraction-inset');
        if (mainScroll && insetScroll) {
          requestAnimationFrame(function () {
            insetScroll.scrollTop = mainScroll.scrollTop;
          });
        }
      }
    } else {
      if (currentSlug === SLUG_DANCE) {
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
