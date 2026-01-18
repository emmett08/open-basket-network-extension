import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { chromium } from 'playwright';

function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: 'inherit' });
  if (res.error) throw res.error;
  if (res.status !== 0) process.exit(res.status ?? 1);
}

async function startBrokerStub() {
  const server = http.createServer(async (req, res) => {
    if (!req.url) {
      res.writeHead(400);
      res.end('bad request');
      return;
    }
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'POST' && url.pathname === '/publish') {
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
    endpoint: `http://127.0.0.1:${addr.port}/publish`,
    close: async () => {
      await new Promise((resolve, reject) => server.close(err => (err ? reject(err) : resolve())));
    }
  };
}

async function writeNoAlphaPng(inputPngPath, outPngPath, width, height) {
  await sharp(inputPngPath)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .flatten({ background: '#ffffff' })
    .png({ compressionLevel: 9, palette: false })
    .toFile(outPngPath);
}

async function generatePromoTiles({ screenshotPath, outDir }) {
  const small = path.join(outDir, 'small-promo-440x280.png');
  const marquee = path.join(outDir, 'marquee-promo-1400x560.png');

  const base = await sharp(screenshotPath)
    .resize(1400, 560, { fit: 'cover', position: 'centre' })
    .flatten({ background: '#ffffff' })
    .toBuffer();

  const overlaySvg = (w, h) => Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="rgba(29,78,216,0.92)"/>
          <stop offset="1" stop-color="rgba(37,99,235,0.92)"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${w}" height="${Math.round(h * 0.32)}" fill="url(#g)"/>
      <text x="32" y="${Math.round(h * 0.16)}" font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="${Math.round(h * 0.10)}" fill="#fff" font-weight="800">Open Basket Network</text>
      <text x="32" y="${Math.round(h * 0.24)}" font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="${Math.round(h * 0.06)}" fill="rgba(255,255,255,0.92)" font-weight="600">Generalised basket for schema.org entities</text>
    </svg>
  `);

  await sharp(base)
    .composite([{ input: overlaySvg(1400, 560), top: 0, left: 0 }])
    .png({ compressionLevel: 9, palette: false })
    .toFile(marquee);

  const smallBuf = await sharp(screenshotPath)
    .resize(440, 280, { fit: 'cover', position: 'centre' })
    .flatten({ background: '#ffffff' })
    .toBuffer();

  await sharp(smallBuf)
    .composite([{ input: overlaySvg(440, 280), top: 0, left: 0 }])
    .png({ compressionLevel: 9, palette: false })
    .toFile(small);
}

async function main() {
  run('npm', ['install']);
  run('npm', ['run', 'build']);
  run('npm', ['run', 'test:extension:build']);

  const extensionId = (await fs.readFile(path.join(process.cwd(), 'dist-test-extension', '.extension-id'), 'utf8')).trim();
  if (!extensionId || extensionId.length !== 32) throw new Error('Invalid extension id');

  const outDir = path.join(process.cwd(), 'store');
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });

  // Store icon (128x128) – generated from the same SVG as extension icons.
  const svgPath = path.join(process.cwd(), 'assets', 'icon.svg');
  const svg = await fs.readFile(svgPath);
  await sharp(svg, { density: 256 })
    .resize(128, 128, { fit: 'cover' })
    .flatten({ background: '#ffffff' })
    .png({ compressionLevel: 9, palette: false })
    .toFile(path.join(outDir, 'store-icon-128.png'));

  const broker = await startBrokerStub();
  try {
    const extensionPath = path.resolve('dist-test-extension');
    const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'obn-store-assets-'));
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
    });

    const page = await context.newPage();

    // Seed settings + basket so screenshots look like a real “basket”.
    const basket = {
      basketId: 'local_store',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [
        {
          basketItemId: 'item_store_1',
          addedAt: new Date().toISOString(),
          quantity: 2,
          schemaType: 'Product',
          extractedFrom: 'json-ld',
          source: { url: 'https://example.com/product', pageTitle: 'Example Product', detectedId: 'urn:obn:store:product-1' },
          title: 'Green Tea Extract Supplement',
          image: '',
          entity: { '@type': 'Product', name: 'Green Tea Extract Supplement' }
        },
        {
          basketItemId: 'item_store_2',
          addedAt: new Date().toISOString(),
          quantity: 1,
          schemaType: 'Event',
          extractedFrom: 'json-ld',
          source: { url: 'https://example.com/event', pageTitle: 'Concert', detectedId: 'urn:obn:store:event-1' },
          title: 'Concert Ticket: Jazz Night',
          image: '',
          entity: { '@type': 'Event', name: 'Concert Ticket: Jazz Night' }
        }
      ]
    };

    const seed = async () => {
      await page.evaluate(
        async ({ basket, brokerEndpoint }) => {
          const setArea = (area, data) => new Promise(resolve => area.set(data, () => resolve()));
          await setArea(chrome.storage.local, { obn_basket_v1: basket });
          await setArea(chrome.storage.sync, {
            obn_settings_v1: { brokerEndpoint, publishPayload: 'snapshot', currency: 'GBP', deliveryRegion: 'GB-LND', debug: false }
          });
        },
        { basket, brokerEndpoint: broker.endpoint }
      );
    };

    // Screenshot 1: Basket (1280x800)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`chrome-extension://${extensionId}/basket.html`, { waitUntil: 'domcontentloaded' });
    await seed();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(Number(process.env.OBN_STORE_DELAY_MS || 1200));
    const basketRaw = path.join(outDir, '_raw_basket.png');
    await page.screenshot({ path: basketRaw, fullPage: false });
    await writeNoAlphaPng(basketRaw, path.join(outDir, 'screenshot-1-basket-1280x800.png'), 1280, 800);

    // Screenshot 2: Settings (1280x800)
    await page.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(Number(process.env.OBN_STORE_DELAY_MS || 1200));
    const settingsRaw = path.join(outDir, '_raw_settings.png');
    await page.screenshot({ path: settingsRaw, fullPage: false });
    await writeNoAlphaPng(settingsRaw, path.join(outDir, 'screenshot-2-settings-1280x800.png'), 1280, 800);

    // Screenshot 3: Popup (capture at 640x400)
    await page.setViewportSize({ width: 640, height: 400 });
    await page.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(Number(process.env.OBN_STORE_DELAY_MS || 1200));
    const popupRaw = path.join(outDir, '_raw_popup.png');
    await page.screenshot({ path: popupRaw, fullPage: false });
    await writeNoAlphaPng(popupRaw, path.join(outDir, 'screenshot-3-popup-640x400.png'), 640, 400);

    // Promo tiles derived from the basket screenshot
    await generatePromoTiles({ screenshotPath: path.join(outDir, 'screenshot-1-basket-1280x800.png'), outDir });

    await context.close();

    // Clean raw files
    await fs.rm(basketRaw, { force: true });
    await fs.rm(settingsRaw, { force: true });
    await fs.rm(popupRaw, { force: true });
    await fs.rm(path.join(outDir, '_raw_basket.png'), { force: true });
    await fs.rm(path.join(outDir, '_raw_settings.png'), { force: true });
    await fs.rm(path.join(outDir, '_raw_popup.png'), { force: true });
  } finally {
    await broker.close();
  }

  process.stdout.write(`Wrote Chrome Web Store assets to ${outDir}\n`);
}

await main();

