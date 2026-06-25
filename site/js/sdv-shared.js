/**
 * Shared helpers: path prefixes, preview query params, material icons.
 * Loaded before content-loader.js and app.js.
 *
 * rootPrefix/assetUrl infer the static site root from this script URL so assets
 * resolve correctly whether the site is served from a domain root or a subpath.
 */
(function () {
  'use strict';

  var cachedSiteRootFromScript = '';

  /**
   * Optional override when autodetection fails (e.g. unusual script URLs):
   *   window.SDV_SITE_ROOT = 'https://example.com/';
   */
  function configuredSiteRoot() {
    try {
      var w = window.SDV_SITE_ROOT;
      if (w == null || !String(w).trim()) return '';
      var u = String(w).trim().replace(/\/?$/, '/');
      if (/^https?:\/\//i.test(u)) return u;
      if (u.charAt(0) === '/') return window.location.origin + u.replace(/\/?$/, '/');
    } catch (e) { }
    return '';
  }

  /** Site root URL (with trailing slash) derived from where sdv-shared.js was loaded from. */
  function siteRootFromSharedScript() {
    if (cachedSiteRootFromScript) return cachedSiteRootFromScript;
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src;
      if (!src || src.indexOf('sdv-shared.js') === -1) continue;
      try {
        var u = new URL(src);
        var p = u.pathname;
        var marker = '/js/sdv-shared.js';
        var idx = p.toLowerCase().lastIndexOf(marker);
        if (idx === -1) continue;
        var rootPath = p.slice(0, idx + 1);
        cachedSiteRootFromScript = u.origin + rootPath;
        return cachedSiteRootFromScript;
      } catch (err) { }
    }
    return '';
  }

  function effectiveSiteRoot() {
    return configuredSiteRoot() || siteRootFromSharedScript();
  }

  function pathnameDirname(pathname) {
    var p = String(pathname || '/').replace(/\/+$/, '') || '/';
    if (p === '/') return '/';
    var slash = p.lastIndexOf('/');
    if (slash <= 0) return '/';
    return p.slice(0, slash) || '/';
  }

  function getPathDepth() {
    var parts = (window.location.pathname || '').split('/').filter(Boolean);
    return parts.length;
  }

  /**
   * Relative prefix from this page's directory to the static site root (for prefix + 'images/...').
   * Falls back to ../ per URL segment when script-based root is unknown.
   */
  function rootPrefix() {
    var absRoot = effectiveSiteRoot();
    if (!absRoot) {
      return '../'.repeat(getPathDepth());
    }
    try {
      var rootUrl = new URL(absRoot);
      var rootPath = rootUrl.pathname.replace(/\/?$/, '') || '/';
      var curDir = pathnameDirname(window.location.pathname);
      var curParts = curDir === '/' ? [] : curDir.split('/').filter(Boolean);
      var rootParts = rootPath === '/' ? [] : rootPath.split('/').filter(Boolean);
      var i = 0;
      while (i < curParts.length && i < rootParts.length && curParts[i] === rootParts[i]) {
        i++;
      }
      var ups = curParts.length - i;
      var rest = rootParts.slice(i);
      var out = '../'.repeat(ups) + rest.join('/');
      if (out && !out.endsWith('/')) out += '/';
      return out;
    } catch (e2) {
      return '../'.repeat(getPathDepth());
    }
  }

  /** Resolve a site-relative asset path (works on GitHub Pages project sites, not only domain root). */
  function assetUrl(path) {
    var s = String(path || '');
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith('/')) s = s.slice(1);
    var root = effectiveSiteRoot();
    if (root) {
      return root.replace(/\/?$/, '/') + s;
    }
    return rootPrefix() + s;
  }

  /** True when the iframe URL includes preview query params (Presentation / visual editing). */
  function isPreviewEnabled() {
    try {
      var qs = new URLSearchParams(window.location.search || '');
      if (qs.get('sdvPreview') === '1') return true;
      if (qs.has('sanity-preview-perspective')) return true;
    } catch (e) { }
    return false;
  }

  function withPreviewQuery(path) {
    if (!isPreviewEnabled()) return path;
    var s = String(path || '');
    var joiner = s.includes('?') ? '&' : '?';
    var out = s.indexOf('sdvPreview=1') === -1 ? s + joiner + 'sdvPreview=1' : s;
    joiner = '&';
    try {
      var cur = new URLSearchParams(window.location.search || '');
      var persp = cur.get('sanity-preview-perspective');
      if (persp && out.indexOf('sanity-preview-perspective=') === -1) {
        out += joiner + 'sanity-preview-perspective=' + encodeURIComponent(persp);
      }
    } catch (e) { }
    return out;
  }

  function slugifyKey(input) {
    return String(input || '')
      .trim()
      .toLowerCase()
      .replace(/[\u2019']/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function normalizeProjectSlug(raw) {
    if (raw && typeof raw === 'object' && raw.current) return String(raw.current).trim();
    return String(raw || '').trim();
  }

  var MATERIAL_CATALOG = {};
  var MATERIAL_CATALOG_ORDER = [];

  var MATERIAL_LABELS = {
    glass: 'Glass',
    textile: 'Textile',
    synthetic: 'Synthetic',
    metal: 'Metal',
    archive: 'Archive',
    av: 'A/V',
    performance: 'Performance',
    objects: 'Objects',
    paper: 'Paper',
    wood: 'Wood',
    ceramic: 'Ceramic',
    stone: 'Stone',
    photography: 'Photography',
    print: 'Print',
    painting: 'Painting',
    sculpture: 'Sculpture',
    installation: 'Installation',
    light: 'Light',
    sound: 'Sound',
    video: 'Video',
    ink: 'Ink',
    clay: 'Clay',
    resin: 'Resin',
    botanical: 'Botanical',
    leather: 'Leather',
    wax: 'Wax',
    digital: 'Digital',
    'mixed-media': 'Mixed media',
    'found-object': 'Found object',
    thread: 'Thread',
    plaster: 'Plaster',
    steel: 'Steel',
    'textile-print': 'Textile print',
  };

  function applyMaterialCatalog(entries) {
    if (!Array.isArray(entries)) return;
    MATERIAL_CATALOG_ORDER = [];
    entries.forEach(function (e) {
      if (!e || !e.key) return;
      var k = String(e.key);
      MATERIAL_CATALOG[k] = {
        label: String(e.label || k),
        icon: String(e.icon || k),
      };
      MATERIAL_LABELS[k] = MATERIAL_CATALOG[k].label;
      MATERIAL_CATALOG_ORDER.push(k);
    });
  }

  function resolveIconKey(materialKey) {
    var k = String(materialKey || '');
    if (MATERIAL_CATALOG[k] && MATERIAL_CATALOG[k].icon) return MATERIAL_CATALOG[k].icon;
    return k;
  }

  function isKnownMaterialKey(key) {
    var k = String(key || '');
    if (Object.prototype.hasOwnProperty.call(MATERIAL_CATALOG, k)) return true;
    return Object.prototype.hasOwnProperty.call(MATERIAL_LABELS, k);
  }

  function resolveMaterialKey(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    if (isKnownMaterialKey(s)) return s;
    var catalogKeys = Object.keys(MATERIAL_CATALOG);
    var i;
    var sl = s.toLowerCase();
    for (i = 0; i < catalogKeys.length; i++) {
      var ck = catalogKeys[i];
      if (String(MATERIAL_CATALOG[ck].label || '').toLowerCase() === sl) return ck;
    }
    var asKey = slugifyKey(s);
    if (isKnownMaterialKey(asKey)) return asKey;
    return canonicalMaterialKey(asKey, s);
  }

  function canonicalMaterialKey(rawKey, label) {
    var k = String(rawKey || '').toLowerCase();
    if (isKnownMaterialKey(k)) return k;
    var l = String(label || '').toLowerCase();
    var s = (k + ' ' + l).trim();

    if (/\bglass\b/.test(s)) return 'glass';
    if (/\btextile[\s-]?print\b/.test(s)) return 'textile-print';
    if (/\btextile\b|\bfabric\b|\bduvetyne\b|\bmolton\b|\btartan\b|\byarn\b/.test(s)) return 'textile';
    if (/\bthread\b|\bembroidery\b|\bsewing\b/.test(s)) return 'thread';
    if (/\bnylon\b|\bsynthetic\b|\bpolyester\b|\bacrylic\b|\bplastic\b/.test(s)) return 'synthetic';
    if (/\bsteel\b/.test(s)) return 'steel';
    if (/\bmetal\b|\biron\b|\bhardware\b|\baluminum\b|\baluminium\b|\bbrass\b|\bcopper\b/.test(s)) return 'metal';
    if (/\barchive\b|\barchival\b|\blegal\b|\bprotocols\b|\brecords\b|\bdocuments\b|\bbook\b/.test(s)) return 'archive';
    if (/\ba-v\b|\ba\/v\b/.test(s)) return 'av';
    if (/\bvideo\b|\bfilm\b|\bcinema\b/.test(s)) return 'video';
    if (/\bsound\b|\baudio\b|\bvoice\b/.test(s)) return 'sound';
    if (/\bperformance\b|\bmovement\b|\bscore\b|\bdance\b/.test(s)) return 'performance';
    if (/\bphotography\b|\bphoto\b|\bcamera\b/.test(s)) return 'photography';
    if (/\bprint\b|\blithograph\b|\bscreenprint\b|\betching\b/.test(s)) return 'print';
    if (/\bpainting\b|\bpaint\b|\bgouache\b|\boil\b/.test(s)) return 'painting';
    if (/\bsculpture\b|\bcarving\b|\bstatue\b/.test(s)) return 'sculpture';
    if (/\binstallation\b/.test(s)) return 'installation';
    if (/\blight\b|\blighting\b|\bled\b|\bneon\b/.test(s)) return 'light';
    if (/\bpaper\b|\bpulp\b|\bcard\b/.test(s)) return 'paper';
    if (/\bwood\b|\btimber\b|\bplywood\b|\boak\b/.test(s)) return 'wood';
    if (/\bceramic\b|\bporcelain\b|\bpottery\b/.test(s)) return 'ceramic';
    if (/\bstone\b|\bmarble\b|\bgranite\b|\brock\b/.test(s)) return 'stone';
    if (/\bink\b|\bpen\b/.test(s)) return 'ink';
    if (/\bclay\b|\bterracotta\b/.test(s)) return 'clay';
    if (/\bresin\b|\bepoxy\b/.test(s)) return 'resin';
    if (/\bbotanical\b|\bplant\b|\bflora\b|\bflower\b|\bleaf\b/.test(s)) return 'botanical';
    if (/\bleather\b|\bhide\b|\bsuede\b/.test(s)) return 'leather';
    if (/\bwax\b|\bbeeswax\b|\bparaffin\b/.test(s)) return 'wax';
    if (/\bdigital\b|\bsoftware\b|\bcode\b|\bscreen\b/.test(s)) return 'digital';
    if (/\bmixed[\s-]?media\b/.test(s)) return 'mixed-media';
    if (/\bfound[\s-]?object\b|\bfound\b|\bassemblage\b/.test(s)) return 'found-object';
    if (/\bplaster\b|\bgypsum\b/.test(s)) return 'plaster';
    if (/\bdisplay\b|\bpackaging\b|\bpodium\b|\bshelving\b|\bmannequin\b|\bobjects?\b/.test(s)) return 'objects';
    return rawKey;
  }

  function canonicalMaterialLabel(key) {
    var k = String(key || '');
    if (MATERIAL_LABELS[k]) return MATERIAL_LABELS[k];
    return k.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function materialIconPath(key) {
    var iconKey = resolveIconKey(key);
    switch (iconKey) {
      case 'glass':
        return '<path d="M6 3h12l-5 8v8l-2 2-2-2v-8L6 3z" />';
      case 'metal':
        return '<path d="M4 14l6-6 10 10-6 6L4 14z" /><path d="M9 9l6 6" />';
      case 'textile':
        return '<rect x="5" y="6" width="14" height="12" rx="1" /><path d="M8 6v12M12 6v12M16 6v12" />';
      case 'synthetic':
        return '<path d="M12 3c4 0 7 2.7 7 6.5 0 4.6-4.2 6.8-7 11.5-2.8-4.7-7-6.9-7-11.5C5 5.7 8 3 12 3z" /><path d="M9 10c1.2 1 2.2 1.5 3 1.5S13.8 11 15 10" />';
      case 'archive':
        return '<path d="M7 3h7l3 3v15H7V3z" /><path d="M14 3v4h4" /><path d="M9 11h6M9 15h6" />';
      case 'av':
        return '<path d="M4 10v4" /><path d="M7 8v8" /><path d="M10 6v12" /><path d="M14 8v8" /><path d="M17 10v4" /><path d="M20 11v2" />';
      case 'performance':
        return '<circle cx="12" cy="7" r="2" /><path d="M8 21l2-6 2-2 2 2 2 6" /><path d="M10 13l-2-2M14 13l2-2" />';
      case 'objects':
        return '<rect x="6" y="6" width="12" height="12" rx="1" /><path d="M9 10h6M9 14h6" />';
      case 'paper':
        return '<path d="M7 4h7l4 4v12H7V4z" /><path d="M14 4v4h4" /><path d="M9 12h6M9 16h4" />';
      case 'wood':
        return '<path d="M12 4c3 0 5 2 5 4.5S14 13 12 20c-2-7-5-9.5-5-11.5S9 4 12 4z" /><path d="M9 9h6M10 13h4" />';
      case 'ceramic':
        return '<path d="M8 8c0-2 1.8-4 4-4s4 2 4 4c0 2-1 3-1 5v5H9v-5c0-2-1-3-1-5z" /><path d="M9 18h6" />';
      case 'stone':
        return '<path d="M6 14l3-6 4 2 5-5 2 9H6z" />';
      case 'photography':
        return '<rect x="4" y="7" width="16" height="12" rx="2" /><circle cx="12" cy="13" r="3" /><path d="M8 7l2-2h4l2 2" />';
      case 'print':
        return '<rect x="5" y="5" width="14" height="14" rx="1" /><path d="M8 9h8M8 13h5" /><path d="M9 5V3M15 5V3" />';
      case 'painting':
        return '<path d="M12 3c3 0 5 2 5 4.5S14 12 12 20c-2-8-5-10.5-5-12.5S9 3 12 3z" /><circle cx="10" cy="8" r="1" /><circle cx="14" cy="10" r="1" /><circle cx="11" cy="12" r="1" />';
      case 'sculpture':
        return '<path d="M12 4c2 0 3 1.5 3 3s-1 3-3 3-3-1.5-3-3 1-3 3-3z" /><path d="M8 20h8l-1-8H9l-1 8z" /><path d="M7 20h10" />';
      case 'installation':
        return '<path d="M4 20V8l8-4 8 4v12" /><path d="M4 20h16" /><path d="M12 4v16" />';
      case 'light':
        return '<path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a6 6 0 0 0-3 11v3h6v-3a6 6 0 0 0-3-11z" />';
      case 'sound':
        return '<path d="M5 10v4h3l5 4V6l-5 4H5z" /><path d="M17 9a4 4 0 0 1 0 6" /><path d="M19 7a7 7 0 0 1 0 10" />';
      case 'video':
        return '<rect x="4" y="7" width="13" height="10" rx="1" /><path d="M17 10l4-2v8l-4-2" />';
      case 'ink':
        return '<path d="M12 3c2 0 3 1.5 3 3.5S12 14 12 21c0-7-3-10.5-3-14.5S10 3 12 3z" />';
      case 'clay':
        return '<path d="M6 16c0-4 2.7-8 6-8s6 4 6 8H6z" /><path d="M8 16h8" />';
      case 'resin':
        return '<path d="M9 3h6l2 4v11a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2V7l2-4z" /><path d="M9 12h6" />';
      case 'botanical':
        return '<path d="M12 21V11" /><path d="M12 11c-3-2-6-1-7 2s1 6 4 7c2-3 3-6 3-9z" /><path d="M12 11c3-2 6-1 7 2s-1 6-4 7c-2-3-3-6-3-9z" />';
      case 'leather':
        return '<path d="M6 8c0-2 2.7-4 6-4s6 2 6 4v9c0 2-2.7 4-6 4s-6-2-6-4V8z" /><path d="M8 10h8M9 14h6" />';
      case 'wax':
        return '<rect x="10" y="4" width="4" height="14" rx="1" /><path d="M9 20h6" /><path d="M12 4V2" />';
      case 'digital':
        return '<rect x="5" y="5" width="6" height="6" /><rect x="13" y="5" width="6" height="6" /><rect x="5" y="13" width="6" height="6" /><rect x="13" y="13" width="6" height="6" />';
      case 'mixed-media':
        return '<circle cx="8" cy="8" r="3" /><rect x="13" y="6" width="6" height="6" /><path d="M6 16l4-3 3 2 5-4" />';
      case 'found-object':
        return '<rect x="5" y="8" width="10" height="10" rx="1" /><circle cx="17" cy="9" r="4" /><path d="M15.5 10.5L17 12" />';
      case 'thread':
        return '<ellipse cx="12" cy="8" rx="5" ry="2" /><path d="M7 8v10M17 8v10" /><path d="M9 14h6" />';
      case 'plaster':
        return '<path d="M5 18l4-10h6l4 10H5z" /><path d="M8 14h8" />';
      case 'steel':
        return '<path d="M4 10h16M4 14h16M8 6v12M16 6v12" />';
      case 'textile-print':
        return '<rect x="5" y="6" width="14" height="12" rx="1" /><path d="M8 10h2v2H8zM11 13h2v2h-2zM14 10h2v2h-2z" />';
      default:
        return '<circle cx="12" cy="12" r="8" /><path d="M8 12h8" />';
    }
  }

  function materialIconSvg(key) {
    var stroke = 'currentColor';
    var sw = '1.5';
    return (
      '<svg class="home-material-icon" viewBox="0 0 24 24" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '">' +
      materialIconPath(key) +
      '</svg>'
    );
  }

  function renderMaterialIcons(keys) {
    if (!Array.isArray(keys) || !keys.length) return '';
    var html = '';
    keys.forEach(function (k) {
      if (!k) return;
      html += materialIconSvg(String(k));
    });
    return html;
  }

  function isPublicationFall(fall) {
    if (!fall || typeof fall !== 'object') return false;
    if (fall.isPublication === true) return true;
    var label = String(fall.label || '')
      .trim()
      .toLowerCase();
    return label === 'publication';
  }

  function findPublicationPanel(falls) {
    var list = Array.isArray(falls) ? falls : [];
    var flagged = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].isPublication === true) {
        if (flagged !== -1) return null;
        flagged = i;
      }
    }
    if (flagged !== -1) {
      return { panel: list[flagged], index: flagged };
    }
    for (var j = 0; j < list.length; j++) {
      if (isPublicationFall(list[j])) {
        return { panel: list[j], index: j };
      }
    }
    return null;
  }

  function projectHasPublicationImmersive(falls) {
    var hit = findPublicationPanel(falls);
    if (!hit || !hit.panel) return false;
    var imgs = hit.panel.images;
    return Array.isArray(imgs) && imgs.length > 0;
  }

  function isSanityCdnImageUrl(url) {
    return /^https:\/\/cdn\.sanity\.io\/images\//i.test(String(url || ''));
  }

  /** Append Sanity image pipeline params (resize, WebP/AVIF, quality). */
  function sanityImageUrl(url, params) {
    var s = String(url || '');
    if (!isSanityCdnImageUrl(s)) return s;
    try {
      var u = new URL(s);
      var keys = Object.keys(params || {});
      for (var i = 0; i < keys.length; i++) {
        u.searchParams.set(keys[i], String(params[keys[i]]));
      }
      return u.toString();
    } catch (e) {
      return s;
    }
  }

  /** Immersive viewer: capped width, modern format — not full archival originals. */
  function immersiveImageDisplayUrl(url) {
    return sanityImageUrl(url, { w: '2560', auto: 'format', q: '80', fit: 'max' });
  }

  /** Fast blurred placeholder while display size downloads. */
  function immersiveImagePreviewUrl(url) {
    return sanityImageUrl(url, { w: '640', auto: 'format', q: '55', blur: '12' });
  }

  function getMaterialCatalogEntries() {
    return MATERIAL_CATALOG_ORDER.map(function (k) {
      return { key: k, label: MATERIAL_CATALOG[k].label, icon: MATERIAL_CATALOG[k].icon };
    });
  }

  function whenFontsReady() {
    if (!document.fonts || !document.fonts.ready) {
      return Promise.resolve();
    }
    return Promise.race([
      document.fonts.ready,
      new Promise(function (resolve) {
        setTimeout(resolve, 1500);
      }),
    ]);
  }

  function revealPendingView(viewEl) {
    if (!viewEl || !viewEl.classList.contains('is-content-pending')) return;
    whenFontsReady().then(function () {
      requestAnimationFrame(function () {
        viewEl.classList.remove('is-content-pending');
      });
    });
  }

  window.SDV = {
    whenFontsReady: whenFontsReady,
    revealPendingView: revealPendingView,
    getPathDepth: getPathDepth,
    rootPrefix: rootPrefix,
    assetUrl: assetUrl,
    isPreviewEnabled: isPreviewEnabled,
    withPreviewQuery: withPreviewQuery,
    slugifyKey: slugifyKey,
    normalizeProjectSlug: normalizeProjectSlug,
    resolveMaterialKey: resolveMaterialKey,
    isKnownMaterialKey: isKnownMaterialKey,
    canonicalMaterialKey: canonicalMaterialKey,
    canonicalMaterialLabel: canonicalMaterialLabel,
    applyMaterialCatalog: applyMaterialCatalog,
    getMaterialCatalogEntries: getMaterialCatalogEntries,
    materialIconSvg: materialIconSvg,
    renderMaterialIcons: renderMaterialIcons,
    isPublicationFall: isPublicationFall,
    findPublicationPanel: findPublicationPanel,
    projectHasPublicationImmersive: projectHasPublicationImmersive,
    isSanityCdnImageUrl: isSanityCdnImageUrl,
    sanityImageUrl: sanityImageUrl,
    immersiveImageDisplayUrl: immersiveImageDisplayUrl,
    immersiveImagePreviewUrl: immersiveImagePreviewUrl,
  };
})();
