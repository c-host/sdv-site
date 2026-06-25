import materialsCatalog from '../data/materials.json'

export function buildDefaultMaterialEntries() {
  return materialsCatalog.materials.map((m) => ({
    _type: 'materialEntry' as const,
    _key: m.key,
    key: m.key,
    label: m.label,
    icon: m.key,
  }))
}

export const DEFAULT_MATERIAL_ENTRIES = buildDefaultMaterialEntries()
