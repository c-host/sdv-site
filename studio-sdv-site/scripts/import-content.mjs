/* eslint-env node */
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import crypto from 'node:crypto'
import {createClient} from '@sanity/client'

const ROOT = path.resolve(process.cwd(), '..')
const CONTENT_DIR = path.join(ROOT, 'content')
const PROJECTS_DIR = path.join(CONTENT_DIR, 'projects')

const HOME_PAGE_DOC_ID = 'homePageConfig'
const IMMERSIVE_LAW_DOC_ID = 'immersiveLawDance'
const IMMERSIVE_NEEDLE_DOC_ID = 'immersiveNeedleSlider'

const SANITY_PROJECT_ID = process.env.SANITY_PROJECT_ID || 'mei3zxrq'
const SANITY_DATASET = process.env.SANITY_DATASET || 'production'
const SANITY_API_VERSION = process.env.SANITY_API_VERSION || '2025-02-19'
const SANITY_AUTH_TOKEN = process.env.SANITY_AUTH_TOKEN

if (!SANITY_AUTH_TOKEN) {
  throw new Error('Missing SANITY_AUTH_TOKEN. Set a write-enabled token before running import.')
}

const client = createClient({
  projectId: SANITY_PROJECT_ID,
  dataset: SANITY_DATASET,
  apiVersion: SANITY_API_VERSION,
  token: SANITY_AUTH_TOKEN,
  useCdn: false,
  /** Large immersive documents + many assets can exceed default timeouts / hit flaky proxies. */
  timeout: 180000,
})

/**
 * Sanity occasionally returns "An invalid response was received from the upstream server"
 * (truncated body, 502/503, connection reset). Retry a few times with backoff.
 */
async function commitWithRetry(label, fn, {retries = 5, delayMs = 2500} = {}) {
  let lastErr
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      const msg = String(e && e.message ? e.message : e)
      const retryable =
        /invalid response|upstream|socket hang up|ECONNRESET|ETIMEDOUT|ECONNABORTED|502|503|504|fetch failed/i.test(
          msg,
        )
      if (!retryable || attempt === retries) throw e
      const wait = delayMs * attempt
      process.stderr.write(`${label}: attempt ${attempt} failed (${msg.slice(0, 120)}…), retry in ${wait}ms\n`)
      await new Promise((r) => setTimeout(r, wait))
    }
  }
  throw lastErr
}

function key() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}

function parseFrontmatter(raw) {
  const s = String(raw || '').replace(/\r\n/g, '\n')
  if (!s.startsWith('---\n')) return {data: {}, body: s}
  const end = s.indexOf('\n---\n', 4)
  if (end === -1) return {data: {}, body: s}
  return {
    data: parseSimpleYaml(s.slice(4, end)),
    body: s.slice(end + 5).replace(/^\n+/, ''),
  }
}

function markdownToPortableText(md) {
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let paragraph = []
  let listType = null
  let listItems = []
  let quoteLines = []

  const toSpanBlock = (text, style = 'normal', extra = {}) => ({
    _type: 'block',
    _key: key(),
    style,
    markDefs: [],
    children: [{_type: 'span', _key: key(), text: String(text || ''), marks: []}],
    ...extra,
  })

  const flushParagraph = () => {
    if (!paragraph.length) return
    blocks.push(toSpanBlock(paragraph.join(' ').replace(/\s+/g, ' ').trim(), 'normal'))
    paragraph = []
  }

  const flushList = () => {
    if (!listType || !listItems.length) return
    listItems.forEach((item) => {
      blocks.push(
        toSpanBlock(item, 'normal', {
          listItem: listType,
          level: 1,
        }),
      )
    })
    listType = null
    listItems = []
  }

  const flushQuote = () => {
    if (!quoteLines.length) return
    blocks.push(toSpanBlock(quoteLines.join(' ').trim(), 'blockquote'))
    quoteLines = []
  }

  const isBullet = (line) => /^(-|\*|•)\s+/.test(line.trim())
  const isNumber = (line) => /^\d+\.\s+/.test(line.trim())
  const isQuote = (line) => /^\s*>\s?/.test(line)
  const stripBullet = (line) => line.trim().replace(/^(-|\*|•)\s+/, '')
  const stripNumber = (line) => line.trim().replace(/^\d+\.\s+/, '')
  const stripQuote = (line) => line.replace(/^\s*>\s?/, '')

  for (const rawLine of lines) {
    const line = String(rawLine || '')
    if (!line.trim()) {
      flushQuote()
      flushList()
      flushParagraph()
      continue
    }

    if (isQuote(line)) {
      flushParagraph()
      flushList()
      quoteLines.push(stripQuote(line))
      continue
    }

    flushQuote()

    if (isBullet(line)) {
      flushParagraph()
      if (listType && listType !== 'bullet') flushList()
      listType = 'bullet'
      listItems.push(stripBullet(line))
      continue
    }

    if (isNumber(line)) {
      flushParagraph()
      if (listType && listType !== 'number') flushList()
      listType = 'number'
      listItems.push(stripNumber(line))
      continue
    }

    flushList()
    if (line.startsWith('### ')) {
      flushParagraph()
      blocks.push(toSpanBlock(line.slice(4).trim(), 'h3'))
      continue
    }
    if (line.startsWith('## ')) {
      flushParagraph()
      blocks.push(toSpanBlock(line.slice(3).trim(), 'h2'))
      continue
    }
    paragraph.push(line.trim())
  }

  flushQuote()
  flushList()
  flushParagraph()
  return blocks.length ? blocks : [toSpanBlock('')]
}

function parseSimpleYaml(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n')
  let i = 0

  const indent = (line) => (line.match(/^(\s*)/) || ['', ''])[1].length
  const scalar = (v) => {
    const t = String(v || '').trim()
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1)
    if (/^\d+$/.test(t)) return Number(t)
    if (t === 'true') return true
    if (t === 'false') return false
    if (t === 'null' || t === '~') return null
    return t
  }

  function parseList(baseIndent) {
    const out = []
    while (i < lines.length) {
      const line = lines[i]
      if (!line.trim()) {
        i++
        continue
      }
      const ind = indent(line)
      if (ind < baseIndent) break
      const trimmed = line.trim()
      if (!trimmed.startsWith('- ')) break
      const rest = trimmed.slice(2)
      if (rest.includes(': ')) {
        const obj = {}
        let cursor = rest
        while (true) {
          const idx = cursor.indexOf(':')
          const key = cursor.slice(0, idx).trim()
          const val = cursor.slice(idx + 1).trim()
          if (!val) {
            const next = lines[i + 1] || ''
            const nextIndent = indent(next)
            if (next.trim().startsWith('- ') && nextIndent > baseIndent) {
              i += 1
              obj[key] = parseList(nextIndent)
            } else {
              obj[key] = ''
              i++
            }
          } else {
            obj[key] = scalar(val)
            i++
          }
          if (i >= lines.length) break
          const nextLine = lines[i]
          const nextTrim = nextLine.trim()
          const nextIndent = indent(nextLine)
          if (!nextTrim || nextIndent <= baseIndent || nextTrim.startsWith('- ') || !nextTrim.includes(':')) break
          cursor = nextTrim
        }
        out.push(obj)
      } else {
        out.push(scalar(rest))
        i++
      }
    }
    return out
  }

  while (i < lines.length && !lines[i].trim()) i++
  if (i < lines.length && lines[i].trim().startsWith('- ')) return parseList(indent(lines[i]))

  const obj = {}
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim() || line.trim().startsWith('#')) {
      i++
      continue
    }
    if (indent(line) !== 0) {
      i++
      continue
    }
    const idx = line.indexOf(':')
    if (idx === -1) {
      i++
      continue
    }
    const key = line.slice(0, idx).trim()
    const rest = line.slice(idx + 1).trim()
    i++
    if (!rest) {
      const next = lines[i] || ''
      if (next.trim().startsWith('- ')) obj[key] = parseList(indent(next))
      else obj[key] = null
      continue
    }
    obj[key] = scalar(rest)
  }
  return obj
}

function resolveRepoPath(filePath) {
  const trimmed = String(filePath || '').trim()
  const relative = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed
  return path.join(ROOT, relative)
}

async function uploadImageField(imagePath) {
  if (!imagePath) return null
  const src = resolveRepoPath(imagePath)
  const buffer = await fs.readFile(src)
  const ext = path.extname(src).slice(1).toLowerCase() || 'jpg'
  const asset = await client.assets.upload('image', buffer, {
    filename: path.basename(src),
    contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
  })
  return {
    _type: 'image',
    _key: key(),
    asset: {_type: 'reference', _ref: asset._id},
  }
}

async function uploadFileField(filePath) {
  if (!filePath) return null
  const src = resolveRepoPath(filePath)
  const buffer = await fs.readFile(src)
  const ext = path.extname(src).slice(1).toLowerCase() || 'pdf'
  const asset = await client.assets.upload('file', buffer, {
    filename: path.basename(src),
    contentType: ext === 'pdf' ? 'application/pdf' : undefined,
  })
  return {
    _type: 'file',
    asset: {_type: 'reference', _ref: asset._id},
  }
}

async function importInfo() {
  const raw = await fs.readFile(path.join(CONTENT_DIR, 'info.md'), 'utf8')
  const parsed = parseFrontmatter(raw)
  const cv = parsed.data.cv || {}
  const fileField = cv.file ? await uploadFileField(cv.file) : null
  const doc = {
    _id: 'infoPage',
    _type: 'info',
    body: markdownToPortableText(parsed.body || ''),
    press: Array.isArray(parsed.data.press)
      ? parsed.data.press.map((item) => ({
          _type: 'item',
          _key: key(),
          title: item?.title || '',
          url: item?.url || '',
          description: item?.description || '',
        }))
      : [],
    cv: Object.assign(
      {
        label: cv.label || '',
        url: cv.url || '',
      },
      fileField ? {file: fileField} : {},
    ),
  }
  await client.createOrReplace(doc)
  process.stdout.write('Imported infoPage\n')
}

async function loadHomeConfig() {
  try {
    const raw = await fs.readFile(path.join(CONTENT_DIR, 'home.json'), 'utf8')
    const j = JSON.parse(raw)
    const map = {}
    for (const p of j.projects || []) {
      if (p && p.slug) map[p.slug] = p
    }
    return { map, projects: Array.isArray(j.projects) ? j.projects : [] }
  } catch {
    return { map: {}, projects: [] }
  }
}

/** Convert legacy law paragraph segments to Portable Text (lawFragment annotations). */
function lawParagraphsToPortableText(paragraphs) {
  const blocks = []
  for (const para of paragraphs || []) {
    const segs = Array.isArray(para?.segments) ? para.segments : []
    const markDefs = []
    const children = []
    for (const seg of segs) {
      if (seg._type === 'lawTextSegment' && seg.text) {
        const t = String(seg.text).replace(/\s+/g, ' ').trim()
        if (t) {
          children.push({
            _type: 'span',
            _key: key(),
            text: t,
            marks: [],
          })
        }
      } else if (seg._type === 'lawFragmentSegment' && seg.image) {
        const mk = key()
        markDefs.push({
          _type: 'lawFragment',
          _key: mk,
          image: seg.image,
        })
        children.push({
          _type: 'span',
          _key: key(),
          text: String(seg.buttonText || '').replace(/\s+/g, ' ').trim(),
          marks: [mk],
        })
      }
    }
    if (!children.length) continue
    blocks.push({
      _type: 'block',
      _key: key(),
      style: 'normal',
      markDefs,
      children,
    })
  }
  return blocks
}

async function importProject(slug) {
  const file = path.join(PROJECTS_DIR, `${slug}.md`)
  const raw = await fs.readFile(file, 'utf8')
  const parsed = parseFrontmatter(raw)
  const d = parsed.data || {}

  const gallery = Array.isArray(d.gallery) ? d.gallery : []
  const galleryImages = []
  for (const imagePath of gallery) {
    galleryImages.push(await uploadImageField(imagePath))
  }

  const falls = Array.isArray(d.falls) ? d.falls : []
  const fallItems = []
  for (const item of falls) {
    const images = Array.isArray(item.images) ? item.images : []
    const imageFields = []
    for (const imagePath of images) {
      imageFields.push(await uploadImageField(imagePath))
    }
    fallItems.push({
      _type: 'fall',
      _key: key(),
      label: item.label || '',
      type: item.type || '',
      details: item.details || '',
      images: imageFields.filter(Boolean),
    })
  }

  const projectId = `project-${slug}`
  const doc = {
    _id: projectId,
    _type: 'project',
    slug,
    immersive_enabled: d.immersive_enabled !== false,
    home_materials: Array.isArray(d.home_materials) ? d.home_materials : [],
    header_title: d.header_title || slug,
    body: markdownToPortableText(parsed.body || ''),
    materials: Array.isArray(d.materials) ? d.materials : [],
    links: Array.isArray(d.links) ? d.links : [],
    falls: fallItems,
    gallery: galleryImages.filter(Boolean),
  }
  doc.links = Array.isArray(d.links)
    ? d.links.map((item) => ({
        _type: 'item',
        _key: key(),
        label: item?.label || '',
        url: item?.url || '',
      }))
    : []
  await client.createOrReplace(doc)
  process.stdout.write(`Imported ${projectId}\n`)
}

async function importLawImmersive() {
  const fragmentPath = path.join(CONTENT_DIR, 'immersive/the-spontaneous-dance-falls-law-fragment.html')
  const raw = await fs.readFile(fragmentPath, 'utf8')
  const h2 = raw.match(/<h2 class="law-heading">([^<]*)<\/h2>/)
  const heading = h2 ? h2[1].trim() : ''
  const paragraphs = []
  const pRe = /<p>([\s\S]*?)<\/p>/g
  let m
  while ((m = pRe.exec(raw)) !== null) {
    const inner = m[1]
    const segments = []
    const btnRe =
      /<button[^>]*class="law-fragment"[^>]*data-image="([^"]+)"[^>]*>([\s\S]*?)<\/button>\s*<span[^>]*class="law-image-inline"[^>]*><\/span>/gi
    let last = 0
    let bm
    while ((bm = btnRe.exec(inner)) !== null) {
      const before = inner.slice(last, bm.index).replace(/\s+/g, ' ').trim()
      if (before) segments.push({_type: 'lawTextSegment', _key: key(), text: before})
      const imgPath = bm[1].replace(/^(\.\.\/)+/, '').replace(/^\//, '')
      const imgField = await uploadImageField(imgPath)
      if (!imgField) continue
      segments.push({
        _type: 'lawFragmentSegment',
        _key: key(),
        buttonText: bm[2].replace(/\s+/g, ' ').trim(),
        image: imgField,
      })
      last = btnRe.lastIndex
    }
    const tail = inner.slice(last).replace(/\s+/g, ' ').trim()
    if (tail) segments.push({_type: 'lawTextSegment', _key: key(), text: tail})
    if (segments.length) {
      paragraphs.push({_type: 'lawParagraph', _key: key(), segments})
    }
  }
  const body = lawParagraphsToPortableText(paragraphs)
  await client.createOrReplace({
    _id: IMMERSIVE_LAW_DOC_ID,
    _type: 'immersiveLaw',
    heading,
    body,
  })
  process.stdout.write(`Imported ${IMMERSIVE_LAW_DOC_ID} (immersive law)\n`)
}

async function importNeedleImmersiveSlides() {
  const raw = await fs.readFile(path.join(CONTENT_DIR, 'immersive/under-the-needles-eye-slides.json'), 'utf8')
  const j = JSON.parse(raw)
  const slides = Array.isArray(j.slides) ? j.slides : []
  const slideFields = []
  for (const s of slides) {
    const img = await uploadImageField(s.image)
    if (!img) continue
    slideFields.push({
      _type: 'sliderSlide',
      _key: key(),
      image: img,
      caption: markdownToPortableText(s.caption || ''),
    })
  }
  await client.createOrReplace({
    _id: IMMERSIVE_NEEDLE_DOC_ID,
    _type: 'immersiveNeedle',
    slides: slideFields,
  })
  process.stdout.write(`Imported ${IMMERSIVE_NEEDLE_DOC_ID} (immersive slider)\n`)
}

async function importHomePage() {
  const {projects} = await loadHomeConfig()
  const sorted = projects.slice().sort((a, b) => (a.home_order ?? 99) - (b.home_order ?? 99))
  const entries = []
  for (const row of sorted) {
    if (!row?.slug) continue
    const splashField = row.splash ? await uploadImageField(row.splash) : null
    const entry = {
      _type: 'homeEntry',
      _key: key(),
      project: {_type: 'reference', _ref: `project-${row.slug}`},
      navLabel: row.home_nav_label || '',
    }
    if (splashField) entry.splashImage = splashField
    entries.push(entry)
  }
  await client.createOrReplace({
    _id: HOME_PAGE_DOC_ID,
    _type: 'homePage',
    entries,
  })
  process.stdout.write(`Imported ${HOME_PAGE_DOC_ID}\n`)
}

async function importCaptions() {
  const raw = await fs.readFile(path.join(CONTENT_DIR, 'captions.yml'), 'utf8')
  const parsed = parseSimpleYaml(raw)
  const captions = parsed && Array.isArray(parsed.captions) ? parsed.captions : []
  const doc = {
    _id: 'captionsConfig',
    _type: 'captions',
    items: captions.map((item) => ({
      _type: 'item',
      _key: key(),
      project: item.project || '',
      text: item.text || '',
    })),
  }
  await client.createOrReplace(doc)
  process.stdout.write('Imported captionsConfig\n')
}

async function main() {
  process.stdout.write('Import started...\n')
  await importInfo()
  await importProject('the-spontaneous-dance-falls')
  await importProject('under-the-needles-eye')
  await importProject('overlocked')
  await importCaptions()
  await importHomePage()
  await importLawImmersive()
  await importNeedleImmersiveSlides()
  process.stdout.write('Import completed.\n')
}

main().catch((err) => {
  process.stderr.write(String(err && err.stack ? err.stack : err) + '\n')
  process.exit(1)
})
