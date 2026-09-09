// Full retained history, synthetic bytes and native-produced record/motion layout.
import assert from "node:assert/strict";
import {
  FrameArchive,
  type TransferChunk,
} from "../packages/sim-client/src/record";
const produced = Bun.spawnSync([
  "cargo",
  "run",
  "-q",
  "-p",
  "sim",
  "--example",
  "record_fixture",
  "--",
  "--retinal",
]);
assert.equal(produced.exitCode, 0, produced.stderr.toString());
const fixture = JSON.parse(produced.stdout.toString());
const layout = fixture.layout;
Object.assign(layout.retinalConfig.profile, {
  width: 128,
  height: 128,
  sampleCount: 721,
});
layout.groupIds = [
  ...layout.groupIds,
  ...Array.from({ length: 14 }, (_, i) => `extra-${i}`),
];
const flyCount = 16,
  horizon = 6000,
  cap = 512 * 1024 * 1024,
  eyeWidth = 721 * 6;
const initial = Array.from({ length: flyCount }, () => ({
  pose: { position: { x: 0, z: 0 }, heading: 0 },
  mode: "walking" as const,
  reserve: 10,
  height: 0,
  support: null,
  rotation: [0, 0, 0, 1] as [number, number, number, number],
  outcome: null,
}));
const archive = new FrameArchive(
  { attemptId: "memory", flyCount, durationTicks: horizon },
  layout,
  cap,
  initial,
);
const template = fixture.chunks[0],
  valueStride = layout.valueFields.length + layout.groupIds.length * 2;
const pose = [
    ...template.values.slice(0, layout.valueFields.length + 4),
    ...Array(28).fill(0),
  ],
  state = template.states.slice(0, 5);
state[2] = 7;
const motionEnd = 6;
const motionValues = Array.from({ length: motionEnd }, (_, point) =>
  Array.from({ length: 9 }, (_, field) =>
    field === 0
      ? point / (motionEnd - 1)
      : template.motionValues[field] +
        ((template.motionValues[9 + field] - template.motionValues[field]) *
          point) /
          (motionEnd - 1),
  ),
).flat();
const motionStates = Array.from({ length: motionEnd }, () =>
  template.motionStates.slice(0, 2),
).flat();
const baseline = process.memoryUsage();
let peak = baseline,
  maxChunkBytes = 0;
for (let start = 1; start <= horizon; start += 10) {
  const count = 10 * flyCount;
  const chunk: TransferChunk = {
    schemaVersion: 6,
    attemptId: "memory",
    sequence: (start - 1) / 10,
    startTick: start,
    tickCount: 10,
    flyCount,
    mapHash: layout.retinalConfig.mapHash,
    profileHash: layout.retinalConfig.profile.profileHash,
    sceneId: layout.retinalConfig.sceneId,
    retinaRgb: new Uint8Array(count * eyeWidth),
    values: new Float64Array(count * valueStride),
    states: new Uint32Array(count * 5),
    events: new Uint32Array(count * 8 * 5),
    tickNeuralSteps: new Uint32Array(10).fill(flyCount),
    motionOffsets: new Uint32Array(count + 1),
    motionValues: new Float64Array(count * motionValues.length),
    motionStates: new Uint32Array(count * motionStates.length),
    result:
      start + 9 === horizon
        ? {
            attemptId: "memory",
            completedTick: horizon,
            stars: 0,
            outcomes: {
              escaped: 0,
              starved: 0,
              zapped: 0,
              caught: 0,
              timedOut: flyCount,
              score: 0,
            },
          }
        : null,
  };
  for (let record = 0; record < count; record++) {
    chunk.values.set(pose, record * valueStride);
    chunk.states.set(state, record * 5);
    chunk.motionOffsets[record] = record * motionEnd;
    chunk.motionValues.set(motionValues, record * motionValues.length);
    chunk.motionStates.set(motionStates, record * motionStates.length);
    const tick = start + Math.floor(record / flyCount),
      id = record % flyCount;
    for (let event = 0; event < 8; event++)
      chunk.events.set([tick, id, 1, 0, 0], (record * 8 + event) * 5);
    chunk.retinaRgb.fill(
      (tick * 17 + id * 31) % 256,
      record * eyeWidth,
      (record + 1) * eyeWidth,
    );
  }
  chunk.motionOffsets[count] = count * motionEnd;
  maxChunkBytes = Math.max(
    maxChunkBytes,
    Object.values(chunk).reduce(
      (n, v) => n + (ArrayBuffer.isView(v) ? v.byteLength : 0),
      0,
    ),
  );
  archive.append(chunk);
  assert.equal(chunk.retinaRgb.byteLength, 0);
  const current = process.memoryUsage();
  if (current.rss > peak.rss) peak = current;
}
let checkedBytes = 0;
for (let tick = 1; tick <= horizon; tick++)
  for (let id = 0; id < flyCount; id++) {
    const rgb = archive.retina(tick, id)!.rgb;
    assert.ok(rgb.every((v) => v === (tick * 17 + id * 31) % 256));
    checkedBytes += rgb.length;
  }
assert.equal(checkedBytes, 415296000);
assert.equal(archive.computedTick, horizon);
assert.ok(archive.complete);
assert.ok(archive.ownedBytes + 16384 <= cap);
console.log(
  JSON.stringify(
    {
      fixture:
        "synthetic RGB, native record layout; six motion points and eight events every fly/tick",
      groupCount: layout.groupIds.length,
      motionPointsPerFlyTick: motionEnd,
      eventsPerFlyTick: 8,
      flyCount,
      horizon,
      sampleCount: 721,
      checkedBytes,
      archiveOwnedBytes: archive.ownedBytes,
      archiveCap: cap,
      maxChunkBytes,
      baselineMemory: baseline,
      peakBuildMemory: peak,
      finalMemory: process.memoryUsage(),
      allTicksRetained: true,
      exactAllFlyBytes: true,
    },
    null,
    2,
  ),
);
