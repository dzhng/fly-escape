import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const base = process.env.RETINA_URL ?? "http://127.0.0.1:5174";
const output = resolve(process.env.RETINA_EVIDENCE_DIR ?? "/tmp/fly-retina-capture");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
page.on("console", message => { if(message.text().startsWith("Retina probe:")) console.log(message.text()); });
const quantiles = values => {
  const sorted = values.toSorted((a, b) => a - b);
  return { p50: sorted[Math.floor(sorted.length * .5)], p95: sorted[Math.ceil(sorted.length * .95) - 1], worst: sorted.at(-1) };
};
try {
  await page.goto(`${base}/retina`);
  await page.waitForFunction(() => document.querySelector("#app")?.dataset.retinaReady === "true");
  const gpu = await page.locator("#app").getAttribute("data-retina-gpu");
  assert.ok(!/SwiftShader|llvmpipe|software/i.test(gpu), `Hardware acceleration required: ${gpu}`);
  const report = { gpu, browser: browser.version(), profiles: [], errors };
  report.failures = await page.evaluate(async workerUrl => {
    const worker = new Worker(workerUrl, { type: "module" });
    try {
      return await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Failure probe did not settle")), 20000);
        worker.onmessage = ({data}) => { clearTimeout(timeout); data.error ? reject(new Error(data.error)) : resolve(data.result); };
        worker.onerror = event => { clearTimeout(timeout); reject(new Error(event.message)); };
        worker.postMessage({});
      });
    } finally { worker.terminate(); }
  }, `${base}/@fs${resolve("tests/browser/retina-failures-worker.mjs")}`);
  assert.match(report.failures.invalidPose, /finite/);
  assert.match(report.failures.overlap, /already pending/);
  assert.equal(report.failures.originalCompleted, true);
  assert.match(report.failures.overload, /1–16/);
  for (const failure of ["cancel", "context", "unresponsive", "copy"]) {
    assert.ok(!report.failures[failure].returnedFrame);
    assert.ok(/cancel|context|failed/i.test(report.failures[failure].error));
    assert.ok(report.failures[failure].ms < 5000, `${failure} exceeded failure deadline`);
  }
  for (const key of ["geometries", "textures", "stagingBytes", "sampleBytes"])
    assert.ok(report.failures.retries.every(run => run[key] === report.failures.retries[0][key]), `${key} grew across retries`);
  console.log(JSON.stringify({failures: report.failures}));
  // This page continues rendering the authored room throughout acquisition.
  for (const [size, radius] of (process.argv.includes("--faults-only") ? [] : process.argv.includes("--selected-only") ? [[128, 15]] : [[64, 15], [128, 15], [256, 15], [128, 8], [128, 12]])) {
    const result = await page.evaluate(async ({ size, radius, projectionUrl }) => {
      const { RetinaProjection } = await import(projectionUrl);
      const worker = new Worker(new URL("/src/retina-worker.ts", location.href), { type: "module" });
      const request = command => new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Probe worker did not settle")), 10000);
        worker.onmessage = ({ data }) => { clearTimeout(timeout); data.type === "error" ? reject(new Error(data.message)) : resolve(data); };
        worker.onerror = event => { clearTimeout(timeout); reject(new Error(event.message)); };
        worker.postMessage(command);
      });
      try {
        const ready = await request({ type: "start", profile: { width: size, height: size, radius, distortion: 3.8, zoom: 2.72 } });
        const makePose = heading => ({ position: [1, .45, 2.5], rotation: [0, Math.sin((Math.PI / 2 - heading) / 2), 0, Math.cos((Math.PI / 2 - heading) / 2)] });
        const first = await request({ type: "capture", poses: [makePose(0)] });
        const turned = await request({ type: "capture", poses: [makePose(.15)] });
        const repeat = await request({ type: "capture", poses: [makePose(0)] });
        const quality = [];
        const projection = new RetinaProjection(ready.profile);
        for (const [name, position, heading] of [
          ["landmarks", [1, .45, 2.5], 0],
          ["landmarks-turned", [1, .45, 2.5], .15],
          ["door-floor", [3.8, .01, 2.55], Math.PI / 2 - .47],
          ["door-flight", [3.8, 1.1, 2.55], Math.PI / 2 - .47],
        ]) {
          const pose = makePose(heading); pose.position = position;
          const frame = await request({ type: "capture", poses: [pose], cameraImages: true });
          const images = [];
          for (let eye = 0; eye < 2; eye++) {
            const bytes = projection.cells.length * 3;
            const canvas = document.createElement("canvas"); canvas.width = size; canvas.height = size;
            canvas.getContext("2d").putImageData(new ImageData(projection.image(frame.samples.subarray(eye * bytes, (eye + 1) * bytes)), size, size), 0, 0);
            images.push(canvas.toDataURL());
          }
          for (let eye = 0; eye < 2; eye++) {
            const canvas = document.createElement("canvas"); canvas.width = size; canvas.height = size;
            canvas.getContext("2d").putImageData(new ImageData(frame.cameraImages[eye], size, size), 0, 0);
            images.push(canvas.toDataURL());
          }
          quality.push({ name, pose, samples: Array.from(frame.samples), images, oracleMaxByteDifference: frame.oracleMaxByteDifference });
        }
        const runs = [];
        for (let i = 0; i < 200; i++) {
          const batch = await request({ type: "capture", poses: Array.from({ length: 16 }, (_, fly) => { const pose = makePose(fly * .1 + i * .005); pose.position[0] += .1 * Math.sin(i * .01); pose.position[1] += .05 * Math.sin(i * .02); return pose; }) });
          const began = performance.now();
          const wasmSized = new Uint8Array(batch.samples.length);
          wasmSized.set(batch.samples);
          runs.push({ ...batch.metrics, copyMs: performance.now() - began });
        }
        const blockedReady = await request({ type: "start", profile: ready.profile, doorwayBlocked: true });
        const occlusion = [];
        for (const item of quality.filter(item => item.name.startsWith("door-"))) {
          const blocked = await request({ type: "capture", poses: [item.pose] });
          const blueCount = values => {
            let count = 0;
            for (let cell = 0; cell < projection.cells.length; cell++) {
              const [r, g, b] = values.slice(cell * 3, cell * 3 + 3);
              if (b >= 32 && b > r * 1.5 && b > g * 1.5) count++;
            }
            return count;
          };
          occlusion.push({ name: item.name, pose: item.pose, openSceneId: ready.sceneId, blockedSceneId: blockedReady.sceneId, openSamples: item.samples, blockedSamples: Array.from(blocked.samples), openBlue: blueCount(item.samples), blockedBlue: blueCount(blocked.samples) });
        }
        await request({ type: "dispose" });
        return { occlusion, quality, ready, first: { ...first, samples: Array.from(first.samples) }, turned: Array.from(turned.samples), repeat: Array.from(repeat.samples), runs };
      } finally { worker.terminate(); }
    }, { size, radius, projectionUrl: `/@fs${resolve("packages/game-renderer/src/retina-projection.ts")}` });
    for (const contrast of result.occlusion) {
      assert.ok(contrast.openBlue >= 3, `${contrast.name}: target must cross multiple cells`);
      assert.equal(contrast.blockedBlue, 0, `${contrast.name}: opaque doorway must occlude target`);
    }
    for (const fixture of result.quality) {
      for (let eye = 0; eye < 2; eye++) {
        await writeFile(`${output}/${size}-${radius}-${fixture.name}-${eye === 0 ? "L" : "R"}.png`, Buffer.from(fixture.images[eye].split(",")[1], "base64"));
        await writeFile(`${output}/${size}-${radius}-${fixture.name}-${eye === 0 ? "L" : "R"}-camera.png`, Buffer.from(fixture.images[eye + 2].split(",")[1], "base64"));
      }
      assert.ok(fixture.oracleMaxByteDifference <= 1, "GPU pool must agree with independent CPU pooling within one RGB8 level");
      delete fixture.images;
    }
    assert.deepEqual(result.first.samples, result.repeat, "Frozen pose must reproduce exact consumed RGB bytes");
    assert.notDeepEqual(result.first.samples, result.turned, "Landmark movement must change sampled eyes");
    const warm = result.runs.slice(20);
    result.timing = Object.fromEntries(["submissionMs", "poolingSubmissionMs", "readbackMs", "unpackMs", "copyMs"].map(key => [key, quantiles(warm.map(run => run[key]))]));
    result.timing.complete = quantiles(warm.map(run => run.totalMs + run.copyMs));
    report.profiles.push(result);
    await writeFile(`${output}/benchmark.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ size, radius, ...result.timing.complete }));
  }
  await writeFile(`${output}/benchmark.json`, JSON.stringify(report, null, 2));
  let stalledWorker = false;
  await page.route("**/src/retina-worker.ts*", async route => {
    const response = await route.fetch();
    let body = await response.text();
    if (!stalledWorker) {
      assert.ok(body.includes("await capture.acquire("));
      body = body.replace("await capture.acquire(", "await new Promise(() => {}); await capture.acquire(");
      stalledWorker = true;
    }
    await route.fulfill({ response, body });
  });
  await page.reload();
  await page.waitForFunction(() => document.querySelector("#retina-status")?.textContent.includes("timed out"), { timeout: 30000 });
  assert.equal(await page.locator("#retina-capture").isEnabled(), true, "Timed-out worker must release controls");
  await page.locator("#retina-capture").click();
  await page.waitForFunction(() => document.querySelector("#app")?.dataset.retinaReady === "true");
  report.watchdog = { terminatedStalledWorker: true, controlsRecovered: true, explicitRetryCaptured: true };
  await writeFile(`${output}/benchmark.json`, JSON.stringify(report, null, 2));
  await page.screenshot({ path: `${output}/workbench.png` });
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
