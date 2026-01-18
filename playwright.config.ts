import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'playwright/tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    video: 'on',
    trace: 'retain-on-failure'
  }
});

