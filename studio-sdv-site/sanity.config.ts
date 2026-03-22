import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {
  defineDocuments,
  defineLocations,
  presentationTool,
  type PresentationPluginOptions,
} from 'sanity/presentation'
import {HOME_PAGE_DOC_ID} from './schemaTypes/homePageType'
import {IMMERSIVE_LAW_DOC_ID} from './schemaTypes/immersiveLawType'
import {IMMERSIVE_NEEDLE_DOC_ID} from './schemaTypes/immersiveNeedleType'
import {schemaTypes} from './schemaTypes'
import {structure} from './structure'

/** Strip drafts. prefix so location resolvers match both published and draft panes. */
function publishedId(id: string | undefined) {
  return id?.replace(/^drafts\./, '') || ''
}

const ALLOWED_NEW_TEMPLATES = new Set(['sanity.imageAsset', 'sanity.fileAsset'])
/** Netlify CLI often serves on :8888; include common dev ports so Presentation can connect. */
const FALLBACK_ORIGINS = [
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'http://127.0.0.1:8888',
  'http://localhost:8888',
]
const PREVIEW_ORIGINS = String(process.env.SANITY_STUDIO_PREVIEW_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const PREVIEW_ORIGIN =
  process.env.SANITY_STUDIO_PREVIEW_ORIGIN || PREVIEW_ORIGINS[0] || FALLBACK_ORIGINS[0]
const PREVIEW_TOKEN = process.env.SANITY_STUDIO_PREVIEW_DRAFT_TOKEN || ''
const ALLOW_ORIGINS = Array.from(
  new Set(PREVIEW_ORIGINS.concat(FALLBACK_ORIGINS).concat(['http://127.0.0.1:*', 'http://localhost:*'])),
)

const presentationResolve: PresentationPluginOptions['resolve'] = {
  mainDocuments: defineDocuments([
    {
      route: '/',
      filter: `(_type == "homePage" && (_id == "${HOME_PAGE_DOC_ID}" || _id == "drafts.${HOME_PAGE_DOC_ID}"))`,
    },
    {
      route: '/info',
      filter: `(_type == "info" && (_id == "infoPage" || _id == "drafts.infoPage"))`,
    },
    {
      route: '/info/',
      filter: `(_type == "info" && (_id == "infoPage" || _id == "drafts.infoPage"))`,
    },
    {
      route: '/immersive/the-spontaneous-dance-falls',
      filter: `(_type == "immersiveLaw" && (_id == "${IMMERSIVE_LAW_DOC_ID}" || _id == "drafts.${IMMERSIVE_LAW_DOC_ID}"))`,
    },
    {
      route: '/immersive/the-spontaneous-dance-falls/',
      filter: `(_type == "immersiveLaw" && (_id == "${IMMERSIVE_LAW_DOC_ID}" || _id == "drafts.${IMMERSIVE_LAW_DOC_ID}"))`,
    },
    {
      route: '/immersive/under-the-needles-eye',
      filter: `(_type == "immersiveNeedle" && (_id == "${IMMERSIVE_NEEDLE_DOC_ID}" || _id == "drafts.${IMMERSIVE_NEEDLE_DOC_ID}"))`,
    },
    {
      route: '/immersive/under-the-needles-eye/',
      filter: `(_type == "immersiveNeedle" && (_id == "${IMMERSIVE_NEEDLE_DOC_ID}" || _id == "drafts.${IMMERSIVE_NEEDLE_DOC_ID}"))`,
    },
    {
      route: '/immersive/overlocked',
      filter: `_type == "project" && slug == "overlocked"`,
    },
    {
      route: '/immersive/overlocked/',
      filter: `_type == "project" && slug == "overlocked"`,
    },
    {
      route: '/project/:slug',
      filter: ({params}) => `_type == "project" && slug == $slug`,
      params: ({params}) => ({slug: params.slug || ''}),
    },
    {
      route: '/project/:slug/',
      filter: ({params}) => `_type == "project" && slug == $slug`,
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
          publishedId(doc?._id) === 'infoPage' ? [{title: 'Info page', href: '/info/'}] : [],
      }),
    }),
    project: defineLocations({
      select: {
        title: 'header_title',
        slug: 'slug',
      },
      resolve: (doc) => {
        const slug = doc?.slug
        if (!slug) return {locations: []}
        // `title` comes from select mapping to `header_title`
        return {
          locations: [
            {title: doc?.title || slug, href: `/project/${slug}/`},
            {title: `${doc?.title || slug} — immersive`, href: `/immersive/${slug}/`},
          ],
        }
      },
    }),
    captions: defineLocations({
      select: {
        _id: '_id',
      },
      resolve: (doc) => ({
        locations:
          publishedId(doc?._id) === 'captionsConfig'
            ? [{title: "Under the Needle's Eye immersive", href: '/immersive/under-the-needles-eye/'}]
            : [],
      }),
    }),
    homePage: defineLocations({
      select: {_id: '_id'},
      resolve: (doc) => ({
        locations:
          publishedId(doc?._id) === HOME_PAGE_DOC_ID ? [{title: 'Home', href: '/'}] : [],
      }),
    }),
    immersiveLaw: defineLocations({
      select: {_id: '_id'},
      resolve: (doc) => ({
        locations:
          publishedId(doc?._id) === IMMERSIVE_LAW_DOC_ID
            ? [{title: 'Dance Falls immersive', href: '/immersive/the-spontaneous-dance-falls/'}]
            : [],
      }),
    }),
    immersiveNeedle: defineLocations({
      select: {_id: '_id'},
      resolve: (doc) => ({
        locations:
          publishedId(doc?._id) === IMMERSIVE_NEEDLE_DOC_ID
            ? [{title: 'Needle immersive', href: '/immersive/under-the-needles-eye/'}]
            : [],
      }),
    }),
  },
}

function buildInitialPreviewUrl() {
  const url = new URL('/', PREVIEW_ORIGIN)
  url.searchParams.set('sdvPreview', '1')
  if (PREVIEW_TOKEN) {
    url.searchParams.set('sdvDraftToken', PREVIEW_TOKEN)
  }
  return url.toString()
}

export default defineConfig({
  name: 'default',
  title: 'sdv-site',

  projectId: 'mei3zxrq',
  dataset: 'production',

  plugins: [
    structureTool({structure}),
    presentationTool({
      previewUrl: {
        initial: buildInitialPreviewUrl(),
      },
      allowOrigins: ALLOW_ORIGINS,
      resolve: presentationResolve,
    }),
    visionTool(),
  ],

  document: {
    newDocumentOptions: (prev, context) => {
      if (context.creationContext.type === 'global') {
        return prev.filter((templateItem) => ALLOWED_NEW_TEMPLATES.has(templateItem.templateId))
      }
      return prev
    },
  },

  schema: {
    types: schemaTypes,
  },
})
