import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const output = process.env.SETUP_CANCEL_OUTPUT ?? '/tmp/fly-setup-cancellation';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { errors: [] };
try {
  const page = await browser.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('fly-escape-progress', JSON.stringify({ bestStars: { 'open-window': 1 }, setups: {} }));
    const NativeWorker = window.Worker;
    window.setupReplyBlocked = false;
    window.Worker = class extends NativeWorker {
      heldRequest;
      postMessage(message, ...rest) {
        if (message.type === 'setup' && message.command.type === 'resolve' && this.heldRequest === undefined)
          this.heldRequest = message.requestId;
        super.postMessage(message, ...rest);
      }
      set onmessage(receive) {
        super.onmessage = event => {
          if (event.data.type === 'setup' && event.data.requestId === this.heldRequest && !window.setupReplyBlocked) {
            window.setupReplyBlocked = true;
            window.releaseSetupReply = () => receive(event);
          } else receive(event);
        };
      }
    };
  });
  await page.goto(process.env.BRAIN_URL ?? 'http://127.0.0.1:5320');
  // Hold the old level's reply, not a particular Worker creation order.
  await page.waitForFunction(() => window.setupReplyBlocked, undefined, { timeout: 30000 });
  await page.getByRole('button', { name: /2\. Turn the Corner/ }).click();
  await page.waitForFunction(() => document.querySelector('[data-testid="setup-game"]')?.dataset.worldState === 'ready');
  await page.waitForFunction(() => document.querySelector('.run-setup')?.disabled === false);
  await page.evaluate(() => window.releaseSetupReply());
  assert.equal(await page.getByRole('button', { name: /2\. Turn the Corner/ }).getAttribute('aria-current'), 'step');
  await page.getByRole('button', { name: 'Release the flies', exact: true }).click();
  await page.waitForFunction(() => {
    const text = document.querySelector('[data-testid="playback-report"]')?.textContent;
    return text && JSON.parse(text).spec?.levelId === 'turn-the-corner';
  });
  report.liveWorkers = page.workers().map(worker => worker.url());
  assert.equal(report.liveWorkers.length, 1, 'level changes reuse one Worker without restarting the abandoned setup');
  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (error) {
  report.failure = String(error);
  process.exitCode = 1;
} finally {
  await mkdir(output, { recursive: true });
  await writeFile(output + '/report.json', JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(report);
