import {defineField, defineType} from 'sanity'

export const HOME_PAGE_DOC_ID = 'homePageConfig'

export const homePageType = defineType({
  name: 'homePage',
  title: 'Home page',
  type: 'document',
  fields: [
    defineField({
      name: 'entries',
      title: 'Projects on home (order)',
      description: 'Order defines carousel / nav order. Optional label and splash override the project defaults.',
      type: 'array',
      of: [
        defineField({
          name: 'homeEntry',
          title: 'Entry',
          type: 'object',
          fields: [
            defineField({
              name: 'project',
              title: 'Project',
              type: 'reference',
              to: [{type: 'project'}],
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'navLabel',
              title: 'Nav label override',
              description: 'Leave empty to use the project title.',
              type: 'string',
            }),
            defineField({
              name: 'splashImage',
              title: 'Splash image override',
              description: 'Leave empty if you rely on a default asset elsewhere.',
              type: 'image',
              options: {hotspot: false},
            }),
          ],
          preview: {
            select: {label: 'navLabel', media: 'splashImage'},
            prepare({label}: {label?: string}) {
              return {title: label || 'Home entry'}
            },
          },
        }),
      ],
    }),
  ],
  preview: {
    prepare() {
      return {title: 'Home page'}
    },
  },
})
