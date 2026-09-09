import { expect, test } from "bun:test";
import { FrameArchive, type TransferChunk } from "./record";
import type { PackedChunk, RecordLayout, AttemptFrame } from "./generated/sim";
const produced = Bun.spawnSync(
  [
    "cargo",
    "run",
    "-q",
    "-p",
    "sim",
    "--example",
    "record_fixture",
    "--",
    "--retinal",
  ],
  { cwd: new URL("../../..", import.meta.url).pathname },
);
if (produced.exitCode !== 0) throw Error(produced.stderr.toString());
const fixture = JSON.parse(produced.stdout.toString()) as {
  layout: RecordLayout;
  chunks: PackedChunk[];
  frames: AttemptFrame[];
  archiveByteBound: number;
};
const transfer = (chunk: PackedChunk): TransferChunk => ({
  ...chunk,
  retinaRgb: new Uint8Array(chunk.retinaRgb),
  values: new Float64Array(chunk.values),
  states: new Uint32Array(chunk.states),
  events: new Uint32Array(chunk.events),
  tickNeuralSteps: new Uint32Array(chunk.tickNeuralSteps),
  motionOffsets: new Uint32Array(chunk.motionOffsets),
  motionValues: new Float64Array(chunk.motionValues),
  motionStates: new Uint32Array(chunk.motionStates),
});
const create = () =>
  new FrameArchive(
    { attemptId: "fixture", flyCount: 2, durationTicks: 4 },
    fixture.layout,
    fixture.archiveByteBound,
    [0, 1].map((id) => ({
      pose: { position: { x: id, z: 0 }, heading: 0 },
      mode: "walking",
      reserve: 10,
      height: 0,
      support: null,
      rotation: [0, 0, 0, 1],
      outcome: null,
    })),
  );
test("native RGB slots survive chunk boundaries, arbitrary selection and seek without aliasing", () => {
  const archive = create();
  for (const chunk of fixture.chunks) archive.append(transfer(chunk));
  for (const tick of [3, 1, 4, 2, 3, 2, 1]) {
    const expected = fixture.frames[tick - 1].retina!;
    expect(archive.frame(tick).retina).toEqual({
      ...expected,
      rgb: new Uint8Array(expected.rgb),
    });
    for (const fly of [1, 0, 1]) {
      const sample = archive.retina(tick, fly);
      const index = expected.request.poses.findIndex((p) => p.flyId === fly);
      if (index < 0) expect(sample).toBeNull();
      else {
        expect(sample!.pose).toEqual(expected.request.poses[index]);
        expect(sample!.rgb).toEqual(
          new Uint8Array(expected.rgb.slice(index * 42, (index + 1) * 42)),
        );
        sample!.rgb.fill(255);
      }
    }
  }
  expect(archive.retina(1, 0)!.rgb.every((v) => v === 0)).toBe(true);
  expect(archive.retina(3, 0)).not.toBeNull();
  expect(archive.retina(4, 0)).toBeNull();
});

test("bad retinal identities, lengths, presence and input transforms cannot poison prior history", () => {
  const archive = create();
  archive.append(transfer(fixture.chunks[0]));
  const before = archive.ownedBytes;
  const mutations: ((chunk: TransferChunk) => void)[] = [
    (chunk) => {
      chunk.profileHash = "e".repeat(64);
    },
    (chunk) => {
      chunk.sceneId = "other-scene";
    },
    (chunk) => {
      chunk.retinaRgb = chunk.retinaRgb.slice(1);
    },
    (chunk) => {
      chunk.states[2] &= ~4;
    },
    (chunk) => {
      chunk.retinaRgb[2 * 42] = 1;
    },
    (chunk) => {
      chunk.values[fixture.layout.valueFields.indexOf("inputHeight")] += 1;
    },
  ];
  for (const change of mutations) {
    const chunk = transfer(fixture.chunks[1]);
    change(chunk);
    expect(() => archive.append(chunk)).toThrow();
    expect(chunk.values.byteLength).toBeGreaterThan(0);
    expect(archive.ownedBytes).toBe(before);
    expect(archive.computedTick).toBe(2);
  }
  archive.append(transfer(fixture.chunks[1]));
  expect(archive.complete).toBe(true);
});
