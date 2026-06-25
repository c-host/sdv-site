import {defineField, defineType} from 'sanity'

/** Web sans presets (loaded from Google Fonts on the site when selected). */
export const WEB_SANS_FONT_LIST = [
  {title: 'Inter', value: 'inter'},
  {title: 'Source Sans 3', value: 'source-sans-3'},
  {title: 'Open Sans', value: 'open-sans'},
  {title: 'Noto Sans', value: 'noto-sans'},
  {title: 'IBM Plex Sans', value: 'ibm-plex-sans'},
]

export const SYSTEM_FONT_LIST = [
  ...WEB_SANS_FONT_LIST,
  {title: 'System UI (sans-serif)', value: 'system-ui'},
  {title: 'Georgia (serif)', value: 'georgia'},
  {title: 'Times New Roman (serif)', value: 'times'},
  {title: 'Palatino (serif)', value: 'palatino'},
  {title: 'System monospace', value: 'mono'},
]

/** @deprecated Use SYSTEM_FONT_LIST — kept for siteTypography baseUi field. */
export const BASE_UI_FONT_LIST = SYSTEM_FONT_LIST

type FontRoleFieldOptions = {
  systemPresets?: Array<{title: string; value: string}>
  defaultPreset?: string
  fieldset?: string
  description?: string
}

const fontRoleObjectFields = (presets: Array<{title: string; value: string}>, defaultPreset: string) => [
  defineField({
    name: 'source',
    title: 'Source',
    type: 'string',
    initialValue: 'system',
    options: {
      list: [
        {title: 'System font stack', value: 'system'},
        {title: 'Font uploaded in Sanity', value: 'custom'},
      ],
      layout: 'radio',
    },
  }),
  defineField({
    name: 'systemPreset',
    title: 'System preset',
    type: 'string',
    initialValue: defaultPreset,
    options: {list: presets},
    hidden: ({parent}) => parent?.source !== 'system',
  }),
  defineField({
    name: 'fontRef',
    title: 'Uploaded font',
    type: 'reference',
    to: [{type: 'fontUpload'}],
    hidden: ({parent}) => parent?.source !== 'custom',
  }),
]

export const fontRoleType = defineType({
  name: 'fontRole',
  title: 'Font role',
  type: 'object',
  fields: fontRoleObjectFields(SYSTEM_FONT_LIST, 'inter'),
})

export function fontRoleField(
  name: string,
  title: string,
  description: string,
  roleOptions?: FontRoleFieldOptions,
) {
  const presets = roleOptions?.systemPresets ?? SYSTEM_FONT_LIST
  const defaultPreset = roleOptions?.defaultPreset ?? 'inter'
  const usesDefaultPresets = !roleOptions?.systemPresets && !roleOptions?.defaultPreset

  if (usesDefaultPresets) {
    return defineField({
      name,
      title,
      description: roleOptions?.description ?? description,
      type: 'fontRole',
      fieldset: roleOptions?.fieldset,
    })
  }

  return defineField({
    name,
    title,
    description: roleOptions?.description ?? description,
    type: 'object',
    fieldset: roleOptions?.fieldset,
    fields: fontRoleObjectFields(presets, defaultPreset),
  })
}
