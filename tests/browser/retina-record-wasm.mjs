import assert from "node:assert/strict";
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const sourceRoot = fileURLToPath(new URL("../..", import.meta.url));
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];
try {
  const page = await browser.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.BRAIN_URL ?? "http://127.0.0.1:5173");
  const report = await page.evaluate(async (sourceRoot) => {
    const { FrameArchive } = await import(
      `/@fs${sourceRoot}/packages/sim-client/src/record.ts`
    );
    return await new Promise((resolve, reject) => {
      const worker = new Worker(
        `/@fs${sourceRoot}/tests/browser/retina-record-worker.mjs`,
        { type: "module" },
      );
      let archive,
        chunks = 0;
      const timeout = setTimeout(() => {
        worker.terminate();
        reject(Error("record worker deadline"));
      }, 60000);
      const finish = (callback, value) => {
        clearTimeout(timeout);
        worker.terminate();
        callback(value);
      };
      worker.onerror = (event) => finish(reject, Error(event.message));
      worker.onmessage = ({ data }) => {
        try {
          if (data.type === "error") throw Error(data.message);
          if (data.type === "info") {
            const info = data.info;
            archive = new FrameArchive(
              info.spec,
              info.recordLayout,
              info.archiveBytes,
              info.initialBodies,
            );
          }
          if (data.type === "chunk") {
            archive.append(data.chunk);
            chunks++;
          }
          if (data.type === "complete") {
            let checked = 0;
            for (const tick of [10, 1, 12, 11, 2, 9, 3, 8, 4, 7, 5, 6]) {
              const expected = data.expected[tick - 1],
                actual = archive.frame(tick).retina;
              if (
                JSON.stringify(actual.request) !==
                JSON.stringify(expected.request)
              )
                throw Error(`request mismatch tick${tick}`);
              if (
                actual.rgb.length !== expected.rgb.length ||
                !actual.rgb.every(
                  (value, index) => value === expected.rgb[index],
                )
              )
                throw Error(`RGB mismatch tick${tick}`);
              checked += actual.rgb.length;
              for (const fly of [1, 0, 1]) {
                const selected = archive.retina(tick, fly),
                  index = expected.request.poses.findIndex(
                    (pose) => pose.flyId === fly,
                  );
                if (index < 0) {
                  if (selected !== null) throw Error("absent input fabricated");
                  continue;
                }
                const width = selected.rgb.length;
                if (
                  !selected.rgb.every(
                    (value, i) => value === expected.rgb[index * width + i],
                  )
                )
                  throw Error("selection mismatch");
              }
            }
            if (
              !archive.complete ||
              archive.computedTick !== 12 ||
              chunks !== 2
            )
              throw Error("incomplete archive");
            finish(resolve, {
              controlledRgb: true,
              physicalCapture: false,
              chunks,
              ticks: archive.computedTick,
              checkedRgbBytes: checked,
              exactConsumedPackedDecodedSoughtBytes: true,
              archiveOwnedBytes: archive.ownedBytes,
              ...data.metrics,
            });
          }
        } catch (error) {
          finish(reject, error);
        }
      };
      worker.postMessage({ type: "start" });
    });
  }, sourceRoot);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(report, null, 2));
  await writeFile(
    process.env.RETINA_RECORD_WASM_REPORT ?? "/tmp/retina-record-wasm.json",
    JSON.stringify({ ...report, errors }, null, 2),
  );
} finally {
  await browser.close();
}
