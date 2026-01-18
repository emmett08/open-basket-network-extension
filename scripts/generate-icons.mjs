import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

async function main() {
  const root = process.cwd();
  const svgPath = path.join(root, 'assets', 'icon.svg');
  const svg = await fs.readFile(svgPath);

  const outDir = path.join(root, 'dist', 'icons');
  await fs.mkdir(outDir, { recursive: true });

  // Chrome Web Store requirement for the 128 icon:
  // a 96x96 icon with 16px transparent padding on each side (=> 128x128 total).
  // Smaller sizes are generated without padding.

  const base = sharp(svg, { density: 256 });

  for (const size of [16, 32, 48]) {
    const outPath = path.join(outDir, `icon${size}.png`);
    await base
      .clone()
      .resize(size, size, { fit: 'cover' })
      .png({ compressionLevel: 9, palette: false })
      .toFile(outPath);
  }

  const icon128Path = path.join(outDir, 'icon128.png');
  const inner96 = await base
    .clone()
    .resize(96, 96, { fit: 'cover' })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();

  await sharp({
    create: {
      width: 128,
      height: 128,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: inner96, top: 16, left: 16 }])
    .png({ compressionLevel: 9, palette: false })
    .toFile(icon128Path);
}

await main();
