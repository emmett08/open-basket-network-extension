import React, { useEffect, useMemo, useState } from 'react';
import type { DetectedEntity } from '../../types';
import { makeBasketItem } from '../../lib/normalise';
import { addBasketItem, clearBasket, getBasket } from '../../lib/storage';
import { clampInt, truncate, typeIcon } from '../../lib/utils';

type ScanResult = {
  ok: boolean;
  url: string;
  title: string;
  entities: DetectedEntity[];
};

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

export function App() {
  const [scan, setScan] = useState<ScanResult>({ ok: true, url: '', title: '', entities: [] });
  const [basketCount, setBasketCount] = useState(0);
  const [scanning, setScanning] = useState(false);

  async function refreshBasketCount() {
    const basket = await getBasket();
    setBasketCount(basket.items.length);
  }

  async function scanPage() {
    const tab = await getActiveTab();
    if (!tab?.id) {
      setScan({ ok: true, url: '', title: '', entities: [] });
      return;
    }

    setScanning(true);
    try {
      const res = await chrome.tabs.sendMessage(tab.id, { type: 'OBN_EXTRACT_ENTITIES' });
      if (res?.ok) setScan(res as ScanResult);
      else setScan({ ok: true, url: tab.url || '', title: tab.title || '', entities: [] });
    } catch {
      setScan({ ok: true, url: tab.url || '', title: tab.title || '', entities: [] });
    } finally {
      setScanning(false);
    }
  }

  useEffect(() => {
    refreshBasketCount();
    scanPage();
  }, []);

  const pageMeta = useMemo(() => {
    if (!scan.url) return '';
    return scan.title ? `${scan.title} — ${scan.url}` : scan.url;
  }, [scan.title, scan.url]);

  return (
    <div>
      <header className="hdr">
        <div>
          <div className="title">Open Basket Network</div>
          <div className="sub">Structured data basket</div>
        </div>
        <button
          id="openBasket"
          className="btn"
          onClick={() => chrome.runtime.sendMessage({ type: 'OBN_OPEN_BASKET_PAGE' })}
        >
          Basket
        </button>
      </header>

      <section className="sec">
        <div className="sec-title">
          Detected on this page
          <button id="scan" className="btn btn-secondary" onClick={scanPage} disabled={scanning}>
            {scanning ? 'Scanning…' : 'Scan'}
          </button>
        </div>
        <div id="pageMeta" className="muted">
          {pageMeta}
        </div>

        <div id="entities" className="list">
          {!scan.entities?.length ? (
            <div id="emptyDetected" className="empty" style={{ display: 'block' }}>
              No structured data detected on this page.
            </div>
          ) : (
            scan.entities.map((detected, idx) => (
              <DetectedCard
                key={`${detected.extractedFrom}:${detected.schemaType}:${detected.id}:${idx}`}
                detected={detected}
                pageUrl={scan.url}
                pageTitle={scan.title}
                onAdded={refreshBasketCount}
              />
            ))
          )}
        </div>
      </section>

      <section className="sec">
        <div className="sec-title">Basket</div>
        <div className="row">
          <div className="muted">
            <span id="basketCount">{basketCount}</span> item(s)
          </div>
          <button
            id="clearBasket"
            className="btn btn-danger btn-small"
            onClick={async () => {
              await clearBasket();
              await refreshBasketCount();
            }}
          >
            Clear
          </button>
        </div>
        <div className="row">
          <a
            id="openOptions"
            href="#"
            onClick={async e => {
              e.preventDefault();
              await chrome.runtime.openOptionsPage();
            }}
          >
            Settings
          </a>
        </div>
      </section>
    </div>
  );
}

function DetectedCard(props: {
  detected: DetectedEntity;
  pageUrl: string;
  pageTitle: string;
  onAdded: () => Promise<void>;
}) {
  const { detected, pageUrl, pageTitle, onAdded } = props;

  const [qty, setQty] = useState('1');
  const [adding, setAdding] = useState(false);
  const [btnText, setBtnText] = useState('Add');

  return (
    <div className="card">
      <div className="card-top">
        <div>
          <div className="card-title">
            {typeIcon(detected.schemaType)} {truncate(detected.name || '(unnamed)', 60)}
          </div>
          <div className="tag">
            {(detected.schemaType || 'Thing') + ' · ' + detected.extractedFrom}
          </div>
        </div>

        <button
          className="btn btn-primary"
          disabled={adding}
          onClick={async () => {
            setAdding(true);
            try {
              const quantity = clampInt(qty, { min: 1, max: 9999 });
              const item = makeBasketItem({ detected, quantity, sourceUrl: pageUrl, pageTitle });
              await addBasketItem(item);
              await onAdded();
              setBtnText('Added');
            } catch (err) {
              console.warn(err);
              setBtnText('Error');
            } finally {
              setTimeout(() => {
                setBtnText('Add');
                setAdding(false);
              }, 900);
            }
          }}
        >
          {btnText}
        </button>
      </div>

      <div className="controls">
        <div className="muted">Qty</div>
        <input
          className="qty"
          type="number"
          min={1}
          value={qty}
          onChange={e => setQty(e.target.value)}
        />
      </div>
    </div>
  );
}

