import React, { useEffect, useState } from 'react';
import type { Settings } from '../../types';
import { DEFAULT_SETTINGS, getSettings, saveSettings } from '../../lib/storage';
import { clampInt } from '../../lib/utils';

export function OptionsApp() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState('');

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  function setStatusMsg(msg: string) {
    setStatus(msg);
    setTimeout(() => setStatus(''), 1600);
  }

  async function onSave() {
    const next = {
      ...settings,
      brokerEndpoint: (settings.brokerEndpoint || '').trim(),
      authHeaderName: (settings.authHeaderName || 'Authorization').trim(),
      authHeaderValue: (settings.authHeaderValue || '').trim(),
      publishPayload: settings.publishPayload === 'offerRequest' ? 'offerRequest' : 'snapshot',
      requestExpiresSeconds: clampInt(settings.requestExpiresSeconds, { min: 30, max: 3600 }),
      currency: (settings.currency || 'GBP').trim().toUpperCase(),
      deliveryRegion: (settings.deliveryRegion || '').trim(),
      debug: !!settings.debug
    } satisfies Settings;

    const saved = await saveSettings(next);
    setSettings(saved);
    setStatusMsg('Saved');
  }

  async function onReset() {
    const saved = await saveSettings(DEFAULT_SETTINGS);
    setSettings(saved);
    setStatusMsg('Reset to defaults');
  }

  return (
    <div>
      <header className="hdr">
        <div>
          <div className="title">Open Basket Network</div>
          <div className="sub">Extension settings</div>
        </div>
      </header>

      <main className="panel">
        <div className="row">
          <label>
            <div className="lbl">Broker publish endpoint URL</div>
            <input
              id="brokerEndpoint"
              type="url"
              placeholder="https://broker.example.com/api/v1/baskets/publish"
              value={settings.brokerEndpoint}
              onChange={e => setSettings(s => ({ ...s, brokerEndpoint: e.target.value }))}
            />
          </label>
        </div>

        <div className="row grid">
          <label>
            <div className="lbl">Auth header name (optional)</div>
            <input
              id="authHeaderName"
              type="text"
              placeholder="Authorization"
              value={settings.authHeaderName}
              onChange={e => setSettings(s => ({ ...s, authHeaderName: e.target.value }))}
            />
          </label>
          <label>
            <div className="lbl">Auth header value (optional)</div>
            <input
              id="authHeaderValue"
              type="password"
              placeholder="Bearer ..."
              value={settings.authHeaderValue}
              onChange={e => setSettings(s => ({ ...s, authHeaderValue: e.target.value }))}
            />
          </label>
        </div>

        <div className="row grid">
          <label>
            <div className="lbl">Publish payload</div>
            <select
              id="publishPayload"
              value={settings.publishPayload}
              onChange={e =>
                setSettings(s => ({
                  ...s,
                  publishPayload: e.target.value === 'offerRequest' ? 'offerRequest' : 'snapshot'
                }))
              }
            >
              <option value="snapshot">BasketSnapshot (simple)</option>
              <option value="offerRequest">OfferRequest (RFQ-style)</option>
            </select>
          </label>
          <label>
            <div className="lbl">Offer expiry (seconds)</div>
            <input
              id="requestExpiresSeconds"
              type="number"
              min={30}
              step={10}
              value={settings.requestExpiresSeconds}
              onChange={e => setSettings(s => ({ ...s, requestExpiresSeconds: Number(e.target.value) }))}
            />
          </label>
        </div>

        <div className="row grid">
          <label>
            <div className="lbl">Currency</div>
            <input
              id="currency"
              type="text"
              placeholder="GBP"
              value={settings.currency}
              onChange={e => setSettings(s => ({ ...s, currency: e.target.value }))}
            />
          </label>
          <label>
            <div className="lbl">Delivery region (optional)</div>
            <input
              id="deliveryRegion"
              type="text"
              placeholder="GB-LND"
              value={settings.deliveryRegion}
              onChange={e => setSettings(s => ({ ...s, deliveryRegion: e.target.value }))}
            />
          </label>
        </div>

        <div className="row">
          <label className="check">
            <input
              id="debug"
              type="checkbox"
              checked={settings.debug}
              onChange={e => setSettings(s => ({ ...s, debug: e.target.checked }))}
            />
            <span>Enable debug logging</span>
          </label>
        </div>

        <div className="row actions">
          <button id="save" className="btn btn-primary" onClick={onSave}>
            Save
          </button>
          <button id="reset" className="btn" onClick={onReset}>
            Reset to defaults
          </button>
          <span id="status" className="status">
            {status}
          </span>
        </div>

        <div className="note">
          <strong>Privacy note:</strong> publishing sends a basket snapshot containing the structured data entities you
          added, plus the page URL they came from. It does not include your browsing history. Add address/payment
          details only after you have selected suppliers.
        </div>
      </main>
    </div>
  );
}

