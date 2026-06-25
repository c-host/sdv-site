/** SVG paths for material icons (keep in sync with js/sdv-shared.js). */
export const MATERIAL_ICON_PATHS: Record<string, string> = {
  glass: '<path d="M6 3h12l-5 8v8l-2 2-2-2v-8L6 3z" />',
  metal: '<path d="M4 14l6-6 10 10-6 6L4 14z" /><path d="M9 9l6 6" />',
  textile:
    '<rect x="5" y="6" width="14" height="12" rx="1" /><path d="M8 6v12M12 6v12M16 6v12" />',
  synthetic:
    '<path d="M12 3c4 0 7 2.7 7 6.5 0 4.6-4.2 6.8-7 11.5-2.8-4.7-7-6.9-7-11.5C5 5.7 8 3 12 3z" /><path d="M9 10c1.2 1 2.2 1.5 3 1.5S13.8 11 15 10" />',
  archive:
    '<path d="M7 3h7l3 3v15H7V3z" /><path d="M14 3v4h4" /><path d="M9 11h6M9 15h6" />',
  av: '<path d="M4 10v4" /><path d="M7 8v8" /><path d="M10 6v12" /><path d="M14 8v8" /><path d="M17 10v4" /><path d="M20 11v2" />',
  performance:
    '<circle cx="12" cy="7" r="2" /><path d="M8 21l2-6 2-2 2 2 2 6" /><path d="M10 13l-2-2M14 13l2-2" />',
  objects: '<rect x="6" y="6" width="12" height="12" rx="1" /><path d="M9 10h6M9 14h6" />',
  paper:
    '<path d="M7 4h7l4 4v12H7V4z" /><path d="M14 4v4h4" /><path d="M9 12h6M9 16h4" />',
  wood: '<path d="M12 4c3 0 5 2 5 4.5S14 13 12 20c-2-7-5-9.5-5-11.5S9 4 12 4z" /><path d="M9 9h6M10 13h4" />',
  ceramic:
    '<path d="M8 8c0-2 1.8-4 4-4s4 2 4 4c0 2-1 3-1 5v5H9v-5c0-2-1-3-1-5z" /><path d="M9 18h6" />',
  stone: '<path d="M6 14l3-6 4 2 5-5 2 9H6z" />',
  photography:
    '<rect x="4" y="7" width="16" height="12" rx="2" /><circle cx="12" cy="13" r="3" /><path d="M8 7l2-2h4l2 2" />',
  print:
    '<rect x="5" y="5" width="14" height="14" rx="1" /><path d="M8 9h8M8 13h5" /><path d="M9 5V3M15 5V3" />',
  painting:
    '<path d="M12 3c3 0 5 2 5 4.5S14 12 12 20c-2-8-5-10.5-5-12.5S9 3 12 3z" /><circle cx="10" cy="8" r="1" /><circle cx="14" cy="10" r="1" /><circle cx="11" cy="12" r="1" />',
  sculpture:
    '<path d="M12 4c2 0 3 1.5 3 3s-1 3-3 3-3-1.5-3-3 1-3 3-3z" /><path d="M8 20h8l-1-8H9l-1 8z" /><path d="M7 20h10" />',
  installation:
    '<path d="M4 20V8l8-4 8 4v12" /><path d="M4 20h16" /><path d="M12 4v16" />',
  light:
    '<path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a6 6 0 0 0-3 11v3h6v-3a6 6 0 0 0-3-11z" />',
  sound:
    '<path d="M5 10v4h3l5 4V6l-5 4H5z" /><path d="M17 9a4 4 0 0 1 0 6" /><path d="M19 7a7 7 0 0 1 0 10" />',
  video:
    '<rect x="4" y="7" width="13" height="10" rx="1" /><path d="M17 10l4-2v8l-4-2" />',
  ink: '<path d="M12 3c2 0 3 1.5 3 3.5S12 14 12 21c0-7-3-10.5-3-14.5S10 3 12 3z" />',
  clay: '<path d="M6 16c0-4 2.7-8 6-8s6 4 6 8H6z" /><path d="M8 16h8" />',
  resin:
    '<path d="M9 3h6l2 4v11a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2V7l2-4z" /><path d="M9 12h6" />',
  botanical:
    '<path d="M12 21V11" /><path d="M12 11c-3-2-6-1-7 2s1 6 4 7c2-3 3-6 3-9z" /><path d="M12 11c3-2 6-1 7 2s-1 6-4 7c-2-3-3-6-3-9z" />',
  leather:
    '<path d="M6 8c0-2 2.7-4 6-4s6 2 6 4v9c0 2-2.7 4-6 4s-6-2-6-4V8z" /><path d="M8 10h8M9 14h6" />',
  wax: '<rect x="10" y="4" width="4" height="14" rx="1" /><path d="M9 20h6" /><path d="M12 4V2" />',
  digital:
    '<rect x="5" y="5" width="6" height="6" /><rect x="13" y="5" width="6" height="6" /><rect x="5" y="13" width="6" height="6" /><rect x="13" y="13" width="6" height="6" />',
  'mixed-media':
    '<circle cx="8" cy="8" r="3" /><rect x="13" y="6" width="6" height="6" /><path d="M6 16l4-3 3 2 5-4" />',
  'found-object':
    '<rect x="5" y="8" width="10" height="10" rx="1" /><circle cx="17" cy="9" r="4" /><path d="M15.5 10.5L17 12" />',
  thread:
    '<ellipse cx="12" cy="8" rx="5" ry="2" /><path d="M7 8v10M17 8v10" /><path d="M9 14h6" />',
  plaster: '<path d="M5 18l4-10h6l4 10H5z" /><path d="M8 14h8" />',
  steel: '<path d="M4 10h16M4 14h16M8 6v12M16 6v12" />',
  'textile-print':
    '<rect x="5" y="6" width="14" height="12" rx="1" /><path d="M8 10h2v2H8zM11 13h2v2h-2zM14 10h2v2h-2z" />',
}

export function materialIconInnerSvg(iconKey: string | undefined): string {
  const key = String(iconKey || '')
  return (
    MATERIAL_ICON_PATHS[key] ||
    '<circle cx="12" cy="12" r="8" /><path d="M8 12h8" />'
  )
}
