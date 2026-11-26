// Renders docs/assets/brand/icon.svg to the PNG sizes that marketplaces require
// (VS Code and Open VSX: 128 px or more, Codex logo and Anthropic directory: square PNG).
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const svg = await readFile('docs/assets/brand/icon.svg', 'utf8');
const browser = await chromium.launch();
try {
  for (const size of [128, 256]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    await page.screenshot({ path: `docs/assets/brand/icon-${size}.png`, omitBackground: true });
    await page.close();
  }
} finally { await browser.close(); }
console.log('Rendered docs/assets/brand/icon-128.png and icon-256.png');
