/**
 * Fetches Sanity content for static HTML pages, injects DOM where needed, and wires Presentation
 * visual editing (history + mutation refetch). Depends on sdv-shared.js (window.SDV).
 * Globals set: SDV_HOME_PROJECTS, SDV_PROJECT_MATERIALS, SDV_ALL_MATERIALS, SDV_CAPTIONS,
 * SDV_IMMERSIVE_SLIDER (Needle immersive only). Dispatches: sdv:home, sdv:materials, sdv:captions,
 * sdv:immersive-ready (detail.slug).
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
    return 'http://127.0.0.1:3333';
  }

  var SANITY_STUDIO_URL = detectStudioUrl();

  var SDV_PREVIEW = {
    projectsBySlug: {},
    info: null,
    captions: null,
    homeProjects: null,
  };

  var isPreviewEnabled = SDV.isPreviewEnabled;

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

  SDV_PREVIEW_TOKEN = getPreviewToken();
  var sanityCreateClientPromise = null;
  var previewSanityClient = null;
  var previewSanityClientKey = '';
  var publicSanityClient = null;
  var visualEditingSetupPromise = null;

  /** Pin versions to studio-sdv-site/package.json (@sanity/client, react, visual-editing). */
  var SANITY_CLIENT_ESM = 'https://esm.sh/@sanity/client@7.18.0?bundle';
  var SANITY_VISUAL_EDITING_ESM =
    'https://esm.sh/@sanity/visual-editing@5.3.1?bundle&deps=react@19.2.4,react-dom@19.2.4,styled-components@6.1.18,@sanity/client@7.18.0';

  function dynamicImport(url) {
    return Function('u', 'return import(u)')(url);
  }

  function invalidatePreviewCaches(changedDoc) {
    var d = changedDoc || {};
    if (!d._type) {
      SDV_PREVIEW.projectsBySlug = {};
      SDV_PREVIEW.info = null;
      SDV_PREVIEW.captions = null;
      SDV_PREVIEW.homeProjects = null;
      return;
    }
    if (d._type === 'project') {
      SDV_PREVIEW.projectsBySlug = {};
      SDV_PREVIEW.homeProjects = null;
    }
    if (d._type === 'homePage') SDV_PREVIEW.homeProjects = null;
    if (d._type === 'info') SDV_PREVIEW.info = null;
    if (d._type === 'captions') SDV_PREVIEW.captions = null;
    if (d._type === 'siteTypography' || d._type === 'fontUpload') {
      try {
        var ty = document.getElementById('sdv-typography');
        if (ty) ty.remove();
      } catch (e) { }
    }
  }

  function resetPreviewSanityClient() {
    previewSanityClient = null;
    previewSanityClientKey = '';
    publicSanityClient = null;
  }

  async function refetchAllSanityDrivenContent() {
    if (isPreviewEnabled()) resetPreviewSanityClient();
    preservePreviewLinks();
    await Promise.all([
      loadInfoLinks().catch(function () { }),
      loadProject().catch(function () { }),
      loadHome().catch(function () { }),
      loadHomeMaterials().catch(function () { }),
      loadCaptions().catch(function () { }),
      loadImmersiveContent().catch(function () { }),
      loadTypography().catch(function () { }),
    ]);
  }

  function presentationApiPerspective() {
    try {
      var qs = new URLSearchParams(window.location.search || '');
      var sp = String(qs.get('sanity-preview-perspective') || '').toLowerCase();
      if (sp === 'published') return 'published';
    } catch (e) { }
    return canUseDraftPreview() ? 'drafts' : 'published';
  }

  async function getSanityCreateClient() {
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
   * Published reads via Sanity CDN (single fetch). Avoids loading @sanity/client from esm.sh
   * (hundreds of tiny module requests). Draft/preview with token still uses the full client.
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
      throw new Error(msg);
    }
    return json.result;
  }

  async function sanityFetch(query, params) {
    if (!canUseDraftPreview()) {
      return sanityFetchCdn(query, params);
    }
    var client = await getSanityFetchClient();
    return client.fetch(query, params || {});
  }

  async function setupVisualEditingBridge() {
    if (!isPreviewEnabled()) return;
    if (visualEditingSetupPromise) return visualEditingSetupPromise;
    visualEditingSetupPromise = dynamicImport(SANITY_VISUAL_EDITING_ESM)
      .then(function (mod) {
        var enable = mod.enableVisualEditing || (mod.default && mod.default.enableVisualEditing);
        if (!enable) throw new Error('Unable to load enableVisualEditing');
        return enable({
          zIndex: 2147483000,
          history: {
            subscribe: function (navigate) {
              function pathUrl() {
                return (
                  '' +
                  (window.location.pathname || '') +
                  (window.location.search || '') +
                  (window.location.hash || '')
                );
              }
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
              window.addEventListener('popstate', onPopState);
              window.addEventListener('hashchange', syncToPresentation);
              function onPageShow(ev) {
                if (ev && ev.persisted) syncToPresentation();
              }
              window.addEventListener('pageshow', onPageShow);
              return function () {
                clearTimeout(retryT);
                window.removeEventListener('popstate', onPopState);
                window.removeEventListener('hashchange', syncToPresentation);
                window.removeEventListener('pageshow', onPageShow);
              };
            },
            update: function (update) {
              switch (update.type) {
                case 'push':
                  return window.history.pushState(null, '', update.url);
                case 'pop':
                  return window.history.back();
                case 'replace':
                  return window.history.replaceState(null, '', update.url);
                default:
                  console.warn('[sdv] Unhandled visual-editing history update', update);
              }
            },
          },
          refresh: function (payload) {
            if (payload.source === 'manual') {
              window.location.reload();
              return Promise.resolve();
            }
            if (payload.source === 'mutation') {
              invalidatePreviewCaches(payload.document);
              return refetchAllSanityDrivenContent();
            }
            return false;
          },
        });
      })
      .catch(function (err) {
        console.warn('[sdv] Sanity visual editing failed to initialize:', err && err.message ? err.message : err);
      });
    return visualEditingSetupPromise;
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
        var text = escapeHtml(String(child.text || ''));
        var marks = Array.isArray(child.marks) ? child.marks.slice() : [];

        marks.forEach(function (mark) {
          if (mark === 'strong') text = '<strong>' + text + '</strong>';
          else if (mark === 'em') text = '<em>' + text + '</em>';
          else if (mark === 'strike-through') text = '<del>' + text + '</del>';
          else if (markDefMap[mark] && markDefMap[mark]._type === 'link' && markDefMap[mark].href) {
            text =
              '<a href="' + escapeAttr(markDefMap[mark].href) + '" target="_blank" rel="noopener">' + text + '</a>';
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
      else out.push('<p>' + itemText + '</p>');
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
  var canonicalMaterialKey = SDV.canonicalMaterialKey;
  var canonicalMaterialLabel = SDV.canonicalMaterialLabel;
  var renderMaterialIcons = SDV.renderMaterialIcons;

  function extractMaterialKeysForProject(data) {
    var sourceList = Array.isArray(data && data.home_materials)
      ? data.home_materials
      : (Array.isArray(data && data.materials) ? data.materials : []);
    var keys = [];
    var seen = {};
    sourceList.forEach(function (labelRaw) {
      if (labelRaw === null || labelRaw === undefined) return;
      var label = String(labelRaw).trim();
      if (!label) return;
      var rawKey = slugifyKey(label);
      if (!rawKey) return;
      var key = canonicalMaterialKey(rawKey, label);
      if (!key || seen[key]) return;
      seen[key] = 1;
      keys.push(key);
    });
    return keys;
  }

  function normalizeSanityProject(data) {
    var d = data || {};
    var hc = d.homeLineColor != null ? String(d.homeLineColor).trim() : '';
    return {
      slug: d.slug || '',
      immersive_enabled: d.immersive_enabled,
      home_materials: Array.isArray(d.home_materials) ? d.home_materials : [],
      header_title: d.header_title || '',
      body: d.body || '',
      materials: Array.isArray(d.materials) ? d.materials : [],
      links: Array.isArray(d.links) ? d.links : [],
      gallery: Array.isArray(d.gallery) ? d.gallery : [],
      falls: Array.isArray(d.falls) ? d.falls : [],
      homeLineColor: hc,
      _updatedAt: d._updatedAt || '',
    };
  }

  function normalizeSanityInfo(data) {
    var d = data || {};
    return {
      data: {
        press: Array.isArray(d.press) ? d.press : [],
        cv: d.cv || {},
        _updatedAt: d._updatedAt || '',
      },
      body: d.body || '',
    };
  }

  function normalizeSanityCaptions(data) {
    var d = data || {};
    return {
      captions: Array.isArray(d.items) ? d.items : [],
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

  var SYSTEM_FONT_STACKS = {
    'system-ui':
      'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    georgia: 'Georgia, "Times New Roman", Times, serif',
    times: '"Times New Roman", Times, Georgia, serif',
    palatino: 'Palatino, "Palatino Linotype", "Book Antiqua", serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
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

  function resolveFontRole(choice, faceSink) {
    var fallback = SYSTEM_FONT_STACKS['system-ui'];
    if (!choice || choice.source === 'system' || !choice.source) {
      var preset = choice && choice.systemPreset ? String(choice.systemPreset) : 'system-ui';
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

  function buildTypographyStyles(doc) {
    var sink = { seen: {}, css: '' };
    var base = resolveFontRole(doc && doc.baseUi, sink);
    var prose = resolveFontRole(doc && doc.prose, sink);
    var strong = resolveFontRole(doc && doc.strongUi, sink);
    var light = resolveFontRole(doc && doc.lightUi, sink);
    var accent = resolveFontRole(doc && doc.accent, sink);
    return (
      sink.css +
      ':root{--font:' +
      base +
      ';--font-prose:' +
      prose +
      ';--font-strong:' +
      strong +
      ';--font-light:' +
      light +
      ';--font-accent:' +
      accent +
      ';}'
    );
  }

  async function loadTypography() {
    try {
      var doc = await sanityFetch(
        '*[_id in ["siteTypography", "drafts.siteTypography"]]|order(_updatedAt desc)[0]{' +
          'baseUi{source,systemPreset,fontRef->{_id,cssFamily,fontWeight,fontStyle,fontFile{asset->{_ref,url}}}},' +
          'prose{source,systemPreset,fontRef->{_id,cssFamily,fontWeight,fontStyle,fontFile{asset->{_ref,url}}}},' +
          'strongUi{source,systemPreset,fontRef->{_id,cssFamily,fontWeight,fontStyle,fontFile{asset->{_ref,url}}}},' +
          'lightUi{source,systemPreset,fontRef->{_id,cssFamily,fontWeight,fontStyle,fontFile{asset->{_ref,url}}}},' +
          'accent{source,systemPreset,fontRef->{_id,cssFamily,fontWeight,fontStyle,fontFile{asset->{_ref,url}}}}' +
          '}',
      );
      if (!doc) {
        var rm = document.getElementById('sdv-typography');
        if (rm) rm.remove();
        return;
      }
      var css = buildTypographyStyles(doc);
      var el = document.getElementById('sdv-typography');
      if (!el) {
        el = document.createElement('style');
        el.id = 'sdv-typography';
        document.head.appendChild(el);
      }
      el.textContent = css;
    } catch (e) {
      // Keep stylesheet defaults
    }
  }

  function dispatchImmersiveReady(slug) {
    window.dispatchEvent(new CustomEvent('sdv:immersive-ready', { detail: { slug: slug || '' } }));
  }

  function segmentType(seg) {
    if (!seg) return '';
    return String(seg._type || seg.type || '');
  }

  function buildLawLayoutHtml(paragraphs, heading, prefix) {
    var h = '<div class="law-layout"><div class="law-text">';
    if (heading) {
      h += '<h2 class="law-heading">' + escapeHtml(heading) + '</h2>';
    }
    (paragraphs || []).forEach(function (para) {
      h += '<p>';
      var segs = Array.isArray(para && para.segments) ? para.segments : [];
      segs.forEach(function (seg) {
        var st = segmentType(seg);
        if (st === 'lawTextSegment') {
          var t = String(seg.text || '').replace(/\s+/g, ' ').trim();
          if (t) h += escapeHtml(t);
        } else if (st === 'lawFragmentSegment') {
          var imgSrc = resolveImageSrc(seg.image, prefix);
          var bt = String(seg.buttonText || '').replace(/\s+/g, ' ').trim();
          h +=
            '<button type="button" class="law-fragment" data-image="' +
            escapeAttr(imgSrc) +
            '">' +
            escapeHtml(bt) +
            '</button><span class="law-image-inline"></span>';
        }
      });
      h += '</p>';
    });
    h += '</div></div>';
    return h;
  }

  /** Remove Stega / invisible chars Sanity may inject in preview fetches */
  function stripStegaText(t) {
    return String(t || '').replace(/[\u00ad\u200b-\u200f\u2028\u2029\ufeff]/g, '');
  }

  function renderLawBodyPortableText(blocks, prefix) {
    if (!Array.isArray(blocks) || !blocks.length) return '';

    function renderLawSpanChildren(block) {
      var children = Array.isArray(block && block.children) ? block.children : [];
      var markDefs = Array.isArray(block && block.markDefs) ? block.markDefs : [];
      var markDefMap = {};
      markDefs.forEach(function (d) {
        if (d && d._key) markDefMap[d._key] = d;
      });

      return children
        .map(function (child) {
          if (!child || child._type !== 'span') return '';
          var rawText = stripStegaText(child.text || '');
          var marks = Array.isArray(child.marks) ? child.marks.slice() : [];

          var lawMarkKey = null;
          for (var mi = 0; mi < marks.length; mi++) {
            var mk = marks[mi];
            var def = markDefMap[mk];
            if (def && def._type === 'lawFragment') {
              lawMarkKey = mk;
              break;
            }
          }

          if (lawMarkKey) {
            var lfDef = markDefMap[lawMarkKey];
            var imgSrc = resolveImageSrc(lfDef && lfDef.image, prefix);
            var inner = escapeHtml(rawText);
            marks.forEach(function (mark) {
              if (mark === lawMarkKey) return;
              if (mark === 'strong') inner = '<strong>' + inner + '</strong>';
              else if (mark === 'em') inner = '<em>' + inner + '</em>';
              else if (mark === 'strike-through') inner = '<del>' + inner + '</del>';
              else if (markDefMap[mark] && markDefMap[mark]._type === 'link' && markDefMap[mark].href) {
                inner =
                  '<a href="' +
                  escapeAttr(markDefMap[mark].href) +
                  '" target="_blank" rel="noopener">' +
                  inner +
                  '</a>';
              }
            });
            return (
              '<button type="button" class="law-fragment" data-image="' +
              escapeAttr(imgSrc) +
              '">' +
              inner +
              '</button><span class="law-image-inline"></span>'
            );
          }

          var text = escapeHtml(rawText);
          marks.forEach(function (mark) {
            if (mark === 'strong') text = '<strong>' + text + '</strong>';
            else if (mark === 'em') text = '<em>' + text + '</em>';
            else if (mark === 'strike-through') text = '<del>' + text + '</del>';
            else if (markDefMap[mark] && markDefMap[mark]._type === 'link' && markDefMap[mark].href) {
              text =
                '<a href="' +
                escapeAttr(markDefMap[mark].href) +
                '" target="_blank" rel="noopener">' +
                text +
                '</a>';
            }
          });
          return text;
        })
        .join('');
    }

    var out = [];
    var listType = null;
    var listItems = [];

    function flushLawList() {
      if (!listType || !listItems.length) return;
      var tag = listType === 'number' ? 'ol' : 'ul';
      out.push('<' + tag + '>' + listItems.map(function (li) { return '<li>' + li + '</li>'; }).join('') + '</' + tag + '>');
      listType = null;
      listItems = [];
    }

    blocks.forEach(function (block) {
      if (!block || block._type !== 'block') return;
      var itemText = renderLawSpanChildren(block);
      if (block.listItem) {
        var current = block.listItem === 'number' ? 'number' : 'bullet';
        if (listType && listType !== current) flushLawList();
        listType = current;
        listItems.push(itemText);
        return;
      }

      flushLawList();
      var style = block.style || 'normal';
      if (style === 'h2') out.push('<h2>' + itemText + '</h2>');
      else if (style === 'h3') out.push('<h3>' + itemText + '</h3>');
      else if (style === 'blockquote') out.push('<blockquote><p>' + itemText + '</p></blockquote>');
      else out.push('<p>' + itemText + '</p>');
    });

    flushLawList();
    return out.join('\n');
  }

  function buildLawDocumentHtml(heading, bodyBlocks, prefix) {
    var inner = renderLawBodyPortableText(bodyBlocks, prefix);
    var h = '<div class="law-layout"><div class="law-text">';
    if (heading) {
      h += '<h2 class="law-heading">' + escapeHtml(stripStegaText(heading)) + '</h2>';
    }
    h += inner;
    h += '</div></div>';
    return h;
  }

  var HOME_PAGE_DOC_ID = 'homePageConfig';
  var IMMERSIVE_LAW_DOC_ID = 'immersiveLawDance';
  var IMMERSIVE_NEEDLE_DOC_ID = 'immersiveNeedleSlider';

  var HOME_PAGE_GROQ =
    '*[_id == "' +
    HOME_PAGE_DOC_ID +
    '"][0]{\n' +
    '  entries[]{\n' +
    '    navLabel,\n' +
    '    homeLineColor,\n' +
    '    splashImage,\n' +
    '    "proj": project->{\n' +
    '      slug, homeLineColor, home_materials, immersive_enabled, header_title,\n' +
    '      body, materials, links, falls, gallery, _updatedAt\n' +
    '    }\n' +
    '  }\n' +
    '}';

  var PROJECT_FALLBACK_GROQ =
    '*[_type == "project"]{\n' +
    '  slug, homeLineColor, home_materials, immersive_enabled, header_title,\n' +
    '  body, materials, links, falls, gallery, _updatedAt\n' +
    '}';

  var FALLBACK_SLUG_ORDER = ['the-spontaneous-dance-falls', 'under-the-needles-eye', 'overlocked'];

  /** When Sanity is unreachable or returns no projects, still render home nav + materials (matches content/home.json). */
  function getOfflineHomeProjects() {
    return [
      {
        slug: 'the-spontaneous-dance-falls',
        header_title: 'The Spontaneous Dance Falls',
        home_materials: ['Glass', 'Textile', 'Metal', 'Archive', 'A/V', 'Performance'],
        materials: [],
        gallery: ['images/home/fall.jpg'],
        immersive_enabled: true,
        body: [],
        links: [],
        falls: [],
        homeLineColor: '#3f3739',
        _updatedAt: '',
        _homeNavLabelOverride: '',
        _homeSplashOverride: null,
        _homeLineColor: '#3f3739',
      },
      {
        slug: 'under-the-needles-eye',
        header_title: "Under the Needle's Eye",
        home_materials: ['Textile', 'Metal', 'Archive', 'A/V'],
        materials: [],
        gallery: ['images/home/needle.jpg'],
        immersive_enabled: true,
        body: [],
        links: [],
        falls: [],
        homeLineColor: '#713b38',
        _updatedAt: '',
        _homeNavLabelOverride: '',
        _homeSplashOverride: null,
        _homeLineColor: '#713b38',
      },
      {
        slug: 'overlocked',
        header_title: 'overlocked',
        home_materials: ['Synthetic', 'Textile', 'Archive', 'A/V', 'Objects'],
        materials: [],
        gallery: ['images/home/overlocked.jpg'],
        immersive_enabled: true,
        body: [],
        links: [],
        falls: [],
        homeLineColor: '#1851a3',
        _updatedAt: '',
        _homeNavLabelOverride: '',
        _homeSplashOverride: null,
        _homeLineColor: '#1851a3',
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
    if (SDV_PREVIEW.homeProjects && Array.isArray(SDV_PREVIEW.homeProjects)) {
      return SDV_PREVIEW.homeProjects;
    }
    try {
      var homeDoc = await sanityFetch(HOME_PAGE_GROQ);
      var entries = homeDoc && Array.isArray(homeDoc.entries) ? homeDoc.entries : [];
      var merged = [];
      for (var ei = 0; ei < entries.length; ei++) {
        var e = entries[ei] || {};
        var p = e.proj;
        if (!p || !p.slug) continue;
        var base = normalizeSanityProject(p);
        base._homeNavLabelOverride = e.navLabel && String(e.navLabel).trim() ? String(e.navLabel).trim() : '';
        base._homeSplashOverride = e.splashImage || null;
        var entryLine = e.homeLineColor != null ? String(e.homeLineColor).trim() : '';
        base._homeLineColor = entryLine || (base.homeLineColor && String(base.homeLineColor).trim()) || '';
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

  async function loadHome() {
    var nav = document.querySelector('.home-projects');
    if (!nav) return;

    try {
      var projects = await fetchOrderedProjects();
      window.SDV_HOME_PROJECTS = projects.map(function (p) {
        var prefix = rootPrefix();
        var splash = p._homeSplashOverride ? resolveImageSrc(p._homeSplashOverride, prefix) : '';
        if (!splash && Array.isArray(p.gallery) && p.gallery[0]) {
          splash = resolveImageSrc(p.gallery[0], prefix);
        }
        var label =
          (p._homeNavLabelOverride && String(p._homeNavLabelOverride).trim()) ||
          p.header_title ||
          p.slug;
        var hl = String(p._homeLineColor != null ? p._homeLineColor : p.homeLineColor || '').trim();
        return { slug: p.slug, label: label, splashUrl: splash, homeLineColor: hl };
      });

      var html = '';
      window.SDV_HOME_PROJECTS.forEach(function (row) {
        html +=
          '<button type="button" class="home-project" data-slug="' +
          escapeAttr(row.slug) +
          '">' +
          escapeHtml(row.label) +
          '</button>';
      });
      nav.innerHTML = html;
      window.dispatchEvent(new CustomEvent('sdv:home'));
    } catch (e) {
      console.warn('[sdv] loadHome failed:', e && e.message ? e.message : e);
      try {
        window.SDV_HOME_PROJECTS = getOfflineHomeProjects().map(function (p) {
          var prefix = rootPrefix();
          var splash = '';
          if (Array.isArray(p.gallery) && p.gallery[0]) splash = resolveImageSrc(p.gallery[0], prefix);
          var label =
            (p._homeNavLabelOverride && String(p._homeNavLabelOverride).trim()) || p.header_title || p.slug;
          var hl2 = String(p._homeLineColor != null ? p._homeLineColor : p.homeLineColor || '').trim();
          return { slug: p.slug, label: label, splashUrl: splash, homeLineColor: hl2 };
        });
        var html2 = '';
        window.SDV_HOME_PROJECTS.forEach(function (row) {
          html2 +=
            '<button type="button" class="home-project" data-slug="' +
            escapeAttr(row.slug) +
            '">' +
            escapeHtml(row.label) +
            '</button>';
        });
        nav.innerHTML = html2;
        window.dispatchEvent(new CustomEvent('sdv:home'));
      } catch (e2) { }
    }
  }

  async function loadImmersiveContent() {
    var slug = getImmersiveSlugFromPath();
    var page = document.querySelector('.immersive-page');
    if (!page || !slug) return;

    page.setAttribute('data-slug', slug);

    if (slug === 'overlocked') {
      dispatchImmersiveReady(slug);
      return;
    }

    if (slug !== 'the-spontaneous-dance-falls' && slug !== 'under-the-needles-eye') {
      dispatchImmersiveReady(slug);
      return;
    }

    try {
      var prefix = rootPrefix();

      if (slug === 'the-spontaneous-dance-falls') {
        var lawDoc = await sanityFetch(
          '*[_id in [$publishedId, $draftId]] | order(_updatedAt desc)[0]{heading, body}',
          {
            publishedId: IMMERSIVE_LAW_DOC_ID,
            draftId: 'drafts.' + IMMERSIVE_LAW_DOC_ID,
          },
        );
        var lawHtml = '';
        if (lawDoc && Array.isArray(lawDoc.body) && lawDoc.body.length) {
          lawHtml = buildLawDocumentHtml(lawDoc.heading || '', lawDoc.body, prefix);
        } else {
          var legacyLaw = await sanityFetch(
            '*[_type == "project" && slug == $slug][0]{immersive_law_heading, immersive_law_paragraphs}',
            { slug: slug },
          );
          var ld = legacyLaw || {};
          lawHtml = buildLawLayoutHtml(
            Array.isArray(ld.immersive_law_paragraphs) ? ld.immersive_law_paragraphs : [],
            ld.immersive_law_heading || '',
            prefix,
          );
        }
        var mainInner = document.getElementById('immersive-inner');
        var insetInner = document.getElementById('immersive-inner-inset');
        if (mainInner) mainInner.innerHTML = lawHtml;
        if (insetInner) insetInner.innerHTML = lawHtml;
      }

      if (slug === 'under-the-needles-eye') {
        var needleDoc = await sanityFetch(
          '*[_id in [$publishedId, $draftId]] | order(_updatedAt desc)[0]{slides}',
          {
            publishedId: IMMERSIVE_NEEDLE_DOC_ID,
            draftId: 'drafts.' + IMMERSIVE_NEEDLE_DOC_ID,
          },
        );
        var slideRows = needleDoc && Array.isArray(needleDoc.slides) ? needleDoc.slides : [];
        if (!slideRows.length) {
          var legacyNeedle = await sanityFetch(
            '*[_type == "project" && slug == $slug][0]{immersive_slider_slides}',
            { slug: slug },
          );
          slideRows =
            legacyNeedle && Array.isArray(legacyNeedle.immersive_slider_slides)
              ? legacyNeedle.immersive_slider_slides
              : [];
        }
        var slides = [];
        slideRows.forEach(function (slide) {
          if (!slide) return;
          var src = resolveImageSrc(slide.image, prefix);
          var cap = Array.isArray(slide.caption) ? renderPortableText(slide.caption) : '';
          slides.push({ src: src, captionHtml: cap });
        });
        window.SDV_IMMERSIVE_SLIDER = { slides: slides };
      } else {
        try {
          delete window.SDV_IMMERSIVE_SLIDER;
        } catch (e) {
          window.SDV_IMMERSIVE_SLIDER = undefined;
        }
      }
    } catch (e) {
      console.warn('[sdv] Immersive content failed to load:', e && e.message ? e.message : e);
    }

    dispatchImmersiveReady(slug);
  }

  async function loadHomeMaterials() {
    if (!document.querySelector('.view--home')) return;

    try {
      var projects = await fetchOrderedProjects();
      var slugs = projects.map(function (p) { return p.slug; }).filter(Boolean);

      function fetchProject(slug) {
        var hit = projects.find(function (p) { return p.slug === slug; });
        if (hit) {
          return Promise.resolve({ slug: slug, data: hit });
        }
        return sanityFetch(
          '*[_type=="project" && slug == $slug][0]{' +
          'slug, home_materials, immersive_enabled, header_title, body, materials, links, falls, gallery, _updatedAt' +
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
        var sourceList = Array.isArray(d.home_materials) ? d.home_materials : (Array.isArray(d.materials) ? d.materials : []);
        var mats = [];
        var seen = {};
        sourceList.forEach(function (labelRaw) {
          if (labelRaw === null || labelRaw === undefined) return;
          var label = String(labelRaw).trim();
          if (!label) return;
          var rawKey = slugifyKey(label);
          if (!rawKey) return;
          var key = canonicalMaterialKey(rawKey, label);
          if (!key) return;
          if (seen[key]) return;
          seen[key] = 1;
          var canonLabel = canonicalMaterialLabel(key) || label;
          mats.push({ key: key, label: canonLabel });
          if (!allLabelsByKey[key]) allLabelsByKey[key] = canonLabel;
        });
        projectMap[r.slug] = { materials: mats };
      });

      var all = Object.keys(allLabelsByKey).sort(function (a, b) {
        return allLabelsByKey[a].localeCompare(allLabelsByKey[b]);
      }).map(function (key) {
        return { key: key, label: allLabelsByKey[key] };
      });

      window.SDV_PROJECT_MATERIALS = projectMap;
      window.SDV_ALL_MATERIALS = all;
      window.dispatchEvent(new Event('sdv:materials'));
    } catch (e) {
      // Non-fatal.
    }
  }

  function buildGallery(host, items, prefix) {
    if (!host) return;
    host.querySelectorAll('img').forEach(function (el) { el.remove(); });
    (items || []).forEach(function (src) {
      var img = document.createElement('img');
      img.src = resolveImageSrc(src, prefix);
      img.alt = '';
      host.appendChild(img);
    });
  }

  function buildFallTimeline(timelineHost, panelsHost, metaHost, falls, prefix) {
    if (!timelineHost || !panelsHost) return;
    timelineHost.innerHTML = '';
    panelsHost.innerHTML = '';

    var selected = 0;
    var isProgrammaticScroll = false;
    var rafScrollSync = 0;

    function buildPanelImages(hostEl, fall) {
      hostEl.innerHTML = '';
      if (!fall || !Array.isArray(fall.images)) return;
      fall.images.forEach(function (src) {
        var img = document.createElement('img');
        img.src = resolveImageSrc(src, prefix);
        img.alt = '';
        hostEl.appendChild(img);
      });
    }

    var panels = falls.map(function (fall) {
      var panel = document.createElement('div');
      panel.className = 'project-gallery-panel';
      var scroll = document.createElement('div');
      scroll.className = 'project-gallery-panel-scroll';
      buildPanelImages(scroll, fall);
      panel.appendChild(scroll);
      panelsHost.appendChild(panel);
      return panel;
    });

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
      var label = fall.label ? String(fall.label) : '';
      var type = fall.type ? String(fall.type) : '';
      metaHost.textContent = type ? (label + ' — ' + type) : label;
    }

    function setTimelineCurrent(i) {
      Array.from(timelineHost.querySelectorAll('button')).forEach(function (b, idx) {
        b.setAttribute('aria-current', idx === i ? 'true' : 'false');
      });
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
      var details = fall && fall.details ? String(fall.details) : '';

      btn.textContent = label;
      if (type || details) {
        btn.setAttribute('aria-label', type ? (label + ': ' + type) : label);
        if (details) btn.title = details;
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
      });
    }, { passive: true });

    window.addEventListener('resize', function () {
      scrollToPanel(selected, 'auto');
    });

    setActive(0, { immediate: true });
  }

  async function loadProject() {
    var title = document.getElementById('overview-title');
    var textHost = document.getElementById('project-overview-text');
    var galleryHost = document.getElementById('project-gallery');
    if (!title || !textHost || !galleryHost) return;

    var slug = getProjectSlugFromPath();
    if (!slug) return;

    var prefix = rootPrefix();
    var data = (SDV_PREVIEW.projectsBySlug && SDV_PREVIEW.projectsBySlug[slug])
      ? (SDV_PREVIEW.projectsBySlug[slug] || {})
      : null;
    if (!data) {
      var doc = await sanityFetch(
        '*[_type=="project" && slug == $slug][0]{' +
        'slug, home_materials, immersive_enabled, header_title, body, materials, links, falls, gallery, _updatedAt' +
        '}',
        { slug: slug },
      );
      data = normalizeSanityProject(doc || {});
      SDV_PREVIEW.projectsBySlug[slug] = data;
    }

    if (data.header_title) {
      title.textContent = String(data.header_title);
    }
    document.title = String(data.header_title || document.title);

    var bodyValue = data.body;
    textHost.innerHTML = Array.isArray(bodyValue) && bodyValue.length
      ? renderPortableText(bodyValue)
      : '<p>Content not found.</p>';

    var materialsHost = document.getElementById('project-materials');
    if (materialsHost) {
      var matsHtml = '';
      if (Array.isArray(data.materials) && data.materials.length) {
        matsHtml = '<h3>Materials</h3><ul>' + data.materials.map(function (m) {
          return '<li>' + escapeHtml(String(m || '')) + '</li>';
        }).join('') + '</ul>';
      }
      var matKeys = extractMaterialKeysForProject(data);
      var icons = renderMaterialIcons(matKeys);
      var iconsWrap = icons ? ('<div class="project-material-icons" aria-hidden="true">' + icons + '</div>') : '';
      materialsHost.innerHTML = matsHtml + iconsWrap;
    }

    var linksHost = document.getElementById('project-links');
    if (linksHost) {
      linksHost.innerHTML = renderProjectLinksHtml(data.links, prefix);
    }

    var zoomWrap = document.querySelector('.project-zoom-wrap');
    if (zoomWrap) {
      var on = (data.immersive_enabled === undefined) ? true : !!data.immersive_enabled;
      zoomWrap.style.display = on ? '' : 'none';
    }

    if (galleryHost) {
      galleryHost.querySelectorAll('h2').forEach(function (el) { el.remove(); });
      var timelineHost = document.getElementById('project-timeline');
      var panelsHost = document.getElementById('project-gallery-panels');
      var metaHost = document.getElementById('project-fall-meta');

      if (timelineHost && panelsHost && Array.isArray(data.falls) && data.falls.length) {
        galleryHost.classList.add('has-falls');
        buildFallTimeline(timelineHost, panelsHost, metaHost, data.falls, prefix);
      } else {
        galleryHost.classList.remove('has-falls');
        galleryHost.querySelectorAll('.project-timeline, #project-timeline, #project-gallery-panels').forEach(function (el) {
          if (el && el.parentNode) el.parentNode.removeChild(el);
        });
        buildGallery(galleryHost, data.gallery, prefix);
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
    var host = document.getElementById('info-links');
    var bioHost = document.getElementById('bio-content');
    if (!host && !bioHost) return;
    var prefix = rootPrefix();
    var data = null;
    var bioBody = '';

    if (SDV_PREVIEW.info) {
      data = SDV_PREVIEW.info.data || {};
      bioBody = SDV_PREVIEW.info.body || '';
    } else {
      var infoDoc = await sanityFetch('*[_type=="info"][0]{body, press, cv, _updatedAt}');
      var normalized = normalizeSanityInfo(infoDoc || {});
      data = normalized.data;
      bioBody = normalized.body;
      SDV_PREVIEW.info = normalized;
    }

    if (bioHost) {
      bioHost.innerHTML = Array.isArray(bioBody) && bioBody.length
        ? renderPortableText(bioBody)
        : '<p>Bio not found.</p>';
    }

    var html = '';

    if (Array.isArray(data.press) && data.press.length) {
      html += '<p><strong>Press</strong></p>';
      data.press.forEach(function (item) {
        if (!item) return;
        var t = item.title ? escapeHtml(String(item.title)) : 'Link';
        var href = item.url ? escapeHtml(String(item.url)) : '';
        var desc = item.description ? escapeHtml(String(item.description)) : '';
        if (href) {
          html += '<p><strong><a href="' + href + '" target="_blank" rel="noopener">' + t + ':</a></strong> ' + desc + '</p>';
        } else {
          html += '<p><strong>' + t + ':</strong> ' + desc + '</p>';
        }
      });
    }

    if (data.cv && (data.cv.file || data.cv.url)) {
      html += '<p><strong>CV</strong></p>';
      var cvLabel = data.cv.label ? escapeHtml(String(data.cv.label)) : 'Download CV';
      var href2 = data.cv.url ? String(data.cv.url) : resolveFileHref(data.cv.file, prefix);
      var fullHref = escapeHtml(safeHref(href2, prefix));
      html += '<p><a href="' + fullHref + '" target="_blank" rel="noopener">' + cvLabel + '</a></p>';
    }

    if (host) {
      host.innerHTML = html || '<p>Links failed to load.</p>';
    }
  }

  async function loadCaptions() {
    var immersiveRoot = document.querySelector('.immersive-page');
    if (!immersiveRoot) return;
    try {
      var list = null;
      if (SDV_PREVIEW.captions && Array.isArray(SDV_PREVIEW.captions.captions)) {
        list = SDV_PREVIEW.captions.captions;
      } else {
        var captionsDoc = await sanityFetch('*[_type=="captions"][0]{items, _updatedAt}');
        var normalizedCaptions = normalizeSanityCaptions(captionsDoc || {});
        list = normalizedCaptions.captions;
        SDV_PREVIEW.captions = normalizedCaptions;
      }
      if (list) {
        window.SDV_CAPTIONS = list;
        window.dispatchEvent(new Event('sdv:captions'));
      }
    } catch (e) {
      // app.js uses CAPTIONS fallback when window.SDV_CAPTIONS is missing.
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    setupVisualEditingBridge();
    preservePreviewLinks();
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
      var host = document.getElementById('info-links');
      if (host) host.innerHTML = '<p>Links failed to load.</p>';
      var bioHost = document.getElementById('bio-content');
      if (bioHost) bioHost.innerHTML = '<p>Bio failed to load.</p>';
    });
    loadProject().catch(function () {
      var textHost = document.getElementById('project-overview-text');
      if (textHost) textHost.innerHTML = '<p>Project content failed to load.</p>';
      var galleryHost = document.getElementById('project-gallery');
      if (galleryHost) galleryHost.querySelectorAll('img').forEach(function (el) { el.remove(); });
    });
    loadHome().catch(function () { });
    loadHomeMaterials().catch(function () { });
    loadCaptions().catch(function () { });
    loadImmersiveContent().catch(function () { });

    if (isPreviewEnabled()) {
      window.addEventListener('popstate', function () {
        resetPreviewSanityClient();
        refetchAllSanityDrivenContent().catch(function () { });
      });
    }
  });
})();
