import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve('.spectorque/browsers');

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 2 : 3,
  timeout: 30_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: ['chromium', 'firefox', 'webkit'].flatMap(browserName =>
    [375, 768, 1280].map(width => ({
      name: `${browserName}-${width}`,
      use: { browserName: browserName as 'chromium' | 'firefox' | 'webkit', viewport: { width, height: 900 } },
    }))),
});
