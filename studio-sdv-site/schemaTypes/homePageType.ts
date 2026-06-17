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
      description: 'Order defines carousel / nav order. Optional label overrides the project title. Removing a project here (or deleting it under Projects) takes it off the home page.',
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
          ],
          preview: {
            select: {label: 'navLabel', projectTitle: 'project.title'},
            prepare({label, projectTitle}: {label?: string; projectTitle?: string}) {
              return {title: label || projectTitle || 'Home entry'}
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
