import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({channel: 'chrome', headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
  page.setDefaultTimeout(60000);
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      postMessage(message, ...rest) {
        // The real core still validates and computes the attempt; shorten only the horizon.
        if (message.type === 'start') message.input.level.durationTicks = 100;
        super.postMessage(message, ...rest);
      }
    };
  });
  await page.goto(process.env.BRAIN_URL ?? 'http://127.0.0.1:5320/');
  await page.getByRole('button', {name: 'Release the flies'}).click();
  await page.waitForFunction(() => document.querySelector('[data-testid=playback-lab]')?.dataset.flyCount === '20');
  await page.getByRole('button', {name: 'Pause', exact: true}).click();
  await page.waitForSelector('[data-playback-state=paused]');
  await page.waitForFunction(() => {
    const report = document.querySelector('[data-testid="playback-report"]');
    return report && JSON.parse(report.textContent).complete;
  });
  const progress = () => page.evaluate(() => JSON.parse(localStorage.getItem('fly-escape-progress')).bestStars);
  assert.deepEqual(await progress(), {}, 'computed results must not reveal progress before playback ends');
  const seek = page.getByTestId('playback-seek');
  await seek.fill('100');
  await seek.dispatchEvent('input');
  await page.getByRole('button', {name: 'Play', exact: true}).click();
  await page.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem('fly-escape-progress')).bestStars).length === 1);
  const awarded = await progress();
  assert.equal(Object.keys(awarded).length, 1);
  await seek.fill('0');
  await seek.dispatchEvent('input');
  assert.deepEqual(await progress(), awarded, 'rewinding preserves earned progress');
  console.log('Computed results stay private until playback reaches its end; rewind preserves progress.');
} finally { await browser.close(); }
