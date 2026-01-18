import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const TEST_EXTENSION_KEY_BASE64 =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAi1m4dsFaZkG03IGydPtgC4JhsXLltjInzFsLhPz7iPYEu8DkfBJPIVkeO3AFrPfAKebPkBssLeprXnDuyOCBGAVMQ8u8WlK526V4VffhKBuWwipkOdEfwxhkcC7EuHizwyvmyYAk9Q75qizaAm09l1fJIL22PdFGemVfksC/o7rFzgIl61paH4rEZ5RNcyVA+NSelX1C3Sr0xLKkgDxyK2MRt+dTEryvmp/vU3WRu2rxn/ak8SctnyhuJ6QaSfELIVScyPFXcrbbAv8VEm0+Q+jEUygZ7D2nCfesCV90wt3MLlxd6HQGzKDxncztjGnR7hy9Q5s7NDYRAR7lqQtg3wIDAQAB';

function extensionIdFromKeyBase64(base64Key) {
  const buf = Buffer.from(base64Key, 'base64');
  const hash = crypto.createHash('sha256').update(buf).digest();
  let id = '';
  for (const b of hash.subarray(0, 16)) {
    id += String.fromCharCode(97 + ((b >> 4) & 0xf));
    id += String.fromCharCode(97 + (b & 0xf));
  }
  return id;
}

async function main() {
  const root = process.cwd();
  const dist = path.join(root, 'dist-test-extension');
  const built = path.join(root, 'dist');

  const build = spawnSync('node', ['scripts/build-extension.mjs'], { stdio: 'inherit' });
  if (build.status !== 0) process.exit(build.status ?? 1);

  await fs.rm(dist, { recursive: true, force: true });
  await fs.mkdir(dist, { recursive: true });

  await fs.cp(built, dist, { recursive: true });

  const manifestPath = path.join(dist, 'manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

  manifest.key = TEST_EXTENSION_KEY_BASE64;
  manifest.name = `${manifest.name || 'Open Basket Network'} (test)`;

  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  const id = extensionIdFromKeyBase64(TEST_EXTENSION_KEY_BASE64);
  await fs.writeFile(path.join(dist, '.extension-id'), id + '\n', 'utf8');

  process.stdout.write(`Built test extension at ${dist}\n`);
  process.stdout.write(`Extension ID: ${id}\n`);
}

await main();
