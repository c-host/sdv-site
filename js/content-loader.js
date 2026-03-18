(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Decap CMS live preview overrides (iframe -> postMessage -> in-memory store)
  // ---------------------------------------------------------------------------

  var SDV_PREVIEW = {
    projectsBySlug: {},
    info: null,      // { data: {...}, body: "markdown" }
    captions: null,  // { captions: [...] }
  };

  function isPreviewEnabled() {
    try {
      var qs = new URLSearchParams(window.location.search || '');
      return qs.get('sdvPreview') === '1';
    } catch (e) {
      return false;
    }
  }

  var PREVIEW_STORAGE_KEY = 'sdv.preview.v1';

  function loadPreviewFromStorage() {
    if (!isPreviewEnabled()) return;
    try {
      var raw = sessionStorage.getItem(PREVIEW_STORAGE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      if (parsed.projectsBySlug && typeof parsed.projectsBySlug === 'object') {
        SDV_PREVIEW.projectsBySlug = parsed.projectsBySlug;
      }
      if (parsed.info && typeof parsed.info === 'object') {
        SDV_PREVIEW.info = parsed.info;
      }
      if (parsed.captions && typeof parsed.captions === 'object') {
        SDV_PREVIEW.captions = parsed.captions;
      }
    } catch (e) { }
  }

  function savePreviewToStorage() {
    if (!isPreviewEnabled()) return;
    try {
      var payload = {
        projectsBySlug: SDV_PREVIEW.projectsBySlug || {},
        info: SDV_PREVIEW.info,
        captions: SDV_PREVIEW.captions,
      };
      sessionStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(payload));
    } catch (e) { }
  }

  function clearPreviewStorage() {
    try {
      sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
    } catch (e) { }
  }

  loadPreviewFromStorage();

  function withPreviewQuery(href) {
    if (!isPreviewEnabled()) return href;
    var s = String(href || '');
    if (!s) return s;
    if (/^(https?:)?\/\//i.test(s)) return s;
    if (s.startsWith('#') || s.startsWith('mailto:') || s.startsWith('tel:')) return s;
    if (s.indexOf('sdvPreview=1') !== -1) return s;
    return s + (s.indexOf('?') !== -1 ? '&' : '?') + 'sdvPreview=1';
  }

  function preservePreviewLinks() {
    if (!isPreviewEnabled()) return;
    // Ensure any normal <a href> navigation inside the iframe keeps preview mode.
    // (Some links are static HTML and don't go through app.js handlers.)
    document.querySelectorAll('a[href]').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      if (!href) return;
      // Skip external links.
      if (/^(https?:)?\/\//i.test(href)) return;
      // Skip downloads/assets (keep as-is).
      if (/\.(pdf|png|jpe?g|gif|webp|mp4|webm)(\?|#|$)/i.test(href)) return;
      a.setAttribute('href', withPreviewQuery(href));
    });
  }

  function isTrustedPreviewMessage(event) {
    // In normal deployments, admin and site are same-origin.
    // When running locally via file://, origin can be "null".
    try {
      if (!event) return false;
      if (event.origin === window.location.origin) return true;
      if (event.origin === 'null') return true;
    } catch (e) { }
    return false;
  }

  function normalizePreviewPayload(payload) {
    if (!payload || typeof payload !== 'object') return null;
    if (payload.collection === 'projects') {
      var slug = payload.slug ? String(payload.slug) : '';
      if (!slug) return null;
      return { kind: 'project', slug: slug, data: payload.data || {} };
    }
    if (payload.collection === 'info') {
      var d = payload.data || {};
      // Decap uses the configured field name `body` for the markdown body.
      var body = (d && d.body !== undefined && d.body !== null) ? String(d.body) : '';
      // Keep all other keys as "frontmatter-like" data.
      var fm = {};
      Object.keys(d || {}).forEach(function (k) {
        if (k === 'body') return;
        fm[k] = d[k];
      });
      return { kind: 'info', data: fm, body: body };
    }
    if (payload.collection === 'captions') {
      var cap = payload.data && Array.isArray(payload.data.captions) ? payload.data.captions : [];
      return { kind: 'captions', captions: cap };
    }
    return null;
  }

  window.addEventListener('message', function (event) {
    if (!isTrustedPreviewMessage(event)) return;
    var msg = event.data;
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'sdv:preview:clear') {
      SDV_PREVIEW.projectsBySlug = {};
      SDV_PREVIEW.info = null;
      SDV_PREVIEW.captions = null;
      clearPreviewStorage();
      return;
    }

    if (msg.type !== 'sdv:preview') return;
    var normalized = normalizePreviewPayload(msg.payload);
    if (!normalized) return;

    if (normalized.kind === 'project') {
      SDV_PREVIEW.projectsBySlug[normalized.slug] = normalized.data || {};
      savePreviewToStorage();
      // If we're currently viewing that project page, re-render immediately.
      var currentSlug = getProjectSlugFromPath();
      if (currentSlug && currentSlug === normalized.slug) {
        loadProject().catch(function () { });
      }
      // If we're currently viewing the Home page, refresh materials-derived UI.
      if (document.getElementById('home-project-image')) {
        scheduleHomeMaterialsRefresh();
      }
    } else if (normalized.kind === 'info') {
      SDV_PREVIEW.info = { data: normalized.data || {}, body: normalized.body || '' };
      savePreviewToStorage();
      if (document.getElementById('info-links') || document.getElementById('bio-content')) {
        loadInfoLinks().catch(function () { });
      }
    } else if (normalized.kind === 'captions') {
      SDV_PREVIEW.captions = { captions: normalized.captions || [] };
      savePreviewToStorage();
      // Push into the runtime event pathway immediately if we're on an immersive page.
      if (document.querySelector('.immersive-page')) {
        window.SDV_CAPTIONS = SDV_PREVIEW.captions.captions;
        window.dispatchEvent(new Event('sdv:captions'));
      }
    }
  });

  var homeMaterialsRefreshTimer = 0;
  function scheduleHomeMaterialsRefresh() {
    if (homeMaterialsRefreshTimer) clearTimeout(homeMaterialsRefreshTimer);
    homeMaterialsRefreshTimer = setTimeout(function () {
      homeMaterialsRefreshTimer = 0;
      loadHomeMaterials().catch(function () { });
    }, 50);
  }

  function getPathDepth() {
    var parts = (window.location.pathname || '').split('/').filter(Boolean);
    return parts.length;
  }

  function rootPrefix() {
    return '../'.repeat(getPathDepth());
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderInlineMarkdown(s) {
    var out = escapeHtml(s);
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    return out;
  }

  function renderMarkdown(md) {
    var lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
    var blocks = [];
    var buf = [];
    var listBuf = null;
    var orderedBuf = null;
    var quoteBuf = null;

    function flushParagraph() {
      if (!buf.length) return;
      // Keep single newlines as spaces, but don't collapse intentional spacing too aggressively.
      blocks.push('<p>' + renderInlineMarkdown(buf.join(' ').replace(/\s+/g, ' ').trim()) + '</p>');
      buf = [];
    }

    function flushList() {
      if (!listBuf || !listBuf.length) return;
      blocks.push('<ul>' + listBuf.map(function (li) {
        return '<li>' + renderInlineMarkdown(li) + '</li>';
      }).join('') + '</ul>');
      listBuf = null;
    }

    function flushOrderedList() {
      if (!orderedBuf || !orderedBuf.length) return;
      blocks.push('<ol>' + orderedBuf.map(function (li) {
        return '<li>' + renderInlineMarkdown(li) + '</li>';
      }).join('') + '</ol>');
      orderedBuf = null;
    }

    function flushQuote() {
      if (!quoteBuf || !quoteBuf.length) return;
      // Render as paragraphs inside a blockquote.
      var inner = quoteBuf.map(function (q) {
        return '<p>' + renderInlineMarkdown(String(q || '').trim()) + '</p>';
      }).join('');
      blocks.push('<blockquote>' + inner + '</blockquote>');
      quoteBuf = null;
    }

    function isListItem(line) {
      var t = String(line || '').trim();
      // Support common list markers from editors: "-", "*", and unicode bullet "•".
      return /^(-|\*|•)\s+/.test(t);
    }

    function listItemText(line) {
      return String(line || '').trim().replace(/^(-|\*|•)\s+/, '').trim();
    }

    function isOrderedItem(line) {
      var t = String(line || '').trim();
      return /^\d+\.\s+/.test(t);
    }

    function orderedItemText(line) {
      return String(line || '').trim().replace(/^\d+\.\s+/, '').trim();
    }

    function isQuoteLine(line) {
      var t = String(line || '');
      return /^\s*>\s?/.test(t);
    }

    function quoteText(line) {
      return String(line || '').replace(/^\s*>\s?/, '');
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line.trim()) {
        flushQuote();
        flushOrderedList();
        flushList();
        flushParagraph();
        continue;
      }
      if (isQuoteLine(line)) {
        flushParagraph();
        flushList();
        flushOrderedList();
        if (!quoteBuf) quoteBuf = [];
        quoteBuf.push(quoteText(line));
        continue;
      }
      flushQuote();
      if (isListItem(line)) {
        flushParagraph();
        flushOrderedList();
        if (!listBuf) listBuf = [];
        listBuf.push(listItemText(line));
        continue;
      }
      if (isOrderedItem(line)) {
        flushParagraph();
        flushList();
        if (!orderedBuf) orderedBuf = [];
        orderedBuf.push(orderedItemText(line));
        continue;
      }
      flushOrderedList();
      flushList();
      if (line.startsWith('### ')) {
        flushParagraph();
        blocks.push('<h3>' + renderInlineMarkdown(line.slice(4).trim()) + '</h3>');
        continue;
      }
      if (line.startsWith('## ')) {
        flushParagraph();
        blocks.push('<h2>' + renderInlineMarkdown(line.slice(3).trim()) + '</h2>');
        continue;
      }
      buf.push(line.trim());
    }
    flushQuote();
    flushOrderedList();
    flushList();
    flushParagraph();
    return blocks.join('\n');
  }

  function parseFrontmatter(md) {
    var s = String(md || '').replace(/\r\n/g, '\n');
    if (!s.startsWith('---\n')) return { data: {}, body: s };
    var end = s.indexOf('\n---\n', 4);
    if (end === -1) return { data: {}, body: s };
    var fmRaw = s.slice(4, end);
    var body = s.slice(end + 5);
    return { data: parseYaml(fmRaw) || {}, body: body.replace(/^\n+/, '') };
  }

  function normalizeProjectDataFromMd(parsed) {
    var data = (parsed && parsed.data) ? (parsed.data || {}) : {};
    var body = (parsed && parsed.body !== undefined && parsed.body !== null) ? String(parsed.body) : '';
    data.body = body;
    return data;
  }

  function parseYaml(text) {
    var lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
    var i = 0;

    function indentOf(line) {
      var m = line.match(/^(\s*)/);
      return m ? m[1].length : 0;
    }

    function parseScalar(raw) {
      var v = raw.trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        return v.slice(1, -1);
      }
      if (/^\d+$/.test(v)) return parseInt(v, 10);
      if (v === 'true') return true;
      if (v === 'false') return false;
      if (v === 'null' || v === '~') return null;
      return v;
    }

    function parseBlockScalar(baseIndent) {
      var out = [];
      while (i < lines.length) {
        var line = lines[i];
        if (!line.trim()) {
          out.push('');
          i++;
          continue;
        }
        var ind = indentOf(line);
        if (ind <= baseIndent) break;
        out.push(line.slice(baseIndent + 2));
        i++;
      }
      return out.join('\n').replace(/\n+$/g, '\n').trimEnd();
    }

    function parseList(baseIndent) {
      var arr = [];
      while (i < lines.length) {
        var line = lines[i];
        if (!line.trim()) {
          i++;
          continue;
        }
        var ind = indentOf(line);
        if (ind < baseIndent) break;
        var trimmed = line.trim();
        if (!trimmed.startsWith('- ')) break;

        var rest = trimmed.slice(2);
        if (rest.includes(': ')) {
          // object item (possibly multi-line)
          var obj = {};
          while (true) {
            var kv = rest;
            var colon = kv.indexOf(':');
            var k = kv.slice(0, colon).trim();
            var v = kv.slice(colon + 1).trim();
            if (v === '') {
              // nested list block (e.g. images:\n  - a\n  - b)
              var peek = lines[i + 1] || '';
              var peekInd = indentOf(peek);
              if (peekInd > baseIndent && peek.trim().startsWith('- ')) {
                // Move to the first list item line; parseList will advance i to the first non-list line.
                i = i + 1;
                obj[k] = parseList(peekInd);
              } else {
                obj[k] = '';
                i++;
              }
            } else {
              obj[k] = parseScalar(v);
              i++;
            }
            if (i >= lines.length) break;
            var next = lines[i];
            if (!next.trim()) break;
            var nextInd = indentOf(next);
            if (nextInd <= baseIndent) break;
            var nextTrim = next.trim();
            if (nextTrim.startsWith('- ')) break;
            if (!nextTrim.includes(':')) break;
            rest = nextTrim;
          }
          arr.push(obj);
          continue;
        }

        arr.push(parseScalar(rest));
        i++;
      }
      return arr;
    }

    // Decide if this document is a list root or map root.
    while (i < lines.length && !lines[i].trim()) i++;
    if (i < lines.length && lines[i].trim().startsWith('- ')) {
      return parseList(indentOf(lines[i]));
    }

    var obj = {};
    while (i < lines.length) {
      var line = lines[i];
      if (!line.trim() || line.trim().startsWith('#')) {
        i++;
        continue;
      }
      var ind = indentOf(line);
      if (ind !== 0) {
        i++;
        continue;
      }
      var idx = line.indexOf(':');
      if (idx === -1) {
        i++;
        continue;
      }
      var key = line.slice(0, idx).trim();
      var rest = line.slice(idx + 1).trim();
      i++;

      if (rest === '|') {
        obj[key] = parseBlockScalar(ind);
        continue;
      }
      if (rest === '') {
        // list or nested map (we only need list for this project)
        var nextLine = lines[i] || '';
        if (nextLine.trim().startsWith('- ')) {
          obj[key] = parseList(indentOf(nextLine));
        } else {
          obj[key] = null;
        }
        continue;
      }
      obj[key] = parseScalar(rest);
    }
    return obj;
  }

  function getProjectSlugFromPath() {
    var p = window.location.pathname || '';
    var m = p.match(/\/project\/([^/]+)\/?$/);
    if (m && m[1]) return String(m[1]);
    return null;
  }

  function slugifyKey(input) {
    return String(input || '')
      .trim()
      .toLowerCase()
      .replace(/['’]/g, '')
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

  async function loadHomeMaterials() {
    // Only run on home.
    if (!document.querySelector('.view--home')) return;

    var prefix = rootPrefix();
    var slugs = ['the-spontaneous-dance-falls', 'under-the-needles-eye', 'overlocked'];

    function fetchProject(slug) {
      // Prefer in-memory draft data when preview is active.
      if (SDV_PREVIEW.projectsBySlug && SDV_PREVIEW.projectsBySlug[slug]) {
        return Promise.resolve({ slug: slug, data: SDV_PREVIEW.projectsBySlug[slug] || {} });
      }
      var url = prefix + 'content/projects/' + slug + '.md';
      return fetch(url).then(function (r) {
        return r.ok ? r.text() : Promise.reject(new Error(r.status));
      }).then(function (raw) {
        return { slug: slug, data: normalizeProjectDataFromMd(parseFrontmatter(raw)) || {} };
      });
    }

    try {
      var results = await Promise.all(slugs.map(fetchProject));
      var projectMap = {};
      var allLabelsByKey = {};

      results.forEach(function (r) {
        var d = r.data || {};
        // Allow home-specific curation.
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
      // Non-fatal: home can render without materials UI.
    }
  }

  function buildGallery(host, items, prefix) {
    if (!host) return;
    host.querySelectorAll('img').forEach(function (el) { el.remove(); });
    (items || []).forEach(function (src) {
      var s = String(src || '');
      var isAbs = /^https?:\/\//i.test(s);
      if (!isAbs && s.startsWith('/')) s = s.slice(1);
      // Content may store paths relative to the `images/` dir (e.g. `project-overviews/...`).
      // Normalize to `images/<path>` for the runtime site which expects assets under `images/`.
      if (!isAbs && s && !s.startsWith('images/')) s = 'images/' + s;
      var img = document.createElement('img');
      img.src = isAbs ? s : (prefix + s);
      img.alt = '';
      host.appendChild(img);
    });
  }

  function resolveImageSrc(src, prefix) {
    if (src && typeof src === 'object') {
      // Decap CMS list field uses objects like { image: "path" }
      src = src.image;
    }
    var s = String(src || '');
    var isAbs = /^https?:\/\//i.test(s);
    if (!isAbs && s.startsWith('/')) s = s.slice(1);
    // Content may store paths relative to the `images/` dir (e.g. `project-overviews/...`).
    // Normalize to `images/<path>` for the runtime site which expects assets under `images/`.
    if (!isAbs && s && !s.startsWith('images/')) s = 'images/' + s;
    return isAbs ? s : (prefix + s);
  }

  function buildFallTimeline(timelineHost, panelsHost, metaHost, falls, prefix, scrollContainer) {
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
      // Release the guard after scroll settles.
      setTimeout(function () { isProgrammaticScroll = false; }, behavior === 'auto' ? 0 : 450);
    }

    function setActive(index, options) {
      var prev = selected;
      selected = clampIndex(index);
      setTimelineCurrent(selected);
      setMeta(selected);

      // Always start at the top of the selected FALL.
      var sc = panelScrollElAt(selected);
      if (sc && prev !== selected) sc.scrollTop = 0;

      // Slide to the selected panel (native scroll-snap handles the animation).
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
        // Keep details available (native tooltip) without being the primary UI.
        if (details) btn.title = details;
      }

      btn.addEventListener('click', function () {
        setActive(idx);
      });

      timelineHost.appendChild(btn);
    });

    // Sync timeline/meta when user swipes/scrolls horizontally.
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

    // Keep horizontal positioning correct on resize.
    window.addEventListener('resize', function () {
      scrollToPanel(selected, 'auto');
    });

    setActive(0, { immediate: true });

    // If images load after layout, update height so the scroll range stays correct.
    panels.forEach(function (panel, idx) {
      panel.querySelectorAll('img').forEach(function (img) {
        img.addEventListener('load', function () {
          // No-op: layout is handled by per-panel vertical scrollers.
        });
        if (img.complete) {
          // No-op: layout is handled by per-panel vertical scrollers.
        }
      });
    });
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
      var url = prefix + 'content/projects/' + slug + '.md';
      var raw = await fetch(url).then(function (r) { return r.ok ? r.text() : Promise.reject(new Error(r.status)); });
      data = normalizeProjectDataFromMd(parseFrontmatter(raw)) || {};
    }

    if (data.header_title || data.title) {
      title.textContent = String(data.header_title || data.title);
    }
    if (data.page_title || data.title) {
      document.title = String(data.page_title || data.title);
    }
    var overviewMd = (data.body !== undefined && data.body !== null) ? String(data.body) : (data.overview_markdown ? String(data.overview_markdown) : '');
    textHost.innerHTML = overviewMd
      ? renderMarkdown(overviewMd)
      : '<p>Content not found.</p>';

    var materialsHost = document.getElementById('project-materials');
    if (materialsHost) {
      var matsHtml = '';
      if (Array.isArray(data.materials) && data.materials.length) {
        matsHtml = '<h3>Materials</h3><ul>' + data.materials.map(function (m) {
          return '<li>' + renderInlineMarkdown(String(m || '')) + '</li>';
        }).join('') + '</ul>';
      } else if (data.materials_markdown) {
        matsHtml = renderMarkdown(String(data.materials_markdown));
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

    // Optional toggle to hide overview → immersive navigation.
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
        buildFallTimeline(timelineHost, panelsHost, metaHost, data.falls, prefix, galleryHost);
      } else {
        galleryHost.classList.remove('has-falls');
        // Back-compat for projects that use a single gallery list.
        galleryHost.querySelectorAll('.project-timeline, #project-timeline, #project-gallery-panels').forEach(function (el) {
          if (el && el.parentNode) el.parentNode.removeChild(el);
        });
        if (data.gallery_heading) {
          var h = document.createElement('h2');
          h.textContent = String(data.gallery_heading);
          galleryHost.prepend(h);
        }
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
    var bioMd = '';

    if (SDV_PREVIEW.info) {
      data = SDV_PREVIEW.info.data || {};
      bioMd = SDV_PREVIEW.info.body || '';
    } else {
      var url = prefix + 'content/info.md';
      var raw = await fetch(url).then(function (r) { return r.ok ? r.text() : Promise.reject(new Error(r.status)); });
      var parsed = parseFrontmatter(raw);
      data = parsed.data || {};
      bioMd = parsed.body || '';
    }

    if (bioHost) {
      bioHost.innerHTML = bioMd
        ? renderMarkdown(String(bioMd))
        : '<p>Bio not found.</p>';
    }

    var html = '';

    if (Array.isArray(data.press) && data.press.length) {
      html += '<p><strong>Press</strong></p>';
      data.press.forEach(function (item) {
        if (!item) return;
        var title = item.title ? escapeHtml(String(item.title)) : 'Link';
        var href = item.url ? escapeHtml(String(item.url)) : '';
        var desc = item.description ? escapeHtml(String(item.description)) : '';
        if (href) {
          html += '<p><strong><a href="' + href + '" target="_blank" rel="noopener">' + title + ':</a></strong> ' + desc + '</p>';
        } else {
          html += '<p><strong>' + title + ':</strong> ' + desc + '</p>';
        }
      });
    }

    if (data.cv && (data.cv.file || data.cv.url)) {
      html += '<p><strong>CV</strong></p>';
      var label = data.cv.label ? escapeHtml(String(data.cv.label)) : 'Download CV';
      var href2 = data.cv.url ? String(data.cv.url) : String(data.cv.file || '');
      var fullHref = escapeHtml(safeHref(href2, prefix));
      html += '<p><a href="' + fullHref + '" target="_blank" rel="noopener">' + label + '</a></p>';
    }

    host.innerHTML = html || '<p>Links failed to load.</p>';
  }

  async function loadCaptions() {
    var immersiveRoot = document.querySelector('.immersive-page');
    if (!immersiveRoot) return;
    try {
      var list = null;
      if (SDV_PREVIEW.captions && Array.isArray(SDV_PREVIEW.captions.captions)) {
        list = SDV_PREVIEW.captions.captions;
      } else {
        var url = rootPrefix() + 'content/captions.yml';
        var yml = await fetch(url).then(function (r) { return r.ok ? r.text() : Promise.reject(new Error(r.status)); });
        var data = parseYaml(yml);
        list = (data && Array.isArray(data.captions)) ? data.captions : null;
      }
      if (list) {
        window.SDV_CAPTIONS = list;
        window.dispatchEvent(new Event('sdv:captions'));
      }
    } catch (e) {
      // If captions fail to load, app.js falls back to its internal CAPTIONS.
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    preservePreviewLinks();
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
    loadHomeMaterials().catch(function () { });
    loadCaptions().catch(function () { });
  });
})();

