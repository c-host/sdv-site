/* eslint-env node */
import path from 'node:path'
import process from 'node:process'
import {fileURLToPath} from 'node:url'
import esbuild from 'esbuild'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const entry = path.join(__dirname, 'visual-editing-entry.mjs')
const outfile = path.resolve(__dirname, '../../js/sanity-visual-editing.bundle.js')

await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  format: 'iife',
  globalName: 'SDVVisualEditing',
  platform: 'browser',
  target: ['es2020'],
  outfile,
  minify: true,
  legalComments: 'none',
  logLevel: 'info',
})

process.stdout.write(`Wrote ${outfile}\n`)
