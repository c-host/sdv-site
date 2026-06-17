import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function runScript(name, extraArgs = []) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, name);
    const child = spawn(process.execPath, [scriptPath, ...extraArgs], {
      cwd: ROOT,
      stdio: 'inherit',
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(name + ' exited with code ' + code));
    });
  });
}

async function main() {
  const userArgs = process.argv.slice(2);
  const prune = !userArgs.includes('--no-prune');
  const args = userArgs.filter((a) => a !== '--no-prune');
  if (prune) args.push('--prune');

  await runScript('sync-project-pages.mjs', args);
  await runScript('sync-immersive-pages.mjs', args);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
