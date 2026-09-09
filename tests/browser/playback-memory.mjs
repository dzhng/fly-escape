import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
const base = process.env.BRAIN_URL ?? "http://127.0.0.1:5184";
const baseline = new URL("../../specs/done/help-the-fly-escape/assets/evidence/05/", import.meta.url);
const output = process.env.MEMORY_OUTPUT
  ? pathToFileURL(process.env.MEMORY_OUTPUT + "/")
  : new URL("/tmp/fly-playback-memory/", import.meta.url);
const browser = await chromium.launch({
  headless: true,
  channel: process.env.BROWSER_CHANNEL ?? "chrome",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
try {
  await page.goto(`${base}/lab/playback`);
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="playback-lab"]')?.dataset.playbackState === "playing",
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.waitForFunction(
    () =>
      JSON.parse(document.querySelector('[data-testid="playback-report"]').textContent).state ===
      "paused",
  );
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download report", exact: true }).click();
  const download = await downloadPromise;
  const snapshot = JSON.parse(await readFile(await download.path(), "utf8"));
  assert.ok(snapshot.renderer.gpu.estimatedBytes > 0);
  const main = await page.context().newCDPSession(page);
  const mainHeap = await main.send("Runtime.getHeapUsage");
  const targets = await browser.newBrowserCDPSession();
  const { targetInfos } = await targets.send("Target.getTargets");
  const target = targetInfos.find(
    (info) => info.type === "worker" && info.url.includes("attempt-worker"),
  );
  assert.ok(target, "attempt Worker must remain available for heap measurement");
  const { sessionId } = await targets.send("Target.attachToTarget", {
    targetId: target.targetId,
    flatten: false,
  });
  const workerHeap = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      targets.off("Target.receivedMessageFromTarget", receive);
      reject(new Error("Worker heap response timed out"));
    }, 5000);
    const receive = (event) => {
      if (event.sessionId !== sessionId) return;
      const message = JSON.parse(event.message);
      if (message.id !== 1) return;
      clearTimeout(timeout);
      targets.off("Target.receivedMessageFromTarget", receive);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    };
    targets.on("Target.receivedMessageFromTarget", receive);
    targets
      .send("Target.sendMessageToTarget", {
        sessionId,
        message: JSON.stringify({ id: 1, method: "Runtime.getHeapUsage" }),
      })
      .catch(reject);
  });
  await targets.send("Target.detachFromTarget", { sessionId });
  const fullRun = JSON.parse(
    await readFile(process.env.FULL_RUN_REPORT ?? new URL("full-playback/run-01.json", baseline), "utf8"),
  );
  assert.equal(fullRun.spec.simulationBuildId, snapshot.spec.simulationBuildId);
  const heapBytes = (heap) => heap.usedSize + heap.embedderHeapUsedSize + heap.backingStorageSize;
  const components = {
    mainHeapAndBackingBytes: heapBytes(mainHeap),
    workerHeapAndBackingBytes: heapBytes(workerHeap),
    wasmHighWaterBytes: Math.max(fullRun.memory.wasmBytes, snapshot.memory.wasmBytes),
    fullArchiveBoundBytes: snapshot.memory.archiveBoundBytes,
    rawGraphAllowanceBytes: snapshot.memory.graphBytes,
    gpuEstimatedBytes: snapshot.renderer.gpu.estimatedBytes,
  };
  const conservativeOwnedBytes = Object.values(components).reduce((sum, value) => sum + value, 0);
  const result = {
    browser: browser.version(),
    snapshot,
    mainHeap,
    workerHeap,
    components,
    conservativeOwnedBytes,
    note: "Conservative app-owned estimate, not process RSS. Intentionally counts potentially overlapping WASM/backing storage, graph/backing storage and archive/backing storage twice; the full archive allowance includes per-chunk overhead. Uses full-run WASM high water plus live main/Worker heaps and renderer-owned GPU estimates. Browser compositor, executable code and driver overhead are excluded.",
  };
  assert.ok(
    conservativeOwnedBytes <= 512 * 1024 * 1024,
    "20-fly owned-memory estimate exceeds target",
  );
  await mkdir(output, { recursive: true });
  await writeFile(new URL("browser-memory.json", output), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ components, conservativeOwnedBytes }, null, 2));
} finally {
  await browser.close();
}
