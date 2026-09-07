import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const output = process.env.RETRY_EVIDENCE ?? "/tmp/fly-retry-resources";
await mkdir(output, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const cdp = await page.context().newCDPSession(page);
  await page.goto(`${process.env.BRAIN_URL ?? "http://127.0.0.1:5184"}/lab/setup`);
  const samples = [];
  for (let run = 0; run < 20; run++) {
    await page.waitForFunction(() => document.querySelector(".run-setup")?.disabled === false);
    await page.getByRole("button", { name: "Run · release flies", exact: true }).click();
    await page.waitForFunction(() => {
      const text = document.querySelector('[data-testid="playback-report"]')?.textContent;
      if (!text) return false;
      const report = JSON.parse(text);
      return report.state === "playing" && report.cursorTick >= 10;
    }, undefined, { timeout: 90000 });
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.waitForFunction(() => JSON.parse(document.querySelector('[data-testid="playback-report"]').textContent).state === "paused");
    const report = JSON.parse(await page.getByTestId("playback-report").textContent());
    assert.equal(report.spec.flyCount, 20);
    assert.equal(page.workers().length, 1, "retry must not accumulate live simulation Workers");
    await page.getByRole("button", { name: "Cancel attempt", exact: true }).click();
    await page.waitForFunction(() => document.querySelector(".run-setup")?.disabled === false);
    await cdp.send("HeapProfiler.collectGarbage");
    const heap = await cdp.send("Runtime.getHeapUsage");
    assert.equal(page.workers().length, 1, "the single setup Worker remains reusable");
    assert.equal(await page.locator("canvas").count(), 1, "retry must show one setup world");
    samples.push({ run, attemptId: report.spec.attemptId, rootSeed: report.spec.rootSeed,
      simulationBuildId: report.spec.simulationBuildId, graphHash: report.spec.graphHash,
      renderer: report.renderer, wasmBytes: report.memory.wasmBytes,
      mainHeapAfterReturn: heap, dom: await cdp.send("Memory.getDOMCounters") });
  }
  assert.equal(new Set(samples.map((s) => s.attemptId)).size, samples.length);
  assert.equal(new Set(samples.map((s) => s.rootSeed)).size, samples.length);
  assert.equal(new Set(samples.map((s) => s.simulationBuildId)).size, 1);
  assert.equal(new Set(samples.map((s) => s.graphHash)).size, 1);
  assert.deepEqual(errors, []);
  const heaps = samples.map((s) => s.mainHeapAfterReturn.usedSize);
  await writeFile(`${output}/report.json`, JSON.stringify({ browser: browser.version(), samples,
    retainedMainHeapChangeBytes: heaps.at(-1) - heaps[0], errors,
    scope: "Twenty real 20-fly Run/cancel/edit cycles. Collected main heaps are observations, not process RSS or a proof that Worker/GPU memory cannot leak. Final release memory and sustained full-attempt gates remain separate." }, null, 2) + "\n");
} finally {
  await browser.close();
}
