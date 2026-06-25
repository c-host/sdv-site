import type { StructureResolver } from 'sanity/structure'
import { HOME_PAGE_DOC_ID } from './schemaTypes/homePageType'
import { SITE_MATERIALS_DOC_ID } from './schemaTypes/materialTypes'
import { SITE_TYPOGRAPHY_DOC_ID } from './schemaTypes/typographyTypes'
import { ImageAssetMinimalView } from './components/ImageAssetMinimalView'

const INFO_DOC_ID = 'infoPage'

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      S.listItem()
        .title('Home page')
        .id(HOME_PAGE_DOC_ID)
        .child(
          S.document()
            .id(HOME_PAGE_DOC_ID)
            .schemaType('homePage')
            .documentId(HOME_PAGE_DOC_ID),
        ),
      S.listItem()
        .title('Bio panel')
        .id(INFO_DOC_ID)
        .child(S.document().id(INFO_DOC_ID).schemaType('info').documentId(INFO_DOC_ID)),
      S.documentTypeListItem('project').title('Projects'),
      S.divider(),
      S.listItem()
        .title('Materials')
        .id(SITE_MATERIALS_DOC_ID)
        .child(
          S.document()
            .id(SITE_MATERIALS_DOC_ID)
            .schemaType('siteMaterials')
            .documentId(SITE_MATERIALS_DOC_ID),
        ),
      S.divider(),
      S.listItem()
        .title('Typography')
        .id(SITE_TYPOGRAPHY_DOC_ID)
        .child(
          S.document()
            .id(SITE_TYPOGRAPHY_DOC_ID)
            .schemaType('siteTypography')
            .documentId(SITE_TYPOGRAPHY_DOC_ID),
        ),
      S.documentTypeListItem('fontUpload').title('Fonts'),
      S.divider(),
      S.listItem()
        .title('Image library (uploaded)')
        .id('image-library-item')
        .child(
          S.documentTypeList('sanity.imageAsset')
            .title('Image library (uploaded)')
            .child((documentId) =>
              S.component(ImageAssetMinimalView)
                .id('image-asset-minimal-view')
                .title('Image')
                .options({ documentId, documentType: 'sanity.imageAsset' }),
            ),
        ),
    ])
