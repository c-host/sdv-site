import {colorInput} from '@sanity/color-input'
import {defineConfig} from 'sanity'
import './studio-portable-text.css'
import {structureTool} from 'sanity/structure'
import {
  defineDocuments,
  defineLocations,
  presentationTool,
  type PresentationPluginOptions,
} from 'sanity/presentation'
import {HOME_PAGE_DOC_ID} from './schemaTypes/homePageType'
import {SITE_TYPOGRAPHY_DOC_ID} from './schemaTypes/typographyTypes'
import {ProjectDeleteAction} from './actions/projectDeleteAction'
import {schemaTypes} from './schemaTypes'
import {structure} from './structure'

/** Strip drafts. prefix for location resolvers (published and draft panes). */
function publishedId(id: string | undefined) {
  return id?.replace(/^drafts\./, '') || ''
}

const ALLOWED_NEW_TEMPLATES = new Set([
  'sanity.imageAsset',
  'sanity.fileAsset',
  'fontUpload',
  'project',
])
/** Preview iframe URL and allowed site origins. Defaults suit local dev; override via env when deploying Studio. */
const FALLBACK_ORIGINS = [
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'https://sdv-site.pages.dev',
]
const PREVIEW_ORIGINS = String(process.env.SANITY_STUDIO_PREVIEW_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const PREVIEW_ORIGIN =
  process.env.SANITY_STUDIO_PREVIEW_ORIGIN || PREVIEW_ORIGINS[0] || FALLBACK_ORIGINS[0]

function previewBaseUrl(): URL {
  const raw = PREVIEW_ORIGIN.trim()
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`
  const url = new URL(withScheme.endsWith('/') ? withScheme : `${withScheme}/`)
  return url
}

/** Path prefix when the site is not at domain root (e.g. a hosting subpath). Empty on Cloudflare Pages (root). */
function previewBasePath(): string {
  const path = previewBaseUrl().pathname.replace(/\/$/, '')
  return path === '/' ? '' : path
}

function previewHref(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${previewBasePath()}${normalized}`
}

/** Route pattern for Presentation document matching (includes any hosting subpath). */
function previewRoute(path: string): string {
  const base = previewBasePath()
  if (path === '/' || path === '') {
    return base ? `${base}/` : '/'
  }
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalized}`
}

const HOME_MAIN_DOCUMENTS_FILTER = `(_type == "homePage" && (_id == "${HOME_PAGE_DOC_ID}" || _id == "drafts.${HOME_PAGE_DOC_ID}")) || (_type == "info" && (_id == "infoPage" || _id == "drafts.infoPage"))`

function previewOriginAllowList(): string[] {
  const entries = PREVIEW_ORIGINS.concat([PREVIEW_ORIGIN])
  const origins = entries.flatMap((entry) => {
    try {
      return [new URL(entry).origin]
    } catch {
      return [entry]
    }
  })
  return Array.from(
    new Set(
      origins
        .concat(FALLBACK_ORIGINS)
        .concat(['http://127.0.0.1:*', 'http://localhost:*']),
    ),
  )
}

const ALLOW_ORIGINS = previewOriginAllowList()

/** Typography preview locations for Presentation "used on N pages". */
function typographyPreviewLocations() {
  const slugs = [
    'overlocked',
    'under-the-needle-s-eye',
    'the-spontaneous-dance-falls',
  ]
  return [
    {title: 'Home', href: previewHref('/')},
    ...slugs.flatMap((slug) => [
      {title: slug, href: previewHref(`/project/${slug}/`)},
      {title: `${slug} — immersive`, href: previewHref(`/immersive/${slug}/`)},
    ]),
  ]
}

const presentationResolve: PresentationPluginOptions['resolve'] = {
  mainDocuments: defineDocuments([
    {
      route: previewRoute('/'),
      filter: HOME_MAIN_DOCUMENTS_FILTER,
    },
    ...(previewBasePath()
      ? [
          {
            route: previewBasePath(),
            filter: HOME_MAIN_DOCUMENTS_FILTER,
          },
        ]
      : []),
    {
      route: previewRoute('/immersive/:slug'),
      filter: ({params}) => `_type == "project" && coalesce(slug.current, slug) == $slug`,
      params: ({params}) => ({slug: params.slug || ''}),
    },
    {
      route: previewRoute('/immersive/:slug/'),
      filter: ({params}) => `_type == "project" && coalesce(slug.current, slug) == $slug`,
      params: ({params}) => ({slug: params.slug || ''}),
    },
    {
      route: previewRoute('/project/:slug'),
      filter: ({params}) => `_type == "project" && coalesce(slug.current, slug) == $slug`,
      params: ({params}) => ({slug: params.slug || ''}),
    },
    {
      route: previewRoute('/project/:slug/'),
      filter: ({params}) => `_type == "project" && coalesce(slug.current, slug) == $slug`,
      params: ({params}) => ({slug: params.slug || ''}),
    },
  ]),
  locations: {
    info: defineLocations({
      select: {
        _id: '_id',
      },
      resolve: (doc) => ({
        locations:
          publishedId(doc?._id) === 'infoPage' ? [{title: 'Home (info panel)', href: previewHref('/')}] : [],
      }),
    }),
    project: defineLocations({
      select: {
        title: 'header_title',
        slug: 'slug',
      },
      resolve: (doc) => {
        const slug =
          typeof doc?.slug === 'object' && doc?.slug?.current
            ? String(doc.slug.current)
            : String(doc?.slug || '')
        if (!slug) return {locations: []}
        return {
          locations: [
            {title: doc?.title || slug, href: previewHref(`/project/${slug}/`)},
            {title: `${doc?.title || slug} — immersive`, href: previewHref(`/immersive/${slug}/`)},
          ],
        }
      },
    }),
    homePage: defineLocations({
      select: {_id: '_id'},
      resolve: (doc) => ({
        locations:
          publishedId(doc?._id) === HOME_PAGE_DOC_ID ? [{title: 'Home', href: previewHref('/')}] : [],
      }),
    }),
    siteTypography: defineLocations({
      select: {_id: '_id'},
      resolve: (doc) => ({
        locations:
          publishedId(doc?._id) === SITE_TYPOGRAPHY_DOC_ID ? typographyPreviewLocations() : [],
      }),
    }),
  },
}

function buildInitialPreviewUrl() {
  const url = previewBaseUrl()
  url.searchParams.set('sdvPreview', '1')
  return url.toString()
}

export default defineConfig({
  name: 'default',
  title: 'sdv-site',

  projectId: 'mei3zxrq',
  dataset: 'production',

  plugins: [
    colorInput(),
    structureTool({structure}),
    presentationTool({
      previewUrl: {
        initial: buildInitialPreviewUrl(),
      },
      allowOrigins: ALLOW_ORIGINS,
      resolve: presentationResolve,
    }),
  ],

  releases: {
    enabled: false,
  },

  scheduledDrafts: {
    enabled: false,
  },

  document: {
    newDocumentOptions: (prev, context) => {
      if (context.creationContext.type === 'global') {
        return prev.filter((templateItem) => ALLOWED_NEW_TEMPLATES.has(templateItem.templateId))
      }
      return prev
    },
    actions: (prev, {schemaType}) => {
      if (schemaType === 'project') {
        return prev.map((original) =>
          original.action === 'delete' ? ProjectDeleteAction : original,
        )
      }
      return prev
    },
  },

  schema: {
    types: schemaTypes,
  },
})
