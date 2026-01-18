import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';

async function main() {
  const root = process.cwd();

  const build = spawnSync('npm', ['run', 'test:extension:build'], { stdio: 'inherit' });
  if (build.status !== 0) process.exit(build.status ?? 1);

  const extensionId = (await fs.readFile(path.join(root, 'dist-test-extension', '.extension-id'), 'utf8')).trim();
  if (!extensionId || extensionId.length !== 32) throw new Error('Invalid extension id');

  const outDir = path.join(root, 'artifacts', 'screenshots');
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });

  const extensionPath = path.join(root, 'dist-test-extension');
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'obn-screens-'));

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
  });

  const page = await context.newPage();

  const shots = [
    { name: 'options', url: `chrome-extension://${extensionId}/options.html` },
    { name: 'basket', url: `chrome-extension://${extensionId}/basket.html` },
    { name: 'popup', url: `chrome-extension://${extensionId}/popup.html` }
  ];

  for (const s of shots) {
    await page.goto(s.url, { waitUntil: 'domcontentloaded' });
    await page.setViewportSize({ width: s.name === 'popup' ? 420 : 1280, height: s.name === 'popup' ? 720 : 900 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(outDir, `${s.name}.png`), fullPage: true });
  }

  await context.close();

  process.stdout.write(`Wrote screenshots to ${outDir}\n`);
}

await main();

