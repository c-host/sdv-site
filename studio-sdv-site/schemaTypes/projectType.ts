import {defineField, defineType} from 'sanity'
import {portableTextBlock} from './sharedPortableText'

const PROJECT_SLUG_OPTIONS = [
  {title: 'The Spontaneous Dance Falls', value: 'the-spontaneous-dance-falls'},
  {title: "Under the Needle's Eye", value: 'under-the-needles-eye'},
  {title: 'Overlocked', value: 'overlocked'},
]

export const projectType = defineType({
  name: 'project',
  title: 'Project',
  type: 'document',
  fields: [
    defineField({
      name: 'slug',
      title: 'Project Slug',
      type: 'string',
      options: {list: PROJECT_SLUG_OPTIONS},
      readOnly: true,
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'immersive_enabled',
      title: 'Enable immersive link',
      type: 'boolean',
      initialValue: true,
    }),
    defineField({
      name: 'home_materials',
      title: 'Home materials',
      type: 'array',
      of: [{type: 'string'}],
      options: {
        list: ['A/V', 'Archive', 'Glass', 'Metal', 'Objects', 'Performance', 'Synthetic', 'Textile'],
      },
    }),
    defineField({
      name: 'header_title',
      title: 'Project title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'homeLineColor',
      title: 'Home line color',
      description:
        'Hex color for the home crosshair and center frame when this project is selected (e.g. #7e7777). Used when no color is set on the home page entry.',
      type: 'string',
      validation: (Rule) =>
        Rule.custom((val) => {
          if (val == null || !String(val).trim()) return true
          return /^#[0-9A-Fa-f]{6}$/.test(String(val).trim()) ? true : 'Use #RRGGBB'
        }),
    }),
    defineField({
      name: 'body',
      title: 'Overview',
      description:
        'Rich text editor with restricted formatting (bold, italic, strike, links, quotes, bulleted/numbered lists).',
      type: 'array',
      of: [portableTextBlock],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'materials',
      title: 'Materials',
      type: 'array',
      of: [{type: 'string'}],
    }),
    defineField({
      name: 'links',
      title: 'Links',
      type: 'array',
      of: [
        defineField({
          name: 'item',
          title: 'Link Item',
          type: 'object',
          fields: [
            defineField({name: 'label', title: 'Label', type: 'string'}),
            defineField({name: 'url', title: 'URL', type: 'url'}),
          ],
          preview: {select: {title: 'label', subtitle: 'url'}},
        }),
      ],
    }),
    defineField({
      name: 'falls',
      title: 'Falls (timeline panels)',
      type: 'array',
      of: [
        defineField({
          name: 'fall',
          title: 'Fall',
          type: 'object',
          fields: [
            defineField({name: 'label', title: 'Label', type: 'string'}),
            defineField({name: 'type', title: 'Type', type: 'string'}),
            defineField({
              name: 'details',
              title: 'Details (tooltip)',
              description: 'Optional extra line used as the native tooltip on the timeline.',
              type: 'string',
            }),
            defineField({
              name: 'images',
              title: 'Images',
              type: 'array',
              of: [{type: 'image', options: {hotspot: false}}],
            }),
          ],
          preview: {
            select: {title: 'label', subtitle: 'type'},
          },
        }),
      ],
    }),
    defineField({
      name: 'gallery',
      title: 'Gallery images',
      type: 'array',
      of: [{type: 'image', options: {hotspot: false}}],
    }),
  ],
  preview: {
    select: {title: 'header_title', subtitle: 'slug'},
    prepare({title, subtitle}) {
      return {
        title: title || 'Untitled project',
        subtitle: subtitle ? `/${subtitle}` : 'Project',
      }
    },
  },
})
