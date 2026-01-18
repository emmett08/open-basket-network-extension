// Open Basket Network - content script
// Extracts structured data (JSON-LD, microdata, basic RDFa) from the current page.

import type { DetectedEntity, ExtractedFrom } from './types';

function canonicalType(t: unknown): string {
  if (!t) return 'Thing';
  const s = String(t).trim();
  if (!s) return 'Thing';
  const parts = s.split(/[/#:]/);
  return parts[parts.length - 1] || s;
}

function getFirstString(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) {
    for (const item of v) {
      const s = getFirstString(item);
      if (s) return s;
    }
  }
  if (typeof v === 'object') {
    const o = v as any;
    if (typeof o.url === 'string') return o.url;
    if (typeof o['@id'] === 'string') return o['@id'];
  }
  return '';
}

function bestName(entity: any): string {
  if (!entity || typeof entity !== 'object') return '';
  return (
    entity.name ||
    entity.headline ||
    entity.title ||
    entity.alternativeHeadline ||
    entity.caption ||
    ''
  );
}

function bestImage(entity: any): string {
  if (!entity || typeof entity !== 'object') return '';
  return getFirstString(entity.image) || getFirstString(entity.thumbnailUrl) || '';
}

function bestId(entity: any): string {
  if (!entity || typeof entity !== 'object') return '';
  return (typeof entity['@id'] === 'string' ? entity['@id'] : '') || (typeof entity.url === 'string' ? entity.url : '');
}

function bestType(entity: any): string {
  if (!entity || typeof entity !== 'object') return 'Thing';
  const t = entity['@type'] || entity.type;
  if (Array.isArray(t) && t.length) return canonicalType(t[0]);
  return canonicalType(t);
}

function expandJsonLd(parsed: any): any[] {
  if (!parsed) return [];
  if (Array.isArray(parsed)) return parsed.flatMap(expandJsonLd);
  if (typeof parsed !== 'object') return [];

  if (Array.isArray(parsed['@graph'])) {
    return parsed['@graph'].filter((x: any) => x && typeof x === 'object');
  }

  return [parsed];
}

function extractJsonLdEntities(): any[] {
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  const entities: any[] = [];

  for (const script of scripts) {
    const text = (script.textContent || '').trim();
    if (!text) continue;

    try {
      const parsed = JSON.parse(text);
      const nodes = expandJsonLd(parsed);
      for (const node of nodes) {
        if (node && typeof node === 'object' && (node['@type'] || node.type)) {
          entities.push(node);
        }
      }
    } catch {
      continue;
    }
  }

  return entities;
}

function microdataValue(el: Element): any {
  const tag = (el as any).tagName?.toLowerCase?.() || '';

  if ((el as HTMLElement).hasAttribute('itemscope')) {
    return extractMicrodataItem(el as HTMLElement);
  }

  if (tag === 'meta') return el.getAttribute('content') || '';
  if (tag === 'a' || tag === 'area' || tag === 'link') return el.getAttribute('href') || '';
  if (tag === 'img' || tag === 'audio' || tag === 'video' || tag === 'source') return el.getAttribute('src') || '';
  if (tag === 'time') return el.getAttribute('datetime') || el.textContent?.trim?.() || '';

  return (el.textContent || '').trim();
}

function closestItemScope(el: Element | null): HTMLElement | null {
  let cur: Element | null = el;
  while (cur && cur !== document.documentElement) {
    if ((cur as HTMLElement).hasAttribute?.('itemscope')) return cur as HTMLElement;
    cur = cur.parentElement;
  }
  return null;
}

function addProp(obj: any, name: string, value: any) {
  if (!name) return;
  if (obj[name] === undefined) {
    obj[name] = value;
  } else if (Array.isArray(obj[name])) {
    obj[name].push(value);
  } else {
    obj[name] = [obj[name], value];
  }
}

function typeFromItemtype(itemtype: string | null): string {
  if (!itemtype) return 'Thing';
  const first = String(itemtype).trim().split(/\s+/)[0];
  return canonicalType(first);
}

function extractMicrodataItem(itemEl: HTMLElement): any {
  const out: any = {};
  out['@type'] = typeFromItemtype(itemEl.getAttribute('itemtype'));
  const itemId = itemEl.getAttribute('itemid');
  if (itemId) out['@id'] = itemId;

  const propEls = Array.from(itemEl.querySelectorAll('[itemprop]'));
  for (const propEl of propEls) {
    const propName = (propEl.getAttribute('itemprop') || '').trim();
    if (!propName) continue;

    const ownerScope = closestItemScope(propEl);
    if (ownerScope !== itemEl) {
      if (!((propEl as HTMLElement).hasAttribute('itemscope') && propEl === ownerScope)) continue;
    }

    const value = microdataValue(propEl);
    addProp(out, propName, value);
  }

  if (!out.name && typeof out['itemName'] === 'string') out.name = out['itemName'];
  return out;
}

function extractMicrodataEntities(): any[] {
  const roots = Array.from(document.querySelectorAll<HTMLElement>('[itemscope][itemtype]')).filter(el => {
    const parentScope = el.parentElement ? closestItemScope(el.parentElement) : null;
    return parentScope !== el;
  });

  const entities: any[] = [];
  for (const root of roots) {
    try {
      const item = extractMicrodataItem(root);
      if (item && item['@type']) entities.push(item);
    } catch {
      continue;
    }
  }
  return entities;
}

function extractRdfaEntities(): any[] {
  const roots = Array.from(document.querySelectorAll<HTMLElement>('[typeof]'));
  const entities: any[] = [];

  for (const root of roots) {
    const typeofVal = (root.getAttribute('typeof') || '').trim();
    if (!typeofVal) continue;
    const typeToken = typeofVal.split(/\s+/)[0];
    const t = canonicalType(typeToken);

    const entity: any = { '@type': t };
    const id = root.getAttribute('resource') || root.getAttribute('about') || root.getAttribute('href') || root.getAttribute('src');
    if (id) entity['@id'] = id;

    const props = Array.from(root.querySelectorAll<HTMLElement>('[property]'));
    for (const propEl of props) {
      const nestedTypeofOwner = propEl.closest('[typeof]');
      if (nestedTypeofOwner && nestedTypeofOwner !== root) continue;

      const propNameRaw = (propEl.getAttribute('property') || '').trim();
      if (!propNameRaw) continue;
      const propName = canonicalType(propNameRaw);

      const value =
        propEl.getAttribute('content') ||
        propEl.getAttribute('resource') ||
        propEl.getAttribute('href') ||
        propEl.getAttribute('src') ||
        (propEl.textContent || '').trim();

      addProp(entity, propName, value);
    }

    if (Object.keys(entity).length > 1) entities.push(entity);
  }

  return entities;
}

function summarise(entity: any, extractedFrom: ExtractedFrom): DetectedEntity {
  const schemaType = bestType(entity);
  return {
    extractedFrom,
    schemaType,
    id: bestId(entity),
    name: bestName(entity),
    image: bestImage(entity),
    entity
  };
}

function extractAll(): DetectedEntity[] {
  const out: DetectedEntity[] = [];

  const jsonLd = extractJsonLdEntities();
  for (const e of jsonLd) out.push(summarise(e, 'json-ld'));

  const micro = extractMicrodataEntities();
  for (const e of micro) out.push(summarise(e, 'microdata'));

  const rdfa = extractRdfaEntities();
  for (const e of rdfa) out.push(summarise(e, 'rdfa'));

  return out.filter(x => (x && x.schemaType && x.schemaType !== 'Thing' ? true : !!x.name));
}

async function updateBadge() {
  try {
    const entities = extractAll();
    chrome.runtime.sendMessage({ type: 'OBN_PAGE_ENTITY_COUNT', count: entities.length });
  } catch {
    // ignore
  }
}

updateBadge();

chrome.runtime.onMessage.addListener((msg: any, _sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'OBN_EXTRACT_ENTITIES') {
    const entities = extractAll();
    sendResponse({ ok: true, url: window.location.href, title: document.title, entities });
    return true;
  }

  return;
});

