import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveFfmpegPath } from './ffmpeg-path.mjs';

async function exists(p) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const dir = path.join(process.cwd(), 'artifacts', 'persona-videos');
  if (!(await exists(dir))) {
    process.stdout.write(`No persona videos found at ${dir}\n`);
    return;
  }

  const ffmpeg = await resolveFfmpegPath();
  if (!ffmpeg) {
    process.stdout.write('ffmpeg not available (install failed); leaving persona videos as .webm\n');
    return;
  }

  const files = (await fs.readdir(dir)).filter(f => f.endsWith('.webm'));
  for (const f of files) {
    const inFile = path.join(dir, f);
    const outFile = path.join(dir, f.replace(/\.webm$/i, '.mp4'));

    let res = spawnSync(ffmpeg, ['-y', '-i', inFile, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', outFile], {
      stdio: 'inherit'
    });

    // If libx264 isn't available in the binary, fall back to mpeg4.
    if (res.status !== 0) {
      res = spawnSync(ffmpeg, ['-y', '-i', inFile, '-c:v', 'mpeg4', '-qscale:v', '5', outFile], { stdio: 'inherit' });
    }

    if (res.status !== 0) process.exit(res.status ?? 1);
  }

  process.stdout.write(`Converted videos to MP4 in ${dir}\n`);
}

await main();

