import {Box} from '@sanity/ui'
import {MaterialIconSvg} from './MaterialIconSvg'

type Props = {
  icon?: string
}

export function MaterialEntryPreviewMedia({icon}: Props) {
  if (!icon) return null
  return (
    <Box padding={1} style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <MaterialIconSvg iconKey={icon} size={24} />
    </Box>
  )
}
