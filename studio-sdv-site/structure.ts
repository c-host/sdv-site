import type {StructureResolver} from 'sanity/structure'
import {HOME_PAGE_DOC_ID} from './schemaTypes/homePageType'
import {IMMERSIVE_LAW_DOC_ID} from './schemaTypes/immersiveLawType'
import {IMMERSIVE_NEEDLE_DOC_ID} from './schemaTypes/immersiveNeedleType'
import {SITE_TYPOGRAPHY_DOC_ID} from './schemaTypes/typographyTypes'

const INFO_DOC_ID = 'infoPage'
const CAPTIONS_DOC_ID = 'captionsConfig'

const FIXED_PROJECTS = [
  {id: 'project-the-spontaneous-dance-falls', title: 'The Spontaneous Dance Falls'},
  {id: 'project-under-the-needles-eye', title: "Under the Needle's Eye"},
  {id: 'project-overlocked', title: 'Overlocked'},
]

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      S.listItem()
        .title('Home page')
        .id('home-page-item')
        .child(S.document().schemaType('homePage').documentId(HOME_PAGE_DOC_ID)),
      S.listItem()
        .title('Immersive — Dance Falls (law)')
        .id('immersive-law-item')
        .child(S.document().schemaType('immersiveLaw').documentId(IMMERSIVE_LAW_DOC_ID)),
      S.listItem()
        .title('Immersive — Needle (slider)')
        .id('immersive-needle-item')
        .child(S.document().schemaType('immersiveNeedle').documentId(IMMERSIVE_NEEDLE_DOC_ID)),
      S.listItem()
        .title('Info page')
        .id('info-page-item')
        .child(S.document().schemaType('info').documentId(INFO_DOC_ID)),
      S.listItem()
        .title('Captions')
        .id('captions-item')
        .child(S.document().schemaType('captions').documentId(CAPTIONS_DOC_ID)),
      S.listItem()
        .title('Typography')
        .id('typography-item')
        .child(S.document().schemaType('siteTypography').documentId(SITE_TYPOGRAPHY_DOC_ID)),
      S.documentTypeListItem('fontUpload').title('Font files'),
      S.listItem()
        .title('Projects')
        .id('projects-item')
        .child(
          S.list()
            .title('Projects')
            .items(
              FIXED_PROJECTS.map((project) =>
                S.listItem()
                  .id(project.id)
                  .title(project.title)
                  .child(S.document().schemaType('project').documentId(project.id)),
              ),
            ),
        ),
    ])
