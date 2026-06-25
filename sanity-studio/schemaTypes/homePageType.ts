import {defineField, defineType} from 'sanity'
import {fontRoleField} from './fontRole'
import {hexColorField} from './hexColorField'

export const HOME_PAGE_DOC_ID = 'homePageConfig'

export const homePageType = defineType({
  name: 'homePage',
  title: 'Home page',
  type: 'document',
  fieldsets: [
    {name: 'appearance', title: 'Appearance', options: {collapsible: true, collapsed: false}},
    {name: 'hero', title: 'Hero text', options: {collapsible: true}},
    {name: 'nav', title: 'Project navigation', options: {collapsible: true}},
  ],
  fields: [
    hexColorField('backgroundColor', 'Background color', {
      description: 'Optional site-wide home default. Project pages can override.',
      fieldset: 'appearance',
    }),
    defineField({
      name: 'heroLine1',
      title: 'Hero line 1',
      type: 'string',
      initialValue: 'STACEY',
      description: 'Shown as typed (no automatic capitals).',
      fieldset: 'hero',
    }),
    defineField({
      name: 'heroLine2',
      title: 'Hero line 2',
      type: 'string',
      initialValue: 'DE VOE',
      description: 'Shown as typed (no automatic capitals).',
      fieldset: 'hero',
    }),
    fontRoleField(
      'heroFont',
      'Hero font',
      'Optional override for the two hero name lines.',
      {fieldset: 'hero'},
    ),
    defineField({
      name: 'entries',
      title: 'Projects on home (order)',
      description:
        'Order defines carousel / nav order. Optional label overrides the project title. Removing a project here (or deleting it under Projects) takes it off the home page.',
      type: 'array',
      fieldset: 'nav',
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
    fontRoleField(
      'navFont',
      'Project nav font',
      'Optional override for project links on the home page.',
      {fieldset: 'nav'},
    ),
  ],
  preview: {
    prepare() {
      return {title: 'Home page'}
    },
  },
})
