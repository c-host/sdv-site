(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // PROJECT DATA (will be moved to CMS-managed content next)
  // ---------------------------------------------------------------------------

  // Thumbnail images shown on the Home page; keyed by project id.
  // Use relative paths so this works on Netlify + local file previews.
  const PROJECT_IMAGES = {
    1: 'images/home/fall.jpg',
    2: 'images/home/needle.jpg',
    3: 'images/home/overlocked.jpg',
  };

  const PROJECT_SLUGS = {
    1: 'the-spontaneous-dance-falls',
    2: 'under-the-needles-eye',
    3: 'overlocked',
  };

  const SLUG_TO_PROJECT = {
    'the-spontaneous-dance-falls': 1,
    'under-the-needles-eye': 2,
    'overlocked': 3,
  };

  function getPathDepth() {
    var parts = (window.location.pathname || '').split('/').filter(Boolean);
    return parts.length;
  }

  function rootPrefix() {
    return '../'.repeat(getPathDepth());
  }

  function assetUrl(path) {
    var s = String(path || '');
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith('/')) s = s.slice(1);
    return rootPrefix() + s;
  }

  // Ordered list of image paths for Project 2's immersive photo story slider.
  const PROJECT2_IMAGES = [
    'images/project-overviews/under-the-needles-eye/1_needle.jpg',
    'images/project-overviews/under-the-needles-eye/2_needle.jpg',
    'images/project-overviews/under-the-needles-eye/3_needle.jpg',
    'images/project-overviews/under-the-needles-eye/4_needle.jpg',
    'images/project-overviews/under-the-needles-eye/5_needle.jpg',
    'images/project-overviews/under-the-needles-eye/6_needle.jpg',
    'images/project-overviews/under-the-needles-eye/7_needle.jpg',
    'images/project-overviews/under-the-needles-eye/8_needle.jpg',
    'images/project-overviews/under-the-needles-eye/9_needle.jpg',
    'images/project-overviews/under-the-needles-eye/10_needle.jpg',
    'images/project-overviews/under-the-needles-eye/11_needle.jpg',
    'images/project-overviews/under-the-needles-eye/12_needle.jpg',
    'images/project-overviews/under-the-needles-eye/13_needle.jpg',
    'images/project-overviews/under-the-needles-eye/14_needle.jpg',
    'images/project-overviews/under-the-needles-eye/15_needle.jpg',
  ];

  // Text fragments for Project 2 slider; one entry per slide (raw HTML).
  const PROJECT2_TEXT_FRAGMENTS = [
    '<h2>Under the Needle\u2019s Eye</h2>',
    '<p>A lost textile industry forms the departing point of Stacey de Voe\u2019s exhibition <strong>Under the Needle\u2019s Eye</strong> (Under n\u00e5lens \u00f6ga).</p>',
    '<p>In K\u00fcrzel\u2019s Factory (1896\u20131955), where Sk\u00e5nes konstf\u00f6rening\u2019s premises are located, worked spinners, dyers, weavers, union representatives and managers.</p>',
    '<p>De Voe engages with the context and develops site-specific works that stage the memory of the locale as an intricate supervisor and a world dressed in tartan and duvetyne.</p>',
    '<p>A 200 kg iron gate has been brought to the exhibition, richly ornamented with twisting, sharp foliage that once closed off the factory area from Ystadsv\u00e4gen.</p>',
    '<p>Otherwise, there are only a few remaining traces in the archive; brief statements in the union\u2019s protocols provide some insights.</p>',
    '<p>Someone lost an eye at a machine, another was punished for wearing the wrong coat, a third was fired after breaking a needle in machinery.</p>',
    '<p>The 50th anniversary book <em>Warp and Weft</em> (Varp och v\u00e4ft) from 1946 shows the management\u2019s gaze on the factory\u2019s achievements.</p>',
    '<p>The book also details how the workers\u2019 vacations and leisure activities were organized.</p>',
    '<p>The limited sources give way to fiction and the historical materials are allowed to take on new forms.</p>',
    '<p>The video essay <em>Revised edition</em> (2024) \u2013 composed as an inverted silent film that emphasizes text rather than image \u2013 modulates the language of the anniversary book.</p>',
    '<p>It samples images of daily life at the factory and stories of workplace incidents, without reconstructing a single historical event.</p>',
    '<p>Instead, with the distance of time, a new narrative emerges: the memory of modernity, of workers under an ever-watchful eye and of weaving witches.</p>',
    '<p>The payrolls, reproduced for the exhibition as graphic prints, show the factory\u2019s production line as a gender-coded hierarchy of some thirty positions with different salaries.</p>',
    '<p>The textiles, objects, images and words act as citations in an incomplete story of a bygone place, shaped by de Voe\u2019s own experiences from the textile industry, provoking reflections between industrial memory and contemporary labour politics.</p>',
  ];

  // Captions used in abstraction mode (will become CMS-managed).
  const CAPTIONS = [
    { project: 1, text: 'Project 1 Caption [TBD].' },
    { project: 3, text: 'There were opportunities back then, it was the land of opportunities.' },
    { project: 3, text: 'People work hard for their money here.' },
    { project: 3, text: 'We have to have a whip, the clock is our whip.' },
    { project: 2, text: 'The witches spun with the intention of remembering.' },
    { project: 2, text: 'An I for an eye.' },
  ];

  // Backdrop media behind abstraction captions.
  const OVERLAY_VIDEO = {
    1: 'images/captions/dance_falls_film_loop.mp4',
    2: 'images/captions/needle_film_loop.mp4',
    3: 'images/captions/overlocked_film_loop.mp4',
  };
  const OVERLAY_IMAGES = {
    1: 'images/home/fall.jpg',
    2: 'images/home/needle.jpg',
    3: 'images/home/overlocked.jpg',
  };

  function getOverlayVideoUrl(relativePath) {
    try {
      return new URL(relativePath, window.location.href).href;
    } catch (e) {
      return relativePath;
    }
  }

  // ---------------------------------------------------------------------------
  // GLOBAL UI STATE
  // ---------------------------------------------------------------------------

  let currentProject = 1;
  let captionIndex = 0;
  let captionInterval = null;
  let currentCaptionPool = [];
  let currentProject2Slide = 0;

  // For project 1's law text layout, we keep track of which inline images are open.
  var lawOpenState = [];

  /**
   * Initialize any project-specific immersive behavior after HTML is loaded.
   * - Project 1: interactive law text + scroll animations.
   * - Project 2: image slider and keyboard navigation.
   * - Project 3: currently static (no extra wiring required).
   */
  function initImmersiveInteractions(projectId) {
    if (projectId === 1) {
      initProject1Immersive();
    } else if (projectId === 2) {
      initProject2Immersive();
    }
  }

  /**
   * Project 1 immersive setup:
   * - Finds all .law-fragment buttons in both main and inset copies.
   * - Clicking a fragment toggles an image in the matching .law-image-inline span.
   * - lawOpenState keeps the open/closed state in sync between main and inset.
   * - initLawScroll adds a subtle tilt effect while scrolling.
   */
  function initProject1Immersive() {
    var main = document.getElementById('immersive-inner');
    var inset = document.getElementById('immersive-inner-inset');
    if (!main) return;

    var mainLayout = main.querySelector('.law-layout');
    if (!mainLayout) return;
    var mainFragments = mainLayout.querySelectorAll('.law-fragment');
    if (!mainFragments.length) return;

    if (!lawOpenState || lawOpenState.length !== mainFragments.length) {
      lawOpenState = [];
      for (var i = 0; i < mainFragments.length; i++) lawOpenState[i] = null;
    }

    // Attach click handlers to all .law-fragment buttons under a given root.
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

    // Bind scroll-based motion for both main and inset layouts.
    initLawScroll(mainLayout);
    if (inset) {
      var insetLayout = inset.querySelector('.law-layout');
      if (insetLayout) initLawScroll(insetLayout);
    }
  }

  /**
   * Helpers for Project 2 immersive (photo story slider)
   * ---------------------------------------------------
   * Project 2 has identical .immersive-story blocks in both main and inset
   * containers; we treat them in parallel so both stay in sync.
   */

  function getProject2Roots() {
    var main = document.getElementById('immersive-inner');
    var inset = document.getElementById('immersive-inner-inset');
    var roots = [];
    if (main) {
      var mainRoot = main.querySelector('.immersive-story[data-project="2"]');
      if (mainRoot) roots.push(mainRoot);
    }
    if (inset) {
      var insetRoot = inset.querySelector('.immersive-story[data-project="2"]');
      if (insetRoot) roots.push(insetRoot);
    }
    return roots;
  }

  // For a given .immersive-story root, return both image elements and the wrap.
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

  // Mark one of the two images as \"front\" (visible) and remember which is active.
  function setProject2Front(root, which) {
    var imgs = getProject2Images(root);
    if (!imgs) return;
    imgs.wrap.dataset.storyFront = which;
    imgs.imgA.classList.toggle('is-front', which === 'a');
    imgs.imgB.classList.toggle('is-front', which === 'b');
  }

  /**
   * Render a given slide index for Project 2:
   * - Computes nextIndex with wraparound.
   * - For each .immersive-story root:
   *   - Updates the back image src/alt.
   *   - Crossfades front→back with a blur/scale effect.
   *   - Updates text with the matching PROJECT2_TEXT_FRAGMENTS entry.
   * - If options.immediate is true, skips the animation and shows the slide directly.
   */
  function renderProject2Slide(index, options) {
    if (!PROJECT2_IMAGES.length) return;
    var total = PROJECT2_IMAGES.length;
    var nextIndex = index;
    if (nextIndex < 0) nextIndex = total - 1;
    if (nextIndex >= total) nextIndex = 0;
    currentProject2Slide = nextIndex;

    var roots = getProject2Roots();
    if (!roots.length) return;

    var immediate = options && options.immediate;
    var newSrc = assetUrl(PROJECT2_IMAGES[currentProject2Slide]);
    var newAlt = 'Under the Needle\u2019s Eye, frame ' + (currentProject2Slide + 1);
    var newHtml = PROJECT2_TEXT_FRAGMENTS[currentProject2Slide] || '';

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

    var pending = roots.length;
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

  // Navigate one slide backward in the Project 2 sequence.
  function goProject2Prev() {
    renderProject2Slide(currentProject2Slide - 1);
  }

  // Navigate one slide forward in the Project 2 sequence.
  function goProject2Next() {
    renderProject2Slide(currentProject2Slide + 1);
  }

  /**
   * Bind Project 2 immersive interactions:
   * - Attaches click listeners to prev/next buttons.
   * - Ensures we only bind once per root (uses data-bound flag).
   * - Renders the initial slide immediately.
   */
  function initProject2Immersive() {
    var roots = getProject2Roots();
    if (!roots.length) return;

    roots.forEach(function (root) {
      if (root.dataset.bound === '1') return;
      root.dataset.bound = '1';

      var prevBtn = root.querySelector('.immersive-story__nav--prev');
      var nextBtn = root.querySelector('.immersive-story__nav--next');

      if (prevBtn) {
        prevBtn.addEventListener('click', goProject2Prev);
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', goProject2Next);
      }
    });

    renderProject2Slide(currentProject2Slide, { immediate: true });
  }

  /**
   * Global keyboard navigation for Project 2 immersive:
   * - When immersive view is visible and currentProject === 2:
   *   - ArrowLeft → previous slide.
   *   - ArrowRight → next slide.
   * - Skips if a text input/textarea/select/contenteditable is focused.
   */
  function initProject2Keyboard() {
    document.addEventListener('keydown', function onKey(e) {
      var page = document.querySelector('.immersive-page');
      if (!page) return;
      if (currentProject !== 2) return;
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

  /**
   * Re-render law text state for Project 1 in both main and inset layouts:
   * - For each entry in lawOpenState:
   *   - If it holds an image src, render an <img> in the matching .law-image-inline.
   *   - Toggle .is-active on the corresponding .law-fragment.
   */
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
          slots[i].innerHTML = src ? '<img src="' + src + '" alt="" />' : '';
        }
        if (buttons[i]) buttons[i].classList.toggle('is-active', !!src);
      }
    });
  }

  /**
   * Attach scroll-based tilt motion for .law-fragment buttons in the given layout.
   * - Watches scrollTop on the nearest .immersive-main or .abstraction-inset.
   * - Applies a small translateY/rotate transform to all fragments based on scroll direction.
   * - Resets the transform after a short delay when scrolling stops.
   */
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

  /**
   * Turn abstraction mode on/off.
   * - When ON:
   *   - #immersive-abstraction gets .is-on and aria-hidden=\"false\".
   *   - .immersive-page gets .is-abstracted.
   *   - Starts caption rotation.
   *   - For project 1, syncs inset scrollTop to match main scrollTop.
   * - When OFF:
   *   - Reverses the above, stops caption rotation, and hides any active backdrop.
   */
  function setAbstractionMode(on) {
    const panel = document.getElementById('immersive-abstraction');
    const page = document.querySelector('.immersive-page');
    if (!panel) return;
    if (on) {
      panel.classList.add('is-on');
      panel.setAttribute('aria-hidden', 'false');
      if (page) page.classList.add('is-abstracted');
      startCaptionRotation();
      if (currentProject === 1) {
        const mainScroll = document.getElementById('immersive-content');
        const insetScroll = document.getElementById('abstraction-inset');
        if (mainScroll && insetScroll) {
          requestAnimationFrame(function () {
            insetScroll.scrollTop = mainScroll.scrollTop;
          });
        }
      }
    } else {
      if (currentProject === 1) {
        const mainScroll = document.getElementById('immersive-content');
        const insetScroll = document.getElementById('abstraction-inset');
        if (mainScroll && insetScroll) {
          mainScroll.scrollTop = insetScroll.scrollTop;
        }
      }
      panel.classList.remove('is-on');
      panel.setAttribute('aria-hidden', 'true');
      if (page) page.classList.remove('is-abstracted');
      stopCaptionRotation();
      hideBackdrop();
    }
  }

  // Simple Fisher-Yates shuffle used to randomize caption order.
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
   * Build a shuffled list of captions for the current project context.
   * - Always excludes captions whose project === currentProject.
   */
  function getCaptionsForCurrentContext() {
    var source = (window.SDV_CAPTIONS && Array.isArray(window.SDV_CAPTIONS)) ? window.SDV_CAPTIONS : CAPTIONS;
    var other = source.filter(function (c) { return c.project !== currentProject; });
    return shuffleArray(other);
  }

  /**
   * Begin (or restart) rotating captions in abstraction mode.
   * - Populates currentCaptionPool (filtered + shuffled).
   * - Immediately calls updateCaptionDisplay().
   * - If there are captions, sets up a 4s interval to advance captionIndex.
   */
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

  /**
   * Write the current caption into #caption-current and store its project id in data-project.
   */
  function updateCaptionDisplay() {
    const btn = document.getElementById('caption-current');
    if (!btn) return;
    var c = currentCaptionPool[captionIndex];
    if (c) {
      btn.textContent = c.text;
      btn.dataset.project = String(c.project);
    } else {
      btn.textContent = '';
      btn.removeAttribute('data-project');
    }
  }

  /** Stop the caption rotation interval if it is running. */
  function stopCaptionRotation() {
    if (captionInterval) {
      clearInterval(captionInterval);
      captionInterval = null;
    }
  }

  /**
   * Show a backdrop (image or looping video) behind the abstraction panel.
   * - projectId determines which OVERLAY_VIDEO entry to use.
   * - If a video exists, plays it; otherwise falls back to a static image
   *   referenced by OVERLAY_IMAGES (defined elsewhere).
   * - Also shows a zoom button that can deep-link into that project’s immersive view.
   */
  function showBackdrop(projectId) {
    const backdrop = document.getElementById('abstraction-backdrop');
    const img = document.getElementById('abstraction-backdrop-img');
    const video = document.getElementById('abstraction-backdrop-video');
    const zoomBtn = document.getElementById('backdrop-zoom-btn');
    const page = document.querySelector('.immersive-page');
    if (!backdrop) return;
    var id = parseInt(projectId, 10) || 1;
    var videoSrc = OVERLAY_VIDEO[id];

    backdrop.dataset.targetProject = String(id);
    backdrop.removeAttribute('hidden');
    if (zoomBtn) {
      zoomBtn.dataset.targetProject = String(id);
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
        img.src = assetUrl(OVERLAY_IMAGES[id] || OVERLAY_IMAGES[2]);
      }
    }
  }

  /**
   * Hide any active backdrop and stop any playing overlay video.
   */
  function hideBackdrop() {
    const backdrop = document.getElementById('abstraction-backdrop');
    const video = document.getElementById('abstraction-backdrop-video');
    const zoomBtn = document.getElementById('backdrop-zoom-btn');
    const page = document.querySelector('.immersive-page');
    if (backdrop) backdrop.setAttribute('hidden', '');
    if (zoomBtn) zoomBtn.setAttribute('hidden', '');
    if (page) page.classList.remove('backdrop-visible', 'backdrop-video');
    if (video) {
      video.pause();
      video.removeAttribute('src');
    }
  }

  // ---------------------------------------------------------------------------
  // MULTI-PAGE INIT: bind only what exists on the current page.
  // ---------------------------------------------------------------------------

  function getProjectIdFromPath() {
    var p = window.location.pathname || '';
    var m = p.match(/\/(project|immersive)\/(\d)\/?$/);
    if (m && m[2]) return parseInt(m[2], 10);
    return null;
  }

  function updateHomeProject() {
    const img = document.getElementById('home-project-image');
    if (img) img.src = PROJECT_IMAGES[currentProject] || PROJECT_IMAGES[1];
    document.querySelectorAll('.home-project').forEach(function (btn) {
      btn.classList.toggle('is-active', parseInt(btn.dataset.project, 10) === currentProject);
    });
  }

  function getHomeMaterialsData() {
    var all = (window.SDV_ALL_MATERIALS && Array.isArray(window.SDV_ALL_MATERIALS)) ? window.SDV_ALL_MATERIALS : [];
    var bySlug = (window.SDV_PROJECT_MATERIALS && typeof window.SDV_PROJECT_MATERIALS === 'object') ? window.SDV_PROJECT_MATERIALS : {};
    return { all: all, bySlug: bySlug };
  }

  function materialIconSvg(key) {
    var stroke = 'currentColor';
    var sw = '1.5';
    switch (key) {
      case 'glass':
        return (
          '<svg class="home-material-icon" viewBox="0 0 24 24" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '">' +
          '<path d="M6 3h12l-5 8v8l-2 2-2-2v-8L6 3z" />' +
          '</svg>'
        );
      case 'metal':
        return (
          '<svg class="home-material-icon" viewBox="0 0 24 24" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '">' +
          '<path d="M4 14l6-6 10 10-6 6L4 14z" />' +
          '<path d="M9 9l6 6" />' +
          '</svg>'
        );
      case 'textile':
        return (
          '<svg class="home-material-icon" viewBox="0 0 24 24" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '">' +
          '<rect x="5" y="6" width="14" height="12" rx="1" />' +
          '<path d="M8 6v12M12 6v12M16 6v12" />' +
          '</svg>'
        );
      case 'synthetic':
        return (
          '<svg class="home-material-icon" viewBox="0 0 24 24" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '">' +
          '<path d="M12 3c4 0 7 2.7 7 6.5 0 4.6-4.2 6.8-7 11.5-2.8-4.7-7-6.9-7-11.5C5 5.7 8 3 12 3z" />' +
          '<path d="M9 10c1.2 1 2.2 1.5 3 1.5S13.8 11 15 10" />' +
          '</svg>'
        );
      case 'archive':
        return (
          '<svg class="home-material-icon" viewBox="0 0 24 24" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '">' +
          '<path d="M7 3h7l3 3v15H7V3z" />' +
          '<path d="M14 3v4h4" />' +
          '<path d="M9 11h6M9 15h6" />' +
          '</svg>'
        );
      case 'av':
        return (
          '<svg class="home-material-icon" viewBox="0 0 24 24" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '">' +
          '<path d="M4 10v4" />' +
          '<path d="M7 8v8" />' +
          '<path d="M10 6v12" />' +
          '<path d="M14 8v8" />' +
          '<path d="M17 10v4" />' +
          '<path d="M20 11v2" />' +
          '</svg>'
        );
      case 'performance':
        return (
          '<svg class="home-material-icon" viewBox="0 0 24 24" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '">' +
          '<circle cx="12" cy="7" r="2" />' +
          '<path d="M8 21l2-6 2-2 2 2 2 6" />' +
          '<path d="M10 13l-2-2M14 13l2-2" />' +
          '</svg>'
        );
      case 'objects':
        return (
          '<svg class="home-material-icon" viewBox="0 0 24 24" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '">' +
          '<rect x="6" y="6" width="12" height="12" rx="1" />' +
          '<path d="M9 10h6M9 14h6" />' +
          '</svg>'
        );
      default:
        return (
          '<svg class="home-material-icon" viewBox="0 0 24 24" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '">' +
          '<circle cx="12" cy="12" r="8" />' +
          '<path d="M8 12h8" />' +
          '</svg>'
        );
    }
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
      var id = parseInt(btn.dataset.project, 10) || 1;
      var slug = PROJECT_SLUGS[id] || PROJECT_SLUGS[1];
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

    if (host.dataset.bound === '1') return;
    host.dataset.bound = '1';

    var storageKey = 'sdv.homeMaterials.selected';
    var selected = new Set();
    try {
      var raw = localStorage.getItem(storageKey);
      var parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) {
        parsed.forEach(function (k) { if (k) selected.add(String(k)); });
      }
    } catch (e) { }

    // Remove any stored keys that no longer exist.
    var allowed = new Set(data.all.map(function (m) { return m.key; }));
    Array.from(selected).forEach(function (k) { if (!allowed.has(k)) selected.delete(k); });

    function labelForKey(key) {
      var hit = data.all.find(function (m) { return m.key === key; });
      return hit ? hit.label : key;
    }

    function selectedSummary() {
      if (!selected.size) return 'None selected';
      // Always follow the icon order (data.all), not selection order.
      return data.all
        .filter(function (m) { return selected.has(m.key); })
        .map(function (m) { return m.label; })
        .join(', ');
    }

    function rerender() {
      renderHomeMaterialIcons(Array.from(selected));
      host.querySelectorAll('.home-material-btn').forEach(function (btn) {
        btn.classList.toggle('is-on', selected.has(btn.dataset.materialKey));
        btn.setAttribute('aria-pressed', selected.has(btn.dataset.materialKey) ? 'true' : 'false');
      });
      var status = host.querySelector('.home-material-status');
      if (status) status.textContent = selectedSummary();
      try {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(selected)));
      } catch (e) { }
    }

    var html = '' +
      '<div class="home-material-meta">' +
      '  <div class="home-material-title">Materials</div>' +
      '  <div class="home-material-status" aria-live="polite"></div>' +
      '</div>' +
      '<div class="home-material-row" role="group" aria-label="Filter by material">';
    data.all.forEach(function (m) {
      html += (
        '<button type="button" class="home-material-btn" data-material-key="' + m.key + '" aria-pressed="false" title="' + m.label + '" aria-label="' + m.label + '">' +
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

    currentProject = 1;
    updateHomeProject();

    renderHomeMaterialToggle();

    function goToCurrentProject() {
      var slug = PROJECT_SLUGS[currentProject] || PROJECT_SLUGS[1];
      window.location.href = 'project/' + slug + '/';
    }

    document.querySelectorAll('.home-project').forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentProject = parseInt(btn.dataset.project, 10) || 1;
        updateHomeProject();
      });
    });

    document.querySelector('.home-zoom-btn')?.addEventListener('click', function () {
      goToCurrentProject();
    });

    // Clicking the home image should behave like the zoom button.
    homeImg.style.cursor = 'pointer';
    homeImg.addEventListener('click', function () {
      goToCurrentProject();
    });
  }

  function initImmersivePage() {
    var immersiveRoot = document.querySelector('.immersive-page');
    if (!immersiveRoot) return;

    var id = parseInt(immersiveRoot.getAttribute('data-project') || '', 10) || getProjectIdFromPath() || 1;
    currentProject = id;

    initImmersiveInteractions(currentProject);
    initProject2Keyboard();

    setAbstractionMode(false);
    hideBackdrop();
    startCaptionRotation();

    document.getElementById('abstraction-btn')?.addEventListener('click', function () {
      const panel = document.getElementById('immersive-abstraction');
      const isOn = panel && panel.classList.contains('is-on');
      setAbstractionMode(!isOn);
    });

    document.getElementById('caption-current')?.addEventListener('click', function () {
      const projectId = parseInt(this.dataset.project, 10);
      if (!projectId) return;
      showBackdrop(projectId);
    });

    document.getElementById('abstraction-backdrop')?.addEventListener('click', function () {
      const projectId = this.dataset.targetProject || '1';
      hideBackdrop();
      var slug = PROJECT_SLUGS[parseInt(projectId, 10) || 1] || PROJECT_SLUGS[1];
      window.location.href = '../../immersive/' + slug + '/';
    });

    document.getElementById('backdrop-zoom-btn')?.addEventListener('click', function (e) {
      e.preventDefault();
      const projectId = this.dataset.targetProject || '1';
      hideBackdrop();
      var slug = PROJECT_SLUGS[parseInt(projectId, 10) || 1] || PROJECT_SLUGS[1];
      window.location.href = '../../project/' + slug + '/';
    });
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
        // Keep state stable when leaving mobile, but normalize the CSS variable target.
        setMode('balanced');
      } else {
        // If entering mobile, ensure we start in balanced (requested default).
        setMode(normalizeMode(split.dataset.split || 'balanced'));
      }
    }

    // React to viewport changes without requiring a refresh.
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

  document.addEventListener('DOMContentLoaded', function () {
    initHomePage();
    initImmersivePage();
    initProjectSplitFocusToggle();
  });

  window.addEventListener('sdv:materials', function () {
    if (!document.getElementById('home-project-image')) return;
    renderHomeMaterialToggle();
  });

  window.addEventListener('sdv:captions', function () {
    var immersiveRoot = document.querySelector('.immersive-page');
    if (!immersiveRoot) return;
    startCaptionRotation();
  });
})();
