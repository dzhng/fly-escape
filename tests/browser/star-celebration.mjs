import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const browser = await chromium.launch({channel: 'chrome', headless: true});
const shots = 'specs/done/help-the-fly-escape/assets/evidence/35-star-celebration';
await mkdir(shots, {recursive: true});
try {
  const page = await browser.newPage({viewport: {width: 1440, height: 900}});
  page.setDefaultTimeout(60000);
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      postMessage(message, ...rest) {
        if (message.type === 'start') message.input.level.durationTicks = 100;
        super.postMessage(message, ...rest);
      }
      set onmessage(receiver) {
        super.onmessage = event => {
          const reply = event.data.reply;
          if (reply?.type === 'ready') {
            // A controllable scoring fixture keeps this UI test independent of fly behavior.
            window.scoringFixture = reply.info.level.starThresholds;
            window.scoringFixture.fill(100);
          }
          receiver(event);
        };
      }
    };
  });
  await page.goto(process.env.BRAIN_URL ?? 'http://127.0.0.1:5173/');
  await page.getByRole('button', {name: 'Release the flies'}).click();
  await page.waitForSelector('[data-world-state=ready]');
  await page.getByRole('button', {name: 'Pause', exact: true}).click();
  await page.waitForSelector('[data-playback-state=paused]');
  await page.waitForFunction(() => JSON.parse(document.querySelector('[data-testid=playback-report]').textContent).complete);
  await page.evaluate(() => { window.scoringFixture[0] = 0; });
  await page.waitForTimeout(300);
  const banner = page.getByTestId('star-celebration');
  assert.equal(await banner.count(), 0, 'computed/paused milestones must not celebrate');
  await page.screenshot({path: `${shots}/before.png`});
  await page.getByRole('button', {name: 'Play', exact: true}).click();
  await banner.waitFor();
  assert.match(await banner.innerText(), /A star for freedom/);
  await page.getByRole('button', {name: 'Pause', exact: true}).click();
  await page.waitForTimeout(350);
  await page.screenshot({path: `${shots}/one-star.png`});
  await banner.screenshot({path: `${shots}/banner.png`});
  assert.equal(await banner.evaluate(el => getComputedStyle(el).pointerEvents), 'none');
  await banner.waitFor({state: 'detached'});
  const seek = page.getByTestId('playback-seek');
  await seek.fill('0'); await seek.dispatchEvent('input');
  await page.getByRole('button', {name: 'Play', exact: true}).click();
  await page.waitForTimeout(400);
  assert.equal(await banner.count(), 0, 'rewatching the same milestone must not celebrate again');
  await page.getByRole('button', {name: 'Pause', exact: true}).click();
  await page.evaluate(() => { window.scoringFixture.fill(0); });
  await page.setViewportSize({width: 900, height: 700});
  await page.getByRole('button', {name: 'Play', exact: true}).click();
  await banner.waitFor();
  assert.match(await banner.innerText(), /Three stars/);
  await page.getByRole('button', {name: 'Pause', exact: true}).click();
  await page.waitForTimeout(350);
  await page.screenshot({path: `${shots}/three-stars-compact.png`});
  await banner.waitFor({state: 'detached'});
  await seek.fill('100'); await seek.dispatchEvent('input');
  await page.getByRole('button', {name: 'Play', exact: true}).click();
  await page.waitForSelector('[data-playback-state=ended]');
  assert.equal(await banner.count(), 0, 'ending must not replay milestones');
  console.log('Celebrations follow watched milestones, expire, permit controls, and never repeat on rewind or completion.');
} finally { await browser.close(); }
