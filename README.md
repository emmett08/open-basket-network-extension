# Open Basket Network (Chrome Extension) — MVP

This extension lets a user **add schema.org entities from any web page** into a **generalised basket**, then **publish** that basket to a broker endpoint.

It supports:
- JSON-LD (`<script type="application/ld+json">`)
- Microdata (basic)
- RDFa (very basic)

## What it does

1. You browse the web as normal.
2. The extension detects structured data and shows it in the popup.
3. You add selected entities (Product, Recipe, Service, Event, etc.) to a single basket.
4. You open the basket page and click **Request Offers**.
5. The extension POSTs either:
   - `BasketSnapshot` (simple)
   - or `OfferRequest` (RFQ-style)
   to a configured broker URL.

The broker is expected to distribute the request to suppliers and manage the multi-seller fulfilment lifecycle.

## Install (developer mode)

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Build once: `npm install` then `npm run build`
5. Select this folder: `open-basket-network-extension/dist`

## Dev + debugging (VSCode)

- Run `npm install` once.
- Run `npm run typecheck` and `npm run build`.
- VSCode: use the provided launch config in `.vscode/launch.json` (“Chrome: Run Extension (unpacked)”) to start Chrome with the extension loaded.
- Debug pages:
  - Popup: open the extension popup, then right-click → **Inspect**
  - Basket: open basket page (from popup → **Basket**), then right-click → **Inspect**
  - Service worker: `chrome://extensions` → Open Basket Network → **Service worker** → **Inspect**
  - Content script: open any page, then DevTools → **Sources** → **Content scripts**

## Automated journeys (Cypress, with MP4 video)

- `npm run test:e2e` runs a Playwright journey with the extension loaded and produces videos in `playwright/videos/` (MP4 conversion requires `ffmpeg` on your PATH).
- Cypress is still included, but Cypress cannot `cy.visit()` `chrome-extension://` pages, so it’s mainly useful for web-page-only flows.
- `npm run test:cypress` runs Cypress in Chrome and records MP4 videos in `cypress/videos/`.
- `npm run test:cypress:open` opens the interactive Cypress runner.

## Persona videos (MP4)

- `npm run personas:videos` records “human-paced” Playwright journeys into `artifacts/persona-videos/` as `.webm`.
- `npm run personas:mp4` converts those `.webm` files to `.mp4` (uses bundled `ffmpeg-static`).

## Publish (zip)

- `npm run publish` builds into `dist/` and writes a versioned zip to `release/`.

## Chrome Web Store assets

- `npm run store:assets` generates listing images into `store/` (store icon, screenshots, promo tiles). Use `STORE_LISTING.md` as a fill-in template for the Web Store form.

## Privacy

- Privacy policy: `PRIVACY.md`

## Configure

Open the extension **Settings** and set:
- **Broker publish endpoint URL**: e.g. `https://broker.example.com/api/v1/baskets/publish`
- (Optional) Auth header name/value (for API keys)
- Publish mode:
  - `BasketSnapshot` (recommended to start)
  - `OfferRequest` (closer to decentralised RFQ semantics)

## Data model

Basket items are stored locally in `chrome.storage.local`.
Settings are stored in `chrome.storage.sync`.

## Protocol examples

See `protocol/*.example.json`.

## Notes and limitations

- This is a **minimal MVP**. JSON-LD extraction is the most robust; microdata/RDFa extraction is best-effort.
- Some pages (e.g. `chrome://` URLs) do not allow content scripts.
- This extension does not receive supplier offers directly; offers are expected to return to the broker.

## Next improvements

- Better RDFa and microdata parsing
- Entity ranking (prefer Offer + itemOffered, prefer Product/Recipe over WebPage)
- Per-item normalisation templates (Product vs Recipe vs Event vs Service)
- Multi-language ingredient parsing and unit normalisation for recipes
- Optional local rules ("no substitutions", "all-or-nothing")
- Signed messages and end-to-end integrity checks
