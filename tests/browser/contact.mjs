import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = process.env.CONTACT_EVIDENCE ?? '/tmp/contact-alignment';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto((process.env.CONTACT_URL ?? 'http://127.0.0.1:5297') + '/?fixture=contact');
  await page.waitForFunction(() => document.querySelector('#app')?.dataset.ready === 'true');
  const rows = [];
  const fixture = JSON.parse(
    await readFile(
      new URL('../../assets/proportions/contact-fixture.json', import.meta.url),
      'utf8',
    ),
  );

  async function shot(name) {
    await page.waitForTimeout(100);
    const r = JSON.parse(await page.locator('#app').getAttribute('data-report'));
    const f = r.camera.flies[0];
    assert.ok(Math.abs(f.x - r.camera.width / 2) < 1);
    assert.ok(Math.abs(f.y - r.camera.height / 2) < 1);
    const pose = fixture.cases[r.sample][r.attachment];
    assert.deepEqual(r.position, pose.root, 'rendered origin must use the supported body root, not its surface witness');
    assert.deepEqual(
      r.rotation,
      pose.rotation,
    );
    rows.push({ name, ...r });
    await page.screenshot({ path: `${out}/${name}.png` });
    const b = await page.locator('canvas').boundingBox();
    await page.screenshot({
      path: `${out}/${name}-crop.png`,
      clip: { x: b.x + b.width / 2 - 160, y: b.y + b.height / 2 - 160, width: 320, height: 320 },
    });
  }
  for (const sample of ['0', '1', '2', '3', '4']) {
    await page.locator('#sample').selectOption(sample);
    for (const mode of ['upright', 'supported']) {
      await page.locator('#attachment').selectOption(mode);
      await shot(`sample-${sample}-${mode}`);
    }
  }
  await page.locator('#sample').selectOption('4');
  for (const clip of ['Walk', 'Feed', 'Land']) {
    await page.locator('#clip').selectOption(clip);
    for (const t of ['0', '0.5', '1']) {
      await page.locator('#time').fill(t);
      await page.locator('#time').dispatchEvent('input');
      await shot(`${clip}-${t}`);
    }
  }
  await page.locator('#clip').selectOption('Walk');
  await page.locator('#time').fill('0.5');
  await page.locator('#time').dispatchEvent('input');
  await page.waitForTimeout(100);
  const frozen = await page.locator('canvas').screenshot();
  await page.locator('#time').fill('1');
  await page.locator('#time').dispatchEvent('input');
  await page.waitForTimeout(100);
  await page.locator('#time').fill('0.5');
  await page.locator('#time').dispatchEvent('input');
  await page.waitForTimeout(100);
  assert.deepEqual(
    await page.locator('canvas').screenshot(),
    frozen,
    'supported animation restores exact pixels on reverse seek',
  );
  assert.deepEqual(errors, []);
  await writeFile(`${out}/report.json`, JSON.stringify({ rows, errors }, null, 2));
} finally {
  await browser.close();
}
