import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const input = JSON.parse(await readFile(process.env.MEAL_INPUT, 'utf8'));
const out = process.env.MEAL_OUTPUT ?? '/tmp/fly-meal-playback';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(90000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto((process.env.BRAIN_URL ?? 'http://127.0.0.1:5173') + '/?about');
  await page.evaluate(({ path, input }) => {
    return Promise.race([
      import(path).then(({ renderMeal }) => renderMeal(input)),
      new Promise((_, reject) => setTimeout(() => reject(Error('Meal player mount timed out')), 30000)),
    ]);
  }, { path: '/@fs' + fileURLToPath(new URL('./meal-playback.tsx', import.meta.url)), input });
  await page.waitForFunction(() => {
    const lab = document.querySelector('[data-testid="playback-lab"]');
    return lab?.dataset.worldState === 'ready' && Number(lab.dataset.computedTick) >= 70;
  });
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.locator('.science-details .science-legend').getByRole('button', { name: 'Mouth', exact: true }).click();
  const seek = async tick => {
    await page.getByTestId('playback-seek').fill(String(tick));
    await page.getByTestId('playback-seek').dispatchEvent('input');
    await page.waitForFunction(tick => Number(document.querySelector('[data-testid="playback-lab"]').dataset.cursorTick) === tick, tick);
    await page.mouse.move(1400, 50);
    await page.waitForTimeout(100);
  };
  const frames = [];
  for (const tick of [50, 51, 53, 60, 64, 65]) {
    await seek(tick);
    await page.screenshot({ path: `${out}/tick-${tick}.png` });
    frames.push({ tick, report: JSON.parse(await page.getByTestId('playback-report').textContent()) });
  }
  await seek(53);
  const feeding = await page.locator('.playback-world canvas').screenshot();
  await seek(65);
  await seek(53);
  assert.ok((await page.locator('.playback-world canvas').screenshot()).equals(feeding), 'reverse seek restores the same curved feeding pose');
  await page.mouse.move(550, 500);
  await page.mouse.wheel(0, -1600);
  await page.mouse.move(1400, 50);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${out}/feeding-extra-close.png` });
  await page.mouse.move(550, 500);
  await page.mouse.wheel(0, 2400);
  await page.mouse.move(1400, 50);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${out}/feeding-context.png` });
  await writeFile(`${out}/report.json`, JSON.stringify({ frames, errors }, null, 2));
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
