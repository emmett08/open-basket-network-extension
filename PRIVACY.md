# Privacy Policy (Open Basket Network Chrome Extension)

Last updated: 2026-01-18

## Summary

Open Basket Network is a client-side Chrome extension that lets you extract structured data from the current page, add selected entities to a local “basket”, and optionally publish a basket payload to a broker endpoint you configure.

We do not sell user data. We do not use collected data for advertising. We do not collect analytics/telemetry.

## Data we handle

### Website content (structured data)
When you click **Scan** in the extension popup, the extension reads structured data already present on the current web page (for example JSON‑LD, microdata, RDFa). If you click **Add**, the selected entity data is stored in your local basket.

This data can include any fields that appear in a page’s structured data. The extension does not intentionally request or derive sensitive personal data, but it may be present on some sites.

### Web history (source URL + page title)
For each basket item, the extension stores the **source page URL** and **page title** so you can trace where an item came from.

### Settings you enter
In Settings, you can enter:
- Broker publish endpoint URL
- Optional auth header name/value (for API keys or tokens)
- Publish mode, currency, delivery region, request expiry, and debug flag

If you provide an auth header value, it may be considered authentication information.

## Where data is stored

Data is stored using Chrome extension storage:
- Basket items: `chrome.storage.local` (on your device)
- Settings: `chrome.storage.sync` (synced by Google across browsers where you are signed in, subject to Chrome Sync)

## When data is shared

The extension only transmits basket data when you explicitly click **Request Offers** (or otherwise trigger publish) on the Basket page.

When publishing, it sends the basket payload (BasketSnapshot or OfferRequest) to the broker endpoint URL you configured, including:
- The selected structured data entities you added to the basket
- Source page URL/title for each basket item
- Your configured settings fields used to build the payload (e.g., currency/region)
- Optional auth header value if you provided one

No data is sent to any other third party by the extension.

## What we do NOT collect

The extension does not:
- Track your browsing history beyond the source URL/title you store for items you add to the basket
- Record keystrokes, mouse movement, scrolling, or other activity on web pages
- Collect passwords or payment details unless you manually enter them into Settings (auth header value) or they appear inside structured data you choose to add
- Use advertising identifiers or sell/share data for advertising purposes

## Data retention and deletion

- You can remove individual items from the basket or clear the basket in the UI.
- You can reset Settings to defaults in the Settings page.
- You can also remove all extension data by uninstalling the extension.

## Security

Data is stored in Chrome’s extension storage on your device and (for synced settings) via Chrome Sync. If you configure an auth header value, treat it like a secret and only use broker endpoints you trust.

## Contact

For questions or concerns, open an issue:
https://github.com/emmett08/open-basket-network-extension/issues

