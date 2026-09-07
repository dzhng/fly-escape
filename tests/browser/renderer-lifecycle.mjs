import { equalPixels } from "./equal-pixels.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const output = process.env.LIFETIME_EVIDENCE ?? "/tmp/fly-renderer-lifecycle";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 600 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${process.env.LIFETIME_URL ?? "http://127.0.0.1:5285"}/tests/browser/renderer-lifecycle.html`);
  await page.waitForFunction(() => !!window.lifecycle);
  const before = await page.evaluate(() => window.lifecycle.statistics());
  const beforePixels = await page.locator("#second canvas").screenshot({ path: `${output}/before.png` });
  await page.evaluate(() => { window.lifecycle.disposeFirst(); window.lifecycle.renderSecond(); });
  const after = await page.evaluate(() => window.lifecycle.statistics());
  const afterPixels = await page.locator("#second canvas").screenshot({ path: `${output}/after.png` });
  equalPixels(afterPixels, beforePixels, "surviving view retains identical rendered pixels");
  assert.deepEqual(after, before, "disposing another view preserves live renderer resources and draw workload");
  assert.equal(await page.locator("canvas").count(), 1);
  await page.evaluate(() => { window.lifecycle.disposeSecond(); });
  assert.equal(await page.locator("canvas").count(), 0);
  assert.deepEqual(errors, []);
  await writeFile(`${output}/report.json`, JSON.stringify({ browser: browser.version(), before, after, errors }, null, 2));
} finally { await browser.close(); }
