import type {StructureResolver} from 'sanity/structure'
import {HOME_PAGE_DOC_ID} from './schemaTypes/homePageType'
import {SITE_MATERIALS_DOC_ID} from './schemaTypes/materialTypes'
import {SITE_TYPOGRAPHY_DOC_ID} from './schemaTypes/typographyTypes'
import {ImageAssetMinimalView} from './components/ImageAssetMinimalView'

const INFO_DOC_ID = 'infoPage'

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      S.listItem()
        .title('Home page')
        .id('home-page-item')
        .child(S.document().schemaType('homePage').documentId(HOME_PAGE_DOC_ID)),
      S.listItem()
        .title('Bio panel')
        .id('info-page-item')
        .child(S.document().schemaType('info').documentId(INFO_DOC_ID)),
      S.documentTypeListItem('project').title('Projects'),
      S.divider(),
      S.listItem()
        .title('Materials')
        .id('materials-item')
        .child(S.document().schemaType('siteMaterials').documentId(SITE_MATERIALS_DOC_ID)),
      S.divider(),
      S.listItem()
        .title('Typography')
        .id('typography-item')
        .child(S.document().schemaType('siteTypography').documentId(SITE_TYPOGRAPHY_DOC_ID)),
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
                .options({documentId, documentType: 'sanity.imageAsset'}),
            ),
        ),
    ])
