import { equalPixels } from "./equal-pixels.mjs";
import { chromium } from "playwright";
import { mkdir, writeFile, realpath } from "node:fs/promises";
import assert from "node:assert/strict";
const base = process.env.BRAIN_URL ?? "http://127.0.0.1:5212";
const output =
  process.env.TOOL_EVIDENCE ?? "specs/help-the-fly-escape/assets/evidence/14/tools/candidate";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const random = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = (a) =>
      a instanceof BigUint64Array && a.length === 1 ? ((a[0] = 42n), a) : random(a);
  });
  await page.goto(base + "/");
  await page.getByRole("button", { name: "Run · release flies", exact: true }).waitFor();
  await page.waitForFunction(() => !document.querySelector(".run-setup").disabled);
  let id = 0;
  const positions = [];
  for (const name of ["Vinegar", "Fan", "Lamp", "Shade"]) {
    await page.getByRole("button", { name: new RegExp(`^${name}.*left`) }).click();
    let placed = false;
    for (const [x, y] of [
      [680, 520],
      [760, 600],
      [850, 580],
      [820, 500],
      [570, 400],
      [600, 450],
      [540, 450],
      [660, 480],
      [740, 460],
      [550, 600],
      [850, 580],
      [740, 460],
    ]) {
      await page.mouse.move(x, y);
      await page.waitForTimeout(120);
      const text = await page.getByTestId("placement-feedback").innerText();
      if (!text.includes("Valid placement")) continue;
      await page.mouse.click(x, y);
      id++;
      await page.getByRole("button", { name: `Remove ${name} ${id}`, exact: true }).waitFor();
      positions.push({ name, x, y });
      placed = true;
      break;
    }
    assert.equal(placed, true, `${name} has a core-valid placement`);
  }
  await page.mouse.move(1430, 20);
  await page.screenshot({ path: output + "/setup-placed.png" });
  await page.screenshot({path:output+"/setup-placed-crop.png",clip:{x:300,y:340,width:650,height:390}});
  await page.getByRole("button", { name: "Run · release flies", exact: true }).click();
  await page.waitForFunction(
    () =>
      Number(document.querySelector('[data-testid="playback-lab"]')?.dataset.computedTick) >= 55,
    null,
    { timeout: 90000 },
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.getByLabel("Playback time", { exact: true }).evaluate((el) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, "50");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(
    () => Number(document.querySelector('[data-testid="playback-lab"]').dataset.cursorTick) === 50,
  );
  await page.mouse.move(1430, 20);
  await page.screenshot({ path: output + "/playback-placed.png" });
  await page.screenshot({path:output+"/playback-placed-crop.png",clip:{x:300,y:340,width:650,height:390}});
  const canvas = page.locator("canvas");
  const paused = await canvas.screenshot();
  await page.waitForTimeout(300);
  equalPixels(await canvas.screenshot(), paused);
  const seek = async (value) => {
    await page.getByLabel("Playback time", { exact: true }).evaluate((el, v) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, String(v));
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
    await page.waitForFunction(
      (v) =>
        Number(document.querySelector('[data-testid="playback-lab"]').dataset.cursorTick) === v,
      value,
    );
  };
  await seek(30);
  await seek(50);
  equalPixels(await canvas.screenshot(), paused);

  const report = JSON.parse(await page.getByTestId("playback-report").textContent());
  assert.equal(report.spec.placements.length, 4);
  assert.deepEqual(errors, []);
  await writeFile(
    output + "/report.json",
    JSON.stringify(
      { spec: report.spec, camera: report.camera, positions, pauseReverse: "exact canvas", errors },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
