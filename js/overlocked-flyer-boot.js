/**
 * Runs synchronously after each .immersive-flyer[data-flyer-root] is parsed so scan
 * <img> elements get the correct src from sessionStorage before a default can load.
 * Must stay in sync with FLYER_PERSIST_KEY in app.js.
 */
(function () {
  var KEY = 'sdv:overlocked-flyer-v1';
  var side = 'front';
  try {
    var raw = sessionStorage.getItem(KEY);
    var o = raw && JSON.parse(raw);
    if (o && o.v === 1 && o.side === 'back') side = 'back';
  } catch (e) {}
  var src =
    '../../images/uploads/overlocked-scan-' + (side === 'back' ? 'back' : 'front') + '.jpg';
  var sc = document.currentScript;
  var root = sc && sc.parentNode;
  if (!root || !root.querySelectorAll) return;
  var imgs = root.querySelectorAll('img');
  for (var i = 0; i < imgs.length; i++) {
    imgs[i].setAttribute('src', src);
  }
})();
