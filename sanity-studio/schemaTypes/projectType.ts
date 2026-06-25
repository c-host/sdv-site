import {defineField, defineType} from 'sanity'
import {fontRoleField} from './fontRole'
import {hexColorField} from './hexColorField'
import {materialKeyArrayField} from './materialOptions'
import {portableTextBlock} from './sharedPortableText'

type TimelinePanelValue = {
  isPublication?: boolean
}

export const projectType = defineType({
  name: 'project',
  title: 'Project',
  type: 'document',
  fieldsets: [
    {name: 'appearance', title: 'Appearance', options: {collapsible: true}},
    {name: 'titleTypography', title: 'Title typography', options: {collapsible: true, collapsed: true}},
    {name: 'overviewTypography', title: 'Overview typography', options: {collapsible: true, collapsed: true}},
    {name: 'timelineTypography', title: 'Timeline typography', options: {collapsible: true, collapsed: true}},
    {name: 'immersiveTypography', title: 'Immersive typography', options: {collapsible: true, collapsed: true}},
  ],
  fields: [
    defineField({
      name: 'header_title',
      title: 'Project title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    fontRoleField(
      'titleFont',
      'Title font',
      'Optional override for the project title and back link.',
      {fieldset: 'titleTypography'},
    ),
    defineField({
      name: 'slug',
      title: 'URL slug',
      description: 'Used in /project/your-slug/ and /immersive/your-slug/. Auto-generated from title.',
      type: 'slug',
      options: {
        source: 'header_title',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required(),
    }),
    hexColorField('backgroundColor', 'Project background color', {
      description: 'Optional background for the project overview page. Falls back to home/default.',
      fieldset: 'appearance',
    }),
    hexColorField('immersiveBackgroundColor', 'Immersive background color', {
      description: 'Optional background for the immersive viewer only. Falls back to project color.',
      fieldset: 'appearance',
    }),
    defineField(materialKeyArrayField(
      'home_materials',
      'Home and project materials',
      'Icons selected here are shown on the home page when this project is selected, and below the Material composition & elements list on the project page.',
    )),
    defineField({
      name: 'body',
      title: 'Overview',
      description:
        'Rich text editor with restricted formatting (bold, italic, strike, links, quotes, bulleted/numbered lists).',
      type: 'array',
      of: [portableTextBlock],
      validation: (Rule) => Rule.required(),
    }),
    fontRoleField(
      'overviewFont',
      'Overview font',
      'Optional override for the project overview body text.',
      {fieldset: 'overviewTypography'},
    ),
    defineField({
      name: 'materials',
      title: 'Material composition & elements',
      description:
        'Free-text list shown as bullets on the project page. Material icons below this list come from Home and project materials.',
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
      title: 'Timeline panels',
      description:
        'Each panel is a tab with its own images. At least one panel is required. Mark one as the publication tab to enable immersive view.',
      type: 'array',
      validation: (Rule) =>
        Rule.required()
          .min(1)
          .custom((falls) => {
            if (!Array.isArray(falls)) return true
            const pubCount = (falls as TimelinePanelValue[]).filter(
              (f) => f?.isPublication === true,
            ).length
            return pubCount <= 1 ? true : 'Only one timeline panel can be marked as the publication tab.'
          }),
      of: [
        defineField({
          name: 'fall',
          title: 'Timeline panel',
          type: 'object',
          fields: [
            defineField({
              name: 'label',
              title: 'Tab label',
              description:
                'Shown only on the timeline tab (not repeated below). Label "Publication" (any case) is also recognized as the publication tab when isPublication is not set.',
              type: 'string',
            }),
            defineField({
              name: 'isPublication',
              title: 'Publication tab',
              description:
                'Marks this panel as the publication tab. Enables the immersive magnifier and feeds immersive viewer images.',
              type: 'boolean',
              initialValue: false,
            }),
            defineField({
              name: 'type',
              title: 'Panel detail',
              description: 'Optional line shown only below the tabs (subtitle / context). Not shown in the tab.',
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
    fontRoleField(
      'tabFont',
      'Timeline tab font',
      'Optional override for timeline tab labels.',
      {fieldset: 'timelineTypography'},
    ),
    fontRoleField(
      'metaFont',
      'Panel detail font',
      'Optional override for the line below the timeline tabs.',
      {fieldset: 'timelineTypography'},
    ),
    fontRoleField(
      'immersiveNavFont',
      'Immersive nav font',
      'Optional override for immersive viewer navigation.',
      {fieldset: 'immersiveTypography'},
    ),
  ],
  preview: {
    select: {title: 'header_title', subtitle: 'slug.current'},
    prepare({title, subtitle}) {
      return {
        title: title || 'Untitled project',
        subtitle: subtitle ? `/${subtitle}` : 'Project',
      }
    },
  },
})
