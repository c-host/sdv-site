import {defineField, defineType} from 'sanity'

export const SITE_TYPOGRAPHY_DOC_ID = 'siteTypography'

const SYSTEM_FONT_LIST = [
  {title: 'System UI (sans-serif)', value: 'system-ui'},
  {title: 'Georgia (serif)', value: 'georgia'},
  {title: 'Times New Roman (serif)', value: 'times'},
  {title: 'Palatino (serif)', value: 'palatino'},
  {title: 'System monospace', value: 'mono'},
]

function fontRoleField(
  name: string,
  title: string,
  description: string,
) {
  return defineField({
    name,
    title,
    description,
    type: 'object',
    fields: [
      defineField({
        name: 'source',
        title: 'Source',
        type: 'string',
        initialValue: 'system',
        options: {
          list: [
            {title: 'System font stack', value: 'system'},
            {title: 'Font uploaded in Sanity', value: 'custom'},
          ],
          layout: 'radio',
        },
      }),
      defineField({
        name: 'systemPreset',
        title: 'System preset',
        type: 'string',
        initialValue: 'system-ui',
        options: {list: SYSTEM_FONT_LIST},
        hidden: ({parent}) => parent?.source !== 'system',
      }),
      defineField({
        name: 'fontRef',
        title: 'Uploaded font',
        type: 'reference',
        to: [{type: 'fontUpload'}],
        hidden: ({parent}) => parent?.source !== 'custom',
      }),
    ],
  })
}

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
  fields: [
    fontRoleField(
      'baseUi',
      'Base UI',
      'Default sans stack for the page (body, chrome).',
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
    fontRoleField(
      'accent',
      'Accent / display',
      'Captions in abstraction mode, display moments.',
    ),
  ],
  preview: {
    prepare() {
      return {title: 'Site typography'}
    },
  },
})
