import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

async function main() {
  const root = process.cwd();
  const dist = path.join(root, 'dist');

  const res = spawnSync('npx', ['vite', 'build'], { stdio: 'inherit' });
  if (res.status !== 0) process.exit(res.status ?? 1);

  await fs.cp(path.join(root, 'assets'), path.join(dist, 'assets'), { recursive: true });
  await fs.copyFile(path.join(root, 'manifest.json'), path.join(dist, 'manifest.json'));

  // Generate required PNG icons into dist/icons/ for Chrome + Web Store.
  const iconBuild = spawnSync('node', ['scripts/generate-icons.mjs'], { stdio: 'inherit' });
  if (iconBuild.status !== 0) process.exit(iconBuild.status ?? 1);
}

await main();
