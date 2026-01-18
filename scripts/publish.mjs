import archiver from 'archiver';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

async function zipDir({ dir, outFile }) {
  await fsp.mkdir(path.dirname(outFile), { recursive: true });

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outFile);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(dir, false);
    archive.finalize();
  });
}

async function main() {
  const root = process.cwd();
  const manifest = JSON.parse(await fsp.readFile(path.join(root, 'manifest.json'), 'utf8'));
  const version = manifest.version || '0.0.0';

  const build = spawnSync('node', ['scripts/build-extension.mjs'], { stdio: 'inherit' });
  if (build.status !== 0) process.exit(build.status ?? 1);

  const outFile = path.join(root, 'release', `open-basket-network-extension-${version}.zip`);
  await zipDir({ dir: path.join(root, 'dist'), outFile });
  process.stdout.write(`Wrote ${outFile}\n`);
}

await main();

