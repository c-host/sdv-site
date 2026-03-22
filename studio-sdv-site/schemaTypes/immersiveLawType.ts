import {defineField, defineType} from 'sanity'
import {lawPortableTextBlock} from './sharedPortableText'

export const IMMERSIVE_LAW_DOC_ID = 'immersiveLawDance'

export const immersiveLawType = defineType({
  name: 'immersiveLaw',
  title: 'Immersive — Dance Falls (law)',
  type: 'document',
  fields: [
    defineField({
      name: 'heading',
      title: 'Heading',
      description: 'Shown above the body (e.g. permit title).',
      type: 'string',
    }),
    defineField({
      name: 'body',
      title: 'Body',
      description:
        'Continuous text. Select words to mark as a law fragment, then add the Law fragment + image annotation and choose an image.',
      type: 'array',
      of: [lawPortableTextBlock],
    }),
  ],
  preview: {
    prepare() {
      return {title: 'Dance Falls — immersive law'}
    },
  },
})
