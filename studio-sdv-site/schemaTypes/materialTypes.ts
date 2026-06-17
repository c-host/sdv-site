import {createElement} from 'react'
import {defineArrayMember, defineField, defineType} from 'sanity'
import {MaterialEntryPreviewMedia} from '../components/MaterialEntryPreviewMedia'
import {MaterialIconInput} from '../components/MaterialIconInput'
import {MaterialKeyInput} from '../components/MaterialKeyInput'
import {DEFAULT_MATERIAL_ENTRIES} from './materialDefaults'
import {MATERIAL_ICON_OPTIONS} from './materialIconOptions'

export const SITE_MATERIALS_DOC_ID = 'siteMaterials'

type MaterialEntryValue = {
  key?: string
}

export const siteMaterialsType = defineType({
  name: 'siteMaterials',
  title: 'Materials',
  type: 'document',
  initialValue: {
    entries: DEFAULT_MATERIAL_ENTRIES,
  },
  fields: [
    defineField({
      name: 'entries',
      title: 'Material types',
      description:
        'Define material types for the site. Edit display names and pick an icon for each. Projects choose from this list for home icons and project materials.',
      type: 'array',
      initialValue: DEFAULT_MATERIAL_ENTRIES,
      validation: (Rule) =>
        Rule.custom((entries) => {
          if (!Array.isArray(entries)) return true
          const keys = (entries as MaterialEntryValue[])
            .map((e) => (e?.key ? String(e.key) : ''))
            .filter(Boolean)
          const seen = new Set<string>()
          const dupes: string[] = []
          keys.forEach((k) => {
            if (seen.has(k)) dupes.push(k)
            seen.add(k)
          })
          return dupes.length ? `Duplicate IDs: ${[...new Set(dupes)].join(', ')}` : true
        }),
      of: [
        defineArrayMember({
          name: 'materialEntry',
          title: 'Material',
          type: 'object',
          fields: [
            defineField({
              name: 'key',
              title: 'ID',
              type: 'string',
              components: {
                input: MaterialKeyInput,
              },
              validation: (Rule) =>
                Rule.required().regex(
                  /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                  'Use lowercase letters, numbers, and hyphens only',
                ),
            }),
            defineField({
              name: 'label',
              title: 'Display name',
              type: 'string',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'icon',
              title: 'Icon',
              type: 'string',
              components: {
                input: MaterialIconInput,
              },
              validation: (Rule) => Rule.required(),
            }),
          ],
          preview: {
            select: {title: 'label', subtitle: 'key', icon: 'icon'},
            prepare({title, subtitle, icon}) {
              const iconLabel =
                MATERIAL_ICON_OPTIONS.find((o) => o.value === icon)?.title || icon || ''
              return {
                title: title || subtitle || 'Material',
                subtitle: [subtitle, iconLabel].filter(Boolean).join(' · '),
                media: createElement(MaterialEntryPreviewMedia, {icon}),
              }
            },
          },
        }),
      ],
    }),
  ],
  preview: {
    prepare() {
      return {title: 'Materials'}
    },
  },
})
