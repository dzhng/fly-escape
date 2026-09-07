import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const out = process.env.ZAPPER_OUT ?? '/tmp/fly-zapper-house';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('fly-escape-progress', JSON.stringify({ bestStars: { 'open-window': 1 }, setups: {} }));
    const Worker = window.Worker;
    window.Worker = class extends Worker {
      set onmessage(callback) {
        super.onmessage = event => {
          if (event.data.type === 'setup' && event.data.value?.state) window.setup = event.data.value;
          callback(event);
        };
      }
    };
  });
  await page.goto(process.env.ZAPPER_URL ?? 'http://127.0.0.1:5173');
  const ready = () => page.waitForFunction(() =>
    document.querySelector('[data-testid="setup-game"]')?.dataset.worldState === 'ready'
    && document.querySelector('.run-setup')?.disabled === false);
  await ready();
  await page.getByRole('button', { name: /2\. Turn the Corner/ }).click();
  await ready();
  await page.getByText('Already in this house', { exact: true }).click();
  await page.getByText('Bug zapper', { exact: true }).waitFor();
  const state = await page.evaluate(() => window.setup.state);
  assert.ok(state.contactHazards.length > 0);
  assert.ok(state.contactHazards.every(hazard => hazard.kind === 'zapper'));
  assert.ok(state.contactHazards.every(hazard => state.objects.some(surface => surface.id === hazard.surfaceId)));
  assert.equal(state.placements.length, 0);
  await page.screenshot({ path: `${out}/house.png` });
  await page.mouse.move(550, 500);
  await page.mouse.wheel(0, -480);
  await page.mouse.move(1200, 120);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/close.png` });
  await writeFile(`${out}/report.json`, JSON.stringify({ hazards: state.contactHazards.length, objects: state.objects.length, errors }, null, 2));
  assert.deepEqual(errors, []);
  console.log({ hazards: state.contactHazards.length, errors });
} finally {
  await browser.close();
}
