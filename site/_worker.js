/**
 * Route /project/<slug>/ and /immersive/<slug>/ to shared shells while keeping
 * the browser URL unchanged. Runs before static assets, so stale per-slug HTML
 * files cannot bypass routing.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname

    if (/^\/project\/[^/]+\/?$/.test(path)) {
      const assetUrl = new URL('/shell/project.html', url)
      return env.ASSETS.fetch(new Request(assetUrl, request))
    }

    if (/^\/immersive\/[^/]+\/?$/.test(path)) {
      const assetUrl = new URL('/shell/immersive.html', url)
      return env.ASSETS.fetch(new Request(assetUrl, request))
    }

    return env.ASSETS.fetch(request)
  },
}
