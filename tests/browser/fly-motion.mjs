import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const destination =
  process.env.MOTION_EVIDENCE_DIR ?? "specs/help-the-fly-escape/assets/evidence/08/browser";
await mkdir(destination, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  recordVideo: { dir: destination, size: { width: 1440, height: 900 } },
});
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
page.on("console", (message) => {
  if (["error", "warning"].includes(message.type())) errors.push(message.text());
});
try {
  await page.goto(process.env.ASSET_LAB_URL ?? "http://127.0.0.1:5192");
  await page.getByRole("status").filter({ hasText: "Model loaded" }).waitFor();
  await page.getByRole("button", { name: "Extra close" }).click();
  const phase = async (seconds) => {
    await page.locator("#time").evaluate((element, value) => {
      element.value = String(value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }, seconds);
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
  };
  const snapshots = [];
  for (const clip of ["Static", "Walk", "Fly", "Land", "Feed"]) {
    await page.locator("#clip").selectOption(clip);
    const laterTime = clip === "Feed" ? 0.5 : 0.125;
    for (const seconds of [0.05, laterTime]) {
      await phase(seconds);
      const name = `${clip.toLowerCase()}-${seconds}.png`;
      await page.screenshot({ path: `${destination}/${name}` });
      snapshots.push(name);
    }
    const later = await page.locator("canvas").screenshot();
    await phase(0.05);
    const earlier = await page.locator("canvas").screenshot();
    await phase(laterTime);
    assert.deepEqual(
      await page.locator("canvas").screenshot(),
      later,
      `${clip} reverse seek restores pixels`,
    );
    if (clip !== "Static")
      assert.notDeepEqual(earlier, later, `${clip} phase changes visible pose`);
    assert.deepEqual(
      await page.locator("canvas").screenshot(),
      later,
      `${clip} paused pixels stay fixed`,
    );
  }
  await page.locator("#clip").selectOption("Fly");
  await page.getByRole("button", { name: "Play animation", exact: true }).click();
  await page.waitForTimeout(750);
  await page.getByRole("button", { name: "Pause animation", exact: true }).click();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  const frozen = await page.locator("canvas").screenshot();
  await page.waitForTimeout(250);
  assert.deepEqual(
    await page.locator("canvas").screenshot(),
    frozen,
    "pausing a running clip freezes pixels",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    `${destination}/report.json`,
    JSON.stringify(
      { snapshots, pauseAndReverseSeek: "exact canvas PNG bytes for every clip", errors },
      null,
      2,
    ),
  );
} finally {
  await page.close();
  await page.video()?.saveAs(`${destination}/clips.webm`);
  await page.video()?.delete();
  await browser.close();
}
