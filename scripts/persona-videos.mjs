import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';

function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: 'inherit' });
  if (res.error) throw res.error;
  if (res.status !== 0) process.exit(res.status ?? 1);
}

async function startBrokerStub() {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    if (!req.url) {
      res.writeHead(400);
      res.end('bad request');
      return;
    }
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'POST' && url.pathname === '/publish') {
      const chunks = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const raw = Buffer.concat(chunks).toString('utf8');
      let parsed = null;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        parsed = null;
      }
      requests.push({ headers: req.headers, body: parsed });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Failed to bind broker stub');
  return {
    url: `http://127.0.0.1:${addr.port}/publish`,
    requests,
    close: async () => {
      await new Promise((resolve, reject) => server.close(err => (err ? reject(err) : resolve())));
    }
  };
}

async function humanDelay(page, minMs = 700, maxMs = 2200) {
  const jitter = minMs + Math.floor(Math.random() * Math.max(1, maxMs - minMs));
  await page.waitForTimeout(jitter);
}

async function ensureOutDir() {
  const dir = path.join(process.cwd(), 'artifacts', 'persona-videos');
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function readExtensionId() {
  return (await fs.readFile(path.join(process.cwd(), 'dist-test-extension', '.extension-id'), 'utf8')).trim();
}

async function withExtensionContext(videoDir, fn) {
  const extensionPath = path.resolve('dist-test-extension');
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'obn-persona-profile-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
  });
  try {
    await fn(context);
  } finally {
    await context.close();
  }
}

async function recordPersona({ outDir, name, run }) {
  const tmpDir = path.join(outDir, `_tmp_${name}`);
  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.mkdir(tmpDir, { recursive: true });

  const outWebm = path.join(outDir, `${name}.webm`);
  await fs.rm(outWebm, { force: true }).catch(() => {});

  await withExtensionContext(tmpDir, async context => {
    const page = await context.newPage();
    const video = page.video();

    await run({ page, context });

    await page.close();

    if (!video) throw new Error(`No video available for persona: ${name}`);
    const videoPath = await video.path();
    await fs.rename(videoPath, outWebm);
  });

  await fs.rm(tmpDir, { recursive: true, force: true });
}

async function personaNewUserConfig(outDir, extensionId, brokerUrl) {
  const name = 'persona-new-user-config';

  await recordPersona({
    outDir,
    name,
    run: async ({ page }) => {
      await page.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'domcontentloaded' });
      await page.setViewportSize({ width: 1100, height: 800 });

      await humanDelay(page);
      await page.locator('#brokerEndpoint').fill(brokerUrl);
      await humanDelay(page, 900, 2500);
      await page.locator('#publishPayload').selectOption('snapshot');
      await humanDelay(page);
      await page.locator('#save').click();
      await humanDelay(page, 1500, 2800);
    }
  });
}

async function personaShopperReviewAndPublish(outDir, extensionId, brokerUrl) {
  const name = 'persona-shopper-review-and-publish';

  await recordPersona({
    outDir,
    name,
    run: async ({ page }) => {
      await page.goto(`chrome-extension://${extensionId}/basket.html`, { waitUntil: 'domcontentloaded' });
      await page.setViewportSize({ width: 1280, height: 900 });

      const baseUrl = 'https://example.com/product';
      const basket = {
        basketId: 'local_persona',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [
          {
            basketItemId: 'item_persona_1',
            addedAt: new Date().toISOString(),
            quantity: 1,
            schemaType: 'Product',
            extractedFrom: 'json-ld',
            source: { url: baseUrl, pageTitle: 'Example Product', detectedId: 'urn:obn:persona:product-1' },
            title: 'Green Tea Extract Supplement',
            image: '',
            entity: { '@type': 'Product', name: 'Green Tea Extract Supplement' }
          },
          {
            basketItemId: 'item_persona_2',
            addedAt: new Date().toISOString(),
            quantity: 1,
            schemaType: 'Event',
            extractedFrom: 'json-ld',
            source: { url: 'https://example.com/event', pageTitle: 'Concert', detectedId: 'urn:obn:persona:event-1' },
            title: 'Concert Ticket: Jazz Night',
            image: '',
            entity: { '@type': 'Event', name: 'Concert Ticket: Jazz Night' }
          }
        ]
      };

      await page.evaluate(
        async ({ basket, brokerUrl }) => {
          const setArea = (area, data) => new Promise(resolve => area.set(data, () => resolve()));
          await setArea(chrome.storage.local, { obn_basket_v1: basket });
          await setArea(chrome.storage.sync, { obn_settings_v1: { brokerEndpoint: brokerUrl, publishPayload: 'snapshot' } });
        },
        { basket, brokerUrl }
      );

      await page.reload({ waitUntil: 'domcontentloaded' });
      await humanDelay(page, 1500, 2800);

      await page.locator('.qty').first().fill('2');
      await humanDelay(page);
      await page.getByRole('button', { name: 'Update' }).first().click();
      await humanDelay(page, 1200, 2500);

      await page.getByRole('button', { name: 'Export JSON' }).click();
      await humanDelay(page, 1200, 2500);

      await page.getByRole('button', { name: 'Request Offers' }).click();
      await humanDelay(page, 1800, 3200);
    }
  });
}

async function personaQuickScanPlaceholder(outDir, extensionId) {
  const name = 'persona-quick-scan-placeholder';

  await recordPersona({
    outDir,
    name,
    run: async ({ page }) => {
      await page.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'domcontentloaded' });
      await page.setViewportSize({ width: 420, height: 720 });

      await humanDelay(page, 1200, 2800);
      await page.getByRole('button', { name: /Scan/i }).click();
      await humanDelay(page, 1800, 3200);
      await page.getByRole('button', { name: /Basket/i }).click();
      await humanDelay(page, 1500, 2600);
    }
  });
}

async function main() {
  run('npm', ['run', 'test:extension:build']);

  const outDir = await ensureOutDir();
  const extensionId = await readExtensionId();
  if (!extensionId || extensionId.length !== 32) throw new Error('Invalid extension id');

  const broker = await startBrokerStub();
  try {
    await personaNewUserConfig(outDir, extensionId, broker.url);
    await personaShopperReviewAndPublish(outDir, extensionId, broker.url);
    await personaQuickScanPlaceholder(outDir, extensionId);
  } finally {
    await broker.close();
  }

  process.stdout.write(`Wrote persona videos (webm) to ${outDir}\n`);
}

await main();
