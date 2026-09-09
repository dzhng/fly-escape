import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const output =
  process.env.MOTION_EVIDENCE_DIR ?? "/tmp/fly-playback-motion/";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
try {
  await page.goto(`${process.env.BRAIN_URL ?? "http://127.0.0.1:5193"}/lab/playback`);
  await page.waitForFunction(
    () => Number(document.querySelector('[data-testid="playback-lab"]')?.dataset.cursorTick) >= 15,
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.mouse.move(1400, 20);
  const seek = async (tick) => {
    await page.getByLabel("Playback time", { exact: true }).evaluate((element, tick) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(
        element,
        String(tick),
      );
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }, tick);
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
  };
  await seek(10.3);
  const a = await page.locator(".playback-world canvas").screenshot();
  await page.waitForTimeout(200);
  assert.deepEqual(
    await page.locator(".playback-world canvas").screenshot(),
    a,
    "pause freezes recorded pose and clip phase",
  );
  await seek(12.8);
  const b = await page.locator(".playback-world canvas").screenshot();
  assert.notDeepEqual(a, b, "recorded cursor changes the rendered scene");
  await seek(10.3);
  assert.deepEqual(
    await page.locator(".playback-world canvas").screenshot(),
    a,
    "reverse seek reproduces recorded pose and phase",
  );
  await page.screenshot({ path: `${output}/reverse-seek.png` });
  await writeFile(
    `${output}/report.json`,
    JSON.stringify({ pauseAndReverseSeek: "exact canvas PNG bytes", errors }, null, 2),
  );
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
