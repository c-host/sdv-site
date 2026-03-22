import {defineField, defineType} from 'sanity'

export const captionsType = defineType({
  name: 'captions',
  title: 'Captions',
  type: 'document',
  fields: [
    defineField({
      name: 'items',
      title: 'Captions',
      type: 'array',
      of: [
        defineField({
          name: 'item',
          title: 'Caption Item',
          type: 'object',
          fields: [
            defineField({
              name: 'project',
              title: 'Project',
              type: 'string',
              options: {
                list: [
                  {title: 'The Spontaneous Dance Falls', value: 'the-spontaneous-dance-falls'},
                  {title: "Under the Needle's Eye", value: 'under-the-needles-eye'},
                  {title: 'Overlocked', value: 'overlocked'},
                ],
              },
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'text',
              title: 'Text',
              type: 'string',
              validation: (Rule) => Rule.required(),
            }),
          ],
          preview: {
            select: {title: 'text', subtitle: 'project'},
          },
        }),
      ],
    }),
  ],
  preview: {
    prepare() {
      return {title: 'Captions'}
    },
  },
})
