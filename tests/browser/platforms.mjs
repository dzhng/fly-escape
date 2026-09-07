import { zoomOut } from "./zoom-out.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, firefox, webkit } from "playwright";

const output = process.env.PLATFORM_OUTPUT ?? "specs/help-the-fly-escape/assets/evidence/17/platforms";
const base = process.env.BRAIN_URL ?? "http://127.0.0.1:5184";
const engines = { chromium, firefox, webkit };
await mkdir(output, { recursive: true });
const results = [];
for (const name of (process.env.SMOKE_ENGINES ?? "chromium,firefox,webkit").split(",")) {
  assert.ok(engines[name], `Unknown engine ${name}`);
  let browser;
  const result = { engine: name, errors: [] };
  try {
    browser = await engines[name].launch({ headless: true, ...(name === "chromium" ? { channel: "chrome" } : {}) });
    result.version = browser.version();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on("pageerror", error => result.errors.push(error.message));
    await page.goto(base);
    await page.getByRole("button", { name: "Release the flies", exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-testid="playback-lab"]')?.dataset.playbackState === "playing", null, { timeout: 120000 });
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-testid="playback-lab"]')?.dataset.playbackState === "paused");
    const report = () => page.getByTestId("playback-report").textContent().then(JSON.parse);
    const paused = await report();
    assert.equal(paused.spec.flyCount, 20);
    await page.waitForTimeout(200);
    assert.equal((await report()).cursorTick, paused.cursorTick);
    await zoomOut(page);
    await page.screenshot({ path: `${output}/${name}-overview.png` });
    await page.getByRole("button", { name: "Select fly 20", exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-testid="selected-fly"]')?.dataset.flyId === "19");
    const slider = page.getByLabel("Playback time", { exact: true });
    await slider.fill("1");
    await page.waitForFunction(() => document.querySelector('[data-testid="selected-fly"]')?.dataset.sampleTick === "1");
    const readout = () => page.locator('[data-testid="selected-fly"] .science-current').innerText();
    const first = await readout();
    await slider.fill("0");
    await slider.fill("1");
    await page.waitForFunction(() => document.querySelector('[data-testid="selected-fly"]')?.dataset.sampleTick === "1");
    assert.equal(await readout(), first);
    await page.screenshot({ path: `${output}/${name}-selected.png` });
    result.attempt = (await report()).spec;
    result.pauseAndSeek = true;
    assert.deepEqual(result.errors, []);
    result.passed = true;
  } catch (error) {
    result.passed = false;
    result.failure = String(error);
    process.exitCode = 1;
  } finally {
    await browser?.close();
    results.push(result);
    await writeFile(`${output}/report.json`, JSON.stringify(results, null, 2));
  }
}
console.log(JSON.stringify(results));
