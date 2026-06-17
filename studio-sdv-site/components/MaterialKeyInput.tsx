import {Stack, Text, TextInput} from '@sanity/ui'
import {useEffect} from 'react'
import {set, type StringInputProps, useFormValue} from 'sanity'
import {slugifyMaterialKey} from '../lib/slugifyMaterialKey'

export function MaterialKeyInput(props: StringInputProps) {
  const {value, onChange, path} = props
  const parentPath = path.slice(0, -1)
  const label = useFormValue([...parentPath, 'label']) as string | undefined
  const current = typeof value === 'string' ? value.trim() : ''

  useEffect(() => {
    if (current) return
    const slug = slugifyMaterialKey(label || '')
    if (slug) onChange(set(slug))
  }, [current, label, onChange])

  if (current) {
    return (
      <Stack space={2}>
        <TextInput value={current} readOnly />
        <Text size={1} muted>
          Internal ID — set automatically from the display name and locked after creation. Projects
          reference this value.
        </Text>
      </Stack>
    )
  }

  return (
    <Text size={1} muted>
      ID will be generated from the display name when you enter one.
    </Text>
  )
}
