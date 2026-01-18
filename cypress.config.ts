import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'cypress';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function extensionIdFromKeyBase64(base64Key: string) {
  const buf = Buffer.from(base64Key, 'base64');
  const hash = crypto.createHash('sha256').update(buf).digest();
  let id = '';
  for (const b of hash.subarray(0, 16)) {
    id += String.fromCharCode(97 + ((b >> 4) & 0xf));
    id += String.fromCharCode(97 + (b & 0xf));
  }
  return id;
}

export default defineConfig({
  video: true,
  videosFolder: 'cypress/videos',
  screenshotsFolder: 'cypress/screenshots',
  chromeWebSecurity: false,
  e2e: {
    setupNodeEvents(on, config) {
      const extensionPath = path.resolve(__dirname, 'dist-test-extension');
      const manifestPath = path.join(extensionPath, 'manifest.json');

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const extensionId = extensionIdFromKeyBase64(manifest.key);

      config.env.EXTENSION_PATH = extensionPath;
      config.env.EXTENSION_ID = extensionId;

      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.family !== 'chromium' || browser.name === 'electron') return launchOptions;

        launchOptions.args.push(`--disable-extensions-except=${extensionPath}`);
        launchOptions.args.push(`--load-extension=${extensionPath}`);
        return launchOptions;
      });

      return config;
    }
  }
});
