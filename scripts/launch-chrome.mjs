import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

async function exists(p) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: 'inherit' });
  if (res.error) throw res.error;
  if (res.status !== 0) process.exit(res.status ?? 1);
}

async function main() {
  const root = process.cwd();
  const dist = path.join(root, 'dist');
  const profileDir = path.join(root, '.vscode', 'chrome-profile');

  run('npm', ['run', 'build']);

  if (!(await exists(path.join(dist, 'manifest.json')))) {
    throw new Error(`Expected built extension at ${dist}`);
  }

  const args = [
    `--user-data-dir=${profileDir}`,
    `--disable-extensions-except=${dist}`,
    `--load-extension=${dist}`,
    'https://schema.org/Product'
  ];

  if (process.platform === 'darwin') {
    run('open', ['-na', 'Google Chrome', '--args', ...args]);
    return;
  }

  if (process.platform === 'win32') {
    run('cmd', ['/c', 'start', '""', 'chrome', ...args]);
    return;
  }

  // Linux / other: try common Chrome executables.
  const candidates = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
  for (const c of candidates) {
    const which = spawnSync('which', [c], { stdio: 'ignore' });
    if (which.status === 0) {
      run(c, args);
      return;
    }
  }

  throw new Error('Could not find Chrome/Chromium. Install Google Chrome or Chromium, then re-run.');
}

await main();

