import {defineField, defineType} from 'sanity'
import {BASE_UI_FONT_LIST, fontRoleField, fontRoleType, SYSTEM_FONT_LIST} from './fontRole'

export const SITE_TYPOGRAPHY_DOC_ID = 'siteTypography'

export {fontRoleField, fontRoleType}

export const fontUploadType = defineType({
  name: 'fontUpload',
  title: 'Font file',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      description: 'Editor-facing label (e.g. “Grotta Medium”).',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'cssFamily',
      title: 'CSS font-family name',
      description: 'Exact name used in CSS, e.g. Grotta Medium. Use letters, numbers, spaces.',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'fontWeight',
      title: 'Font weight',
      type: 'number',
      initialValue: 400,
      validation: (Rule) => Rule.min(100).max(900).integer(),
    }),
    defineField({
      name: 'fontStyle',
      title: 'Font style',
      type: 'string',
      initialValue: 'normal',
      options: {
        list: [
          {title: 'Normal', value: 'normal'},
          {title: 'Italic', value: 'italic'},
        ],
      },
    }),
    defineField({
      name: 'fontFile',
      title: 'Font file',
      description: 'Prefer WOFF2 for the web; OTF/TTF also work.',
      type: 'file',
      options: {
        accept: '.woff2,.woff,.otf,.ttf',
      },
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: {title: 'title', subtitle: 'cssFamily'},
  },
})

export const siteTypographyType = defineType({
  name: 'siteTypography',
  title: 'Typography',
  type: 'document',
  description:
    'Site-wide default fonts. These apply everywhere unless a page provides an optional override: Home (hero, project nav), each Project (title, overview, timeline, immersive nav), and Bio panel (bio & CV). Change a default here first; use overrides only when one page needs a different font.',
  fields: [
    fontRoleField(
      'baseUi',
      'Base UI',
      'Chrome and controls (buttons, labels, UI chrome). Choose Inter, Source Sans 3, IBM Plex Sans, Open Sans, or Noto Sans for the same font on every device. System UI uses each visitor’s operating-system interface font instead, so it can look different on Mac, Windows, and Linux.',
      {systemPresets: BASE_UI_FONT_LIST, defaultPreset: 'inter'},
    ),
    fontRoleField(
      'prose',
      'Prose / paragraphs',
      'Main reading text (project body, descriptions).',
    ),
    fontRoleField(
      'strongUi',
      'Headings & strong UI',
      'Nav labels, section titles, timeline, buttons.',
    ),
    fontRoleField(
      'lightUi',
      'Light emphasis',
      'Lighter subheads or de-emphasized UI where used.',
    ),
  ],
  preview: {
    prepare() {
      return {title: 'Site typography'}
    },
  },
})
