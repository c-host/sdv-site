import {defineField, defineType} from 'sanity'

export const infoType = defineType({
  name: 'info',
  title: 'Bio panel',
  type: 'document',
  fields: [
    defineField({
      name: 'body',
      title: 'Bio',
      description:
        'Enter starts a new paragraph (with space below). Shift+Enter adds a line break inside the same paragraph (no extra space). Use Presentation preview to confirm spacing on the live site.',
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
  ],
  preview: {
    prepare() {
      return {title: 'Bio panel'}
    },
  },
})
