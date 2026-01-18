import React, { useCallback, useMemo, useState } from 'react';
import type { Basket, BasketItem, Settings } from '../../types';
import { basketToOfferRequest, basketToSnapshot } from '../../lib/protocol';
import {
  clearBasket,
  getBasket,
  getSettings,
  removeBasketItem,
  setLastPublishResult,
  updateItemQuantity
} from '../../lib/storage';
import { clampInt, safeJsonStringify, typeIcon, withTimeout } from '../../lib/utils';
import { useAsync } from '../shared/useAsync';

export function BasketApp() {
  const { data, loading } = useAsync(async () => {
    const [basket, settings] = await Promise.all([getBasket(), getSettings()]);
    return { basket, settings };
  }, []);

  const [toastMsg, setToastMsg] = useState('');

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 1800);
  }, []);

  const basket = data?.basket;
  const settings = data?.settings;

  const publishModeText = useMemo(() => {
    if (!settings) return '';
    return settings.publishPayload === 'offerRequest' ? 'OfferRequest (RFQ)' : 'BasketSnapshot';
  }, [settings]);

  const brokerEndpointText = useMemo(() => {
    if (!settings) return '';
    return settings.brokerEndpoint ? settings.brokerEndpoint : '(not set)';
  }, [settings]);

  const refresh = useCallback(async () => {
    const [basket, settings] = await Promise.all([getBasket(), getSettings()]);
    return { basket, settings };
  }, []);

  const [snapshot, setSnapshot] = useState<{ basket: Basket; settings: Settings } | null>(null);
  React.useEffect(() => {
    if (data) setSnapshot(data);
  }, [data]);

  async function exportJson() {
    if (!snapshot) return;
    const payload =
      snapshot.settings.publishPayload === 'offerRequest'
        ? basketToOfferRequest(snapshot.basket, snapshot.settings)
        : basketToSnapshot(snapshot.basket, snapshot.settings);

    const text = safeJsonStringify(payload, 2);
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied JSON to clipboard');
      return;
    } catch {
      // ignore
    }

    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `obn-${payload.type.toLowerCase()}-${snapshot.basket.basketId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Downloaded JSON');
  }

  async function publish() {
    if (!snapshot) return;
    const { basket, settings } = snapshot;

    if (!basket.items.length) {
      toast('Basket is empty');
      return;
    }
    if (!settings.brokerEndpoint) {
      toast('Set broker endpoint in Settings');
      return;
    }

    const payload =
      settings.publishPayload === 'offerRequest' ? basketToOfferRequest(basket, settings) : basketToSnapshot(basket, settings);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-OBN-Message-Type': payload.type,
      'X-OBN-Message-Version': payload.version,
      'Idempotency-Key': (payload as any).requestId || payload.basketId || String(Date.now())
    };
    if (settings.authHeaderValue) {
      headers[settings.authHeaderName || 'Authorization'] = settings.authHeaderValue;
    }

    const startedAt = new Date().toISOString();

    try {
      const res = await withTimeout(
        fetch(settings.brokerEndpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        }),
        15000
      );

      const contentType = res.headers.get('content-type') || '';
      const body = contentType.includes('application/json') ? await res.json() : await res.text();

      const result = {
        ok: res.ok,
        status: res.status,
        startedAt,
        finishedAt: new Date().toISOString(),
        endpoint: settings.brokerEndpoint,
        requestPayloadType: payload.type,
        response: body
      };

      await setLastPublishResult(result);
      const next = await refresh();
      setSnapshot(next);
      toast(res.ok ? 'Published' : `Publish failed (${res.status})`);
    } catch (err) {
      const result = {
        ok: false,
        startedAt,
        finishedAt: new Date().toISOString(),
        endpoint: settings.brokerEndpoint,
        requestPayloadType: payload.type,
        error: String(err)
      };
      await setLastPublishResult(result);
      const next = await refresh();
      setSnapshot(next);
      toast('Publish error');
    }
  }

  if (loading || !snapshot) {
    return (
      <div style={{ padding: 18, color: 'var(--muted)' }}>
        Loading…
      </div>
    );
  }

  return (
    <div>
      <header className="hdr">
        <div>
          <div className="title">Your Basket</div>
          <div className="sub">A generalised basket for schema.org entities</div>
        </div>
        <div className="hdr-actions">
          <button className="btn btn-secondary" onClick={() => chrome.runtime.openOptionsPage()}>
            Settings
          </button>
          <button className="btn" onClick={exportJson}>
            Export JSON
          </button>
          <button className="btn btn-primary" onClick={publish}>
            Request Offers
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="panel">
          <div className="panel-title">Items</div>
          <div className="list">
            {!snapshot.basket.items.length ? (
              <div className="empty" style={{ display: 'block' }}>
                Your basket is empty. Use the extension popup to add items from structured data.
              </div>
            ) : (
              snapshot.basket.items.map(item => (
                <BasketItemRow
                  key={item.basketItemId}
                  item={item}
                  onChange={async () => {
                    const next = await refresh();
                    setSnapshot(next);
                  }}
                  toast={toast}
                />
              ))
            )}
          </div>
        </section>

        <aside className="panel">
          <div className="panel-title">Summary</div>
          <div className="kv">
            <div className="k">Basket ID</div>
            <div className="v">{snapshot.basket.basketId}</div>
          </div>
          <div className="kv">
            <div className="k">Items</div>
            <div className="v">{String(snapshot.basket.items.length)}</div>
          </div>
          <div className="kv">
            <div className="k">Publish mode</div>
            <div className="v">{publishModeText}</div>
          </div>
          <div className="kv">
            <div className="k">Broker endpoint</div>
            <div className="v">{brokerEndpointText}</div>
          </div>

          <div className="divider"></div>
          <div className="panel-title">Last publish</div>
          <pre className="pre">{snapshot.basket.lastPublish ? safeJsonStringify(snapshot.basket.lastPublish, 2) : '(nothing published yet)'}</pre>

          <div className="divider"></div>
          <button
            className="btn btn-danger"
            onClick={async () => {
              await clearBasket();
              const next = await refresh();
              setSnapshot(next);
              toast('Basket cleared');
            }}
          >
            Clear basket
          </button>
        </aside>
      </main>

      {toastMsg ? (
        <div className="toast">{toastMsg}</div>
      ) : (
        <div className="toast" hidden />
      )}
    </div>
  );
}

function BasketItemRow(props: { item: BasketItem; onChange: () => Promise<void>; toast: (msg: string) => void }) {
  const { item, onChange, toast } = props;
  const [qty, setQty] = useState(String(item.quantity ?? 1));

  return (
    <div className="item">
      <div className="item-top">
        <div>
          <div className="item-title">
            {typeIcon(item.schemaType)} {item.title || item.schemaType || 'Thing'}
          </div>
          <div className="item-meta">
            {(item.schemaType || 'Thing') + ' · ' + (item.extractedFrom || 'unknown')}
            {item.source?.url ? <SourceLink url={item.source.url} /> : null}
          </div>
        </div>

        <div className="item-actions">
          <input className="qty" type="number" min={1} value={qty} onChange={e => setQty(e.target.value)} />
          <button
            className="btn"
            onClick={async () => {
              const q = clampInt(qty, { min: 1, max: 9999 });
              await updateItemQuantity(item.basketItemId, q);
              await onChange();
              toast('Quantity updated');
            }}
          >
            Update
          </button>
          <button
            className="btn btn-danger"
            onClick={async () => {
              await removeBasketItem(item.basketItemId);
              await onChange();
              toast('Removed');
            }}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function SourceLink(props: { url: string }) {
  try {
    const u = new URL(props.url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return (
      <>
        {' · '}
        <a className="link" href={u.toString()} target="_blank" rel="noreferrer">
          source
        </a>
      </>
    );
  } catch {
    return null;
  }
}

