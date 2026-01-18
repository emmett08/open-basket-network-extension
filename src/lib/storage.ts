import type { Basket, Settings } from '../types';
import { nowIso, uuid } from './utils';

const BASKET_KEY = 'obn_basket_v1';
const SETTINGS_KEY = 'obn_settings_v1';

export const DEFAULT_SETTINGS: Settings = {
  brokerEndpoint: '',
  authHeaderName: 'Authorization',
  authHeaderValue: '',
  publishPayload: 'snapshot',
  currency: 'GBP',
  deliveryRegion: '',
  requestExpiresSeconds: 300,
  debug: false
};

export async function getSettings(): Promise<Settings> {
  const res = await chrome.storage.sync.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(res[SETTINGS_KEY] || {}) };
}

export async function saveSettings(partial: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next = { ...current, ...partial };
  await chrome.storage.sync.set({ [SETTINGS_KEY]: next });
  return next;
}

function freshBasket(): Basket {
  const now = nowIso();
  return {
    basketId: 'local_' + uuid(),
    createdAt: now,
    updatedAt: now,
    items: []
  };
}

export async function getBasket(): Promise<Basket> {
  const res = await chrome.storage.local.get(BASKET_KEY);
  const basket = res[BASKET_KEY];
  if (basket && typeof basket === 'object' && Array.isArray(basket.items)) {
    return basket as Basket;
  }
  const fresh = freshBasket();
  await chrome.storage.local.set({ [BASKET_KEY]: fresh });
  return fresh;
}

export async function saveBasket(basket: Basket): Promise<Basket> {
  const next = { ...basket, updatedAt: nowIso() };
  await chrome.storage.local.set({ [BASKET_KEY]: next });
  return next;
}

export async function clearBasket(): Promise<Basket> {
  const fresh = freshBasket();
  await chrome.storage.local.set({ [BASKET_KEY]: fresh });
  return fresh;
}

export async function addBasketItem(item: Basket['items'][number]): Promise<Basket> {
  const basket = await getBasket();
  basket.items.push(item);
  return await saveBasket(basket);
}

export async function updateItemQuantity(basketItemId: string, quantity: number): Promise<Basket> {
  const basket = await getBasket();
  const idx = basket.items.findIndex(i => i.basketItemId === basketItemId);
  if (idx >= 0) {
    basket.items[idx] = { ...basket.items[idx], quantity };
  }
  return await saveBasket(basket);
}

export async function removeBasketItem(basketItemId: string): Promise<Basket> {
  const basket = await getBasket();
  basket.items = basket.items.filter(i => i.basketItemId !== basketItemId);
  return await saveBasket(basket);
}

export async function setLastPublishResult(result: unknown): Promise<Basket> {
  const basket = await getBasket();
  basket.lastPublish = { ...(result as object), recordedAt: nowIso() };
  return await saveBasket(basket);
}

