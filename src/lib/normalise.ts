import type { BasketItem, DetectedEntity, ExtractedFrom } from '../types';
import { nowIso, uuid } from './utils';

function asArray(x: unknown): unknown[] {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

export function deriveNeeds(entity: any, schemaType: string): unknown | undefined {
  const t = String(schemaType || '').toLowerCase();
  if (!t.includes('recipe')) return undefined;

  const recipeIngredient = asArray(entity.recipeIngredient || entity.ingredients).filter(Boolean);

  if (recipeIngredient.length) {
    return {
      kind: 'ingredient-set',
      minimise: true,
      substitutionsAllowed: true,
      items: recipeIngredient.map(i => ({ name: String(i) }))
    };
  }

  return {
    kind: 'ingredient-set',
    minimise: true,
    substitutionsAllowed: true,
    items: []
  };
}

export function makeBasketItem(opts: {
  detected: DetectedEntity;
  quantity: number;
  sourceUrl: string;
  pageTitle: string;
}): BasketItem {
  const { detected, quantity, sourceUrl, pageTitle } = opts;
  const schemaType = detected.schemaType || 'Thing';
  const entity = (detected.entity ?? {}) as any;

  const item: BasketItem = {
    basketItemId: 'item_' + uuid(),
    addedAt: nowIso(),
    quantity: quantity ?? 1,
    schemaType,
    extractedFrom: (detected.extractedFrom || 'unknown') as ExtractedFrom,
    source: {
      url: sourceUrl,
      pageTitle: pageTitle || '',
      detectedId: detected.id || ''
    },
    title: detected.name || entity.name || pageTitle || schemaType,
    image: detected.image || entity.image || '',
    entity
  };

  const needs = deriveNeeds(entity, schemaType);
  if (needs) item.derivedNeeds = needs;

  return item;
}

