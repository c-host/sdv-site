import {defineArrayMember} from 'sanity'
import {MaterialKeySelect} from '../components/MaterialKeySelect'
import materialsCatalog from '../data/materials.json'

export const MATERIAL_OPTIONS_FALLBACK = materialsCatalog.materials.map((m) => ({
  title: m.label,
  value: m.key,
}))

export function materialKeyArrayField(name: string, title: string, description: string) {
  return {
    name,
    title,
    description,
    type: 'array' as const,
    of: [
      defineArrayMember({
        type: 'string',
        components: {
          input: MaterialKeySelect,
        },
      }),
    ],
  }
}
