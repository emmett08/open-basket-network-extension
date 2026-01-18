import { test, expect } from '@playwright/test';
import { chromium, type BrowserContext } from 'playwright';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

async function startTestServer() {
  const requests: any[] = [];

  const server = http.createServer(async (req, res) => {
    if (!req.url) {
      res.writeHead(400);
      res.end('bad request');
      return;
    }

    const url = new URL(req.url, 'http://127.0.0.1');

    if (req.method === 'POST' && url.pathname === '/publish') {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const raw = Buffer.concat(chunks).toString('utf8');
      let parsed: any = null;
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

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Failed to bind test server');

  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    requests,
    close: async () => {
      await new Promise<void>((resolve, reject) => server.close(err => (err ? reject(err) : resolve())));
    }
  };
}

async function loadExtensionId() {
  const id = (await fs.readFile('dist-test-extension/.extension-id', 'utf8')).trim();
  expect(id).toHaveLength(32);
  return id;
}

async function launchWithExtension(videoDir: string): Promise<BrowserContext> {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'obn-playwright-profile-'));
  const extensionPath = path.resolve('dist-test-extension');

  return await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    recordVideo: { dir: videoDir },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });
}

test('configures settings and publishes a BasketSnapshot (video)', async () => {
  const server = await startTestServer();
  const extensionId = await loadExtensionId();
  const optionsUrl = `chrome-extension://${extensionId}/options.html`;
  const basketUrl = `chrome-extension://${extensionId}/basket.html`;

  const context = await launchWithExtension('playwright/videos');
  const page = await context.newPage();

  await page.goto(optionsUrl);
  await page.locator('#brokerEndpoint').fill(`${server.baseUrl}/publish`);
  await page.locator('#publishPayload').selectOption('snapshot');
  await page.locator('#save').click();
  await expect(page.locator('#status')).toContainText('Saved');

  await page.goto(basketUrl);

  const baseUrl = server.baseUrl;
  const brokerEndpoint = `${server.baseUrl}/publish`;
  const basket = {
    basketId: 'local_test',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      {
        basketItemId: 'item_test_1',
        addedAt: new Date().toISOString(),
        quantity: 2,
        schemaType: 'Product',
        extractedFrom: 'json-ld',
        source: { url: `${baseUrl}/`, pageTitle: 'OBN Playwright Test', detectedId: 'urn:obn:test:product-1' },
        title: 'Test Product',
        image: 'https://example.com/image.jpg',
        entity: { '@type': 'Product', name: 'Test Product' }
      }
    ]
  };

  const itemsLen = await page.evaluate(async ({ basket, brokerEndpoint }) => {
    const setArea = (area: any, data: any) => new Promise<void>(resolve => area.set(data, () => resolve()));
    const getArea = (area: any, key: string) => new Promise<any>(resolve => area.get(key, (res: any) => resolve(res)));

    await setArea(chrome.storage.local, { obn_basket_v1: basket });
    await setArea(chrome.storage.sync, { obn_settings_v1: { brokerEndpoint, publishPayload: 'snapshot' } });

    const res = await getArea(chrome.storage.local, 'obn_basket_v1');
    return Array.isArray(res?.obn_basket_v1?.items) ? res.obn_basket_v1.items.length : 0;
  }, { basket, brokerEndpoint });
  expect(itemsLen).toBe(1);

  await page.reload();
  await expect(page.locator('.item-title')).toContainText('Test Product');

  await page.locator('button:has-text("Request Offers")').click();
  await expect(page.locator('.toast')).toContainText(/Published|Publish/);

  await expect.poll(() => server.requests.length).toBe(1);
  expect(server.requests[0].body?.type).toBe('BasketSnapshot');
  expect(server.requests[0].body?.items?.length).toBe(1);

  await context.close();
  await server.close();
});
