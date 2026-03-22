import {defineField, defineType} from 'sanity'

export const infoType = defineType({
  name: 'info',
  title: 'Info Page',
  type: 'document',
  fields: [
    defineField({
      name: 'body',
      title: 'Bio',
      description:
        'Rich text editor with restricted formatting (bold, italic, strike, links, quotes, bulleted/numbered lists).',
      type: 'array',
      of: [
        defineField({
          name: 'block',
          type: 'block',
          styles: [
            {title: 'Normal', value: 'normal'},
            {title: 'Heading 2', value: 'h2'},
            {title: 'Heading 3', value: 'h3'},
            {title: 'Quote', value: 'blockquote'},
          ],
          lists: [
            {title: 'Bullet', value: 'bullet'},
            {title: 'Numbered', value: 'number'},
          ],
          marks: {
            decorators: [
              {title: 'Bold', value: 'strong'},
              {title: 'Italic', value: 'em'},
              {title: 'Strike', value: 'strike-through'},
            ],
            annotations: [
              {
                name: 'link',
                title: 'Link',
                type: 'object',
                fields: [
                  defineField({
                    name: 'href',
                    title: 'URL',
                    type: 'url',
                    validation: (Rule) => Rule.uri({allowRelative: false, scheme: ['http', 'https']}),
                  }),
                ],
              },
            ],
          },
        }),
      ],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'press',
      title: 'Press',
      type: 'array',
      of: [
        defineField({
          name: 'item',
          title: 'Press Item',
          type: 'object',
          fields: [
            defineField({
              name: 'title',
              title: 'Title',
              type: 'string',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'url',
              title: 'URL',
              type: 'url',
            }),
            defineField({
              name: 'description',
              title: 'Description',
              type: 'text',
              rows: 3,
            }),
          ],
          preview: {
            select: {title: 'title', subtitle: 'url'},
          },
        }),
      ],
    }),
    defineField({
      name: 'cv',
      title: 'CV',
      type: 'object',
      fields: [
        defineField({
          name: 'label',
          title: 'Link Label',
          type: 'string',
        }),
        defineField({
          name: 'file',
          title: 'PDF File',
          type: 'file',
          options: {accept: '.pdf'},
        }),
        defineField({
          name: 'url',
          title: 'URL (Optional)',
          type: 'url',
        }),
      ],
    }),
  ],
  preview: {
    prepare() {
      return {title: 'Info Page'}
    },
  },
})
