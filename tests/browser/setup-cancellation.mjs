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
  });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let blocked;
  const loading = new Promise(resolve => { blocked = resolve; });
  let entries = 0;
  await page.route(/attempt-worker(?:-[^/]+\.js|\.ts\?)/, async route => {
    if (++entries === 2) {
      blocked();
      await gate;
    }
    await route.continue();
  });
  await page.goto(process.env.BRAIN_URL ?? 'http://127.0.0.1:5320');
  // The first Worker loads the catalogue; hold the first level's Worker entry
  // so switching levels deterministically cancels a pending setup request.
  let timeout;
  try {
    await Promise.race([loading, new Promise((_, reject) => {
      timeout = setTimeout(() => reject(Error('Initial setup Worker did not load')), 30000);
    })]);
    await page.getByRole('button', { name: /2\. Turn the Corner/ }).click();
  } finally { clearTimeout(timeout); release(); }
  await page.waitForFunction(() => document.querySelector('[data-testid="setup-game"]')?.dataset.worldState === 'ready');
  await page.waitForFunction(() => document.querySelector('.run-setup')?.disabled === false);
  assert.equal(await page.getByRole('heading', { level: 1 }).innerText(), 'Turn the Corner');
  report.liveWorkers = page.workers().map(worker => worker.url());
  report.workerEntries = entries;
  assert.equal(report.liveWorkers.length, 1, 'unmounted setup must not restart its disposed Worker');
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
