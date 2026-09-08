import { visibleResponse } from "./visible-response.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const base = process.env.BRAIN_URL ?? "http://127.0.0.1:5184";
const output = new URL(
  process.env.PERFORMANCE_OUTPUT ?? "../../specs/done/help-the-fly-escape/assets/evidence/05/full-playback/",
  import.meta.url,
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: process.env.BROWSER_CHANNEL ?? "chrome",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const report = async () => JSON.parse(await page.getByTestId("playback-report").textContent());
const runs = Number(process.env.PERFORMANCE_RUNS ?? 10);
assert.ok(Number.isInteger(runs) && runs > 0 && runs <= 10);
try {
  await page.goto(`${base}/lab/playback`);
  for (let run = 1; run <= runs; run++) {
    if (run > 1) {
      await page.getByRole("button", { name: "New attempt", exact: true }).click();
      await page.getByRole("button", { name: "Leave attempt", exact: true }).click();
    }
    await page.waitForFunction(
      () =>
        document.querySelector('[data-testid="playback-lab"]')?.dataset.playbackState === "playing",
      undefined,
      { timeout: 600000 },
    );
    const visibleResponseMs = await visibleResponse(
      page,
      "click",
      '[data-testid="selected-fly"][data-fly-id="19"]',
      () => page.getByRole("button", { name: "Select fly 20", exact: true }).click(),
    );
    await page.waitForFunction(
      () => document.querySelector('[data-testid="selected-fly"]')?.dataset.flyId === "19",
    );
    const start = await report();
    console.log(
      `Run ${run}: started after ${start.initialWaitMs.toFixed(0)} ms; production ${start.activeEquivalentProductionRate.toFixed(2)}×`,
    );
    await page.waitForFunction(
      () =>
        ["ended", "error"].includes(
          document.querySelector('[data-testid="playback-lab"]')?.dataset.playbackState,
        ),
      undefined,
      { timeout: 1200000 },
    );
    const result = { run, visibleResponseMs, browser: browser.version(), ...(await report()), errors: [...errors] };
    await writeFile(
      new URL(`run-${String(run).padStart(2, "0")}.json`, output),
      JSON.stringify(result, null, 2) + "\n",
    );
    assert.ok(
      result.visibleResponseMs <= 100,
      `Visible selection response took ${result.visibleResponseMs} ms`,
    );
    assert.equal(result.state, "ended");
    assert.equal(result.computedTick, 6000);
    assert.equal(result.cursorTick, 6000);
    assert.equal(
      result.activeNeuralSteps,
      120000,
      "all20 brains must remain active through the complete horizon",
    );
    assert.equal(result.mode, "realTime", "the lab measures production against real time");
    assert.equal(result.speed, 1);
    assert.equal(result.underruns, 0, "a sustained1× run must not need repeated buffer rebuilding");
    assert.ok(result.frameIntervals.p95Ms <= 25, "frame intervalp95 exceeds the desktop target");
    assert.ok(
      result.interactions.count > 0 && result.interactions.maxMs <= 100,
      "interaction response exceeds target",
    );
    assert.ok(result.memory.archiveOwnedChunkBytes <= 128 * 1024 * 1024);
    assert.deepEqual(result.errors, []);
    console.log(
      `Run ${run} complete: framep95 ${result.frameIntervals.p95Ms} ms, underruns ${result.underruns}`,
    );
  }
} finally {
  await browser.close();
}
