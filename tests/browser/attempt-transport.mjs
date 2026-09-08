import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

// This transport test loads the same Vite-transformed Worker entry as the app.
// Production playback/render performance is measured separately on /lab/playback.
const base = process.env.BRAIN_URL ?? "http://127.0.0.1:5173";
const browser = await chromium.launch({
  headless: true,
  channel: process.env.BROWSER_CHANNEL ?? "chrome",
});
const page = await browser.newPage();
try {
  await page.goto(`${base}/lab/brain`);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const report = await page.evaluate(
    async (root) => {
      const { AttemptClient } = await import(`${root}/attempt-client.ts`);
      const { FrameArchive } = await import(`${root}/record.ts`);
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const until = async (predicate) => {
        const deadline = performance.now() + 30000;
        while (!predicate()) {
          if (performance.now() > deadline) throw new Error("Transport test timed out");
          await sleep(10);
        }
      };
      const messages = [];
      const archives = new Map();
      let reenter = false;
      let detached = true;
      const client = new AttemptClient((reply) => {
        messages.push({ type: reply.type, id: reply.attemptId });
        if (reply.type === "error") throw new Error(reply.message);
        if (reply.type === "ready") {
          archives.set(
            reply.attemptId,
            new FrameArchive(reply.info.spec, reply.info.recordLayout, reply.info.archiveBytes, reply.info.initialBodies),
          );
          if (reenter) {
            reenter = false;
            client.startLab("reentered", "42", 2, 30);
          }
        } else if (reply.type === "frames") {
          archives.get(reply.attemptId).append(reply.chunk);
          detached &&= reply.chunk.values.byteLength === 0 && reply.chunk.states.byteLength === 0;
        }
      });
      try {
        client.setHidden(true);
        client.startLab("cancel-loading", "42", 2, 100);
        client.cancel();
        client.startLab("hidden", "42", 2, 100);
        await until(() => archives.has("hidden"));
        await sleep(150);
        const hiddenTick = archives.get("hidden").computedTick;
        client.setHidden(false);
        await until(() => archives.get("hidden").computedTick > 0);
        client.setHidden(true);
        const hideTick = archives.get("hidden").computedTick;
        await sleep(500);
        const stoppedTick = archives.get("hidden").computedTick;
        await sleep(150);
        const stableTick = archives.get("hidden").computedTick;
        client.setHidden(false);
        await until(() => archives.get("hidden").complete);
        const original = archives.get("hidden");
        client.startLab("repeat", "42", 2, 100);
        await until(() => archives.get("repeat")?.complete);
        const repeated = archives.get("repeat");
        const normalized = (archive) =>
          Array.from({ length: archive.computedTick }, (_, i) => {
            const frame = archive.frame(i + 1);
            return { tick: frame.tick, flies: frame.flies };
          });
        const deterministic =
          JSON.stringify(normalized(original)) === JSON.stringify(normalized(repeated));
        reenter = true;
        client.startLab("callback-restart", "42", 2, 100);
        await until(() => archives.get("reentered")?.complete);
        const callbackOldFrames = messages.filter(
          (m) => m.id === "callback-restart" && m.type === "frames",
        ).length;
        client.startLab("cancel-running", "42", 20, 6000);
        await until(() => archives.get("cancel-running")?.computedTick > 0);
        client.cancel();
        const cancellationMessages = messages.length;
        await sleep(150);
        const afterCancellation = messages.length;
        client.startLab("after-cancel", "42", 2, 20);
        await until(() => archives.get("after-cancel")?.complete);
        return {
          detached,
          hiddenTick,
          hideTick,
          stoppedTick,
          stableTick,
          deterministic,
          callbackOldFrames,
          cancellationMessages,
          afterCancellation,
          cancelledLoadingDelivered: messages.some((m) => m.id === "cancel-loading"),
          errors: messages.filter((m) => m.type === "error"),
          finalTick: archives.get("after-cancel").computedTick,
          archiveBytes: original.ownedBytes,
        };
      } finally {
        client.dispose();
      }
    },
    "/@fs" + fileURLToPath(new URL("../../packages/sim-client/src", import.meta.url)),
  );
  assert.equal(report.hiddenTick, 0, "hidden loading must grant no production credits");
  assert.ok(
    report.stoppedTick - report.hideTick <= 20,
    "hidden production must drain at most two chunks",
  );
  assert.equal(
    report.stableTick,
    report.stoppedTick,
    "hidden production must stop after bounded in-flight work",
  );
  assert.equal(report.detached, true, "archive owns and detaches transferred buffers");
  assert.equal(
    report.deterministic,
    true,
    "repeated seed must preserve every recorded neural/body frame",
  );
  assert.equal(
    report.callbackOldFrames,
    0,
    "restart during ready must not acknowledge the old attempt",
  );
  assert.equal(report.cancelledLoadingDelivered, false);
  assert.equal(report.afterCancellation, report.cancellationMessages);
  assert.deepEqual(report.errors, []);
  assert.equal(report.finalTick, 20);
  const output = process.env.TRANSPORT_OUTPUT ? pathToFileURL(process.env.TRANSPORT_OUTPUT + "/") : new URL("../../specs/done/help-the-fly-escape/assets/evidence/05/", import.meta.url);
  await mkdir(output, { recursive: true });
  await writeFile(
    new URL("browser-transport.json", output),
    JSON.stringify({ browser: browser.version(), ...report }, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
