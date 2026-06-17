/* eslint-env node */
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import {spawn} from 'node:child_process'

const DATASET = process.env.SANITY_DATASET || 'production'
const backupsDir = path.join(process.cwd(), 'backups')
const stamp = new Date().toISOString().slice(0, 10)
const outFile = path.join(backupsDir, `sanity-${DATASET}-${stamp}.tar.gz`)

function runSanityExport() {
  return new Promise((resolve, reject) => {
    const args = ['sanity', 'dataset', 'export', DATASET, outFile, '--assets']
    const child = spawn('npx', args, {stdio: 'inherit', shell: true})
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`sanity dataset export exited with code ${code}`))
    })
  })
}

async function main() {
  await fs.mkdir(backupsDir, {recursive: true})
  process.stdout.write(`Exporting ${DATASET} to ${path.relative(process.cwd(), outFile)} …\n`)
  await runSanityExport()
  process.stdout.write('Done.\n')
}

main().catch((err) => {
  process.stderr.write(String(err && err.message ? err.message : err) + '\n')
  process.exit(1)
})
