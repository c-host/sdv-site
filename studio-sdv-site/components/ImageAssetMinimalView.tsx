import {Box, Button, Card, Code, Dialog, Flex, Stack, Text} from '@sanity/ui'
import {useEffect, useMemo, useState} from 'react'
import {IntentLink} from 'sanity/router'
import {type SanityDocumentLike, useClient} from 'sanity'

type Props = {
  options?: {
    documentId?: string
    documentType?: string
  }
}

type ImageAssetDoc = SanityDocumentLike & {
  originalFilename?: string
}

type ImageUsage = {
  _id: string
  _type: string
  label: string
  detail?: string
}

const USAGES_QUERY = `
  *[
    _type != "sanity.imageAsset" &&
    references($id) &&
    !(_id in path("drafts.**"))
  ]{
    _id,
    _type,
    "label": select(
      _type == "project" => coalesce(header_title, "Project"),
      _type == "info" => "Bio panel",
      _type == "homePage" => "Home page",
      _type == "siteTypography" => "Typography",
      _type == "siteMaterials" => "Materials",
      _type == "fontUpload" => coalesce(title, "Font file"),
      coalesce(title, header_title, _type)
    ),
    "detail": select(
      _type == "project" => array::join(
        falls[count(images[asset._ref == $id]) > 0].label,
        ", "
      )
    )
  } | order(label asc)
`

export function ImageAssetMinimalView(props: Props) {
  const documentId = props?.options?.documentId || ''
  const client = useClient({apiVersion: '2025-02-19'})
  const [doc, setDoc] = useState<ImageAssetDoc | null>(null)
  const [usages, setUsages] = useState<ImageUsage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const id = useMemo(() => (documentId || '').replace(/^drafts\./, ''), [documentId])

  useEffect(() => {
    let alive = true
    setError('')
    setDoc(null)
    setUsages([])
    setConfirmOpen(false)
    setIsDeleting(false)

    if (!id) {
      setLoading(false)
      return
    }

    setLoading(true)

    Promise.all([
      client.getDocument(id),
      client.fetch<ImageUsage[]>(USAGES_QUERY, {id}),
    ])
      .then(([asset, refs]) => {
        if (!alive) return
        setDoc((asset as ImageAssetDoc) || null)
        setUsages(Array.isArray(refs) ? refs : [])
      })
      .catch((e) => {
        if (!alive) return
        setError(String(e?.message || e || 'Failed to load image'))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [client, id])

  const filename = (doc?.originalFilename || '').trim()
  const missing = !loading && !error && id && !doc

  return (
    <Box padding={4}>
      <Stack space={4}>
        <Card padding={4} radius={2} shadow={1}>
          <Stack space={3}>
            <Text size={2} weight="semibold">
              Image library (uploaded)
            </Text>
            <Text size={1} muted>
              Upload images inside the relevant project (Projects → Timeline panels → Images). Use
              this library to see what is already uploaded and where it is used.
            </Text>
            <Text size={1} muted>
              Deleting an image here removes it from Sanity. Any project using it will show a broken
              image until a replacement is uploaded.
            </Text>
          </Stack>
        </Card>

        <Card padding={4} radius={2} shadow={1}>
          <Stack space={3}>
            <Flex align="center" justify="space-between" gap={3}>
              <Text size={1} muted>
                Original file name
              </Text>
              <Button
                tone="critical"
                text={isDeleting ? 'Deleting…' : 'Delete image'}
                disabled={!id || loading || isDeleting || Boolean(missing)}
                onClick={() => setConfirmOpen(true)}
              />
            </Flex>
            {error ? (
              <Text size={1} style={{color: 'var(--card-fg-color)'}}>
                {error}
              </Text>
            ) : loading ? (
              <Text size={1} muted>
                Loading…
              </Text>
            ) : missing ? (
              <Text size={1} muted>
                Image not found (it may have been deleted).
              </Text>
            ) : filename ? (
              <Code size={2}>{filename}</Code>
            ) : (
              <Text size={1} muted>
                (no file name)
              </Text>
            )}
          </Stack>
        </Card>

        <Card padding={4} radius={2} shadow={1}>
          <Stack space={3}>
            <Text size={1} muted>
              Used in
            </Text>
            {loading ? (
              <Text size={1} muted>
                Loading…
              </Text>
            ) : usages.length === 0 ? (
              <Text size={1} muted>
                Not used in any content yet.
              </Text>
            ) : (
              <Stack space={2}>
                {usages.map((usage) => (
                  <Box key={usage._id}>
                    <IntentLink
                      intent="edit"
                      params={{id: usage._id, type: usage._type}}
                      style={{textDecoration: 'none'}}
                    >
                      <Text size={1} style={{color: 'var(--card-link-color)'}}>
                        {usage.label}
                        {usage.detail ? ` — ${usage.detail}` : ''}
                      </Text>
                    </IntentLink>
                  </Box>
                ))}
              </Stack>
            )}
          </Stack>
        </Card>
      </Stack>

      {confirmOpen ? (
        <Dialog
          header="Delete image?"
          id="delete-image-asset"
          onClose={() => setConfirmOpen(false)}
          width={1}
          footer={
            <Flex justify="flex-end" gap={2} padding={3}>
              <Button text="Cancel" mode="ghost" onClick={() => setConfirmOpen(false)} />
              <Button
                tone="critical"
                text={isDeleting ? 'Deleting…' : 'Delete'}
                disabled={isDeleting || !id}
                onClick={async () => {
                  if (!id) return
                  setIsDeleting(true)
                  setError('')
                  try {
                    await client.delete(id)
                    setDoc(null)
                    setUsages([])
                    setConfirmOpen(false)
                  } catch (e: unknown) {
                    setError(
                      e instanceof Error ? e.message : String(e || 'Failed to delete image'),
                    )
                  } finally {
                    setIsDeleting(false)
                  }
                }}
              />
            </Flex>
          }
        >
          <Stack space={3} padding={4}>
            <Text size={1}>This permanently deletes the uploaded image from Sanity.</Text>
            {filename ? (
              <Text size={1} muted>
                File: <Code size={1}>{filename}</Code>
              </Text>
            ) : null}
            {usages.length > 0 ? (
              <Stack space={2}>
                <Text size={1} weight="semibold">
                  Currently used in:
                </Text>
                {usages.map((usage) => (
                  <Text key={usage._id} size={1} muted>
                    {usage.label}
                    {usage.detail ? ` — ${usage.detail}` : ''}
                  </Text>
                ))}
              </Stack>
            ) : null}
          </Stack>
        </Dialog>
      ) : null}
    </Box>
  )
}
