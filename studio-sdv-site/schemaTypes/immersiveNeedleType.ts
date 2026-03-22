import {defineField, defineType} from 'sanity'
import {sliderSlideObject} from './sharedPortableText'

export const IMMERSIVE_NEEDLE_DOC_ID = 'immersiveNeedleSlider'

export const immersiveNeedleType = defineType({
  name: 'immersiveNeedle',
  title: 'Immersive — Needle (slider)',
  type: 'document',
  fields: [
    defineField({
      name: 'slides',
      title: 'Slides',
      type: 'array',
      of: [sliderSlideObject],
    }),
  ],
  preview: {
    prepare() {
      return {title: "Needle — immersive slider"}
    },
  },
})
