export function uuid(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function clampInt(value: unknown, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}): number {
  const n = Number.parseInt(String(value), 10);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function typeIcon(schemaType: string | undefined | null): string {
  const t = (schemaType || '').toLowerCase();
  if (t.includes('recipe')) return '🍲';
  if (t.includes('product')) return '🛍️';
  if (t.includes('service')) return '🧰';
  if (t.includes('event')) return '🎟️';
  if (t.includes('course')) return '🎓';
  if (t.includes('offer')) return '🏷️';
  if (t.includes('contract')) return '📄';
  if (t.includes('reservation') || t.includes('rental')) return '🚗';
  return '🔖';
}

export function truncate(s: unknown, max = 80): string {
  const str = String(s || '');
  if (str.length <= max) return str;
  return str.slice(0, Math.max(0, max - 1)) + '…';
}

export function safeJsonStringify(obj: unknown, space = 2): string {
  return JSON.stringify(
    obj,
    (_k, v) => {
      if (typeof v === 'bigint') return v.toString();
      return v;
    },
    space
  );
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage = 'Request timed out'): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

