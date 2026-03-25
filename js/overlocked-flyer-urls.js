/**
 * Shared scan URL tier for overlocked flyer (boot + app.js). No dependencies.
 * Mobile tier uses smaller JPEGs; must stay in sync with applyFlyerScanSide in app.js.
 */
(function (global) {
  function useMobileScanTier() {
    try {
      if (global.matchMedia && global.matchMedia('(max-width: 900px)').matches) {
        return true;
      }
      if (global.matchMedia && global.matchMedia('(max-height: 600px)').matches) {
        return true;
      }
      var dpr = global.devicePixelRatio || 1;
      if (
        dpr <= 1.5 &&
        global.matchMedia &&
        global.matchMedia('(max-width: 1200px)').matches
      ) {
        return true;
      }
    } catch (e) { /* ignore */ }
    return false;
  }

  /**
   * @param {'front'|'back'} side
   * @returns {string} path from site root, e.g. images/uploads/overlocked-scan-front-mobile.jpg
   */
  function relPath(side) {
    var face = side === 'back' ? 'back' : 'front';
    if (useMobileScanTier()) {
      return 'images/uploads/overlocked-scan-' + face + '-mobile.jpg';
    }
    return 'images/uploads/overlocked-scan-' + face + '.jpg';
  }

  global.SDV_FLYER_SCAN_URLS = {
    relPath: relPath,
    useMobileScanTier: useMobileScanTier,
  };
})(typeof window !== 'undefined' ? window : this);
