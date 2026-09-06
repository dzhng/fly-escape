import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const base = process.env.BRAIN_URL ?? "http://127.0.0.1:5173";
const browser = await chromium.launch({
  headless: true,
  channel: process.env.BROWSER_CHANNEL ?? "chrome",
});
try {
  const page = await browser.newPage();
  await page.route("**/placement-check", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Placement boundary check</title>",
    }),
  );
  await page.goto(`${base}/placement-check`);
  const root = `/@fs${fileURLToPath(new URL("../../packages/sim-client/src/", import.meta.url))}`;
  const report = await page.evaluate(async (root) => {
    const wasm = await import(`${root}wasm/game_wasm.js`);
    const { FrameArchive } = await import(`${root}record.ts`);
    await wasm.default();
    const catalog = JSON.parse(wasm.tool_catalog());
    const request = JSON.parse(wasm.swarm_request("placement-check", "42", 1, 20));
    request.level.sources = [];
    request.level.placementRules.inventory = [
      { kind: "fruit", count: 1 },
      { kind: "fan", count: 1 },
    ];
    const level = JSON.stringify(request.level);
    let state = JSON.parse(
      wasm.edit_setup(
        level,
        "[]",
        JSON.stringify({
          type: "place",
          placement: { id: 1, kind: "fruit", position: { x: -2, z: -2.45 }, heading: 0 },
        }),
      ),
    );
    state = JSON.parse(
      wasm.edit_setup(
        level,
        JSON.stringify(state.placements),
        JSON.stringify({
          type: "place",
          placement: { id: 2, kind: "fan", position: { x: -3, z: -2 }, heading: 0 },
        }),
      ),
    );
    let rejected = "";
    try {
      wasm.edit_setup(
        level,
        JSON.stringify(state.placements),
        JSON.stringify({ type: "move", id: 1, position: { x: -2, z: -2 }, heading: 0 }),
      );
    } catch (error) {
      rejected = String(error);
    }
    const resolved = JSON.parse(wasm.resolve_setup(level, JSON.stringify(state.placements)));
    request.placements = state.placements;
    request.tuning = {
      cues: [
        { pathway: "inhibitoryOdor", gain: 1 },
        { pathway: "excitatoryOdor", gain: 1 },
        { pathway: "vision", gain: 1 },
      ],
      tasteGain: 1,
      silencedNeurons: [],
    };
    const [bytes, manifest] = await Promise.all([
      fetch("/brain/graph.bin").then((r) => r.arrayBuffer()),
      fetch("/brain/manifest.json").then((r) => r.text()),
    ]);
    const run = () => {
      const session = new wasm.AttemptSession(
        new Uint8Array(bytes),
        manifest,
        JSON.stringify(request),
      );
      try {
        const info = JSON.parse(session.info());
        session.step();
        const chunk = session.take_chunk();
        try {
          const record = new FrameArchive(info.spec, info.recordLayout, info.archiveBytes);
          record.append({
            ...JSON.parse(chunk.header()),
            values: chunk.take_values(),
            states: chunk.take_states(),
            events: chunk.take_events(),
            tickNeuralSteps: chunk.take_tick_neural_steps(),
          });
          return { info, frame: record.frame(1) };
        } finally {
          chunk.free();
        }
      } finally {
        session.free();
      }
    };
    const first = run(),
      replay = run();
    const removed = JSON.parse(
      wasm.edit_setup(
        level,
        JSON.stringify(state.placements),
        JSON.stringify({ type: "remove", id: 1 }),
      ),
    );
    return {
      catalog,
      state,
      rejected,
      resolved,
      removed,
      spec: first.info.spec,
      metadataSetup: first.info.resolvedSetup,
      frame: first.frame,
      deterministic: JSON.stringify(first.frame) === JSON.stringify(replay.frame),
    };
  }, root);
  assert.match(report.rejected, /spawn/);
  assert.deepEqual(report.state.remaining, [
    { kind: "fruit", count: 0 },
    { kind: "fan", count: 0 },
  ]);
  assert.equal(report.removed.remaining.find((s) => s.kind === "fruit").count, 1);
  assert.deepEqual(report.metadataSetup, report.resolved);
  assert.deepEqual(report.spec.placements, report.state.placements);
  assert.equal(report.resolved.sources[0].kind, "attractiveOdor");
  assert.equal(report.resolved.food.length, 1);
  assert.equal(report.resolved.fieldConfig.fans.length, 1);
  assert.ok(report.frame.flies[0].sensory.wind.x > 0);
  assert.equal(report.deterministic, true);
  const output = new URL("../../specs/help-the-fly-escape/assets/evidence/14/", import.meta.url);
  await mkdir(output, { recursive: true });
  await writeFile(
    new URL("placement-boundary.json", output),
    JSON.stringify({ browser: browser.version(), ...report }, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      inventory: true,
      invalidMoveRejected: true,
      resolvedMetadataMatches: true,
      localWind: report.frame.flies[0].sensory.wind,
      deterministic: true,
    }),
  );
} finally {
  await browser.close();
}
