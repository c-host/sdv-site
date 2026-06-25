/**
 * Route /project/<slug>/ and /immersive/<slug>/ to shared shells while keeping
 * the browser URL unchanged. Must return the shell body as 200 — passing
 * through ASSETS.fetch for *.html triggers Cloudflare's 308 to extension-less
 * URLs (/shell/project), which replaces the address bar and breaks slug parsing.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname

    if (/^\/project\/[^/]+\/?$/.test(path)) {
      return serveShell(request, env, '/shell/project')
    }

    if (/^\/immersive\/[^/]+\/?$/.test(path)) {
      return serveShell(request, env, '/shell/immersive')
    }

    // Direct /shell/* hits (bookmarks, old redirects) — send visitors home.
    if (/^\/shell\/(project|immersive)\/?$/.test(path)) {
      return Response.redirect(new URL('/', url).toString(), 302)
    }

    return env.ASSETS.fetch(request)
  },
}

async function serveShell(request, env, shellPath) {
  const assetUrl = new URL(shellPath, request.url)
  const assetResponse = await env.ASSETS.fetch(new Request(assetUrl, request))

  if (!assetResponse.ok) {
    return assetResponse
  }

  return new Response(assetResponse.body, {
    status: 200,
    headers: {
      'Content-Type': assetResponse.headers.get('Content-Type') || 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  })
}
