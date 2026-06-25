/**
 * Serve shared HTML shells for /project/<slug>/ and /immersive/<slug>/ without
 * changing the browser URL. _redirects 200 rewrites to .html files cause
 * Cloudflare to redirect the visible URL to an extension-less path (e.g.
 * /shell/project), which drops the slug and breaks content-loader.js.
 */
export async function onRequest(context) {
  const {request, next} = context
  const path = new URL(request.url).pathname

  if (/^\/project\/[^/]+\/?$/.test(path)) {
    return next('/shell/project.html')
  }

  if (/^\/immersive\/[^/]+\/?$/.test(path)) {
    return next('/shell/immersive.html')
  }

  return next()
}
