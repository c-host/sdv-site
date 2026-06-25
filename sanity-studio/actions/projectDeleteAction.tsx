import {TrashIcon} from '@sanity/icons'
import {useCallback, useState} from 'react'
import {type DocumentActionComponent, useClient, useDocumentOperation} from 'sanity'
import {HOME_PAGE_DOC_ID} from '../schemaTypes/homePageType'

type HomeEntry = {
  _key?: string
  project?: {_ref?: string}
}

function entryReferencesProject(entry: HomeEntry | null | undefined, projectIds: Set<string>) {
  const ref = entry?.project?._ref
  return Boolean(ref && projectIds.has(ref))
}

export const ProjectDeleteAction: DocumentActionComponent = (props) => {
  const {id, type, onComplete} = props
  const {delete: deleteOp} = useDocumentOperation(id, type)
  const client = useClient({apiVersion: '2025-02-19'})
  const [isOpen, setIsOpen] = useState(false)
  const publishedId = id.replace(/^drafts\./, '')

  const unlinkAndDelete = useCallback(async () => {
    const homeIds = [HOME_PAGE_DOC_ID, `drafts.${HOME_PAGE_DOC_ID}`]
    const refs = new Set([publishedId, id, `drafts.${publishedId}`])
    const tx = client.transaction()

    for (const homeId of homeIds) {
      const doc = await client.getDocument(homeId)
      if (!doc || !Array.isArray(doc.entries)) continue
      const next = (doc.entries as HomeEntry[]).filter(
        (entry) => !entryReferencesProject(entry, refs),
      )
      if (next.length !== doc.entries.length) {
        tx.patch(homeId, {set: {entries: next}})
      }
    }

    const idsToDelete = new Set<string>()
    if (id.startsWith('drafts.')) idsToDelete.add(id)
    const published = await client.getDocument(publishedId)
    if (published) idsToDelete.add(publishedId)
    idsToDelete.forEach((docId) => tx.delete(docId))

    await tx.commit()
    onComplete()
  }, [client, id, onComplete, publishedId])

  return {
    label: 'Delete',
    icon: TrashIcon,
    tone: 'critical',
    disabled: deleteOp.disabled !== false,
    onHandle: () => setIsOpen(true),
    dialog: isOpen && {
      type: 'confirm' as const,
      tone: 'critical' as const,
      title: 'Delete project?',
      message:
        'This permanently deletes the project. If it appears on the home page, it will be removed from there automatically.',
      confirmButtonText: 'Delete project',
      onConfirm: async () => {
        try {
          await unlinkAndDelete()
        } finally {
          setIsOpen(false)
        }
      },
      onCancel: () => setIsOpen(false),
    },
  }
}
