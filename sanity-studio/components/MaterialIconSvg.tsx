import {materialIconInnerSvg} from '../lib/materialIconPaths'

type Props = {
  iconKey?: string
  size?: number
  stroke?: string
  strokeWidth?: number
}

export function MaterialIconSvg({
  iconKey,
  size = 24,
  stroke = 'currentColor',
  strokeWidth = 1.5,
}: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{__html: materialIconInnerSvg(iconKey)}}
    />
  )
}
