import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const out = process.env.FAILURE_OUT ?? '/tmp/fly-playback-failure';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  const diagnostics = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') diagnostics.push(message.text()); });
  await page.addInitScript(() => {
    const random = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = array => array instanceof BigUint64Array && array.length === 1
      ? (array[0] = 42n, array) : random(array);
    const Worker = window.Worker;
    window.Worker = class extends Worker {
      constructor(url, options) {
        super(url, options);
        if (String(url).includes('attempt-worker')) {
          window.breakProducer = () => this.dispatchEvent(new ErrorEvent('error', { message: 'Injected producer failure' }));
        }
      }
    };
  });
  await page.goto(process.env.FAILURE_URL ?? 'http://127.0.0.1:5173');
  await page.getByRole('button', { name: 'Release the flies' }).click();
  await page.waitForFunction(() => document.querySelector('[data-testid="playback-lab"]')?.dataset.playbackState === 'playing');
  await page.waitForFunction(() => Number(document.querySelector('[data-testid="playback-lab"]')?.dataset.cursorTick) >= 10);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.mouse.move(1400, 50);
  await page.waitForTimeout(200);
  // Read the rendered canvas itself: a DOM screenshot includes the intentionally
  // changing error banner and playback controls overlaid on the world.
  const worldPixels = () => page.locator('.playback-world .canvas canvas').evaluate(canvas =>
    new Promise(resolve => requestAnimationFrame(() => resolve(canvas.toDataURL()))));
  const rosterPixels = () => page.locator('.fly-roster canvas').evaluateAll(canvases => canvases.map(canvas => canvas.toDataURL()));
  const before = await worldPixels();
  assert.ok(Buffer.from(before.split(',')[1], 'base64').length > 10000, 'world capture must contain the rendered house');
  const previewsBefore = await rosterPixels();
  await page.evaluate(() => window.breakProducer());
  await page.waitForFunction(() => document.querySelector('[data-testid="playback-lab"]')?.dataset.playbackState === 'error');
  assert.equal(await page.getByRole('alert').innerText(), 'This flight was interrupted. You can try again from setup.');
  const cursor = await page.getByTestId('playback-lab').getAttribute('data-cursor-tick');
  await page.screenshot({ path: `${out}/failed.png` });
  await page.setViewportSize({ width: 1100, height: 850 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/resized.png` });
  const panelScrolls = await page.locator('aside').evaluate(panel => { panel.scrollTop = 100; const moved = panel.scrollTop > 0; panel.scrollTop = 0; return moved; });
  assert.ok(panelScrolls, 'narrow viewport retains access to lower fly cards');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/restored.png` });
  const after = await worldPixels();
  const restored = before === after;
  await writeFile(`${out}/report.json`, JSON.stringify({ restored, errors, diagnostics, cursor }, null, 2));
  assert.equal(await page.getByTestId('playback-lab').getAttribute('data-cursor-tick'), cursor);
  assert.ok(restored, 'failure and resize retain the paused scene pixels');
  assert.deepEqual(await rosterPixels(), previewsBefore, 'failure and resize retain the last valid fly previews');
  assert.equal(diagnostics.filter(message => message.includes('attempt failed')).length, 1);
  assert.deepEqual(errors, []);
  await page.getByRole('button', { name: 'Back to setup', exact: true }).click();
  await page.getByRole('button', { name: 'Leave attempt', exact: true }).click();
  await page.getByRole('button', { name: 'Release the flies' }).click();
  await page.waitForFunction(() => document.querySelector('[data-testid="playback-lab"]')?.dataset.playbackState === 'playing');
  assert.equal(await page.getByRole('button', { name: 'Pause', exact: true }).isEnabled(), true);
  await page.evaluate(() => {
    const draw = WebGL2RenderingContext.prototype.drawElements;
    window.failedDrawCalls = 0;
    window.restoreDrawing = () => { WebGL2RenderingContext.prototype.drawElements = draw; };
    WebGL2RenderingContext.prototype.drawElements = function () {
      window.failedDrawCalls++;
      throw new Error('Injected renderer failure');
    };
  });
  await page.waitForFunction(() => document.querySelector('[data-testid="playback-lab"]')?.dataset.playbackState === 'error');
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => window.failedDrawCalls), 1, 'a broken renderer is not retried every frame');
  await page.evaluate(() => window.restoreDrawing());
  assert.equal(diagnostics.filter(message => message.includes('attempt failed')).length, 2);
  assert.deepEqual(errors, []);
  await page.getByRole('button', { name: 'Back to setup', exact: true }).click();
  await page.getByRole('button', { name: 'Leave attempt', exact: true }).click();
  await page.getByRole('button', { name: 'Release the flies' }).click();
  await page.waitForFunction(() => document.querySelector('[data-testid="playback-lab"]')?.dataset.playbackState === 'playing');
  await writeFile(`${out}/report.json`, JSON.stringify({ restored, errors, diagnostics, cursor, rendererFailureCalls: 1, restartedAfterBothFailures: true }, null, 2));
  console.log('Producer failure retains the scene; renderer failure stops drawing; both allow a fresh attempt.');
} finally {
  await browser.close();
}
