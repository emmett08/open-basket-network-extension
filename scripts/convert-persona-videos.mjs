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

  // Many players show the *first* frame as the thumbnail/preview; our recordings can start
  // on a blank navigation frame. Trim a small lead-in so the first frame is meaningful.
  const trimSeconds = Number(process.env.OBN_VIDEO_TRIM_SECONDS || 1.0);

  const files = (await fs.readdir(dir)).filter(f => f.endsWith('.webm'));
  for (const f of files) {
    const inFile = path.join(dir, f);
    const outFile = path.join(dir, f.replace(/\.webm$/i, '.mp4'));

    const inputArgs = trimSeconds > 0 ? ['-ss', String(trimSeconds)] : [];

    let res = spawnSync(ffmpeg, [
      '-y',
      ...inputArgs,
      '-i',
      inFile,
      '-f',
      'lavfi',
      '-i',
      'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-shortest',
      '-map',
      '0:v:0',
      '-map',
      '1:a:0',
      '-c:v',
      'libx264',
      '-profile:v',
      'baseline',
      '-level',
      '3.1',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      outFile
    ], {
      stdio: 'inherit'
    });

    // If libx264 isn't available in the binary, fall back to mpeg4.
    if (res.status !== 0) {
      res = spawnSync(
        ffmpeg,
        [
          '-y',
          ...inputArgs,
          '-i',
          inFile,
          '-f',
          'lavfi',
          '-i',
          'anullsrc=channel_layout=stereo:sample_rate=44100',
          '-shortest',
          '-map',
          '0:v:0',
          '-map',
          '1:a:0',
          '-c:v',
          'mpeg4',
          '-qscale:v',
          '5',
          '-pix_fmt',
          'yuv420p',
          '-c:a',
          'aac',
          '-b:a',
          '128k',
          '-movflags',
          '+faststart',
          outFile
        ],
        { stdio: 'inherit' }
      );
    }

    if (res.status !== 0) process.exit(res.status ?? 1);
  }

  process.stdout.write(`Converted videos to MP4 in ${dir}\n`);
}

await main();
