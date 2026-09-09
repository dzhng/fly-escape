import { visibleResponse } from "./visible-response.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
const base = process.env.BRAIN_URL ?? "http://127.0.0.1:5184";
const output = process.env.PLAYBACK_OUTPUT
  ? pathToFileURL(process.env.PLAYBACK_OUTPUT + "/")
  : new URL("/tmp/fly-playback/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: process.env.BROWSER_CHANNEL ?? "chrome",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const report = async () => JSON.parse(await page.getByTestId("playback-report").textContent());
const state = (value) =>
  page.waitForFunction(
    (s) => document.querySelector('[data-testid="playback-lab"]')?.dataset.playbackState === s,
    value,
  );
const readout = () => page.locator('[data-testid="selected-fly"] .science-current').innerText();
const seekOne = async () => {
  const slider = page.getByLabel("Playback time", { exact: true });
  await slider.focus();
  await slider.press("Home");
  for (let i = 0; i < 10; i++) await slider.press("ArrowRight");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="selected-fly"]')?.dataset.sampleTick === "1",
  );
};
try {
  await page.goto(`${base}/lab/playback`);
  await state("playing");
  await page.getByTestId("fly-card-0").click();
  await page.waitForFunction(
    () => Number(document.querySelector('[data-testid="playback-lab"]').dataset.cursorTick) >= 10,
  );
  await page.screenshot({ path: new URL("playing.png", output).pathname });
  const pauseResponseMs = await visibleResponse(
    page,
    "click",
    '[data-playback-state="paused"]',
    () => page.getByRole("button", { name: "Pause", exact: true }).click(),
  );
  await state("paused");
  const paused = await report();
  await page.waitForTimeout(180);
  assert.equal((await report()).cursorTick, paused.cursorTick);
  assert.equal(paused.sampleTick, Math.floor(paused.cursorTick));
  await page.getByRole("button", { name: "Select fly 20", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="selected-fly"]').dataset.flyId === "19",
  );
  await seekOne();
  const first = await readout();
  await page.getByLabel("Playback time", { exact: true }).press("End");
  await page.waitForFunction(
    () => Number(document.querySelector('[data-testid="selected-fly"]').dataset.sampleTick) > 1,
  );
  await seekOne();
  assert.equal(await readout(), first, "seeking back must restore the same recorded neuron values");
  await page.screenshot({ path: new URL("paused-seek.png", output).pathname });
  await page.getByRole("button", { name: "Fast", exact: true }).click({timeout: 120000});
  await page.waitForFunction(() => {
    const current = JSON.parse(
      document.querySelector('[data-testid="playback-report"]').textContent,
    );
    return current.mode === "fast" && ["playing", "buffering"].includes(current.state);
  });
  const fast = await report();
  assert.ok(["playing", "buffering"].includes(fast.state));
  assert.equal(fast.speed, fast.fastMultiplier, "fast mode must consume at the derived multiplier");
  assert.ok(
    fast.spec.durationTicks * 0.1 <= fast.speed * 60 + 0.001,
    "fast mode must fit the authored horizon into a wall minute",
  );
  // Only real time and fast exist; there is no third speed to select.
  assert.equal(
    await page.getByRole("button", { name: /^(Play|Fast|[0-9.]+×)$/ }).count(),
    2,
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await state("paused");
  await page.getByRole("button", { name: "Replay", exact: true }).click();
  await page.getByRole("button", {name: "Replay from start", exact: true}).click();
  await page.waitForFunction(
    () => Number(document.querySelector('[data-testid="playback-lab"]').dataset.cursorTick) < 1,
  );
  const oldId = (await report()).spec.attemptId;
  await page.getByRole("button", { name: "New attempt", exact: true }).click();
  await page.getByRole("button", {name: "Leave attempt", exact: true}).click();
  await state("playing");
  const restarted = await report();
  assert.notEqual(restarted.spec.attemptId, oldId);
  assert.equal(restarted.mode, "realTime", "the lab starts a new attempt in real time");
  assert.equal(restarted.speed, 1);
  assert.equal(restarted.spec.flyCount, 20);
  assert.ok(restarted.cursorTick < 30);
  assert.ok(pauseResponseMs <= 100, `Pause response took ${pauseResponseMs} ms`);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await state("paused");
  const explanation = page.getByText("What do these numbers mean?", { exact: true });
  await explanation.focus();
  await explanation.press("Enter");
  await page
    .getByText("Read about integrate-and-fire neurons", { exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: new URL("neural-explanation.png", output).pathname });
  assert.deepEqual(errors, []);
  await writeFile(
    new URL("checks.json", output),
    JSON.stringify(
      {
        browser: browser.version(),
        paused,
        fast,
        restarted,
        repeatedNeuralReadout: true,
        pauseResponseMs,
        errors,
      },
      null,
      2,
    ) + "\n",
  );
  console.log("Playback pause/seek/fast/replay/restart and shared sample time passed.");
} finally {
  await browser.close();
}
