import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import type { AttemptFrame, PackedChunk, RecordLayout } from "./generated/sim";
import { FrameArchive, type TransferChunk } from "./record";

const exported = Bun.spawnSync(
  ["cargo", "run", "--quiet", "-p", "sim", "--example", "record_fixture"],
  { cwd: fileURLToPath(new URL("../../..", import.meta.url)) },
);
if (exported.exitCode !== 0) throw new Error(exported.stderr.toString());
const fixture = JSON.parse(exported.stdout.toString()) as {
  layout: RecordLayout;
  chunks: PackedChunk[];
  frames: AttemptFrame[];
  archiveByteBound: number;
};
const transfer = (chunk: PackedChunk): TransferChunk => ({
  ...chunk,
  result: structuredClone(chunk.result),
  values: new Float64Array(chunk.values),
  states: new Uint32Array(chunk.states),
  events: new Uint32Array(chunk.events),
  tickNeuralSteps: new Uint32Array(chunk.tickNeuralSteps),
});
const initialBodies = [0, 1].map((id) => ({
  pose: { position: { x: id, z: 0 }, heading: 0 },
  mode: "walking" as const,
  reserve: 10,
  height: 0,
  outcome: null,
}));
const archive = () =>
  new FrameArchive(
    { attemptId: "fixture", flyCount: 2, durationTicks: 4 },
    fixture.layout,
    fixture.archiveByteBound,
    initialBodies,
  );

test("Rust packed records decode exactly across flies, chunks, events and terminal absence", () => {
  const record = archive();
  for (const chunk of fixture.chunks) record.append(transfer(chunk));
  for (const frame of fixture.frames) expect(record.frame(frame.tick)).toEqual(frame);
  expect(record.complete).toBe(true);
  expect(record.result).toEqual(fixture.frames[3].result);
  expect(record.frame(0).flies.map((f) => f.body)).toEqual(initialBodies);
  expect(() => record.frame(5)).toThrow("not been recorded");
  // Consumers receive fresh views of a frame, not mutable cached history.
  record.frame(2).flies[0].body.reserve = -1;
  record.frame(4).result!.stars = 3;
  expect(record.frame(4)).toEqual(fixture.frames[3]);
  expect(record.frame(2)).toEqual(fixture.frames[1]);
});

test("metadata field order determines the consumer offsets", () => {
  const layout = structuredClone(fixture.layout);
  const names = layout.valueFields;
  const a = names.indexOf("reserve"),
    b = names.indexOf("flightTurn");
  [names[a], names[b]] = [names[b], names[a]];
  const record = new FrameArchive(
    { attemptId: "fixture", flyCount: 2, durationTicks: 4 },
    layout,
    fixture.archiveByteBound,
    initialBodies,
  );
  for (const source of fixture.chunks) {
    const chunk = transfer(source);
    const stride = names.length + layout.groupIds.length * layout.groupFields.length;
    for (let i = 0; i < chunk.values.length; i += stride)
      [chunk.values[i + a], chunk.values[i + b]] = [chunk.values[i + b], chunk.values[i + a]];
    record.append(chunk);
  }
  for (const frame of fixture.frames) expect(record.frame(frame.tick)).toEqual(frame);
});

test("stale attempts are ignored and invalid current chunks fail without changing history", () => {
  const record = archive();
  expect(
    record.append({
      ...transfer(fixture.chunks[0]),
      attemptId: "old",
      tickCount: -1,
    }),
  ).toBe(false);
  expect(record.computedTick).toBe(0);
  record.append(transfer(fixture.chunks[0]));
  const before = record.ownedBytes;
  const changes: ((c: TransferChunk) => void)[] = [
    (c) => {
      c.sequence = 0;
    },
    (c) => {
      c.startTick++;
    },
    (c) => {
      c.flyCount++;
    },
    (c) => {
      c.values = c.values.slice(1);
    },
    (c) => {
      c.values[0] = NaN;
    },
    (c) => {
      c.states[fixture.layout.stateFields.indexOf("mode")] = 99;
    },
    (c) => {
      c.events[fixture.layout.eventFields.indexOf("tick")] = 1;
    },
    (c) => {
      c.events[fixture.layout.eventFields.indexOf("kind")] = 99;
    },
    (c) => {
      c.result = { ...c.result!, completedTick: 3 };
    },
  ];
  for (const change of changes) {
    const chunk = transfer(fixture.chunks[1]);
    change(chunk);
    expect(() => record.append(chunk)).toThrow();
    expect(record.ownedBytes).toBe(before);
    expect(record.frame(2)).toEqual(fixture.frames[1]);
  }
  record.append(transfer(fixture.chunks[1]));
  expect(record.frame(4)).toEqual(fixture.frames[3]);
  record.clear();
  expect(record.computedTick).toBe(0);
  expect(record.ownedBytes).toBe(0);
  expect(record.complete).toBe(false);
  expect(() => record.frame(1)).toThrow();
});

test("archive limits count retained backing allocations, and reject unsupported metadata", () => {
  expect(
    () =>
      new FrameArchive(
        { attemptId: "a", flyCount: 20, durationTicks: 6000 },
        fixture.layout,
        128 * 1024 * 1024 + 1,
        initialBodies,
      ),
  ).toThrow("128 MiB");
  const chunk = transfer(fixture.chunks[0]);
  chunk.values = new Float64Array(
    new ArrayBuffer(fixture.archiveByteBound * 2),
    0,
    chunk.values.length,
  );
  const record = archive();
  expect(() => record.append(chunk)).toThrow("capacity");
  expect(record.computedTick).toBe(0);
  expect(
    () =>
      new FrameArchive(
        { attemptId: "fixture", flyCount: 2, durationTicks: 4 },
        { ...fixture.layout, valueFields: [] },
        fixture.archiveByteBound,
        initialBodies,
      ),
  ).toThrow("Missing record field");
  expect(
    () =>
      new FrameArchive(
        { attemptId: "fixture", flyCount: 2, durationTicks: 4 },
        { ...fixture.layout, schemaVersion: 99 },
        fixture.archiveByteBound,
        initialBodies,
      ),
  ).toThrow("Unsupported");
});

test("accepting a chunk takes ownership and snapshots metadata and results", () => {
  const spec = { attemptId: "fixture", flyCount: 2, durationTicks: 4 };
  const layout = structuredClone(fixture.layout);
  const record = new FrameArchive(spec, layout, fixture.archiveByteBound, initialBodies);
  const first = transfer(fixture.chunks[0]);
  record.append(first);
  const bytes = record.ownedBytes;
  spec.flyCount = 99;
  layout.modes.reverse();
  layout.groupIds.reverse();
  first.startTick = 100;
  first.values[0] = 999;
  expect(record.frame(1)).toEqual(fixture.frames[0]);
  expect(first.values.byteLength).toBe(0);
  expect(record.ownedBytes).toBe(bytes);
  const second = transfer(fixture.chunks[1]);
  record.append(second);
  second.result!.stars = 3;
  expect(record.frame(4)).toEqual(fixture.frames[3]);
});

test("missing or malformed results cannot finish the archive", () => {
  for (const badResult of [
    undefined,
    false,
    0,
    {},
    { ...fixture.chunks[1].result, outcomes: null },
  ]) {
    const record = archive();
    record.append(transfer(fixture.chunks[0]));
    const bad = transfer(fixture.chunks[1]);
    Object.assign(bad, { result: badResult });
    expect(() => record.append(bad)).toThrow();
    expect(record.complete).toBe(false);
    expect(record.computedTick).toBe(2);
    expect(bad.values.byteLength).toBeGreaterThan(0);
  }
});

test("motion phase freezes at terminal and reverse seek restores the prior phase", () => {
  const record = archive();
  for (const chunk of fixture.chunks) record.append(transfer(chunk));
  expect(record.motion(2.5)[0]).toEqual({
    mode: "walking",
    startedTick: 0,
    cursorTick: 2.5,
  });
  expect(record.motion(4)[0].cursorTick).toBe(3);
  expect(record.motion(1.25)[0].cursorTick).toBe(1.25);
  expect(record.motion(3.75)[0].cursorTick).toBe(3);
});

test("motion follows packed mode transitions across chunk boundaries and resets on clear", () => {
  const record = archive();
  for (const source of fixture.chunks) {
    const chunk = transfer(source);
    for (let t = 0; t < chunk.tickCount; t++) {
      const tick = chunk.startTick + t;
      const offset = t * 2 * fixture.layout.stateFields.length;
      chunk.states[offset + fixture.layout.stateFields.indexOf("mode")] =
        fixture.layout.modes.indexOf(tick < 3 ? "flying" : "walking");
    }
    record.append(chunk);
  }
  expect(record.motion(2.5)[0]).toEqual({
    mode: "flying",
    startedTick: 1,
    cursorTick: 2.5,
  });
  expect(record.motion(4)[0]).toEqual({
    mode: "walking",
    startedTick: 3,
    cursorTick: 3,
  });
  expect(record.motion(1)[0].startedTick).toBe(1);
  expect(record.motion(4)[0].cursorTick).toBe(3);
  record.clear();
  expect(record.motion(0)[0]).toEqual({
    mode: "walking",
    startedTick: 0,
    cursorTick: 0,
  });
});

test("bounded neural traces match recorded frames across seek and terminal gaps", () => {
  const record = archive();
  for (const chunk of fixture.chunks) record.append(transfer(chunk));
  const groupId = fixture.layout.groupIds[0];
  for (const flyId of [0, 1]) {
    const expected = fixture.frames.map((frame) => {
      const group = frame.flies[flyId].neural?.groups.find((group) => group.id === groupId);
      return {
        tick: frame.tick,
        meanVoltage: group?.meanVoltage ?? null,
        spikeFraction: group?.spikeFraction ?? null,
      };
    });
    expect(record.neuralTrace(flyId, groupId, 4)).toEqual(expected);
    expect(record.neuralTrace(flyId, groupId, 2)).toEqual(expected.slice(0, 2));
    expect(record.neuralTrace(flyId, groupId, 4, 2)).toEqual(expected.slice(2));
    expect(record.neuralTrace(flyId, groupId, 0)).toEqual([]);
    expect(record.neuralTrace(flyId, groupId, 4)).toEqual(expected);
  }
  expect(() => record.neuralTrace(0, groupId, 5)).toThrow();
  expect(() => record.neuralTrace(0, groupId, 4, 101)).toThrow();
  expect(() => record.neuralTrace(2, groupId, 4)).toThrow();
});

test("pose-only windows preserve recorded positions and terminal states across chunks and seeks", () => {
  const record = archive();
  for (const chunk of fixture.chunks) record.append(transfer(chunk));
  const expected = (end: number, count: number) =>
    Array.from({ length: 2 }, (_, id) =>
      fixture.frames
        .filter((f) => f.tick <= end && f.tick > end - count)
        .map((f) => ({
          tick: f.tick,
          x: f.flies[id].body.pose.position.x,
          z: f.flies[id].body.pose.position.z,
          height: f.flies[id].body.height,
          inputX: f.flies[id].inputPose.position.x,
          inputZ: f.flies[id].inputPose.position.z,
          mode: f.flies[id].body.mode,
          terminal: f.flies[id].body.outcome !== null,
        })),
    );
  const values = (end: number, count = 40) =>
    record.poseHistory(end, count);
  expect(values(4, 3)).toEqual(expected(4, 3));
  expect(values(2, 2)).toEqual(expected(2, 2));
  expect(values(4, 1)).toEqual(expected(4, 1));
  expect(record.poseHistory(0)).toEqual([[], []]);
  expect(() => record.poseHistory(5)).toThrow("not been recorded");
  expect(() => record.poseHistory(4, 41)).toThrow("40 ticks");
  record.poseHistory(4)[0][0].x = 999;
  expect(values(4)).toEqual(expected(4, 40));
});

test("tick zero and rewind preserve immutable core initial poses and mixed modes", () => {
  const bodies = structuredClone(initialBodies) as import("./generated/sim").BodyState[];
  bodies[1].mode = "flying";
  bodies[1].height = 0.6;
  bodies[1].pose.heading = 2.4;
  const record = new FrameArchive(
    { attemptId: "fixture", flyCount: 2, durationTicks: 4 },
    fixture.layout,
    fixture.archiveByteBound,
    bodies,
  );
  const zero = record.frame(0);
  expect(zero.flies.map((f) => f.body)).toEqual(bodies);
  expect(record.motion(0).map((m) => m.mode)).toEqual(["walking", "flying"]);
  bodies[1].mode = "walking";
  for (const chunk of fixture.chunks) record.append(transfer(chunk));
  record.motion(4);
  expect(record.motion(0).map((m) => m.mode)).toEqual(["walking", "flying"]);
  expect(record.frame(0)).toEqual(zero);
  zero.flies[1].body.pose.heading = 99;
  expect(record.frame(0).flies[1].body.pose.heading).toBe(2.4);
});
