/**
 * Shared helpers for the static site: path prefixes, Presentation preview query params,
 * and home materials icon rendering. Loaded before content-loader.js and app.js.
 *
 * assetUrl / rootPrefix: GitHub Pages "project" sites live under /repo-name/; we infer the
 * static site root from the resolved URL of this file (.../repo-name/js/sdv-shared.js) so
 * assets resolve to /repo-name/images/... instead of /images/... (404).
 */
(function () {
  'use strict';

  var cachedSiteRootFromScript = '';

  /**
   * Optional override when autodetection fails (e.g. unusual script URLs):
   *   window.SDV_SITE_ROOT = 'https://user.github.io/repo-name/';
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

  /**
   * Presentation and visual editing use sdvPreview=1 and/or sanity-preview-perspective on the iframe URL.
   * Both must be treated as preview mode so enableVisualEditing runs after in-iframe navigations.
   */
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

  function canonicalMaterialKey(rawKey, label) {
    var k = String(rawKey || '').toLowerCase();
    var l = String(label || '').toLowerCase();
    var s = (k + ' ' + l).trim();

    if (/\bglass\b/.test(s)) return 'glass';
    if (/\btextile\b|\bfabric\b|\bduvetyne\b|\bmolton\b|\btartan\b|\bthread\b|\byarn\b/.test(s)) return 'textile';
    if (/\bnylon\b|\bsynthetic\b/.test(s)) return 'synthetic';
    if (/\bmetal\b|\biron\b|\bhardware\b/.test(s)) return 'metal';
    if (/\barchive\b|\barchival\b|\blegal\b|\bprotocols\b|\brecords\b|\bdocuments\b|\bbook\b/.test(s)) return 'archive';
    if (/\bvideo\b|\bsound\b|\baudio\b|\bfilm\b|\ba-v\b|\ba\/v\b/.test(s)) return 'av';
    if (/\bperformance\b|\bmovement\b|\bscore\b/.test(s)) return 'performance';
    if (/\bdisplay\b|\bpackaging\b|\bpodium\b|\bshelving\b|\bmannequin\b|\bobjects?\b/.test(s)) return 'objects';
    return rawKey;
  }

  function canonicalMaterialLabel(key) {
    switch (key) {
      case 'glass': return 'Glass';
      case 'textile': return 'Textile';
      case 'synthetic': return 'Synthetic';
      case 'metal': return 'Metal';
      case 'archive': return 'Archive';
      case 'av': return 'A/V';
      case 'performance': return 'Performance';
      case 'objects': return 'Objects';
      default: return String(key || '');
    }
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

  function renderMaterialIcons(keys) {
    if (!Array.isArray(keys) || !keys.length) return '';
    var html = '';
    keys.forEach(function (k) {
      if (!k) return;
      html += materialIconSvg(String(k));
    });
    return html;
  }

  window.SDV = {
    getPathDepth: getPathDepth,
    rootPrefix: rootPrefix,
    assetUrl: assetUrl,
    isPreviewEnabled: isPreviewEnabled,
    withPreviewQuery: withPreviewQuery,
    slugifyKey: slugifyKey,
    canonicalMaterialKey: canonicalMaterialKey,
    canonicalMaterialLabel: canonicalMaterialLabel,
    materialIconSvg: materialIconSvg,
    renderMaterialIcons: renderMaterialIcons,
  };
})();
