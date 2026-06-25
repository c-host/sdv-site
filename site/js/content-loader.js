/**
 * Fetches Sanity content, updates the DOM, and wires Presentation visual editing.
 * Depends on sdv-shared.js (window.SDV).
 * Globals: SDV_HOME_PROJECTS, SDV_PROJECT_MATERIALS, SDV_ALL_MATERIALS, SDV_FLYER_IMAGES.
 * Events: sdv:home, sdv:materials, sdv:immersive-ready, sdv:project-tab.
 */
(function () {
  'use strict';

  var SDV = window.SDV;
  if (!SDV || typeof SDV.rootPrefix !== 'function') {
    console.warn('[sdv] sdv-shared.js must load before content-loader.js');
    return;
  }

  var SANITY_CONFIG = (window.SDV_SANITY_CONFIG && typeof window.SDV_SANITY_CONFIG === 'object')
    ? window.SDV_SANITY_CONFIG
    : {};
  var SANITY_PROJECT_ID = String(SANITY_CONFIG.projectId || 'mei3zxrq');
  var SANITY_DATASET = String(SANITY_CONFIG.dataset || 'production');
  var SANITY_API_VERSION = String(SANITY_CONFIG.apiVersion || '2025-02-19');

  var isPreviewEnabled = SDV.isPreviewEnabled;

  function detectStudioUrl() {
    var configured = String(SANITY_CONFIG.studioUrl || '').trim();
    if (configured) return configured;
    try {
      if (document.referrer) {
        var ref = new URL(document.referrer);
        if (/localhost|127\.0\.0\.1|sanity\.studio$/i.test(ref.hostname)) {
          return ref.origin;
        }
      }
    } catch (e) { }
    if (isPreviewEnabled()) return 'https://sdv-site.sanity.studio';
    return 'http://127.0.0.1:3333';
  }

  var SANITY_STUDIO_URL = detectStudioUrl();

  var SDV_PREVIEW = {
    projectsBySlug: {},
    info: null,
    homeProjects: null,
    homePageDoc: null,
  };

  var HOME_PAGE_DOC_ID = 'homePageConfig';
  var SITE_MATERIALS_DOC_ID = 'siteMaterials';

  var PREVIEW_TOKEN_KEY = 'sdv.preview.token';
  var SDV_PREVIEW_TOKEN = '';

  function getPreviewToken() {
    try {
      var qs = new URLSearchParams(window.location.search || '');
      var tokenFromQuery = String(qs.get('sdvDraftToken') || '').trim();
      if (tokenFromQuery) {
        sessionStorage.setItem(PREVIEW_TOKEN_KEY, tokenFromQuery);
        return tokenFromQuery;
      }
      var tokenFromStorage = sessionStorage.getItem(PREVIEW_TOKEN_KEY) || '';
      return String(tokenFromStorage).trim();
    } catch (e) {
      return '';
    }
  }

  function canUseDraftPreview() {
    return isPreviewEnabled() && !!SDV_PREVIEW_TOKEN;
  }

  /** True only when server-side draft mode is wired (not our static python host). */
  function isDraftModeActive() {
    return canUseDraftPreview();
  }

  function isDraftDocumentId(id) {
    return String(id || '').indexOf('drafts.') === 0;
  }

  SDV_PREVIEW_TOKEN = getPreviewToken();
  var sanityCreateClientPromise = null;
  var previewSanityClient = null;
  var previewSanityClientKey = '';
  var publicSanityClient = null;
  var visualEditingSetupPromise = null;

  /** Bundled with sanity-visual-editing.bundle.js (sanity-studio: npm run build:visual-editing). */
  var SANITY_CLIENT_ESM = 'https://esm.sh/@sanity/client@7.18.0?bundle';
  var STEGA_CLEAN_ESM = 'https://esm.sh/@sanity/client@7.18.0/stega?bundle';

  function dynamicImport(url) {
    return Function('u', 'return import(u)')(url);
  }

  var stegaCleanFn = null;
  var stegaCleanPromise = null;

  /** Remove stega metadata from URL/navigation strings (not body copy). */
  function loadStegaClean() {
    if (!isPreviewEnabled()) return Promise.resolve(null);
    if (stegaCleanFn) return Promise.resolve(stegaCleanFn);
    if (!stegaCleanPromise) {
      stegaCleanPromise = loadVisualEditingModule()
        .then(function (mod) {
          stegaCleanFn = mod.stegaClean || (mod.default && mod.default.stegaClean);
          if (stegaCleanFn) return stegaCleanFn;
          return dynamicImport(STEGA_CLEAN_ESM)
            .then(function (esm) {
              stegaCleanFn = esm.stegaClean || (esm.default && esm.default.stegaClean);
              return stegaCleanFn;
            });
        })
        .catch(function () {
          return dynamicImport(STEGA_CLEAN_ESM)
            .then(function (esm) {
              stegaCleanFn = esm.stegaClean || (esm.default && esm.default.stegaClean);
              return stegaCleanFn;
            })
            .catch(function () {
              return null;
            });
        });
    }
    return stegaCleanPromise;
  }

  function cleanStegaText(value) {
    if (value == null) return '';
    if (typeof value !== 'string') value = String(value);
    if (!isPreviewEnabled()) return value;
    if (stegaCleanFn) {
      try {
        return stegaCleanFn(value);
      } catch (e) {
        return value;
      }
    }
    return value.replace(/[\u200B-\u200C\u200D\uFEFF]/g, '');
  }

  /** Keep stega in preview so Presentation overlays can target string fields. */
  function setSanityDisplayText(el, value, fallback) {
    if (!el) return;
    var raw = value != null && String(value).length ? String(value) : fallback || '';
    el.textContent = isPreviewEnabled() ? raw : cleanStegaText(raw);
  }

  /** Strip stega from values used for logic (layout, font keys), not visible copy. */
  function cleanConfigValue(value, fallback) {
    var raw = value != null ? String(value).trim() : '';
    if (!raw) return fallback || '';
    return isPreviewEnabled() ? cleanStegaText(raw) : raw;
  }

  function normalizeFontRoleChoice(choice) {
    if (!choice || typeof choice !== 'object') return choice;
    var out = Object.assign({}, choice);
    if (out.systemPreset) out.systemPreset = cleanConfigValue(out.systemPreset, 'inter');
    if (out.source) out.source = cleanConfigValue(out.source, 'system');
    return out;
  }

  function projectNavLabel(project) {
    var p = project || {};
    var override = p._homeNavLabelOverride && String(p._homeNavLabelOverride).trim();
    return override || p.header_title || p.slug || '';
  }

  if (isPreviewEnabled()) {
    loadStegaClean();
  }

  function invalidatePreviewCaches(changedDoc) {
    var d = changedDoc || {};
    if (!d._type) {
      SDV_PREVIEW.projectsBySlug = {};
      SDV_PREVIEW.info = null;
      SDV_PREVIEW.homeProjects = null;
      SDV_PREVIEW.homePageDoc = null;
      cachedHomeBackgroundColor = '';
      return;
    }
    if (d._type === 'project') {
      SDV_PREVIEW.projectsBySlug = {};
      SDV_PREVIEW.homeProjects = null;
    }
    if (d._type === 'homePage') {
      SDV_PREVIEW.homeProjects = null;
      SDV_PREVIEW.homePageDoc = null;
      cachedHomeBackgroundColor = '';
    }
    if (d._type === 'info') SDV_PREVIEW.info = null;
    if (d._type === 'siteTypography' || d._type === 'fontUpload') {
      siteTypographyDoc = null;
      try {
        var ty = document.getElementById('sdv-typography');
        if (ty) ty.remove();
      } catch (e) { }
    }
    if (d._type === 'siteMaterials') {
      materialCatalogPromise = null;
    }
  }

  function resetPreviewSanityClient() {
    previewSanityClient = null;
    previewSanityClientKey = '';
    publicSanityClient = null;
  }

  async function refetchAllSanityDrivenContent() {
    preservePreviewLinks();
    await loadTypography().catch(function () { });
    if (document.querySelector('.view--home')) {
      await refreshHomePageDoc();
    }
    await Promise.all([
      loadMaterialCatalog().catch(function () { }),
      loadInfoLinks().catch(function () { }),
      loadProject().catch(function () { }),
      loadHome().catch(function () { }),
      loadHomeMaterials().catch(function () { }),
      loadImmersiveContent().catch(function () { }),
    ]);
  }

  if (isPreviewEnabled()) {
    var previewRefetchTimer = 0;
    window.__SDV_VE_REFRESH = function (payload) {
      if (payload && payload.source === 'manual') {
        window.location.reload();
        return Promise.resolve();
      }
      var doc = payload && payload.document;
      if (doc && isDraftDocumentId(doc._id) && !isDraftModeActive()) {
        return Promise.resolve();
      }
      if (doc) {
        invalidatePreviewCaches(doc);
      } else if (payload) {
        invalidatePreviewCaches(null);
      }
      if (previewRefetchTimer) clearTimeout(previewRefetchTimer);
      return new Promise(function (resolve) {
        previewRefetchTimer = setTimeout(function () {
          previewRefetchTimer = 0;
          refetchAllSanityDrivenContent().then(resolve).catch(function () {
            resolve();
          });
        }, 350);
      });
    };
  }

  function presentationApiPerspective() {
    if (!isDraftModeActive()) return 'published';
    try {
      var qs = new URLSearchParams(window.location.search || '');
      var sp = String(qs.get('sanity-preview-perspective') || '').toLowerCase();
      if (sp === 'published') return 'published';
      if (sp === 'drafts') return 'drafts';
    } catch (e) { }
    return 'published';
  }

  async function getSanityCreateClient() {
    if (isPreviewEnabled()) {
      var mod = await loadVisualEditingModule();
      var createClient = mod.createClient || (mod.default && mod.default.createClient);
      if (createClient) return createClient;
    }
    if (!sanityCreateClientPromise) {
      sanityCreateClientPromise = dynamicImport(SANITY_CLIENT_ESM).then(function (mod) {
        var createClient = mod.createClient || (mod.default && mod.default.createClient);
        if (!createClient) throw new Error('Unable to load @sanity/client createClient');
        return createClient;
      });
    }
    return sanityCreateClientPromise;
  }

  async function getPreviewSanityClient() {
    var createClient = await getSanityCreateClient();
    var perspective = presentationApiPerspective();
    var cacheKey =
      perspective +
      '|' +
      String(SDV_PREVIEW_TOKEN || '') +
      '|' +
      String(window.location.search || '');
    if (previewSanityClient && cacheKey === previewSanityClientKey) return previewSanityClient;
    previewSanityClientKey = cacheKey;
    var cfg = {
      projectId: SANITY_PROJECT_ID,
      dataset: SANITY_DATASET,
      apiVersion: SANITY_API_VERSION,
      useCdn: false,
      perspective: perspective,
      stega: { enabled: true, studioUrl: SANITY_STUDIO_URL },
    };
    if (perspective === 'drafts' && SDV_PREVIEW_TOKEN) cfg.token = SDV_PREVIEW_TOKEN;
    previewSanityClient = createClient(cfg);
    return previewSanityClient;
  }

  async function getSanityFetchClient() {
    if (isPreviewEnabled()) {
      return await getPreviewSanityClient();
    }
    if (!publicSanityClient) {
      var createClient = await getSanityCreateClient();
      publicSanityClient = createClient({
        projectId: SANITY_PROJECT_ID,
        dataset: SANITY_DATASET,
        apiVersion: SANITY_API_VERSION,
        useCdn: true,
        perspective: 'published',
      });
    }
    return publicSanityClient;
  }

  /**
   * Published reads via Sanity CDN. Draft/preview with token uses the full client.
   */
  async function sanityFetchCdn(query, params) {
    var apiVer =
      SANITY_API_VERSION.indexOf('v') === 0 ? SANITY_API_VERSION : 'v' + SANITY_API_VERSION;
    var url =
      'https://' +
      encodeURIComponent(SANITY_PROJECT_ID) +
      '.apicdn.sanity.io/' +
      encodeURIComponent(apiVer) +
      '/data/query/' +
      encodeURIComponent(SANITY_DATASET);
    var res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query, params: params || {} }),
    });
    var json = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) {
      var msg = (json && json.message) || res.statusText || String(res.status);
      if (res.status === 403) {
        throw new Error(
          'Sanity API blocked this origin (CORS). Add ' +
            window.location.origin +
            ' under Project → API → CORS origins in sanity.io/manage. (' +
            msg +
            ')',
        );
      }
      throw new Error(msg);
    }
    return json.result;
  }

  async function sanityFetch(query, params) {
    if (isPreviewEnabled()) {
      var previewClient = await getSanityFetchClient();
      return previewClient.fetch(query, params || {});
    }
    return sanityFetchCdn(query, params);
  }

  /** Local visual-editing bundle (sanity-studio: npm run build:visual-editing). */
  function getVisualEditingBundleUrl() {
    try {
      return new URL('sanity-visual-editing.bundle.js', new URL(rootPrefix() + 'js/', window.location.href)).href;
    } catch (e) {
      return rootPrefix() + 'js/sanity-visual-editing.bundle.js';
    }
  }

  function loadVisualEditingModule() {
    if (window.SDVVisualEditing && typeof window.SDVVisualEditing.enableVisualEditing === 'function') {
      return Promise.resolve(window.SDVVisualEditing);
    }
    if (window.SDVVisualEditingReady && typeof window.SDVVisualEditingReady.then === 'function') {
      return window.SDVVisualEditingReady;
    }
    return new Promise(function (resolve, reject) {
      var url = getVisualEditingBundleUrl();
      var s = document.createElement('script');
      s.src = url;
      s.async = false;
      s.setAttribute('data-sdv-ve-bundle', '1');
      s.onload = function () {
        if (window.SDVVisualEditing && typeof window.SDVVisualEditing.enableVisualEditing === 'function') {
          resolve(window.SDVVisualEditing);
          return;
        }
        reject(new Error('Unable to load enableVisualEditing'));
      };
      s.onerror = function () {
        reject(new Error('Visual editing bundle failed to load'));
      };
      document.head.appendChild(s);
    });
  }

  async function setupVisualEditingBridge() {
    if (!isPreviewEnabled()) return;
    if (visualEditingSetupPromise) return visualEditingSetupPromise;
    visualEditingSetupPromise = loadVisualEditingModule()
      .then(function () {
        if (!window.__SDV_VE_INSTALLED) {
          console.warn('[sdv] Visual editing comlink was not initialized in presentation-boot.js');
        }
      })
      .catch(function (err) {
        console.warn('[sdv] Sanity visual editing failed to initialize:', err && err.message ? err.message : err);
      });
    return visualEditingSetupPromise;
  }

  if (isPreviewEnabled()) {
    setupVisualEditingBridge();
  }

  var withPreviewQuery = SDV.withPreviewQuery;

  function preservePreviewLinks() {
    if (!isPreviewEnabled()) return;
    document.querySelectorAll('a[href]').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      if (!href) return;
      if (/^(https?:)?\/\//i.test(href)) return;
      if (/\.(pdf|png|jpe?g|gif|webp|mp4|webm)(\?|#|$)/i.test(href)) return;
      a.setAttribute('href', withPreviewQuery(href));
    });
  }

  var homeMaterialsRefreshTimer = 0;
  function scheduleHomeMaterialsRefresh() {
    if (homeMaterialsRefreshTimer) clearTimeout(homeMaterialsRefreshTimer);
    homeMaterialsRefreshTimer = setTimeout(function () {
      homeMaterialsRefreshTimer = 0;
      loadHomeMaterials().catch(function () { });
    }, 50);
  }

  var rootPrefix = SDV.rootPrefix;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(s) {
    return String(s || '').replace(/"/g, '&quot;');
  }

  /** Allow only safe link schemes; blocks javascript:/data:/etc. Returns '' if unsafe. */
  function safeUrl(s) {
    var raw = String(s || '').trim();
    if (!raw) return '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^(https?|mailto|tel):/i.test(raw)) return '';
    return raw;
  }

  function renderPortableText(blocks) {
    if (!Array.isArray(blocks) || !blocks.length) return '';

    function renderChildren(block) {
      var children = Array.isArray(block && block.children) ? block.children : [];
      var markDefs = Array.isArray(block && block.markDefs) ? block.markDefs : [];
      var markDefMap = {};
      markDefs.forEach(function (d) {
        if (d && d._key) markDefMap[d._key] = d;
      });

      return children.map(function (child) {
        if (!child || child._type !== 'span') return '';
        var text = escapeHtml(String(child.text || '')).replace(/\n/g, '<br>');
        var marks = Array.isArray(child.marks) ? child.marks.slice() : [];

        marks.forEach(function (mark) {
          if (mark === 'strong') text = '<strong>' + text + '</strong>';
          else if (mark === 'em') text = '<em>' + text + '</em>';
          else if (mark === 'strike-through') text = '<del>' + text + '</del>';
          else if (markDefMap[mark] && markDefMap[mark]._type === 'link' && markDefMap[mark].href) {
            var linkHref = safeUrl(markDefMap[mark].href);
            if (linkHref) {
              text =
                '<a href="' + escapeAttr(linkHref) + '" target="_blank" rel="noopener">' + text + '</a>';
            }
          }
        });
        return text;
      }).join('');
    }

    var out = [];
    var listType = null;
    var listItems = [];

    function flushList() {
      if (!listType || !listItems.length) return;
      var tag = listType === 'number' ? 'ol' : 'ul';
      out.push('<' + tag + '>' + listItems.map(function (li) { return '<li>' + li + '</li>'; }).join('') + '</' + tag + '>');
      listType = null;
      listItems = [];
    }

    blocks.forEach(function (block) {
      if (!block || block._type !== 'block') return;
      var itemText = renderChildren(block);
      if (block.listItem) {
        var current = block.listItem === 'number' ? 'number' : 'bullet';
        if (listType && listType !== current) flushList();
        listType = current;
        listItems.push(itemText);
        return;
      }

      flushList();
      var style = block.style || 'normal';
      if (style === 'h2') out.push('<h2>' + itemText + '</h2>');
      else if (style === 'h3') out.push('<h3>' + itemText + '</h3>');
      else if (style === 'blockquote') out.push('<blockquote><p>' + itemText + '</p></blockquote>');
      else out.push('<p>' + (itemText ? itemText : '<br>') + '</p>');
    });

    flushList();
    return out.join('\n');
  }

  function getProjectSlugFromPath() {
    var p = window.location.pathname || '';
    var m = p.match(/\/project\/([^/]+)\/?$/);
    if (m && m[1]) return String(m[1]);
    return null;
  }

  function getImmersiveSlugFromPath() {
    var p = window.location.pathname || '';
    var m = p.match(/\/immersive\/([^/]+)\/?$/);
    if (m && m[1]) return String(m[1]);
    return null;
  }

  var slugifyKey = SDV.slugifyKey;
  var normalizeProjectSlug = SDV.normalizeProjectSlug;
  var resolveMaterialKey = SDV.resolveMaterialKey;
  var canonicalMaterialLabel = SDV.canonicalMaterialLabel;
  var renderMaterialIcons = SDV.renderMaterialIcons;
  var isPublicationFall = SDV.isPublicationFall;
  var findPublicationPanel = SDV.findPublicationPanel;
  var projectHasPublicationImmersive = SDV.projectHasPublicationImmersive;

  function homeMaterialKeysForProject(data) {
    var keys = [];
    var seen = {};
    var home = Array.isArray(data && data.home_materials) ? data.home_materials : [];
    home.forEach(function (labelRaw) {
      if (labelRaw === null || labelRaw === undefined) return;
      var label = String(labelRaw).trim();
      if (!label) return;
      var key = resolveMaterialKey(label);
      if (!key || seen[key]) return;
      seen[key] = 1;
      keys.push(key);
    });

    var catalogOrder = {};
    if (SDV.getMaterialCatalogEntries) {
      SDV.getMaterialCatalogEntries().forEach(function (entry, i) {
        if (entry && entry.key) catalogOrder[entry.key] = i;
      });
    }
    keys.sort(function (a, b) {
      var ia = catalogOrder[a] != null ? catalogOrder[a] : 1e9;
      var ib = catalogOrder[b] != null ? catalogOrder[b] : 1e9;
      return ia - ib;
    });
    return keys;
  }

  function normalizeSanityProject(data) {
    var d = data || {};
    return {
      slug: normalizeProjectSlug(cleanStegaText(d.slug)),
      home_materials: Array.isArray(d.home_materials) ? d.home_materials : [],
      header_title: cleanStegaText(d.header_title || ''),
      body: d.body || '',
      materials: Array.isArray(d.materials) ? d.materials : [],
      links: Array.isArray(d.links) ? d.links : [],
      gallery: Array.isArray(d.gallery) ? d.gallery : [],
      falls: Array.isArray(d.falls) ? d.falls : [],
      backgroundColor: d.backgroundColor || '',
      immersiveBackgroundColor: d.immersiveBackgroundColor || '',
      titleFont: d.titleFont || null,
      overviewFont: d.overviewFont || null,
      tabFont: d.tabFont || null,
      metaFont: d.metaFont || null,
      immersiveNavFont: d.immersiveNavFont || null,
      _updatedAt: d._updatedAt || '',
    };
  }

  /** Prefer `falls`; legacy CDN docs may still have `gallery` only — one synthetic panel per image. */
  function effectiveTimelinePanels(data) {
    var d = data || {};
    var falls = Array.isArray(d.falls) ? d.falls : [];
    if (falls.length) {
      return falls.map(function (fall) {
        var f = fall || {};
        return {
          label: f.label,
          type: f.type,
          isPublication: isPublicationFall(f),
          images: Array.isArray(f.images) ? f.images : [],
        };
      });
    }
    var gallery = Array.isArray(d.gallery) ? d.gallery : [];
    if (!gallery.length) return [];
    return gallery.map(function (img, i) {
      return {
        label: 'Panel ' + (i + 1),
        type: '',
        isPublication: false,
        images: [img],
      };
    });
  }

  function firstProjectSplashImage(data, prefix) {
    var d = data || {};
    if (Array.isArray(d.gallery) && d.gallery[0]) {
      return resolveImageSrc(d.gallery[0], prefix);
    }
    var falls = Array.isArray(d.falls) ? d.falls : [];
    var first = falls[0];
    if (!first || !Array.isArray(first.images) || !first.images[0]) return '';
    return resolveImageSrc(first.images[0], prefix);
  }

  function normalizeSanityInfo(data) {
    var d = data || {};
    return {
      bio: d.bio || d.body || '',
      cv: d.cv || '',
      bioFont: d.bioFont || null,
      cvFont: d.cvFont || null,
      _updatedAt: d._updatedAt || '',
    };
  }

  function sanityAssetUrlFromRef(ref) {
    var s = String(ref || '');
    var imageMatch = s.match(/^image-([a-zA-Z0-9]+)-(\d+x\d+)-([a-z0-9]+)$/i);
    if (imageMatch) {
      return 'https://cdn.sanity.io/images/' + SANITY_PROJECT_ID + '/' + SANITY_DATASET + '/' + imageMatch[1] + '-' + imageMatch[2] + '.' + imageMatch[3];
    }
    var fileMatch = s.match(/^file-([a-zA-Z0-9]+)-([a-z0-9]+)$/i);
    if (fileMatch) {
      return 'https://cdn.sanity.io/files/' + SANITY_PROJECT_ID + '/' + SANITY_DATASET + '/' + fileMatch[1] + '.' + fileMatch[2];
    }
    return '';
  }

  function resolveImageSrc(src, prefix) {
    if (src && typeof src === 'object' && src.asset && src.asset.url) {
      return String(src.asset.url);
    }
    if (src && typeof src === 'object' && src.asset && src.asset._ref) {
      var built = sanityAssetUrlFromRef(src.asset._ref);
      if (built) return built;
    }
    if (src && typeof src === 'object' && src.url) {
      return String(src.url);
    }
    if (src && typeof src === 'object' && src.image) {
      src = src.image;
      if (src && typeof src === 'object' && src.asset && src.asset._ref) {
        var fromNested = sanityAssetUrlFromRef(src.asset._ref);
        if (fromNested) return fromNested;
      }
    }
    var s = String(src || '');
    var isAbs = /^https?:\/\//i.test(s);
    if (!isAbs && s.startsWith('/')) s = s.slice(1);
    if (!isAbs && s && !s.startsWith('images/')) s = 'images/' + s;
    return isAbs ? s : (prefix + s);
  }

  var SYSTEM_UI_FALLBACK =
    'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  var SYSTEM_FONT_STACKS = {
    'system-ui': SYSTEM_UI_FALLBACK,
    inter: '"Inter", ' + SYSTEM_UI_FALLBACK,
    'source-sans-3': '"Source Sans 3", ' + SYSTEM_UI_FALLBACK,
    'ibm-plex-sans': '"IBM Plex Sans", ' + SYSTEM_UI_FALLBACK,
    'open-sans': '"Open Sans", ' + SYSTEM_UI_FALLBACK,
    'noto-sans': '"Noto Sans", ' + SYSTEM_UI_FALLBACK,
    georgia: 'Georgia, "Times New Roman", Times, serif',
    times: '"Times New Roman", Times, Georgia, serif',
    palatino: 'Palatino, "Palatino Linotype", "Book Antiqua", serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  };

  /** Google Fonts CSS URLs (SIL/OFL families). Injected only when a preset is selected. */
  var WEB_FONT_IMPORTS = {
    inter:
      'https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap',
    'source-sans-3':
      'https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400&display=swap',
    'ibm-plex-sans':
      'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap',
    'open-sans':
      'https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,400;0,600;0,700;1,400&display=swap',
    'noto-sans':
      'https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,400;0,600;0,700;1,400&display=swap',
  };

  function fontFormatFromUrl(url) {
    var u = String(url || '')
      .split('?')[0]
      .toLowerCase();
    if (u.endsWith('.woff2')) return 'woff2';
    if (u.endsWith('.woff')) return 'woff';
    if (u.endsWith('.otf')) return 'opentype';
    if (u.endsWith('.ttf')) return 'truetype';
    return 'woff2';
  }

  function sanitizeCssFamilyName(name) {
    return String(name || '')
      .replace(/["'<>]/g, '')
      .trim()
      .slice(0, 120);
  }

  function resolveFontFileUrl(field) {
    if (!field || !field.asset) return '';
    var a = field.asset;
    if (a.url) return String(a.url);
    if (a._ref) return sanityAssetUrlFromRef(a._ref);
    return '';
  }

  function resolveFontChoice(choice, faceSink) {
    var fallback = SYSTEM_FONT_STACKS['system-ui'];
    choice = normalizeFontRoleChoice(choice);
    if (!choice || choice.source === 'system' || !choice.source) {
      var preset = choice && choice.systemPreset ? String(choice.systemPreset) : 'inter';
      var importUrl = WEB_FONT_IMPORTS[preset];
      if (faceSink && importUrl && !faceSink.seen['gf-' + preset]) {
        faceSink.seen['gf-' + preset] = true;
        faceSink.css += '@import url("' + importUrl + '");';
      }
      return SYSTEM_FONT_STACKS[preset] || fallback;
    }
    var ref = choice.fontRef;
    if (!ref) return fallback;
    var family = sanitizeCssFamilyName(ref.cssFamily);
    if (!family) return fallback;
    var url = resolveFontFileUrl(ref.fontFile);
    if (!url) return '"' + family + '", ' + fallback;
    var fmt = fontFormatFromUrl(url);
    var weight = ref.fontWeight != null ? Number(ref.fontWeight) : 400;
    var style = ref.fontStyle === 'italic' ? 'italic' : 'normal';
    var key = ref._id || url;
    if (faceSink && key && !faceSink.seen[key]) {
      faceSink.seen[key] = true;
      var famEsc = family.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      var urlEsc = url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      faceSink.css +=
        '@font-face{font-family:"' +
        famEsc +
        '";src:url("' +
        urlEsc +
        '") format("' +
        fmt +
        '");font-weight:' +
        weight +
        ';font-style:' +
        style +
        ';font-display:swap;}';
    }
    return '"' + family + '", ' + fallback;
  }

  var siteTypographyDoc = null;
  var scopedTypographyConfig = { home: null, project: null, info: null };
  var cachedHomeBackgroundColor = '';
  var DEFAULT_PAGE_BG = '#E0DBD7';

  var FONT_ROLE_PROJECTION =
    'source,systemPreset,fontRef->{_id,cssFamily,fontWeight,fontStyle,fontFile{asset->{_ref,url}}}';

  function fontRoleProjection(fieldName) {
    return fieldName + '{' + FONT_ROLE_PROJECTION + '}';
  }

  function resolveFontRole(override, siteRoleKey, faceSink) {
    var choice = override || (siteTypographyDoc && siteTypographyDoc[siteRoleKey]);
    return resolveFontChoice(choice, faceSink);
  }

  function normalizeHexColor(value) {
    if (!value) return '';
    if (typeof value === 'object') {
      if (value.hex) value = value.hex;
      else if (value.rgb) {
        var r = value.rgb.r;
        var g = value.rgb.g;
        var b = value.rgb.b;
        if (r != null && g != null && b != null) {
          value =
            '#' +
            [r, g, b]
              .map(function (n) {
                var h = Math.round(Number(n)).toString(16);
                return h.length === 1 ? '0' + h : h;
              })
              .join('');
        }
      }
    }
    var hex = String(value).trim();
    if (!hex.startsWith('#')) hex = '#' + hex;
    if (/^#([0-9a-fA-F]{6})$/.test(hex)) return hex;
    return '';
  }

  function hasFontRoleOverride(role) {
    role = normalizeFontRoleChoice(role);
    if (!role || typeof role !== 'object') return false;
    if (role.source === 'custom') {
      var ref = role.fontRef;
      return !!(ref && (ref._ref || ref._id || ref.cssFamily));
    }
    return !!(role.systemPreset || role.source === 'system');
  }

  function applyPageBackground(viewEl, color) {
    if (!viewEl) return;
    var bg = normalizeHexColor(color) || DEFAULT_PAGE_BG;
    viewEl.style.setProperty('--bg', bg);
    cachePageBackground(bg, viewEl);
  }

  function cachePageBackground(bg, viewEl) {
    if (!bg) return;
    try {
      var path = String(window.location.pathname || '/');
      var projectMatch = path.match(/\/project\/([^/]+)/);
      var immersiveMatch = path.match(/\/immersive\/([^/]+)/);
      if (projectMatch) {
        sessionStorage.setItem('sdv.bg.project.' + projectMatch[1], bg);
      } else if (immersiveMatch) {
        sessionStorage.setItem('sdv.bg.immersive.' + immersiveMatch[1], bg);
      } else if (viewEl && viewEl.classList.contains('view--home')) {
        sessionStorage.setItem('sdv.bg', bg);
      }
    } catch (e) { }
  }

  async function getHomeBackgroundColor() {
    if (cachedHomeBackgroundColor) return cachedHomeBackgroundColor;
    if (SDV_PREVIEW.homePageDoc && SDV_PREVIEW.homePageDoc.backgroundColor) {
      cachedHomeBackgroundColor = normalizeHexColor(SDV_PREVIEW.homePageDoc.backgroundColor) || '';
      return cachedHomeBackgroundColor;
    }
    try {
      var doc = await sanityFetch(
        '*[_id == "' + HOME_PAGE_DOC_ID + '"][0]{backgroundColor}',
      );
      cachedHomeBackgroundColor = normalizeHexColor(doc && doc.backgroundColor) || '';
    } catch (e) {
      cachedHomeBackgroundColor = '';
    }
    return cachedHomeBackgroundColor;
  }

  async function resolvePageBackgroundColor(projectData, forImmersive) {
    var d = projectData || {};
    if (forImmersive) {
      return (
        normalizeHexColor(d.immersiveBackgroundColor) ||
        normalizeHexColor(d.backgroundColor) ||
        (await getHomeBackgroundColor()) ||
        DEFAULT_PAGE_BG
      );
    }
    return normalizeHexColor(d.backgroundColor) || (await getHomeBackgroundColor()) || DEFAULT_PAGE_BG;
  }

  function setScopedTypographyConfig(key, items) {
    scopedTypographyConfig[key] = Array.isArray(items) ? items : null;
    rebuildTypographyStyleTag();
  }

  function rebuildTypographyStyleTag() {
    var sink = { seen: {}, css: '' };
    var rules = [];
    if (siteTypographyDoc) {
      var base = resolveFontRole(null, 'baseUi', sink);
      var prose = resolveFontRole(null, 'prose', sink);
      var strong = resolveFontRole(null, 'strongUi', sink);
      var light = resolveFontRole(null, 'lightUi', sink);
      rules.push(
        ':root{--font:' +
          base +
          ';--font-prose:' +
          prose +
          ';--font-strong:' +
          strong +
          ';--font-light:' +
          light +
          ';}',
      );
    }
    ['home', 'project', 'info'].forEach(function (key) {
      var cfg = scopedTypographyConfig[key];
      if (!cfg || !cfg.length) return;
      cfg.forEach(function (item) {
        if (!item || !hasFontRoleOverride(item.override)) return;
        var family = resolveFontRole(item.override, item.siteRole, sink);
        rules.push(
          item.selector +
            '{--' +
            item.cssVar +
            ':' +
            family +
            ';font-family:' +
            family +
            ',var(--font);}',
        );
      });
    });
    var el = document.getElementById('sdv-typography');
    if (!el) {
      if (!siteTypographyDoc && !rules.length) return;
      el = document.createElement('style');
      el.id = 'sdv-typography';
      document.head.appendChild(el);
    }
    el.textContent = sink.css + rules.join('');
  }

  function buildTypographyStyles(doc) {
    siteTypographyDoc = doc || null;
    rebuildTypographyStyleTag();
    return '';
  }

  async function loadTypography() {
    try {
      var doc = await sanityFetch(
        '*[_id in ["siteTypography", "drafts.siteTypography"]]|order(_updatedAt desc)[0]{' +
          'baseUi{source,systemPreset,fontRef->{_id,cssFamily,fontWeight,fontStyle,fontFile{asset->{_ref,url}}}},' +
          'prose{source,systemPreset,fontRef->{_id,cssFamily,fontWeight,fontStyle,fontFile{asset->{_ref,url}}}},' +
          'strongUi{source,systemPreset,fontRef->{_id,cssFamily,fontWeight,fontStyle,fontFile{asset->{_ref,url}}}},' +
          'lightUi{source,systemPreset,fontRef->{_id,cssFamily,fontWeight,fontStyle,fontFile{asset->{_ref,url}}}}' +
          '}',
      );
      if (!doc) {
        siteTypographyDoc = null;
        rebuildTypographyStyleTag();
        var rm = document.getElementById('sdv-typography');
        if (rm && !scopedTypographyConfig.home && !scopedTypographyConfig.project && !scopedTypographyConfig.info) {
          rm.remove();
        }
        return;
      }
      buildTypographyStyles(doc);
    } catch (e) {
      /* Typography unavailable; keep stylesheet defaults. */
    }
  }

  function dispatchImmersiveReady(slug) {
    window.dispatchEvent(new CustomEvent('sdv:immersive-ready', { detail: { slug: slug || '' } }));
  }

  function preloadImmersiveImages(urls) {
    if (!Array.isArray(urls) || !urls.length) return;
    var seen = {};
    urls.forEach(function (displayUrl) {
      if (!displayUrl || seen[displayUrl]) return;
      seen[displayUrl] = 1;
      var previewUrl = SDV.immersiveImagePreviewUrl(displayUrl);
      [previewUrl, displayUrl].forEach(function (u) {
        if (!u) return;
        var link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = u;
        document.head.appendChild(link);
      });
    });
  }

  var materialCatalogPromise = null;

  var MATERIALS_CATALOG_GROQ =
    '*[_id == "' +
    SITE_MATERIALS_DOC_ID +
    '" || _id == "drafts.' +
    SITE_MATERIALS_DOC_ID +
    '"][0]{entries[]{key, label, icon}}';

  async function loadMaterialCatalog() {
    if (materialCatalogPromise) return materialCatalogPromise;
    materialCatalogPromise = sanityFetch(MATERIALS_CATALOG_GROQ)
      .then(function (doc) {
        var entries = doc && Array.isArray(doc.entries) ? doc.entries : [];
        if (entries.length && SDV.applyMaterialCatalog) {
          SDV.applyMaterialCatalog(entries);
        }
      })
      .catch(function (err) {
        console.warn('[sdv] loadMaterialCatalog failed:', err && err.message ? err.message : err);
      });
    return materialCatalogPromise;
  }

  var PROJECT_FIELDS =
    '"slug": coalesce(slug.current, slug), home_materials, header_title,\n' +
    'backgroundColor, immersiveBackgroundColor,\n' +
    fontRoleProjection('titleFont') + ',\n' +
    fontRoleProjection('overviewFont') + ',\n' +
    fontRoleProjection('tabFont') + ',\n' +
    fontRoleProjection('metaFont') + ',\n' +
    fontRoleProjection('immersiveNavFont') + ',\n' +
    'body, materials, links, falls, gallery, _updatedAt';

  var HOME_PAGE_GROQ =
    '*[_id == "' +
    HOME_PAGE_DOC_ID +
    '"][0]{\n' +
    '  backgroundColor,\n' +
    '  heroLine1,\n' +
    '  heroLine2,\n' +
    '  ' +
    fontRoleProjection('heroFont') + ',\n' +
    '  ' +
    fontRoleProjection('navFont') + ',\n' +
    '  entries[]{\n' +
    '    navLabel,\n' +
    '    "proj": project->{\n' +
    '      ' +
    PROJECT_FIELDS +
    '\n' +
    '    }\n' +
    '  }\n' +
    '}';

  var PROJECT_FALLBACK_GROQ =
    '*[_type == "project"]{\n' +
    '  ' +
    PROJECT_FIELDS +
    '\n' +
    '}';

  var FALLBACK_SLUG_ORDER = ['the-spontaneous-dance-falls', 'under-the-needle-s-eye', 'overlocked'];

  /** Offline fallback for home nav and materials (matches content/home.json). */
  function getOfflineHomeProjects() {
    return [
      {
        slug: 'the-spontaneous-dance-falls',
        header_title: 'The Spontaneous Dance Falls',
        home_materials: ['Glass', 'Textile', 'Metal', 'Archive', 'A/V', 'Performance'],
        materials: [],
        gallery: [],
        body: [],
        links: [],
        falls: [
          {
            label: 'Panel 1',
            type: '',
            images: ['images/home/fall.jpg'],
          },
        ],
        _updatedAt: '',
        _homeNavLabelOverride: '',
      },
      {
        slug: 'under-the-needle-s-eye',
        header_title: "Under the Needle's Eye",
        home_materials: ['Textile', 'Metal', 'Archive', 'A/V'],
        materials: [],
        gallery: [],
        body: [],
        links: [],
        falls: [
          {
            label: 'Panel 1',
            type: '',
            images: ['images/home/needle.jpg'],
          },
        ],
        _updatedAt: '',
        _homeNavLabelOverride: '',
      },
      {
        slug: 'overlocked',
        header_title: 'overlocked',
        home_materials: ['Synthetic', 'Textile', 'Archive', 'A/V', 'Objects'],
        materials: [],
        gallery: [],
        body: [],
        links: [],
        falls: [
          {
            label: 'Panel 1',
            type: '',
            images: ['images/home/overlocked.jpg'],
          },
        ],
        _updatedAt: '',
        _homeNavLabelOverride: '',
      },
    ];
  }

  function sortProjectsBySlugOrder(list, orderArr) {
    var idx = {};
    (orderArr || []).forEach(function (s, i) {
      idx[s] = i;
    });
    return (list || []).slice().sort(function (a, b) {
      var ia = idx[a.slug] != null ? idx[a.slug] : 999;
      var ib = idx[b.slug] != null ? idx[b.slug] : 999;
      if (ia !== ib) return ia - ib;
      return String(a.slug).localeCompare(String(b.slug));
    });
  }

  async function fetchOrderedProjects() {
    if (
      !isPreviewEnabled() &&
      SDV_PREVIEW.homeProjects &&
      Array.isArray(SDV_PREVIEW.homeProjects)
    ) {
      return SDV_PREVIEW.homeProjects;
    }
    try {
      var homeDoc = await sanityFetch(HOME_PAGE_GROQ);
      if (homeDoc) {
        SDV_PREVIEW.homePageDoc = homeDoc;
        if (document.querySelector('.view--home')) {
          applyHomePageSettings(homeDoc);
        }
      }
      var entries = homeDoc && Array.isArray(homeDoc.entries) ? homeDoc.entries : [];
      var merged = [];
      for (var ei = 0; ei < entries.length; ei++) {
        var e = entries[ei] || {};
        var p = e.proj;
        if (!p || !p.slug) continue;
        var base = normalizeSanityProject(p);
        base._homeNavLabelOverride = e.navLabel ? String(e.navLabel).trim() : '';
        merged.push(base);
      }
      if (merged.length) {
        SDV_PREVIEW.homeProjects = merged;
        return merged;
      }
      var list = await sanityFetch(PROJECT_FALLBACK_GROQ);
      var arr = Array.isArray(list) ? list.map(function (d) { return normalizeSanityProject(d || {}); }) : [];
      var sorted = sortProjectsBySlugOrder(arr, FALLBACK_SLUG_ORDER);
      if (sorted.length) {
        SDV_PREVIEW.homeProjects = sorted;
        return sorted;
      }
    } catch (err) {
      console.warn('[sdv] fetchOrderedProjects failed:', err && err.message ? err.message : err);
    }
    var offline = getOfflineHomeProjects();
    SDV_PREVIEW.homeProjects = offline;
    return offline;
  }

  function applyHomePageSettings(homeDoc) {
    var homeView = document.querySelector('.view--home');
    var line1 = document.getElementById('home-hero-line1');
    var line2 = document.getElementById('home-hero-line2');
    var d = homeDoc || SDV_PREVIEW.homePageDoc || {};
    setSanityDisplayText(line1, d.heroLine1, 'STACEY');
    setSanityDisplayText(line2, d.heroLine2, 'DE VOE');
    if (isPreviewEnabled()) {
      if (line1) line1.dataset.sanityEditTarget = '';
      if (line2) line2.dataset.sanityEditTarget = '';
      if (line1) line1.removeAttribute('aria-hidden');
      if (line2) line2.removeAttribute('aria-hidden');
    }
    if (homeView) {
      cachedHomeBackgroundColor = normalizeHexColor(d.backgroundColor) || '';
      applyPageBackground(homeView, cachedHomeBackgroundColor || DEFAULT_PAGE_BG);
    }
    setScopedTypographyConfig('home', [
      {
        selector: '.home-name-stacey,.home-name-devoe',
        cssVar: 'font-home-hero',
        override: d.heroFont,
        siteRole: 'strongUi',
      },
      {
        selector: '.home-project',
        cssVar: 'font-home-nav',
        override: d.navFont,
        siteRole: 'strongUi',
      },
    ]);
  }

  async function refreshHomePageDoc() {
    if (!document.querySelector('.view--home')) return null;
    try {
      var doc = await sanityFetch(HOME_PAGE_GROQ);
      SDV_PREVIEW.homePageDoc = doc || null;
      applyHomePageSettings(SDV_PREVIEW.homePageDoc);
      return SDV_PREVIEW.homePageDoc;
    } catch (e) {
      return null;
    }
  }

  function renderHomeProjectNav(nav, projects) {
    if (!nav) return;
    nav.textContent = '';
    (projects || []).forEach(function (row) {
      var a = document.createElement('a');
      a.className = 'home-project';
      a.href = withPreviewQuery('project/' + row.slug + '/');
      a.setAttribute('data-slug', row.slug);
      if (isPreviewEnabled()) a.dataset.sanityEditTarget = '';
      setSanityDisplayText(a, row.label, row.slug);
      nav.appendChild(a);
    });
  }

  async function loadHome() {
    var nav = document.querySelector('.home-projects');
    if (!nav) return;

    if (isPreviewEnabled()) await loadStegaClean();

    try {
      if (isPreviewEnabled()) {
        await refreshHomePageDoc();
      } else if (!SDV_PREVIEW.homePageDoc) {
        await refreshHomePageDoc();
      } else {
        applyHomePageSettings(SDV_PREVIEW.homePageDoc);
      }

      var projects = await fetchOrderedProjects();
      window.SDV_HOME_PROJECTS = projects.map(function (p) {
        var prefix = rootPrefix();
        var splash = firstProjectSplashImage(p, prefix);
        var label = projectNavLabel(p);
        return { slug: cleanStegaText(p.slug), label: label, splashUrl: splash };
      });

      renderHomeProjectNav(nav, window.SDV_HOME_PROJECTS);
      window.dispatchEvent(new CustomEvent('sdv:home'));
    } catch (e) {
      console.warn('[sdv] loadHome failed:', e && e.message ? e.message : e);
      try {
        applyHomePageSettings(null);
        window.SDV_HOME_PROJECTS = getOfflineHomeProjects().map(function (p) {
          var prefix = rootPrefix();
          var splash = firstProjectSplashImage(p, prefix);
          return {
            slug: cleanStegaText(p.slug),
            label: projectNavLabel(p),
            splashUrl: splash,
          };
        });
        renderHomeProjectNav(nav, window.SDV_HOME_PROJECTS);
        window.dispatchEvent(new CustomEvent('sdv:home'));
      } catch (e2) { }
    }
  }

  function setupImmersiveNav(slug) {
    var back = document.querySelector('[data-immersive-back]');
    var index = document.querySelector('[data-immersive-index]');
    if (back) back.setAttribute('href', withPreviewQuery('../../project/' + slug + '/'));
    if (index) index.setAttribute('href', withPreviewQuery('../../'));
  }

  async function loadImmersiveContent() {
    var slug = getImmersiveSlugFromPath();
    var page = document.querySelector('.immersive-page');
    if (!page || !slug) return;

    page.setAttribute('data-slug', slug);
    setupImmersiveNav(slug);

    try {
      var prefix = rootPrefix();
      var data = (SDV_PREVIEW.projectsBySlug && SDV_PREVIEW.projectsBySlug[slug])
        ? SDV_PREVIEW.projectsBySlug[slug]
        : null;
      if (!data) {
        var doc = await sanityFetch(
          '*[_type=="project" && coalesce(slug.current, slug) == $slug][0]{' +
          PROJECT_FIELDS +
          '}',
          { slug: slug },
        );
        data = normalizeSanityProject(doc || {});
        SDV_PREVIEW.projectsBySlug[slug] = data;
      }
      var immersiveView = document.querySelector('.view--immersive');
      var bg = await resolvePageBackgroundColor(data, true);
      applyPageBackground(immersiveView, bg);
      setScopedTypographyConfig('project', [
        {
          selector: '.immersive-nav',
          cssVar: 'font-immersive-nav',
          override: data.immersiveNavFont,
          siteRole: 'strongUi',
        },
      ]);
      var displayTitle = (data.header_title && String(data.header_title).trim())
        ? String(data.header_title).trim()
        : slug;
      document.title = 'SDV — ' + displayTitle;
      var mainImg = document.querySelector('.immersive-flyer__img');
      if (mainImg) mainImg.setAttribute('alt', displayTitle);
      var panels = effectiveTimelinePanels(data);
      var hit = findPublicationPanel(panels);
      var urls = [];
      if (hit && hit.panel && Array.isArray(hit.panel.images)) {
        hit.panel.images.forEach(function (src) {
          var u = resolveImageSrc(src, prefix);
          if (u) urls.push(SDV.immersiveImageDisplayUrl(u));
        });
      }
      window.SDV_FLYER_IMAGES = { images: urls, index: 0 };
      preloadImmersiveImages(urls);
    } catch (e) {
      console.warn('[sdv] Immersive content failed to load:', e && e.message ? e.message : e);
      window.SDV_FLYER_IMAGES = { images: [], index: 0 };
    }

    dispatchImmersiveReady(slug);
  }

  async function loadHomeMaterials() {
    if (!document.querySelector('.view--home')) return;

    try {
      await loadMaterialCatalog();
      var projects = await fetchOrderedProjects();
      var slugs = projects.map(function (p) { return p.slug; }).filter(Boolean);

      function fetchProject(slug) {
        var hit = projects.find(function (p) { return p.slug === slug; });
        if (hit) {
          return Promise.resolve({ slug: slug, data: hit });
        }
        return sanityFetch(
          '*[_type=="project" && coalesce(slug.current, slug) == $slug][0]{' +
          PROJECT_FIELDS +
          '}',
          { slug: slug },
        ).then(function (doc) {
          return { slug: slug, data: normalizeSanityProject(doc || {}) };
        });
      }

      var results = await Promise.all(slugs.map(fetchProject));
      var projectMap = {};
      var allLabelsByKey = {};

      results.forEach(function (r) {
        var d = r.data || {};
        var sourceList = Array.isArray(d.home_materials) ? d.home_materials : [];
        var mats = [];
        var seen = {};
        sourceList.forEach(function (labelRaw) {
          if (labelRaw === null || labelRaw === undefined) return;
          var label = String(labelRaw).trim();
          if (!label) return;
          var key = resolveMaterialKey(label);
          if (!key) return;
          if (seen[key]) return;
          seen[key] = 1;
          var canonLabel = canonicalMaterialLabel(key) || label;
          mats.push({ key: key, label: canonLabel });
          if (!allLabelsByKey[key]) allLabelsByKey[key] = canonLabel;
        });
        projectMap[r.slug] = { materials: mats };
      });

      var catalogOrder = {};
      if (SDV.getMaterialCatalogEntries) {
        SDV.getMaterialCatalogEntries().forEach(function (entry, i) {
          if (entry && entry.key) catalogOrder[entry.key] = i;
        });
      }

      var all = Object.keys(allLabelsByKey).sort(function (a, b) {
        var ia = catalogOrder[a] != null ? catalogOrder[a] : 1e9;
        var ib = catalogOrder[b] != null ? catalogOrder[b] : 1e9;
        if (ia !== ib) return ia - ib;
        return allLabelsByKey[a].localeCompare(allLabelsByKey[b]);
      }).map(function (key) {
        return { key: key, label: allLabelsByKey[key] };
      });

      window.SDV_PROJECT_MATERIALS = projectMap;
      window.SDV_ALL_MATERIALS = all;
      window.dispatchEvent(new Event('sdv:materials'));
    } catch (e) {
      /* Materials fetch failed; home page still renders. */
    }
  }

  function buildFallTimeline(timelineHost, panelsHost, metaHost, falls, prefix) {
    if (!timelineHost || !panelsHost) return;
    timelineHost.innerHTML = '';
    panelsHost.innerHTML = '';

    var selected = 0;
    var isProgrammaticScroll = false;
    var rafScrollSync = 0;
    var timelineNav = setupProjectTimelineNav(timelineHost);

    function buildPanelImages(hostEl, fall, panelIndex) {
      hostEl.innerHTML = '';
      if (!fall || !Array.isArray(fall.images)) return;
      var urls = [];
      fall.images.forEach(function (src, imgIndex) {
        var resolved = resolveImageSrc(src, prefix);
        urls.push(resolved);
        var img = document.createElement('img');
        img.src = resolved;
        img.alt = '';
        img.dataset.panelIndex = String(panelIndex);
        img.dataset.imageIndex = String(imgIndex);
        img.addEventListener('click', function () {
          window.dispatchEvent(
            new CustomEvent('sdv:lightbox-open', {
              detail: { urls: urls.slice(), index: imgIndex },
            }),
          );
        });
        hostEl.appendChild(img);
      });
    }

    var panels = falls.map(function (fall, panelIndex) {
      var panel = document.createElement('div');
      panel.className = 'project-gallery-panel';
      var scroll = document.createElement('div');
      scroll.className = 'project-gallery-panel-scroll';
      buildPanelImages(scroll, fall, panelIndex);
      panel.appendChild(scroll);
      panelsHost.appendChild(panel);
      return panel;
    });

    function emitTabChange() {
      var fall = falls[selected] || {};
      window.dispatchEvent(
        new CustomEvent('sdv:project-tab', {
          detail: {
            index: selected,
            label: fall.label ? String(fall.label) : '',
            isPublication: !!(fall && fall.isPublication),
          },
        }),
      );
    }

    function clampIndex(i) {
      var n = falls.length;
      if (!n) return 0;
      if (i < 0) return 0;
      if (i >= n) return n - 1;
      return i;
    }

    function panelScrollElAt(i) {
      var panel = panels[i];
      if (!panel) return null;
      return panel.querySelector('.project-gallery-panel-scroll');
    }

    function setMeta(i) {
      if (!metaHost) return;
      var fall = falls[i] || {};
      var type = fall.type ? String(fall.type).trim() : '';
      metaHost.textContent = type;
      if (type) {
        metaHost.removeAttribute('hidden');
        metaHost.setAttribute('aria-hidden', 'false');
      } else {
        metaHost.setAttribute('hidden', '');
        metaHost.setAttribute('aria-hidden', 'true');
      }
    }

    function setTimelineCurrent(i) {
      var buttons = Array.from(timelineHost.querySelectorAll('button.project-timeline__item'));
      buttons.forEach(function (b, idx) {
        b.setAttribute('aria-current', idx === i ? 'true' : 'false');
      });
      if (timelineNav && buttons[i]) timelineNav.scrollTabIntoView(buttons[i]);
    }

    function scrollToPanel(i, behavior) {
      var panel = panels[i];
      if (!panel) return;
      isProgrammaticScroll = true;
      panelsHost.scrollTo({ left: panel.offsetLeft, behavior: behavior || 'smooth' });
      setTimeout(function () { isProgrammaticScroll = false; }, behavior === 'auto' ? 0 : 450);
    }

    function setActive(index, options) {
      var prev = selected;
      selected = clampIndex(index);
      setTimelineCurrent(selected);
      setMeta(selected);
      var sc = panelScrollElAt(selected);
      if (sc && prev !== selected) sc.scrollTop = 0;
      var immediate = options && options.immediate;
      scrollToPanel(selected, immediate ? 'auto' : 'smooth');
      emitTabChange();
    }

    function activeIndexFromScroll() {
      var w = panelsHost.clientWidth || 1;
      var idx = Math.round(panelsHost.scrollLeft / w);
      return clampIndex(idx);
    }

    falls.forEach(function (fall, idx) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'project-timeline__item';

      var label = fall && fall.label ? String(fall.label) : ('Fall ' + (idx + 1));
      var type = fall && fall.type ? String(fall.type) : '';
      var isPub = !!(fall && fall.isPublication);

      btn.textContent = label;
      btn.dataset.isPublication = isPub ? 'true' : 'false';
      if (type) {
        btn.setAttribute('aria-label', label + ': ' + type);
      }

      btn.addEventListener('click', function () {
        setActive(idx);
      });

      timelineHost.appendChild(btn);
    });

    panelsHost.addEventListener('scroll', function () {
      if (isProgrammaticScroll) return;
      if (rafScrollSync) cancelAnimationFrame(rafScrollSync);
      rafScrollSync = requestAnimationFrame(function () {
        rafScrollSync = 0;
        var idx = activeIndexFromScroll();
        if (idx === selected) return;
        selected = idx;
        setTimelineCurrent(selected);
        setMeta(selected);
        var sc = panelScrollElAt(selected);
        if (sc) sc.scrollTop = 0;
        emitTabChange();
      });
    }, { passive: true });

    window.addEventListener('resize', function () {
      scrollToPanel(selected, 'auto');
    });

    setActive(0, { immediate: true });
    if (timelineNav) {
      timelineNav.refresh();
      requestAnimationFrame(function () {
        timelineNav.refresh();
      });
    }
  }

  function setupProjectTimelineNav(timelineHost) {
    if (!timelineHost || timelineHost.dataset.timelineNavBound === '1') {
      return timelineHost._sdvTimelineNav || null;
    }
    var parent = timelineHost.parentElement;
    if (!parent) return null;

    var scrollRow = document.createElement('div');
    scrollRow.className = 'project-timeline-scroll';
    parent.insertBefore(scrollRow, timelineHost);

    var prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'project-timeline-nav project-timeline-nav--prev';
    prevBtn.setAttribute('aria-label', 'Scroll tabs left');
    prevBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M14 6l-6 6 6 6"/></svg>';

    var nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'project-timeline-nav project-timeline-nav--next';
    nextBtn.setAttribute('aria-label', 'Scroll tabs right');
    nextBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M10 6l6 6-6 6"/></svg>';

    scrollRow.appendChild(prevBtn);
    scrollRow.appendChild(timelineHost);
    scrollRow.appendChild(nextBtn);

    function refresh() {
      var overflow = timelineHost.scrollWidth > timelineHost.clientWidth + 2;
      scrollRow.classList.toggle('has-overflow', overflow);
      var atStart = timelineHost.scrollLeft <= 2;
      var atEnd = timelineHost.scrollLeft >= timelineHost.scrollWidth - timelineHost.clientWidth - 2;
      prevBtn.hidden = !overflow || atStart;
      nextBtn.hidden = !overflow || atEnd;
    }

    function scrollByDir(dir) {
      var delta = Math.max(100, timelineHost.clientWidth * 0.55) * dir;
      timelineHost.scrollBy({ left: delta, behavior: 'smooth' });
    }

    prevBtn.addEventListener('click', function () { scrollByDir(-1); });
    nextBtn.addEventListener('click', function () { scrollByDir(1); });
    timelineHost.addEventListener('scroll', refresh, { passive: true });
    window.addEventListener('resize', refresh);
    if (typeof ResizeObserver !== 'undefined') {
      var resizeObserver = new ResizeObserver(function () {
        refresh();
      });
      resizeObserver.observe(scrollRow);
      resizeObserver.observe(timelineHost);
    }

    var navApi = {
      refresh: refresh,
      scrollTabIntoView: function (btn) {
        if (!btn) return;
        try {
          btn.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
        } catch (e) {
          btn.scrollIntoView(false);
        }
        setTimeout(refresh, 280);
      },
    };

    timelineHost.dataset.timelineNavBound = '1';
    timelineHost._sdvTimelineNav = navApi;
    refresh();
    return navApi;
  }

  function renderProjectNotFound(title, textHost, prefix) {
    document.title = 'SDV — Not found';
    if (title) title.textContent = 'Not found';
    if (textHost) {
      textHost.innerHTML =
        '<p>This project could not be found. It may have been removed, ' +
        'or the link may be incorrect.</p>' +
        '<p><a href="' + escapeHtml(prefix) + '">Return home</a></p>';
    }
    ['project-materials', 'project-links', 'project-gallery'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });
    var zoomWrap = document.querySelector('.project-zoom-wrap');
    if (zoomWrap) zoomWrap.hidden = true;
  }

  async function loadProject() {
    var title = document.getElementById('overview-title');
    var textHost = document.getElementById('project-overview-text');
    var galleryHost = document.getElementById('project-gallery');
    if (!title || !textHost || !galleryHost) return;

    var slug = getProjectSlugFromPath();
    if (!slug) return;

    var prefix = rootPrefix();
    var data = null;
    if (!isPreviewEnabled() && SDV_PREVIEW.projectsBySlug && SDV_PREVIEW.projectsBySlug[slug]) {
      data = SDV_PREVIEW.projectsBySlug[slug] || {};
    }
    if (!data) {
      var doc = await sanityFetch(
        '*[_type=="project" && coalesce(slug.current, slug) == $slug][0]{' +
        PROJECT_FIELDS +
        '}',
        { slug: slug },
      );
      if (!doc && !isPreviewEnabled()) {
        renderProjectNotFound(title, textHost, prefix);
        return;
      }
      data = normalizeSanityProject(doc || {});
      SDV_PREVIEW.projectsBySlug[slug] = data;
    }

    if (data.header_title) {
      title.textContent = String(data.header_title);
    }
    document.title = String(data.header_title || document.title);

    var projectView = document.querySelector('.view--project');
    var bg = await resolvePageBackgroundColor(data, false);
    applyPageBackground(projectView, bg);
    setScopedTypographyConfig('project', [
      {
        selector: '.project-header',
        cssVar: 'font-project-title',
        override: data.titleFont,
        siteRole: 'strongUi',
      },
      {
        selector: '#project-overview-text',
        cssVar: 'font-project-prose',
        override: data.overviewFont,
        siteRole: 'prose',
      },
      {
        selector: '.project-timeline__item',
        cssVar: 'font-project-tab',
        override: data.tabFont,
        siteRole: 'strongUi',
      },
      {
        selector: '.project-fall-meta',
        cssVar: 'font-project-meta',
        override: data.metaFont,
        siteRole: 'lightUi',
      },
    ]);

    var bodyValue = data.body;
    textHost.innerHTML = Array.isArray(bodyValue) && bodyValue.length
      ? renderPortableText(bodyValue)
      : '<p>Content not found.</p>';

    var materialsHost = document.getElementById('project-materials');
    if (materialsHost) {
      var matsHtml = '';
      if (Array.isArray(data.materials) && data.materials.length) {
        matsHtml =
          '<h3>Material composition &amp; elements</h3><ul>' +
          data.materials
            .map(function (m) {
              var text = String(m || '').trim();
              return text ? '<li>' + escapeHtml(text) + '</li>' : '';
            })
            .filter(Boolean)
            .join('') +
          '</ul>';
      }
      var iconKeys = homeMaterialKeysForProject(data);
      var icons = renderMaterialIcons(iconKeys);
      var iconsWrap = icons
        ? ('<div class="project-material-icons" aria-hidden="true">' + icons + '</div>')
        : '';
      materialsHost.innerHTML = matsHtml || iconsWrap ? matsHtml + iconsWrap : '';
    }

    var linksHost = document.getElementById('project-links');
    if (linksHost) {
      linksHost.innerHTML = renderProjectLinksHtml(data.links, prefix);
    }

    var zoomWrap = document.querySelector('.project-zoom-wrap');
    var zoomBtn = document.querySelector('.project-zoom-btn');
    var panels = effectiveTimelinePanels(data);
    var hasImmersive = projectHasPublicationImmersive(panels);
    if (zoomWrap) {
      zoomWrap.hidden = !hasImmersive;
    }
    if (zoomBtn && hasImmersive) {
      zoomBtn.setAttribute('href', withPreviewQuery('../../immersive/' + slug + '/'));
    }

    if (galleryHost) {
      galleryHost.querySelectorAll('h2').forEach(function (el) { el.remove(); });
      var timelineHost = document.getElementById('project-timeline');
      var panelsHost = document.getElementById('project-gallery-panels');
      var metaHost = document.getElementById('project-fall-meta');
      window.SDV_PROJECT_FALLS = panels;

      if (timelineHost && panelsHost) {
        galleryHost.classList.add('has-falls');
        galleryHost.querySelectorAll('img').forEach(function (el) { el.remove(); });
        buildFallTimeline(timelineHost, panelsHost, metaHost, panels, prefix);
      }
    }
  }

  function safeHref(href, prefix) {
    var s = String(href || '');
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith('/')) s = s.slice(1);
    return prefix + s;
  }

  function resolveFileHref(fileField, prefix) {
    if (!fileField) return '';
    if (typeof fileField === 'string') return safeHref(fileField, prefix);
    if (fileField.asset && fileField.asset.url) return String(fileField.asset.url);
    if (fileField.asset && fileField.asset._ref) {
      var built = sanityAssetUrlFromRef(fileField.asset._ref);
      if (built) return built;
    }
    if (fileField.url) return String(fileField.url);
    return '';
  }

  function renderProjectLinksHtml(links, prefix) {
    if (!Array.isArray(links) || !links.length) return '';
    var items = links.map(function (item) {
      if (!item) return '';
      var label = '';
      var url = '';
      if (typeof item === 'string') {
        label = String(item);
        url = String(item);
      } else {
        label = item.label ? String(item.label) : '';
        url = item.url ? String(item.url) : '';
      }
      label = label.trim();
      url = url.trim();
      if (!label && !url) return '';
      var href = escapeHtml(safeHref(url || label, prefix));
      var text = escapeHtml(label || url);
      return '<li><a href="' + href + '" target="_blank" rel="noopener">' + text + '</a></li>';
    }).filter(Boolean);
    if (!items.length) return '';
    return '<p><strong>Links</strong></p><ul>' + items.join('') + '</ul>';
  }

  async function loadInfoLinks() {
    var bioHost = document.getElementById('home-info-bio');
    var cvHost = document.getElementById('home-info-cv');
    if (!bioHost && !cvHost) return;

    var bioBody = '';
    var cvBody = '';
    var infoDoc = null;

    if (SDV_PREVIEW.info && !isPreviewEnabled()) {
      bioBody = SDV_PREVIEW.info.bio || SDV_PREVIEW.info.body || '';
      cvBody = SDV_PREVIEW.info.cv || '';
      infoDoc = SDV_PREVIEW.info;
    } else {
      infoDoc = await sanityFetch(
        '*[_type=="info"][0]{' +
          'bio, cv, body, _updatedAt,' +
          fontRoleProjection('bioFont') + ',' +
          fontRoleProjection('cvFont') +
          '}',
      );
      var normalized = normalizeSanityInfo(infoDoc || {});
      bioBody = normalized.bio;
      cvBody = normalized.cv;
      SDV_PREVIEW.info = normalized;
      infoDoc = normalized;
    }

    var bioHtml = Array.isArray(bioBody) && bioBody.length
      ? renderPortableText(bioBody)
      : '<p>Bio not found.</p>';
    var cvHtml = Array.isArray(cvBody) && cvBody.length ? renderPortableText(cvBody) : '';

    if (bioHost) {
      bioHost.innerHTML = '<h2 class="home-info-section__title">Bio</h2>' + bioHtml;
    }
    if (cvHost) {
      cvHost.innerHTML = cvHtml
        ? ('<h2 class="home-info-section__title">CV</h2>' + cvHtml)
        : '';
    }

    setScopedTypographyConfig('info', [
      {
        selector: '#home-info-bio',
        cssVar: 'font-home-bio',
        override: infoDoc && infoDoc.bioFont,
        siteRole: 'prose',
      },
      {
        selector: '#home-info-cv',
        cssVar: 'font-home-cv',
        override: infoDoc && infoDoc.cvFont,
        siteRole: 'prose',
      },
    ]);
  }

  document.addEventListener('DOMContentLoaded', function () {
    function startPageLoad() {
      preservePreviewLinks();
      var catalogReady = loadMaterialCatalog();
    if (canUseDraftPreview()) {
      loadTypography().catch(function () { });
    } else {
      function runTypography() {
        loadTypography().catch(function () { });
      }
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(runTypography, { timeout: 2000 });
      } else {
        setTimeout(runTypography, 16);
      }
    }
    loadInfoLinks().catch(function () {
      var bioHost = document.getElementById('home-info-bio');
      if (bioHost) bioHost.innerHTML = '<p>Bio failed to load.</p>';
      var cvHost = document.getElementById('home-info-cv');
      if (cvHost) cvHost.innerHTML = '';
    });
    catalogReady.finally(function () {
      loadProject().catch(function () {
        var textHost = document.getElementById('project-overview-text');
        if (textHost) textHost.innerHTML = '<p>Project content failed to load.</p>';
        var galleryHost = document.getElementById('project-gallery');
        if (galleryHost) galleryHost.querySelectorAll('img').forEach(function (el) { el.remove(); });
      });
      loadHomeMaterials().catch(function () { });
    });
    loadHome().catch(function () { });
    loadImmersiveContent().catch(function () { });

    if (isPreviewEnabled()) {
      var lastPresentationPerspective = presentationApiPerspective();
      function onPresentationNavigation() {
        var next = presentationApiPerspective();
        if (next === lastPresentationPerspective) return;
        lastPresentationPerspective = next;
        resetPreviewSanityClient();
        refetchAllSanityDrivenContent().catch(function () { });
      }
      window.addEventListener('popstate', onPresentationNavigation);
    }
    }

    if (isPreviewEnabled()) {
      Promise.all([setupVisualEditingBridge(), loadVisualEditingModule(), loadStegaClean()])
        .then(startPageLoad)
        .catch(function (err) {
          console.warn('[sdv] Preview bootstrap failed:', err && err.message ? err.message : err);
          startPageLoad();
        });
    } else {
      startPageLoad();
    }
  });
})();
