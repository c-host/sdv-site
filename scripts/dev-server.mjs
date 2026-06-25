#!/usr/bin/env node
/**
 * Local static server with the same routing as site/_worker.js:
 *   /project/<slug>/  → shell/project.html
 *   /immersive/<slug>/ → shell/immersive.html
 * No dependencies; works on Node 18+. Use when Wrangler is unavailable.
 */
import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SITE_DIR = path.resolve(__dirname, '..', 'site')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
}

function parsePort(argv) {
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--port' && argv[i + 1]) return Number(argv[i + 1])
    if (argv[i].startsWith('--port=')) return Number(argv[i].slice(7))
  }
  if (process.env.PORT) return Number(process.env.PORT)
  return 3000
}

function shellRoute(pathname) {
  if (/^\/project\/[^/]+\/?$/.test(pathname)) return '/shell/project.html'
  if (/^\/immersive\/[^/]+\/?$/.test(pathname)) return '/shell/immersive.html'
  return null
}

function redirectHome(pathname) {
  return /^\/shell\/(project|immersive)\/?$/.test(pathname)
}

async function resolveFile(urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0])
  if (rel.endsWith('/')) rel += 'index.html'
  if (rel === '/') rel = '/index.html'

  const abs = path.normalize(path.join(SITE_DIR, rel))
  if (!abs.startsWith(SITE_DIR)) return null

  try {
    const stat = await fs.stat(abs)
    if (stat.isFile()) return abs
  } catch {
    /* fall through */
  }

  if (!path.extname(abs)) {
    try {
      await fs.stat(abs + '.html')
      return abs + '.html'
    } catch {
      /* not found */
    }
  }

  return null
}

async function serveFile(res, filePath, extraHeaders) {
  const body = await fs.readFile(filePath)
  const ext = path.extname(filePath).toLowerCase()
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': 'public, max-age=0, must-revalidate',
    ...extraHeaders,
  })
  res.end(body)
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`)
    const pathname = url.pathname

    if (redirectHome(pathname)) {
      res.writeHead(302, { Location: '/' })
      res.end()
      return
    }

    const shell = shellRoute(pathname)
    if (shell) {
      const filePath = path.join(SITE_DIR, shell.slice(1))
      await serveFile(res, filePath)
      return
    }

    const filePath = await resolveFile(pathname)
    if (!filePath) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Not found')
      return
    }

    await serveFile(res, filePath)
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(String(err && err.message ? err.message : err))
  }
})

const port = parsePort(process.argv)
server.listen(port, '127.0.0.1', () => {
  const base = `http://127.0.0.1:${port}/`
  process.stdout.write(`SDV dev server at ${base}\n`)
  process.stdout.write(`  project example: ${base}project/overlocked/\n`)
  process.stdout.write(`  immersive example: ${base}immersive/overlocked/\n`)
})
