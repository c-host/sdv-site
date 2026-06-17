import {Flex, Select, Stack, Text} from '@sanity/ui'
import {useEffect, useState} from 'react'
import {set, unset, useClient, type StringInputProps} from 'sanity'
import {MATERIAL_OPTIONS_FALLBACK} from '../schemaTypes/materialOptions'
import {SITE_MATERIALS_DOC_ID} from '../schemaTypes/materialTypes'
import {MaterialIconSvg} from './MaterialIconSvg'

type MaterialOption = {title: string; value: string; icon?: string}

export function MaterialKeySelect(props: StringInputProps) {
  const {value, onChange} = props
  const client = useClient({apiVersion: '2025-02-19'})
  const [options, setOptions] = useState<MaterialOption[]>(MATERIAL_OPTIONS_FALLBACK)

  useEffect(() => {
    let cancelled = false
    client
      .fetch<{entries?: Array<{key?: string; label?: string; icon?: string}>} | null>(
        `*[_id in ["${SITE_MATERIALS_DOC_ID}", "drafts.${SITE_MATERIALS_DOC_ID}"]][0]{entries[]{key, label, icon}}`,
      )
      .then((doc) => {
        if (cancelled) return
        const entries = doc && Array.isArray(doc.entries) ? doc.entries : []
        const list = entries
          .filter((e) => e && e.key)
          .map((e) => ({
            title: String(e.label || e.key).trim() || String(e.key),
            value: String(e.key),
            icon: e.icon ? String(e.icon) : String(e.key),
          }))
        if (list.length) setOptions(list)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [client])

  const current = typeof value === 'string' ? value : ''
  const currentOption = options.find((o) => o.value === current)

  return (
    <Stack space={3}>
      {currentOption ? (
        <Flex align="center" gap={2}>
          <MaterialIconSvg iconKey={currentOption.icon || currentOption.value} size={22} />
          <Text size={1}>{currentOption.title}</Text>
        </Flex>
      ) : null}
      <Select
        value={current}
        onChange={(event) => {
          const next = event.currentTarget.value
          onChange(next ? set(next) : unset())
        }}
      >
        <option value="">—</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.title}
          </option>
        ))}
      </Select>
    </Stack>
  )
}
