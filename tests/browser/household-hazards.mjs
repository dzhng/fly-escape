import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const out = process.env.HAZARDS_OUT ?? '/tmp/fly-household-hazards';
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
  await page.goto(process.env.HAZARDS_URL ?? 'http://127.0.0.1:5173');
  const ready = () => page.waitForFunction(() =>
    document.querySelector('[data-testid="setup-game"]')?.dataset.worldState === 'ready'
    && document.querySelector('.run-setup')?.disabled === false);
  const results = [];
  for (const [level, name, kind] of [
    [/1\. Open Window/, 'Spider web', 'web'],
    [/2\. Turn the Corner/, 'Bug zapper', 'zapper'],
  ]) {
    await ready();
    await page.getByRole('button', { name: level }).click();
    await ready();
    const fixed = page.getByText('Already in this house', { exact: true });
    if (!(await page.getByText(name, { exact: true }).isVisible())) await fixed.click();
    await page.getByText(name, { exact: true }).waitFor();
    const state = await page.evaluate(() => window.setup.state);
    assert.ok(state.contactHazards.length > 0);
    assert.ok(state.contactHazards.every(hazard => hazard.kind === kind));
    assert.ok(state.contactHazards.every(hazard => state.objects.some(surface => surface.id === hazard.surfaceId)));
    assert.equal(state.placements.length, 0);
    await page.screenshot({ path: `${out}/${kind}-house.png` });
    if (kind === 'web') {
      await page.mouse.move(370, 720);
      await page.mouse.down();
      await page.mouse.move(550, 520, { steps: 10 });
      await page.mouse.up();
    }
    await page.mouse.move(550, 500);
    await page.mouse.wheel(0, -480);
    await page.mouse.move(1200, 120);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${out}/${kind}-close.png` });
    results.push({ kind, hazards: state.contactHazards.length, objects: state.objects.length });
  }
  await writeFile(`${out}/report.json`, JSON.stringify({ results, errors }, null, 2));
  assert.deepEqual(errors, []);
  console.log({ results, errors });
} finally {
  await browser.close();
}
