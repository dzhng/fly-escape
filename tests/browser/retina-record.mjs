import assert from "node:assert/strict";
import { chromium } from "playwright";
import { readFile, mkdir, writeFile } from "node:fs/promises";
const legacy = JSON.parse(
  await readFile(
    new URL(
      "../../specs/retinal-vision/assets/07/schema-5.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const output =
  process.env.RETINA_RECORD_OUTPUT ?? "/tmp/fly-retina-record-evidence";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = { cases: [] };
try {
  for (const fault of [
    "standard-error",
    "old-layout",
    "future-layout",
    "truncated-layout",
    "corrupt-layout",
    "old-after-valid",
    "invalid-payload",
  ]) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    page.setDefaultTimeout(120000);
    const errors = [];
    const failedRequests = [];
    page.on("requestfailed", (request) =>
      failedRequests.push({
        url: request.url(),
        failure: request.failure()?.errorText,
      }),
    );
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(
      ({ fault, legacy }) => {
        localStorage.setItem(
          "fly-escape-progress",
          JSON.stringify({
            bestStars: { fixture: 3 },
            setups: {
              fixture: [
                { toolId: "kept", position: { x: 1, z: 2 }, rotation: 0 },
              ],
            },
          }),
        );
        const NativeWorker = window.Worker;
        window.Worker = class extends NativeWorker {
          set onmessage(receiver) {
            let chunks = 0;
            super.onmessage = (event) => {
              const data = event.data;
              const reply = data?.reply;
              if (reply?.type === "ready") {
                if (fault === "standard-error")
                  data.reply = {
                    type: "error",
                    attemptId: reply.attemptId,
                    message: "Ordinary interrupted attempt",
                  };
                if (fault === "corrupt-layout")
                  reply.info.recordLayout = {
                    ...reply.info.recordLayout,
                    valueFields: [null],
                  };
                if (fault === "old-layout")
                  reply.info.recordLayout = legacy.layout;
                if (fault === "future-layout")
                  reply.info.recordLayout = { schemaVersion: 99 };
                if (fault === "truncated-layout") reply.info.recordLayout = {};
              }
              if (reply?.type === "frames")
                window.__retinaRecordChunks = ++chunks;
              if (reply?.type === "frames" && chunks === 2) {
                if (fault === "old-after-valid")
                  reply.chunk = {
                    ...legacy.chunks[1],
                    attemptId: reply.attemptId,
                  };
                if (fault === "invalid-payload")
                  reply.chunk.values = new Uint32Array(0);
              }
              receiver?.call(this, new MessageEvent("message", { data }));
            };
          }
        };
      },
      { fault, legacy },
    );
    await page.goto(
      (process.env.BRAIN_URL ?? "http://127.0.0.1:5173") + "/lab/setup",
    );
    const release = page.getByRole("button", { name: "Release the flies" });
    await release.waitFor();
    await page.waitForFunction(
      () => !document.querySelector(".run-setup").disabled,
    );
    const progress = await page.evaluate(() =>
      localStorage.getItem("fly-escape-progress"),
    );
    await page.waitForFunction(
      () =>
        document.querySelector(".setup-game")?.dataset.worldState === "ready",
    );
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    if (fault === "standard-error")
      await page.screenshot({ path: `${output}/settled-setup.png` });
    await release.click();
    const alert = page.getByRole("alert");
    await alert.waitFor();
    for (const name of ["Pause","Play","Fast","Replay"]) assert.equal(await page.getByRole("button",{name,exact:true}).count(),0);
    assert.equal(await page.getByTestId("round-time").count(),0);
    assert.equal(await page.getByTestId("playback-seek").count(),0);
    const recovery = page.getByRole("button", {
      name: "Back to setup",
      exact: true,
    });
    assert.equal((await recovery.textContent()).trim(), "Back to setup");
    const errorRect = await alert.boundingBox(),
      actionRect = await recovery.boundingBox();
    assert.ok(
      Math.abs(actionRect.y - errorRect.y) < 150,
      "recovery action must be near the error message",
    );
    await page.waitForFunction(
      () =>
        document.querySelector(".playback-lab")?.dataset.worldAssetsReady ===
        "true",
    );
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
    });
    const text = await alert.textContent();
    const deliveredChunks = await page.evaluate(
      () => window.__retinaRecordChunks ?? 0,
    );
    if (fault === "old-after-valid" || fault === "invalid-payload")
      assert.ok(
        deliveredChunks >= 2,
        "fault must follow a valid production chunk",
      );
    const hasFrames =
      fault === "old-after-valid" || fault === "invalid-payload";
    const unavailable = page.getByText("Recording unavailable", {
      exact: true,
    });
    if (hasFrames) {
      assert.equal(await unavailable.count(), 0);
      assert.ok(
        (await page.getByTestId("active-count").textContent()).includes(
          "recorded flies",
        ),
      );
      assert.equal(await page.getByTestId("fly-card-0").count(), 1);
      assert.ok(
        (await page.locator(".record-paused").textContent()).includes(
          "recorded at",
        ),
      );
    } else {
      assert.equal(await unavailable.count(), 1);
      assert.equal(await page.getByTestId("active-count").count(), 0);
      assert.equal(await page.getByText("What do these numbers mean?",{exact:true}).count(),0);
      assert.equal(await page.getByTestId("fly-card-0").count(), 0);
    }
    const assetFailuresAtCapture = [...failedRequests];
    assert.deepEqual(assetFailuresAtCapture, []);
    if (fault.startsWith("old"))
      assert.ok(
        text.includes(
          "This recording uses an older format. Start a new attempt to view the fly's eyes.",
        ),
        text,
      );
    else if (fault === "standard-error")
      assert.ok(text.includes("This flight was interrupted"), text);
    else
      assert.ok(
        text.includes("record") ||
          text.includes("Record") ||
          text.includes("Chunk"),
        text,
      );
    await page.screenshot({ path: `${output}/${fault}.png` });
    const messageBounds = await alert.boundingBox();
    const returnBounds = await page
      .getByRole("button", { name: "Back to setup", exact: true })
      .boundingBox();
    await page.screenshot({
      path: `${output}/${fault}-controls.png`,
      clip: {
        x: Math.max(0, returnBounds.x - 15),
        y: Math.max(0, returnBounds.y - 15),
        width: returnBounds.width + 30,
        height: returnBounds.height + 30,
      },
    });
    await alert.screenshot({ path: `${output}/${fault}-message.png` });
    await page
      .getByRole("button", { name: "Back to setup", exact: true })
      .click();
    const confirm = page.getByRole("button", {
      name: "Leave attempt",
      exact: true,
    });
    if (await confirm.count()) await confirm.click();
    await release.waitFor();
    assert.equal(await release.isEnabled(), true);
    assert.equal(
      await page.evaluate(() => localStorage.getItem("fly-escape-progress")),
      progress,
    );
    assert.deepEqual(errors, []);
    report.cases.push({
      fault,
      deliveredChunks,
      hasFrames,
      assetsReady: true,
      assetFailuresAtCapture,
      messageBounds,
      returnBounds,
      message: text,
      usableSetup: true,
      progressUnchanged: true,
      errors,
    });
    await page.close();
  }
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report));
