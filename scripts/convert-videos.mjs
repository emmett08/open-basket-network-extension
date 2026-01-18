import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

async function exists(p) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

function isExecutable(ffmpegPath) {
  const res = spawnSync(ffmpegPath, ['-version'], { stdio: 'ignore' });
  return res.status === 0;
}

async function main() {
  const webmDir = path.join(process.cwd(), 'playwright', 'videos');
  if (!(await exists(webmDir))) return;
  let ffmpegPath = 'ffmpeg';
  if (!isExecutable(ffmpegPath)) {
    process.stdout.write('ffmpeg not found; leaving Playwright videos as .webm\n');
    return;
  }

  const files = (await fs.readdir(webmDir)).filter(f => f.endsWith('.webm'));
  for (const f of files) {
    const inFile = path.join(webmDir, f);
    const outFile = path.join(webmDir, f.replace(/\.webm$/i, '.mp4'));
    const res = spawnSync(
      ffmpegPath,
      ['-y', '-i', inFile, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outFile],
      { stdio: 'inherit' }
    );
    if (res.status !== 0) process.exit(res.status ?? 1);
  }
}

await main();
