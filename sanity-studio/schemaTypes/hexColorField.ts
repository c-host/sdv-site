import {defineField} from 'sanity'

type HexColorFieldOptions = {
  description?: string
  fieldset?: string
}

/** Optional background color with Sanity color picker (stored as a color object). */
export function hexColorField(name: string, title: string, options?: HexColorFieldOptions) {
  return defineField({
    name,
    title,
    description: options?.description,
    type: 'color',
    fieldset: options?.fieldset,
    options: {
      disableAlpha: true,
    },
  })
}
