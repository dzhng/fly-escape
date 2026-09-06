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
  values: new Float64Array(chunk.values),
  states: new Uint32Array(chunk.states),
  events: new Uint32Array(chunk.events),
  tickNeuralSteps: new Uint32Array(chunk.tickNeuralSteps),
});
const archive = () =>
  new FrameArchive(
    { attemptId: "fixture", flyCount: 2, durationTicks: 4 },
    fixture.layout,
    fixture.archiveByteBound,
  );

test("Rust packed records decode exactly across flies, chunks, events and terminal absence", () => {
  const record = archive();
  for (const chunk of fixture.chunks) record.append(transfer(chunk));
  for (const frame of fixture.frames)
    expect(record.frame(frame.tick)).toEqual(frame);
  expect(record.complete).toBe(true);
  expect(record.result).toEqual(fixture.frames[3].result);
  expect(() => record.frame(0)).toThrow("not been recorded");
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
  );
  for (const source of fixture.chunks) {
    const chunk = transfer(source);
    const stride =
      names.length + layout.groupIds.length * layout.groupFields.length;
    for (let i = 0; i < chunk.values.length; i += stride)
      [chunk.values[i + a], chunk.values[i + b]] = [
        chunk.values[i + b],
        chunk.values[i + a],
      ];
    record.append(chunk);
  }
  for (const frame of fixture.frames)
    expect(record.frame(frame.tick)).toEqual(frame);
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
        record.spec,
        { ...fixture.layout, valueFields: [] },
        fixture.archiveByteBound,
      ),
  ).toThrow("Missing record field");
  expect(
    () =>
      new FrameArchive(
        record.spec,
        { ...fixture.layout, schemaVersion: 99 },
        fixture.archiveByteBound,
      ),
  ).toThrow("Unsupported");
});
