export type ExtractedFrom = 'json-ld' | 'microdata' | 'rdfa' | 'unknown';

export type DetectedEntity = {
  extractedFrom: ExtractedFrom;
  schemaType: string;
  id: string;
  name: string;
  image: string;
  entity: unknown;
};

export type BasketItem = {
  basketItemId: string;
  addedAt: string;
  quantity: number;
  schemaType: string;
  extractedFrom: ExtractedFrom;
  source: {
    url: string;
    pageTitle: string;
    detectedId: string;
  };
  title: string;
  image: string;
  derivedNeeds?: unknown;
  entity: unknown;
};

export type Basket = {
  basketId: string;
  createdAt: string;
  updatedAt: string;
  items: BasketItem[];
  lastPublish?: unknown;
};

export type Settings = {
  brokerEndpoint: string;
  authHeaderName: string;
  authHeaderValue: string;
  publishPayload: 'snapshot' | 'offerRequest';
  currency: string;
  deliveryRegion: string;
  requestExpiresSeconds: number;
  debug: boolean;
};

