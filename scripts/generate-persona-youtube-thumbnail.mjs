import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

async function main() {
  const root = process.cwd();
  const storeDir = path.join(root, 'store');
  await fs.mkdir(storeDir, { recursive: true });

  // Use the settings screenshot as the base for the "new user config" persona thumbnail.
  const basePath = path.join(storeDir, 'screenshot-2-settings-1280x800.png');
  const exists = await fs
    .stat(basePath)
    .then(() => true)
    .catch(() => false);

  if (!exists) {
    throw new Error(`Missing ${basePath}. Run: npm run store:assets`);
  }

  const w = 1280;
  const h = 720;

  const overlay = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="rgba(29,78,216,0.92)"/>
          <stop offset="1" stop-color="rgba(37,99,235,0.92)"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${w}" height="${Math.round(h * 0.33)}" fill="url(#g)"/>
      <text x="48" y="${Math.round(h * 0.18)}" font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="64" fill="#fff" font-weight="900">Persona: New user setup</text>
      <text x="48" y="${Math.round(h * 0.26)}" font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="34" fill="rgba(255,255,255,0.92)" font-weight="700">Configure broker endpoint + publish mode</text>
    </svg>
  `);

  // Crop 1280x800 -> 1280x720 (top crop), then overlay banner.
  const outPath = path.join(storeDir, 'youtube-thumb-persona-new-user-config-1280x720.jpg');
  await sharp(basePath)
    .extract({ left: 0, top: 0, width: 1280, height: 720 })
    .flatten({ background: '#ffffff' })
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(outPath);

  process.stdout.write(`Wrote ${outPath}\n`);
}

await main();

