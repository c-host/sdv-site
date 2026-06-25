import {defineField, defineType} from 'sanity'
import {fontRoleField} from './fontRole'

const portableTextBlock = defineField({
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
})

export const infoType = defineType({
  name: 'info',
  title: 'Bio panel',
  type: 'document',
  fieldsets: [
    {name: 'bio', title: 'Bio', options: {collapsible: false}},
    {name: 'cv', title: 'CV', options: {collapsible: true}},
    {name: 'bioTypography', title: 'Bio typography', options: {collapsible: true, collapsed: true}},
    {name: 'cvTypography', title: 'CV typography', options: {collapsible: true, collapsed: true}},
  ],
  fields: [
    defineField({
      name: 'bio',
      title: 'Bio',
      description:
        'Enter starts a new paragraph (with space below). Shift+Enter adds a line break inside the same paragraph (no extra space). Use Presentation preview to confirm spacing on the live site.',
      type: 'array',
      of: [portableTextBlock],
      fieldset: 'bio',
      validation: (Rule) => Rule.required(),
    }),
    fontRoleField(
      'bioFont',
      'Bio font',
      'Optional override for the Bio section.',
      {fieldset: 'bioTypography'},
    ),
    defineField({
      name: 'cv',
      title: 'CV',
      description: 'Optional curriculum vitae content shown below Bio in the INFO panel.',
      type: 'array',
      of: [portableTextBlock],
      fieldset: 'cv',
    }),
    fontRoleField(
      'cvFont',
      'CV font',
      'Optional override for the CV section.',
      {fieldset: 'cvTypography'},
    ),
  ],
  preview: {
    prepare() {
      return {title: 'Bio panel'}
    },
  },
})
