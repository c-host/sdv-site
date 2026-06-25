import {defineField} from 'sanity'

/** Project overview, info, slider captions — no law fragment annotation. */
export const portableTextBlock = defineField({
  name: 'block',
  type: 'block',
  styles: [
    {title: 'Normal', value: 'normal'},
    {title: 'Heading 2', value: 'h2'},
    {title: 'Heading 3', value: 'h3'},
    {title: 'Quote', value: 'blockquote'},
  ],
  lists: [
    {title: 'Bullet', value: 'bullet'},
    {title: 'Numbered', value: 'number'},
  ],
  marks: {
    decorators: [
      {title: 'Bold', value: 'strong'},
      {title: 'Italic', value: 'em'},
      {title: 'Strike', value: 'strike-through'},
    ],
    annotations: [
      {
        name: 'link',
        title: 'Link',
        type: 'object',
        fields: [
          defineField({
            name: 'href',
            title: 'URL',
            type: 'url',
            validation: (Rule) => Rule.uri({allowRelative: false, scheme: ['http', 'https']}),
          }),
        ],
      },
    ],
  },
})

/** Dance Falls immersive: inline law fragments with image (select text → annotation). */
export const lawPortableTextBlock = defineField({
  name: 'block',
  type: 'block',
  styles: [
    {title: 'Normal', value: 'normal'},
    {title: 'Heading 2', value: 'h2'},
    {title: 'Heading 3', value: 'h3'},
    {title: 'Quote', value: 'blockquote'},
  ],
  lists: [
    {title: 'Bullet', value: 'bullet'},
    {title: 'Numbered', value: 'number'},
  ],
  marks: {
    decorators: [
      {title: 'Bold', value: 'strong'},
      {title: 'Italic', value: 'em'},
      {title: 'Strike', value: 'strike-through'},
    ],
    annotations: [
      {
        name: 'link',
        title: 'Link',
        type: 'object',
        fields: [
          defineField({
            name: 'href',
            title: 'URL',
            type: 'url',
            validation: (Rule) => Rule.uri({allowRelative: false, scheme: ['http', 'https']}),
          }),
        ],
      },
      {
        name: 'lawFragment',
        title: 'Law fragment + image',
        type: 'object',
        fields: [
          defineField({
            name: 'image',
            title: 'Image',
            type: 'image',
            options: {hotspot: false},
            validation: (Rule) => Rule.required(),
          }),
        ],
      },
    ],
  },
})

export const sliderSlideObject = defineField({
  name: 'sliderSlide',
  title: 'Slide',
  type: 'object',
  fields: [
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      options: {hotspot: false},
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'caption',
      title: 'Caption',
      type: 'array',
      of: [portableTextBlock],
    }),
  ],
  preview: {
    select: {media: 'image'},
    prepare({media}) {
      return {title: 'Slide', media}
    },
  },
})
