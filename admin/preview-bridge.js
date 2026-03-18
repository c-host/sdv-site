// Decap CMS live preview bridge for sdv-site.
// Renders real site pages in an iframe and streams draft entry data via postMessage.
(function () {
  'use strict';

  // Decap exposes preview helpers globally in the CMS bundle:
  // - window.h: hyperscript function
  // - window.createClass: createClass helper (React-like lifecycle)
  // We intentionally avoid injecting our own React to prevent version mismatch crashes.
  function getH() {
    return window.h || null;
  }

  function getCreateClass() {
    return window.createClass || null;
  }

  function safeToJs(imm) {
    try {
      if (!imm) return null;
      if (typeof imm.toJS === 'function') return imm.toJS();
    } catch (e) { }
    return null;
  }

  function entryPath(entry) {
    try {
      return entry && typeof entry.get === 'function' ? (entry.get('path') || '') : '';
    } catch (e) {
      return '';
    }
  }

  function guessProjectSlug(entry) {
    var path = entryPath(entry);
    var m = String(path).match(/content\/projects\/([^/]+)\.ya?ml$/);
    if (m && m[1]) return String(m[1]);

    // Fallback: file names in admin/config.yml are project1/2/3.
    var name = '';
    try { name = entry && typeof entry.get === 'function' ? String(entry.get('slug') || '') : ''; } catch (e) { }
    var map = {
      project1: 'the-spontaneous-dance-falls',
      project2: 'under-the-needles-eye',
      project3: 'overlocked',
    };
    return map[name] || null;
  }

  function previewUrlFor(collectionName, entry) {
    if (collectionName === 'projects') {
      var slug = guessProjectSlug(entry);
      return slug ? ('/project/' + slug + '/') : '/';
    }
    if (collectionName === 'info') {
      return '/info/';
    }
    if (collectionName === 'captions') {
      // Captions are surfaced on immersive pages; pick a stable preview target.
      return '/immersive/under-the-needles-eye/';
    }
    return '/';
  }

  function originForUrl(url) {
    try {
      return new URL(url, window.location.origin).origin;
    } catch (e) {
      return '*';
    }
  }

  function buildPayload(collectionName, entry) {
    // For file collections, entry.get('data') is an Immutable.Map of fields.
    var data = null;
    try {
      data = entry && typeof entry.get === 'function' ? safeToJs(entry.get('data')) : null;
    } catch (e) {
      data = null;
    }

    if (collectionName === 'projects') {
      return {
        collection: 'projects',
        slug: guessProjectSlug(entry),
        data: data || {},
      };
    }

    if (collectionName === 'info') {
      return {
        collection: 'info',
        data: data || {},
      };
    }

    if (collectionName === 'captions') {
      // The YAML file is { captions: [...] }
      var captions = (data && Array.isArray(data.captions)) ? data.captions : [];
      return {
        collection: 'captions',
        data: { captions: captions },
      };
    }

    return { collection: collectionName, data: data || {} };
  }

  function registerWhenReady() {
    var CMS = window.CMS;
    var h = getH();
    var createClass = getCreateClass();
    if (!CMS || !h || !createClass) return false;

    // Hide Decap's sync-scroll control (conflicts with real-page iframe preview UX).
    // Note: this button lives in the CMS chrome (not inside the preview iframe),
    // so we inject CSS into the admin document itself.
    (function ensureHideSyncScrollCss() {
      try {
        if (document.getElementById('sdv-hide-sync-scroll')) return;
        var style = document.createElement('style');
        style.id = 'sdv-hide-sync-scroll';
        style.textContent = [
          'button[title="Sync scrolling"],',
          'button[aria-label="Sync scrolling"] {',
          '  display: none !important;',
          '}',
        ].join('\n');
        document.head.appendChild(style);
      } catch (e) { }
    })();

    function makeIframePreview(collectionName) {
      return createClass({
        getInitialState: function () {
          return {};
        },

        componentWillMount: function () {
          this.iframeRef = null;
          this.wrapRef = null;
          this._lastSent = '';
          this._postTimer = 0;
          this._previewNonce = String(Date.now()) + '-' + String(Math.random()).slice(2);
        },

        componentDidMount: function () {
          this._dockToBottom();
          this._schedulePost(false);
        },

        componentDidUpdate: function () {
          this._dockToBottom();
          this._schedulePost(false);
        },

        componentWillUnmount: function () {
          if (this._postTimer) clearTimeout(this._postTimer);
          this._postTimer = 0;
          this._sendClear();
        },

        _dockToBottom: function () {
          // Decap's preview pane doesn't always give custom templates full-height layout.
          // Instead of relying on flex in our component alone, walk up to find a scroll container
          // and convert it into a flex column so our preview block can sit at the bottom.
          try {
            var wrap = this.wrapRef;
            if (!wrap || !wrap.parentElement) return;

            // Our block should take its natural height and sit after any other preview UI.
            wrap.style.marginTop = 'auto';
            wrap.style.position = 'relative';

            var el = wrap.parentElement;
            var chosen = null;
            for (var i = 0; i < 12 && el && el !== document.body; i++) {
              var cs = window.getComputedStyle ? window.getComputedStyle(el) : null;
              var oy = cs ? cs.overflowY : '';
              var isScrollable = (oy === 'auto' || oy === 'scroll') || (el.scrollHeight > el.clientHeight + 4);
              if (isScrollable) { chosen = el; break; }
              el = el.parentElement;
            }
            if (!chosen) chosen = wrap.parentElement;

            // Ensure flex column layout so marginTop:auto works, and propagate height so the
            // container actually has extra vertical space to push into.
            chosen.style.display = 'flex';
            chosen.style.flexDirection = 'column';
            chosen.style.flex = '1 1 auto';
            chosen.style.minHeight = '0';
            chosen.style.height = '100%';

            var p = chosen.parentElement;
            for (var j = 0; j < 6 && p && p !== document.body; j++) {
              // Don't clobber layout if a parent is already a flex container; just help it stretch.
              if (p.style) {
                if (!p.style.height) p.style.height = '100%';
                if (!p.style.minHeight) p.style.minHeight = '0';
              }
              p = p.parentElement;
            }
          } catch (e) { }
        },

        _frameEl: function () {
          return this.iframeRef;
        },

        _targetOrigin: function () {
          var f = this._frameEl();
          var fallback = previewUrlFor(collectionName, this.props.entry);
          var src = (f && f.src) ? f.src : fallback;
          return originForUrl(src);
        },

        _post: function (msg) {
          var f = this._frameEl();
          if (!f || !f.contentWindow) return;
          try {
            f.contentWindow.postMessage(msg, this._targetOrigin());
          } catch (e) { }
        },

        _sendClear: function () {
          this._post({ type: 'sdv:preview:clear' });
        },

        _onLoad: function () {
          this._schedulePost(true);
        },

        _schedulePost: function (immediate) {
          var self = this;
          if (self._postTimer) clearTimeout(self._postTimer);
          self._postTimer = setTimeout(function () {
            self._postTimer = 0;
            self._sendLatest();
          }, immediate ? 0 : 60);
        },

        _sendLatest: function () {
          var payload = buildPayload(collectionName, this.props.entry);
          var serialized = '';
          try { serialized = JSON.stringify(payload); } catch (e) { serialized = ''; }
          if (serialized && serialized === this._lastSent) return;
          this._lastSent = serialized;
          this._post({ type: 'sdv:preview', payload: payload });
        },

        render: function () {
          // Cache-bust the iframe URL so the preview always runs latest JS/CSS.
          // This avoids stale behavior when iterating locally.
          var base = previewUrlFor(collectionName, this.props.entry);
          var src = base + (base.indexOf('?') === -1 ? '?' : '&') + 'sdvPreview=1&t=' + encodeURIComponent(this._previewNonce);
          return h('div', {
            ref: (function (r) { this.wrapRef = r; }).bind(this),
            className: 'sdv-realpage-preview',
            style: {
              // Keep natural height; parent flex column + marginTop:auto docks it.
              paddingTop: '0px',
              paddingBottom: '15px',
            },
          }, [
            h('div', {
              style: {
                fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
                fontSize: '12px',
                padding: '6px 8px',
                border: '1px solid rgba(0,0,0,0.18)',
                borderBottom: '0',
                borderTopLeftRadius: '6px',
                borderTopRightRadius: '6px',
                background: '#fff',
              },
            }, [
              'Live preview below. See unedted version here: ',
              h('a', { href: base, target: '_blank', rel: 'noopener noreferrer' }, base),
            ]),

            h('iframe', {
              ref: (function (r) { this.iframeRef = r; }).bind(this),
              src: src,
              onLoad: this._onLoad,
              style: {
                border: '1px solid rgba(0,0,0,0.18)',
                borderTop: '0',
                borderBottomLeftRadius: '6px',
                borderBottomRightRadius: '6px',
                width: '100%',
                height: '70vh',
                background: '#fff',
                display: 'block',
              },
              title: 'Live preview',
            }),
          ]);
        },
      });
    }

    // Register preview templates.
    //
    // IMPORTANT: For `collections: [...] files: [...]` entries, Decap registers previews
    // by the *file entry name* (e.g. `project1`), not the parent collection name (`projects`).
    CMS.registerPreviewTemplate('project1', makeIframePreview('projects'));
    CMS.registerPreviewTemplate('project2', makeIframePreview('projects'));
    CMS.registerPreviewTemplate('project3', makeIframePreview('projects'));
    CMS.registerPreviewTemplate('info', makeIframePreview('info'));
    CMS.registerPreviewTemplate('captions', makeIframePreview('captions'));
    return true;
  }

  // Decap CMS loads asynchronously; retry a few times.
  var attempts = 0;
  var maxAttempts = 80; // ~8s at 100ms.
  var timer = setInterval(function () {
    attempts++;
    if (registerWhenReady()) {
      clearInterval(timer);
    } else if (attempts >= maxAttempts) {
      clearInterval(timer);
    }
  }, 100);
})();

