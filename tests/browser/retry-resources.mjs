import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const seeds = process.env.RETRY_SEEDS?.split(",");
const runs = Number(process.env.RETRY_RUNS ?? seeds?.length ?? 20);
const campaign = process.env.RETRY_CAMPAIGN;
// Local desktop production acceptance; diagnostic labs retain their existing timeouts.
const assertStartup = process.env.RETRY_ASSERT_STARTUP === "1";
const fullAttempts = process.env.RETRY_FULL === "1";
// An explicit diagnostic override measures slow startup; the default gate stays unchanged.
const startTimeoutMs = Number(process.env.RETRY_START_TIMEOUT_MS ?? 90000);
assert.ok(Number.isFinite(startTimeoutMs) && startTimeoutMs > 0);
const mode = process.env.RETRY_MODE ?? "realTime";
assert.ok(mode === "realTime" || mode === "fast", "RETRY_MODE must be realTime or fast");
assert.ok(!campaign || campaign === "1" || campaign === "2", "RETRY_CAMPAIGN must be 1 or 2");
assert.ok(!assertStartup || campaign, "Startup acceptance requires an actual campaign level");
assert.ok(!fullAttempts || campaign, "Full-attempt verification requires an actual campaign level");
assert.ok(process.env.RETRY_ASSERT_STABLE !== "1" || runs >= 3, "Post-warm-up stability comparison requires at least three retries");
assert.ok(Number.isInteger(runs) && runs >= 1 && runs <= 20, "RETRY_RUNS must be 1..20");
if (seeds) {
  assert.equal(seeds.length, runs, "provide one recorded seed per attempt");
  assert.ok(seeds.every(seed => /^\d+$/.test(seed) && BigInt(seed) < 2n ** 64n), "seeds must be unsigned 64-bit integers");
  assert.equal(new Set(seeds.map(seed => BigInt(seed).toString())).size, runs, "retry seeds must be distinct");
}
const browser = await chromium.launch({ channel: "chrome", headless: true });
const output = process.env.RETRY_EVIDENCE ?? "/tmp/fly-retry-resources";
await mkdir(output, { recursive: true });
let activeRun = 0;
let page;
try {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => {
    // Capture actual DOM clicks before React handles them. Double RAF places the
    // observation beyond a paint opportunity, including the world's render loop.
    window.__retryTiming = { starts: [], returns: [], coldSetupMs: null };
    const afterPaint = (ready, complete) => {
      const poll = () => {
        if (!ready()) return requestAnimationFrame(poll);
        requestAnimationFrame(() => requestAnimationFrame(() => complete(performance.now())));
      };
      requestAnimationFrame(poll);
    };
    const editable = () => document.querySelector(".run-setup")?.disabled === false;
    afterPaint(editable, now => { window.__retryTiming.coldSetupMs = now; });
    document.addEventListener("click", event => {
      const button = event.target.closest?.("button");
      const timing = window.__retryTiming;
      if (button?.matches(".run-setup")) {
        const sample = { clickedAt: performance.now(), firstAdvancingFrameMs: null };
        timing.starts.push(sample);
        afterPaint(() => {
          const text = document.querySelector('[data-testid="playback-report"]')?.textContent;
          if (!text) return false;
          const report = JSON.parse(text);
          return report.state === "playing" && report.cursorTick > 0;
        }, now => { sample.firstAdvancingFrameMs = now - sample.clickedAt; });
      } else if (button?.textContent.trim() === "Leave attempt") {
        const sample = { clickedAt: performance.now(), editableFrameMs: null };
        timing.returns.push(sample);
        afterPaint(editable, now => { sample.editableFrameMs = now - sample.clickedAt; });
      }
    }, true);
  });
  if (seeds) await page.addInitScript(recordedSeeds => {
    const random = crypto.getRandomValues.bind(crypto);
    let next = 0;
    crypto.getRandomValues = array => {
      if (!(array instanceof BigUint64Array) || array.length !== 1) return random(array);
      if (next >= recordedSeeds.length) throw new Error("Recorded attempt seeds exhausted");
      array[0] = BigInt(recordedSeeds[next++]);
      return array;
    };
  }, seeds);
  const worldAssetRequests = [];
  const imageRequests = [];
  page.on("request", request => {
    if (!/\.(glb|png)$/i.test(new URL(request.url()).pathname)) return;
    // Palette <img> elements remount independently of the world asset loaders.
    if (request.resourceType() === "image" && /\.png$/i.test(new URL(request.url()).pathname))
      imageRequests.push(request.url());
    else worldAssetRequests.push(request.url());
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const cdp = await page.context().newCDPSession(page);
  if (campaign === "2") await page.addInitScript(() => {
    localStorage.setItem("fly-escape-progress", JSON.stringify({ bestStars: { "open-window": 1 }, setups: {} }));
  });
  await page.goto(`${process.env.BRAIN_URL ?? "http://127.0.0.1:5184"}${campaign ? "/" : "/lab/setup"}`);
  if (campaign === "2") await page.getByRole("button", { name: /2\. Turn the Corner/ }).click();
  await page.waitForFunction(() => window.__retryTiming.coldSetupMs !== null);
  // Level two includes the real level-selection interaction after navigation.
  if (campaign === "2") await page.evaluate(() => new Promise(resolve => {
    const poll = () => {
      if (document.querySelector(".run-setup")?.disabled !== false) return requestAnimationFrame(poll);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        window.__retryTiming.coldSetupMs = performance.now();
        resolve();
      }));
    };
    requestAnimationFrame(poll);
  }));
  const coldSetupMs = await page.evaluate(() => window.__retryTiming.coldSetupMs);
  const setupAssets = [...worldAssetRequests];
  const setupCanvas = await page.locator("canvas").elementHandle();
  const samples = [];
  for (let run = 0; run < runs; run++) {
    activeRun = run + 1;
    await page.waitForFunction(() => document.querySelector(".run-setup")?.disabled === false);
    await page.getByRole("button", { name: "Release the flies", exact: true }).click();
    if (fullAttempts)
      await page.getByRole("button", { name: mode === "fast" ? "Fast" : "Play", exact: true }).click({timeout: startTimeoutMs});
    await page.waitForFunction(() => {
      const text = document.querySelector('[data-testid="playback-report"]')?.textContent;
      if (!text) return false;
      const report = JSON.parse(text);
      return report.state === "error" || (report.state === "playing" && report.cursorTick >= 10);
    }, undefined, { timeout: startTimeoutMs });
    assert.ok(await setupCanvas.evaluate(canvas => canvas === document.querySelector("canvas")),
      "Release must preserve the editable world canvas identity");
    assert.equal(await page.locator(".playback-world > .canvas canvas").count(), 1, "playback must show one world");
    assert.deepEqual(worldAssetRequests, setupAssets, "Release must not request world assets again");
    await page.waitForFunction(run => window.__retryTiming.starts[run]?.firstAdvancingFrameMs != null,
      run, { timeout: startTimeoutMs });
    const startedAt = performance.now();
    const started = JSON.parse(await page.getByTestId("playback-report").textContent());
    assert.equal(started.state, "playing", started.error ?? "attempt must enter playback");
    const rendererDevice = await page.evaluate(() => {
      const gl = document.querySelector('[data-testid="playback-lab"] canvas')?.getContext("webgl2");
      const extension = gl?.getExtension("WEBGL_debug_renderer_info");
      return extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null;
    });
    if (seeds) assert.equal(BigInt(started.spec.rootSeed), BigInt(seeds[run]), "attempt must use its recorded seed");
    if (campaign) {
      assert.equal(await page.getByRole("button", { name: "Play", exact: true }).count(), 1);
      assert.equal(await page.getByRole("button", { name: "Fast", exact: true }).count(), 1);
      assert.equal(await page.getByTestId("outcome-starved").count(), 0);
      assert.match(await page.getByTestId("round-time").textContent(), /^\d+:\d{2} left$/);
    }
    const startedTick = started.cursorTick;
    if (fullAttempts) {
      await page.waitForFunction(() => {
        const report = JSON.parse(document.querySelector('[data-testid="playback-report"]').textContent);
        return report.state === "ended" || report.state === "error";
      }, undefined, { timeout: started.spec.durationTicks * 100 / started.speed + 90000 });
    } else {
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await page.waitForFunction(() => JSON.parse(document.querySelector('[data-testid="playback-report"]').textContent).state === "paused");
    }
    const report = JSON.parse(await page.getByTestId("playback-report").textContent());
    report.rendererDevice = rendererDevice;
    await writeFile(`${output}/attempt-${run + 1}.json`, JSON.stringify(report, null, 2) + "\n");
    assert.equal(report.spec.flyCount, 16);
    if (fullAttempts) {
      assert.ok(rendererDevice && !/SwiftShader|Software|llvmpipe/i.test(rendererDevice),
        "frame timing acceptance requires an identified hardware renderer");
      assert.equal(report.state, "ended", "the actual attempt must finish without an error");
      assert.equal(report.complete, true);
      assert.equal(report.cursorTick, report.result.completedTick);
      assert.equal(report.computedTick, report.result.completedTick);
      assert.ok(report.result.completedTick > 0 && report.result.completedTick <= report.spec.durationTicks);
      if (campaign) {
        assert.equal(report.result.outcomes.starved, 0, "timed campaign flies cannot starve");
        if (report.result.completedTick === report.spec.durationTicks)
          assert.equal(await page.getByTestId("round-time").textContent(), "0:00 left");
        await page.screenshot({ path: `${output}/attempt-${run + 1}.png` });
      }
      const outcomes = report.result.outcomes;
      assert.equal(outcomes.escaped + outcomes.starved + outcomes.zapped + outcomes.caught + outcomes.timedOut,
        report.spec.flyCount, "every fly must have a terminal outcome before an attempt is complete");
      assert.equal(report.mode, mode, "attempt must retain the selected playback mode");
      assert.equal(report.speed, mode === "fast" ? report.fastMultiplier : 1,
        "playback must consume at the selected mode's multiplier");
      assert.ok(report.spec.durationTicks * 0.1 <= report.fastMultiplier * 60 + 0.001,
        "fast mode must fit the authored horizon into a wall minute");
      assert.ok(performance.now() - startedAt >= (report.cursorTick - startedTick) * 100 / report.speed - 100,
        "playback must traverse the recorded interval at the chosen rate without skipping ahead");
      assert.equal(report.underruns, 0);
      assert.ok(report.frameIntervals.count > 0 && Number.isFinite(report.frameIntervals.p95Ms),
        "full attempts require measured frame intervals");
      assert.ok(report.frameIntervals.p95Ms <= 25, "desktop frame interval p95 exceeds 25 ms");
    }
    assert.equal(page.workers().length, 1, "retry must not accumulate live simulation Workers");
    await page.getByRole("button", { name: /Cancel attempt|Retry — edit setup/ }).click();
    await page.getByRole("button", {name: "Leave attempt", exact: true}).click();
    await page.waitForFunction(() => document.querySelector(".run-setup")?.disabled === false);
    await page.waitForFunction(run => window.__retryTiming.returns[run]?.editableFrameMs != null,
      run, { timeout: startTimeoutMs });
    assert.ok(await setupCanvas.evaluate(canvas => canvas === document.querySelector("canvas")),
      "return and restart must preserve the original editable world canvas identity");
    assert.deepEqual(worldAssetRequests, setupAssets, "return must not request world assets again");
    const timing = await page.evaluate(run => ({
      startToAdvancingFrameMs: window.__retryTiming.starts[run].firstAdvancingFrameMs,
      confirmationToEditableFrameMs: window.__retryTiming.returns[run].editableFrameMs,
    }), run);
    await cdp.send("HeapProfiler.collectGarbage");
    const heap = await cdp.send("Runtime.getHeapUsage");
    assert.equal(page.workers().length, 1, "the single setup Worker remains reusable");
    assert.equal(await page.locator("canvas").count(), 1, "retry must show one setup world");
    samples.push({ run, attemptId: report.spec.attemptId, rootSeed: report.spec.rootSeed,
      simulationBuildId: report.spec.simulationBuildId, graphHash: report.spec.graphHash,
      rendererDevice, timing, startup: report.startup,
      renderer: report.renderer, wasmBytes: report.memory.wasmBytes,
      mainHeapAfterReturn: heap, dom: await cdp.send("Memory.getDOMCounters") });
  }
  await page.locator("canvas").screenshot({ path: `${output}/setup.png` });
  const chunks = [];
  cdp.on("HeapProfiler.addHeapSnapshotChunk", ({ chunk }) => chunks.push(chunk));
  await cdp.send("HeapProfiler.takeHeapSnapshot", { reportProgress: false });
  await writeFile(`${output}/clean.heapsnapshot`, chunks.join(""));
  assert.equal(new Set(samples.map((s) => s.attemptId)).size, samples.length);
  assert.equal(new Set(samples.map((s) => s.rootSeed)).size, samples.length);
  assert.equal(new Set(samples.map((s) => s.simulationBuildId)).size, 1);
  assert.equal(new Set(samples.map((s) => s.graphHash)).size, 1);
  assert.deepEqual(errors, []);
  const heaps = samples.map((s) => s.mainHeapAfterReturn.usedSize);
  await writeFile(`${output}/report.json`, JSON.stringify({ browser: browser.version(), samples,
    startupAcceptance: assertStartup, coldSetupMs, setupAssets, imageRequests,
    timingMaxima: {
      startToAdvancingFrameMs: Math.max(...samples.map(sample => sample.timing.startToAdvancingFrameMs)),
      confirmationToEditableFrameMs: Math.max(...samples.map(sample => sample.timing.confirmationToEditableFrameMs)),
    },
    retainedMainHeapChangeBytes: heaps.at(-1) - heaps[0], errors,
    scope: `${runs} real 16-fly ${fullAttempts ? `complete ${mode} attempts and retries` : "Run/cancel/edit cycles"} on ${campaign ? `campaign level ${campaign}` : "diagnostic setup"}. Collected main heaps are observations, not process RSS or a proof that Worker/GPU memory cannot leak. Final combined memory, input latency, hidden-tab and platform gates remain separate.` }, null, 2) + "\n");
  if (assertStartup) {
    assert.ok(coldSetupMs <= 5000, `cold navigation to editable frame took ${coldSetupMs} ms (limit 5000)`);
    for (const sample of samples) {
      const startLimitMs = sample.run === 0 ? 3000 : 2000;
      assert.ok(sample.timing.startToAdvancingFrameMs <= startLimitMs,
        `run ${sample.run + 1} Release to advancing frame took ${sample.timing.startToAdvancingFrameMs} ms (limit ${startLimitMs})`);
      assert.ok(sample.timing.confirmationToEditableFrameMs <= 500,
        `run ${sample.run + 1} confirmation to editable frame took ${sample.timing.confirmationToEditableFrameMs} ms (limit 500)`);
    }
  }
  await setupCanvas.dispose();
  if (process.env.RETRY_ASSERT_STABLE === "1") {
    assert.ok(samples.at(-1).dom.nodes <= samples[1].dom.nodes + 2, "detached DOM must not grow per retry after warm-up");
  }
} catch (error) {
  const report = await page?.getByTestId("playback-report").textContent({ timeout: 1000 }).catch(() => null);
  await writeFile(`${output}/failure.json`, JSON.stringify({ run: activeRun, error: String(error),
    report, timing: await page?.evaluate(() => window.__retryTiming).catch(() => null) }, null, 2) + "\n");
  await page?.screenshot({ path: `${output}/failure.png` }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
