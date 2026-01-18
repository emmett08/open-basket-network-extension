import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

async function main() {
  const root = process.cwd();
  const svgPath = path.join(root, 'assets', 'icon.svg');
  const svg = await fs.readFile(svgPath);

  const outDir = path.join(root, 'dist', 'icons');
  await fs.mkdir(outDir, { recursive: true });

  const sizes = [16, 32, 48, 128];
  for (const size of sizes) {
    const outPath = path.join(outDir, `icon${size}.png`);
    await sharp(svg, { density: 256 })
      .resize(size, size, { fit: 'cover' })
      .png({ compressionLevel: 9, palette: false })
      .toFile(outPath);
  }
}

await main();

