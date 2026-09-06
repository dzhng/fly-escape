import { visibleResponse } from "./visible-response.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const base = process.env.BRAIN_URL ?? "http://127.0.0.1:5184";
const output = new URL("../../specs/help-the-fly-escape/assets/evidence/05/ui/", import.meta.url);
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
const readout = () => page.locator(".groups").innerText();
const seekOne = async () => {
  const slider = page.getByLabel("Playback time", { exact: true });
  await slider.focus();
  await slider.press("Home");
  for (let i = 0; i < 10; i++) await slider.press("ArrowRight");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="selected-tick"]')?.textContent === "1",
  );
};
try {
  await page.goto(`${base}/lab/playback`);
  await state("playing");
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
    () => Number(document.querySelector('[data-testid="selected-tick"]').textContent) > 1,
  );
  await seekOne();
  assert.equal(await readout(), first, "seeking back must restore the same recorded neuron values");
  await page.screenshot({ path: new URL("paused-seek.png", output).pathname });
  await page.getByRole("button", { name: "2×", exact: true }).click();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForFunction(() => {
    const current = JSON.parse(
      document.querySelector('[data-testid="playback-report"]').textContent,
    );
    return current.speed === 2 && ["playing", "buffering"].includes(current.state);
  });
  const speed = await report();
  assert.ok(["playing", "buffering"].includes(speed.state));
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await state("paused");
  await page.getByRole("button", { name: "Replay", exact: true }).click();
  await page.waitForFunction(
    () => Number(document.querySelector('[data-testid="playback-lab"]').dataset.cursorTick) < 1,
  );
  const oldId = (await report()).spec.attemptId;
  await page.getByRole("button", { name: "New attempt", exact: true }).click();
  await state("playing");
  const restarted = await report();
  assert.notEqual(restarted.spec.attemptId, oldId);
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
        speed,
        restarted,
        repeatedNeuralReadout: true,
        pauseResponseMs,
        errors,
      },
      null,
      2,
    ) + "\n",
  );
  console.log("Playback pause/seek/2×/replay/restart and shared sample time passed.");
} finally {
  await browser.close();
}
