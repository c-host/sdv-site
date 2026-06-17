import {Box, Card, Flex, Grid, Stack, Text} from '@sanity/ui'
import {useCallback} from 'react'
import {set, unset, type StringInputProps} from 'sanity'
import {MATERIAL_ICON_OPTIONS} from '../schemaTypes/materialIconOptions'
import {MaterialIconSvg} from './MaterialIconSvg'

export function MaterialIconInput(props: StringInputProps) {
  const {value, onChange} = props
  const current = typeof value === 'string' ? value : ''

  const select = useCallback(
    (iconKey: string) => {
      onChange(iconKey ? set(iconKey) : unset())
    },
    [onChange],
  )

  return (
    <Stack space={3}>
      {current ? (
        <Flex align="center" gap={3}>
          <Box padding={2}>
            <MaterialIconSvg iconKey={current} size={32} />
          </Box>
          <Text size={1} muted>
            Selected: {MATERIAL_ICON_OPTIONS.find((o) => o.value === current)?.title || current}
          </Text>
        </Flex>
      ) : (
        <Text size={1} muted>
          Choose an icon below
        </Text>
      )}
      <Grid columns={[4, 5, 6, 7]} gap={2}>
        {MATERIAL_ICON_OPTIONS.map((option) => {
          const selected = current === option.value
          return (
            <Card
              key={option.value}
              as="button"
              type="button"
              padding={2}
              radius={2}
              tone={selected ? 'primary' : 'default'}
              selected={selected}
              onClick={() => select(option.value)}
              style={{cursor: 'pointer', textAlign: 'center'}}
            >
              <Stack space={2}>
                <Flex justify="center">
                  <MaterialIconSvg iconKey={option.value} size={28} />
                </Flex>
                <Text size={0} muted>
                  {option.title}
                </Text>
              </Stack>
            </Card>
          )
        })}
      </Grid>
    </Stack>
  )
}
