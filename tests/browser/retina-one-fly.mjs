import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const sourceRoot = fileURLToPath(new URL("../..", import.meta.url));
const output = process.env.RETINA_ONE_FLY_OUTPUT ?? "/tmp/retina-one-fly";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(process.env.RETINA_URL ?? "http://127.0.0.1:5174/retina");
  await page.waitForSelector('[data-retina-ready="true"]');
  const section = page.locator(".retina-attempt");
  assert.equal(await section.locator("[data-tick]").isDisabled(), true);
  await section.locator("[data-run]").click();
  await page.waitForSelector('.retina-attempt[data-state="complete"]', { timeout: 120000 });
  assert.equal(await section.locator("[data-tick]").isDisabled(), false);
  const download = page.waitForEvent("download");
  await section.locator("[data-export]").click();
  await (await download).saveAs(`${output}/consumed.json`);
  const exported = JSON.parse(await readFile(`${output}/consumed.json`, "utf8"));
  assert.equal(exported.frames.length, 24);
  assert.equal(exported.input.flyCount, 1);
  assert.equal(exported.config.profile.sampleCount, 721);
  for (const [index, frame] of exported.frames.entries()) {
    assert.equal(frame.tick, index + 1);
    assert.equal(frame.retina.rgb.length, 4326);
    assert.equal(frame.retina.request.poses.length, 1);
    assert.ok(frame.flies[0].neural);
  }
  const fixtureCaptureCount = await page.locator("#app").getAttribute("data-retina-capture-count");
  const telemetry = [];
  for (const tick of [1, 12, 24, 1]) {
    await section.locator("[data-tick]").fill(String(tick));
    await section.locator("[data-tick]").dispatchEvent("input");
    await section.locator("[data-tick]").dispatchEvent("change");
    const measured = await page.evaluate(async ({ tick, frame, sourceRoot }) => {
      const { RetinaProjection, retinaProfile } = await import(`/@fs${sourceRoot}/packages/game-renderer/src/retina-projection.ts`);
      const projection = new RetinaProjection(retinaProfile);
      const canvases = [...document.querySelectorAll(".retina-attempt canvas")];
      const diffs = canvases.map((canvas, eye) => {
        const actual = canvas.getContext("2d").getImageData(0, 0, 128, 128).data;
        const expected = projection.image(new Uint8Array(frame.retina.rgb.slice(eye * 2163, (eye + 1) * 2163)));
        return actual.reduce((n, value, index) => n + Number(value !== expected[index]), 0);
      });
      return { tick, diffs };
    }, { tick, frame: exported.frames[tick - 1], sourceRoot });
    assert.deepEqual(measured.diffs, [0, 0]); telemetry.push(measured);
  }
  assert.equal(await page.locator("#app").getAttribute("data-retina-capture-count"), fixtureCaptureCount);
  assert.equal(await page.locator("#app").getAttribute("data-retina-ready"), "true");
  await page.screenshot({ path: `${output}/one-fly-desktop-full.png`, fullPage: true });
  await section.screenshot({ path: `${output}/one-fly-desktop.png` });
  await page.setViewportSize({ width: 420, height: 900 });
  await page.screenshot({ path: `${output}/one-fly-narrow-full.png`, fullPage: true });
  await section.screenshot({ path: `${output}/one-fly-narrow.png` });
  assert.deepEqual(errors, []);
  const native = JSON.parse(execFileSync("cargo", ["run", "-q", "--release", "-p", "sim", "--example", "retinal_reconsume", "--",
    `${output}/consumed.json`, "data/processed/brain/graph.bin", "data/processed/brain/manifest.json", "data/processed/brain/retinal-map.json"],
    { cwd: sourceRoot, maxBuffer: 4 * 1024 * 1024, timeout: 120000 }).toString());
  let maxAbsoluteDifference = 0;
  let floatingComparisons = 0;
  function compare(actual, expected, path = "frames") {
    if (typeof actual === "number" && typeof expected === "number") {
      if (Number.isInteger(actual) && Number.isInteger(expected)) assert.equal(actual, expected, path);
      else {
        const difference = Math.abs(actual - expected);
        maxAbsoluteDifference = Math.max(maxAbsoluteDifference, difference); floatingComparisons++;
        assert.ok(difference <= 1e-12 * Math.max(1, Math.abs(expected)), `${path}: ${actual} != ${expected}`);
      }
    } else if (Array.isArray(actual)) {
      assert.equal(actual.length, expected.length, path);
      actual.forEach((value, index) => compare(value, expected[index], `${path}/${index}`));
    } else if (actual && typeof actual === "object") {
      assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), path);
      for (const key of Object.keys(actual)) compare(actual[key], expected[key], `${path}/${key}`);
    } else assert.equal(actual, expected, path);
  }
  compare(native, exported.frames);
  const nativeComparison = { floatingComparisons, maxAbsoluteDifference, relativeTolerance: 1e-12, exactIntegersAndMetadata: true };
  await writeFile(`${output}/verification.json`, JSON.stringify({ frames: 24, telemetry, nativeComparison, errors }, null, 2) + "\n");
  console.log(JSON.stringify({ output, frames: 24, telemetry }));
} finally { await browser.close(); }
