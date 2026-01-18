export async function resolveFfmpegPath() {
  try {
    const mod = await import('ffmpeg-static');
    const p = mod?.default ?? mod;
    if (typeof p === 'string' && p) return p;
  } catch {
    // ignore
  }
  return null;
}

