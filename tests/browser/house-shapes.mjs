import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
const url = (process.env.SHAPE_URL ?? 'http://127.0.0.1:5294') + '/?fixture=proportions';
const out = process.env.SHAPE_EVIDENCE ?? '/tmp/fly-browser-shapes';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  const panel = page.locator('section').filter({ has: page.locator('#shape') });
  await page.waitForFunction(() => document.querySelector('#app').dataset.ready === 'true' && document.querySelector('#shape').closest('section').dataset.ready === 'true', { timeout: 90000 });
  const read = async () => ({ models: JSON.parse(await panel.getAttribute('data-models')), ...JSON.parse(await page.locator('#app').getAttribute('data-measurements')) });
  const capture = async name => {
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${out}/${name}.png` });
    const box = await page.locator('canvas').boundingBox();
    await page.screenshot({ path: `${out}/${name}-crop.png`, clip: { x: box.x + box.width / 2 - 250, y: box.y + box.height / 2 - 300, width: 500, height: 600 } });
    return { name, ...await read() };
  };
  const frames = [];
  for (const mode of ['context', 'overview']) {
    await page.locator(`[data-view=${mode}]`).click();
    frames.push(await capture(mode));
  }
  for (const key of ['window', 'sconce', 'plant']) {
    await page.locator('#shape').selectOption(key);
    await page.locator('#inspect-shape').click();
    frames.push(await capture(key));
    await page.locator('#shape-detail').click();
    frames.push(await capture(`${key}-detail`));
  }
  await page.locator('#shape').selectOption('sconce');
  await page.locator('#shape-mounting').click();
  frames.push(await capture('sconce-mounting'));
  await page.locator('[data-view=overview]').click();
  await page.waitForTimeout(100);
  assert.deepEqual((await read()).camera, frames.find(frame => frame.name === 'overview').camera, 'Overview restores the ordinary camera after mounting inspection');
  await page.locator('[data-view=follow]').click();
  await page.waitForTimeout(100);
  const ordinaryFollow = await page.locator('canvas').screenshot();
  await page.locator('#shape-mounting').click();
  await page.locator('[data-view=follow]').click();
  await page.waitForTimeout(100);
  assert.deepEqual(await page.locator('canvas').screenshot(), ordinaryFollow, 'Follow restores ordinary rendering after mounting inspection');
  const models = (await read()).models;
  assert.equal(models.length, 3);
  for (const model of models) { assert.deepEqual(model.scale, [1, 1, 1]); assert.deepEqual(model.forward, [0, 0, 1]); assert.ok(Math.abs(model.nativeBounds[1]) < 1e-6); }
  await page.locator('#shape').selectOption('sconce');
  await page.locator('#shape-detail').click();
  await page.waitForTimeout(100);
  const before = await read();
  const beforePixels = await page.locator('canvas').screenshot();
  await page.locator('#shape-file').setInputFiles(resolve('assets/house/window/window.glb'));
  await page.waitForFunction(() => document.querySelector('#shape-status').textContent.includes('Previous shape retained'));
  assert.deepEqual((await read()).models, before.models);
  assert.deepEqual(await page.locator('canvas').screenshot(), beforePixels, 'failed replacement retains exact visible scene');
  await capture('rejected-replacement');
  const resources = [];
  for (let cycle = 0; cycle < 6; cycle++) {
    for (const key of ['window', 'sconce', 'plant']) {
      await page.locator('#shape').selectOption(key);
      const prior = Number(await panel.getAttribute('data-revision'));
      await page.locator('#shape-file').setInputFiles(resolve(`assets/house/${key}/${key}.glb`));
      await page.waitForFunction(prior => Number(document.querySelector('#shape').closest('section').dataset.revision) > prior, prior);
    }
    await page.locator('[data-view=overview]').click();
    await page.waitForTimeout(100);
    const stats = (await read()).statistics;
    resources.push(stats);
    assert.deepEqual(stats, resources[0], 'same scene has stable renderer resources after each replacement cycle');
  }
  await page.locator('#recorded-tick').fill('40'); await page.locator('#recorded-tick').dispatchEvent('input');
  await page.waitForTimeout(100);
  const recording = await read();
  assert.equal(recording.recordedFrame.flies.length, 20);
  assert.ok(recording.recordedFrame.neuralSteps > 0);
  const at40 = await page.locator('canvas').screenshot();
  await page.locator('#recorded-tick').fill('0'); await page.locator('#recorded-tick').dispatchEvent('input');
  await page.locator('#recorded-tick').fill('40'); await page.locator('#recorded-tick').dispatchEvent('input');
  await page.waitForTimeout(100);
  assert.deepEqual(await page.locator('canvas').screenshot(), at40, 'recorded reverse is pixel identical');
  assert.deepEqual((await read()).spec, before.spec, 'inspection leaves attempt identity untouched');
  assert.deepEqual(errors, []);
  // Hold a production asset response while a user replacement wins the same key.
  const race = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let requested;
  const started = new Promise(resolve => { requested = resolve; });
  await race.route(/\/assets\/window-[^/]+\.glb$/, async route => { requested(); await gate; await route.continue(); });
  await race.goto(url); await started;
  await race.locator('#shape-file').setInputFiles(resolve('assets/house/window/window.glb'));
  await race.waitForFunction(() => JSON.parse(document.querySelector('#shape').closest('section').dataset.models ?? '[]').length === 3);
  const winningRevision = await race.locator('section').getAttribute('data-revision');
  release();
  await race.waitForTimeout(300);
  assert.equal(await race.locator('section').getAttribute('data-revision'), winningRevision, 'late initial fetch cannot replace a newer upload');
  await race.close();
  await writeFile(`${out}/report.json`, JSON.stringify({ frames, resources, recording, staleReplacement: true, errors }, null, 2));
} finally { await browser.close(); }
