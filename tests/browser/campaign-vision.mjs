import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import openWindow from '../../apps/web/src/levels/open-window.ts';
import turnTheCorner from '../../apps/web/src/levels/turn-the-corner.ts';

const base = process.env.CAMPAIGN_URL ?? 'http://127.0.0.1:5194';
const output = process.env.CAMPAIGN_OUTPUT ?? '/tmp/fly-campaign-vision';
await mkdir(output, { recursive: true });
const rooms = [['Open Window', openWindow], ['Turn the Corner', turnTheCorner]];
const expected = new Map();
for (const [, content] of rooms) {
  const prior = JSON.parse(await readFile(`specs/done/neural-vision/assets/playtest/physical-on-${content.level.id}.json`, 'utf8'));
  assert.deepEqual(content, prior.content, 'Actual resolved export differs from full native playtest');
  expected.set(content.level.id, prior.spec);
}
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 },
  ...(process.env.PLAYTEST_STORAGE_STATE ? { storageState: process.env.PLAYTEST_STORAGE_STATE } : {}) });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.setDefaultTimeout(30000);
const results = [];
try {
  await page.goto(base);
  if (!process.env.PLAYTEST_STORAGE_STATE) {
    // A pre-existing earned star exercises progression preservation across this update.
    await page.evaluate(() => localStorage.setItem('fly-escape-progress', JSON.stringify({ bestStars: { 'open-window': 1 }, setups: {} })));
    await page.reload();
  }
  const report = async () => JSON.parse(await page.getByTestId('playback-report').textContent());
  const ready = () => page.waitForFunction(() => document.querySelector('.run-setup')?.disabled === false);
  const paint = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  for (const [title, content] of rooms) {
    const id = content.level.id;
    await ready();
    await page.locator('.campaign-levels button').filter({ hasText: title }).click();
    await ready();
    const storedBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('fly-escape-progress')));
    await paint();
    await page.screenshot({ path: `${output}/${id}-setup.png` });
    const start = performance.now();
    await page.getByRole('button', { name: 'Release the flies', exact: true }).click();
    await page.waitForFunction(() => Number(document.querySelector('[data-testid="playback-lab"]')?.dataset.cursorTick) > 0);
    const startToPlaybackMs = performance.now() - start;
    await page.waitForFunction(() => Number(document.querySelector('[data-testid="playback-lab"]')?.dataset.cursorTick) >= 40);
    const playing = await report();
    assert.equal(playing.spec.flyCount, 16);
    assert.equal(playing.spec.durationTicks, content.level.durationTicks);
    assert.equal(playing.spec.levelHash, expected.get(id).levelHash, 'Production page must use resolved light sources');
    assert.equal(playing.spec.tuningHash, expected.get(id).tuningHash, 'Production page must enable vision');
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByRole('button', { name: 'Select fly 1', exact: true }).click();
    const seek = page.getByTestId('playback-seek');
    const move = async tick => {
      await seek.fill(String(tick)); await seek.dispatchEvent('input');
      await page.waitForFunction(t => document.querySelector('[data-testid="selected-fly"]')?.dataset.sampleTick === String(t), tick);
    };
    await move(10);
    const first = await page.getByTestId('selected-fly').innerText();
    await move(25); await move(10);
    assert.equal(await page.getByTestId('selected-fly').innerText(), first);
    await page.getByRole('button', { name: 'Vision L', exact: true }).click();
    await page.getByTestId('selected-fly').evaluate(element => element.scrollIntoView({ block: 'start' }));
    await paint();
    await page.screenshot({ path: `${output}/${id}-rewind.png` });
    console.log(`${id}: source/tuning identities and pause/seek/rewind passed; waiting for full computation`);
    await page.waitForFunction(() => document.querySelector('button[aria-label="Fast"]')?.disabled === false, undefined, { timeout: 480000 });
    await page.getByRole('button', { name: 'Fast', exact: true }).click();
    await page.waitForFunction(() => {
      const r = JSON.parse(document.querySelector('[data-testid="playback-report"]').textContent);
      return r.result && r.cursorTick >= r.result.completedTick;
    }, undefined, { timeout: 120000 });
    const finished = await report();
    const outcome = finished.result.outcomes;
    assert.equal(outcome.escaped + outcome.starved + outcome.zapped + outcome.caught + outcome.timedOut, 16);
    assert.equal(outcome.score, outcome.escaped);
    assert.equal(finished.result.stars, [2, 5, 10].filter(n => outcome.escaped >= n).length);
    assert.equal(finished.underruns, 0);
    assert.ok(finished.result.completedTick <= content.level.durationTicks);
    await page.screenshot({ path: `${output}/${id}-result.png` });
    await writeFile(`${output}/${id}-report.json`, JSON.stringify(finished, null, 2));
    await page.getByRole('button', { name: 'Retry — edit setup', exact: true }).click();
    const leaving = performance.now();
    await page.getByRole('button', { name: 'Leave attempt', exact: true }).click();
    await ready();
    const returnToEditingMs = performance.now() - leaving;
    assert.ok(returnToEditingMs < 250, `Retry took ${returnToEditingMs}ms`);
    const storedAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('fly-escape-progress')));
    assert.deepEqual(storedAfter.setups[id] ?? [], storedBefore.setups[id] ?? []);
    assert.ok(storedAfter.bestStars['open-window'] >= storedBefore.bestStars['open-window']);
    results.push({ id, startToPlaybackMs, returnToEditingMs, outcome, stars: finished.result.stars,
      levelHash: finished.spec.levelHash, tuningHash: finished.spec.tuningHash, rootSeed: finished.spec.rootSeed,
      computedTick: finished.computedTick, completedTick: finished.result.completedTick, underruns: finished.underruns,
      pauseSeekRewind: true, placementsRetained: true });
    await writeFile(`${output}/summary.json`, JSON.stringify({ results, errors, providedEarnedProgress: !!process.env.PLAYTEST_STORAGE_STATE }, null, 2));
    console.log(`${id}: completed ${finished.result.completedTick} ticks, ${outcome.escaped} escaped, ${finished.result.stars} stars, retry ${returnToEditingMs.toFixed(1)}ms`);
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
