import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const base = process.env.BRAIN_URL ?? "http://127.0.0.1:5173";
const output = new URL("../../specs/help-the-fly-escape/assets/evidence/03/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: process.env.BROWSER_CHANNEL ?? "chrome",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const waitReady = () =>
  page.waitForFunction(
    () =>
      ![...document.querySelectorAll("button")].find((b) => b.textContent === "One tick").disabled,
  );
const tick = async () => {
  await page.getByRole("button", { name: "One tick", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("[data-testid=field-tick]").textContent === "Tick 1",
  );
};
const sample = async () => {
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save sample" }).click();
  return JSON.parse(await readFile(await (await download).path(), "utf8"));
};
try {
  await page.goto(`${base}/lab/fields`);
  await page.waitForFunction(
    () => Number(document.querySelector("[data-testid=field-tick]")?.textContent.slice(5)) >= 1,
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Reset pair" }).click();
  await waitReady();
  await tick();
  const odor = await sample();
  assert.equal(odor.info.brain.neuronCount, 70000);
  assert.ok(odor.frame.flies[0].sensory.left.odor > odor.frame.flies[0].sensory.right.odor);
  assert.ok(odor.frame.flies[1].sensory.left.odor < odor.frame.flies[1].sensory.right.odor);
  assert.ok(
    Math.abs(odor.frame.flies[0].sensory.left.odor - odor.frame.flies[1].sensory.right.odor) <
      1e-12,
  );
  const grid = odor.frame.grids[0];
  assert.equal(grid.cells.length, grid.width * grid.height);
  await page.screenshot({ path: new URL("fields-odor.png", output).pathname });
  await page
    .locator(".field-worlds")
    .screenshot({ path: new URL("fields-chambers.png", output).pathname });
  await page.getByRole("button", { name: "Reset pair" }).click();
  await waitReady();
  await tick();
  assert.deepEqual((await sample()).frame, odor.frame);
  const values = { odor };
  for (const cue of ["lamp", "shade", "wind", "exit"]) {
    await page.getByLabel("Cue", { exact: true }).selectOption(cue);
    await waitReady();
    await tick();
    values[cue] = await sample();
    await page.screenshot({ path: new URL(`fields-${cue}.png`, output).pathname });
  }
  assert.ok(
    values.lamp.frame.flies[0].sensory.left.brightness >
      values.lamp.frame.flies[0].sensory.right.brightness,
  );
  assert.ok(
    values.shade.frame.flies[0].sensory.left.brightness <
      values.shade.frame.flies[0].sensory.right.brightness,
  );
  for (const fly of values.exit.frame.flies) {
    assert.equal(fly.sensory.left.exitCue, 0);
    assert.equal(fly.sensory.right.exitCue, 0);
  }
  assert.ok(values.exit.frame.grids[0].cells.some((c) => c?.exitCue > 0));
  assert.ok(values.wind.frame.flies[0].pose.z > values.wind.frame.flies[1].pose.z);
  await page.getByText("What do these numbers mean?", { exact: true }).click();
  await page.locator("aside details").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: new URL("fields-explanation.png", output).pathname });
  await page
    .locator("aside details")
    .first()
    .screenshot({ path: new URL("neurons-detail.png", output).pathname });
  assert.deepEqual(errors, []);
  await writeFile(
    new URL("browser.json", output),
    JSON.stringify({ browser: browser.version(), errors, values }),
  );
  console.log(
    JSON.stringify({
      mirroredOdor: true,
      sameSeedReset: true,
      oppositeLightShade: true,
      exitLocal: true,
      worldWind: true,
      errors,
    }),
  );
} finally {
  await browser.close();
}
