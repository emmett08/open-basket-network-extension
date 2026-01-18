import type { Basket, Settings } from '../types';
import { nowIso, uuid } from './utils';

export function basketToSnapshot(basket: Basket, settings: Settings) {
  return {
    type: 'BasketSnapshot',
    version: '0.1',
    basketId: basket.basketId,
    createdAt: basket.createdAt,
    updatedAt: basket.updatedAt,
    generatedAt: nowIso(),
    buyerContext: {
      currency: settings.currency || 'GBP',
      deliveryRegion: settings.deliveryRegion || ''
    },
    items: (basket.items || []).map(i => ({
      basketItemId: i.basketItemId,
      schemaType: i.schemaType,
      quantity: i.quantity,
      extractedFrom: i.extractedFrom,
      source: i.source,
      title: i.title,
      derivedNeeds: i.derivedNeeds,
      entity: i.entity
    }))
  };
}

export function basketToOfferRequest(basket: Basket, settings: Settings) {
  const now = new Date();
  const expiresMs = (settings.requestExpiresSeconds || 300) * 1000;
  return {
    type: 'OfferRequest',
    version: '0.1',
    requestId: 'req_' + uuid(),
    basketId: basket.basketId,
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + expiresMs).toISOString(),
    buyerContext: {
      currency: settings.currency || 'GBP',
      deliveryRegion: settings.deliveryRegion || ''
    },
    items: (basket.items || []).map(i => ({
      basketItemId: i.basketItemId,
      schemaType: i.schemaType,
      quantity: i.quantity,
      source: i.source,
      entity: i.entity,
      derivedNeeds: i.derivedNeeds
    }))
  };
}

