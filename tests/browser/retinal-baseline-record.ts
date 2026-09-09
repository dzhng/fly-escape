import type { AttemptInfo, RecordLayout } from "../../packages/sim-client/src/generated/sim";
/** Streaming inspection of the pinned packed record; retains only next-tick poses. */
export const MAX_TICKS = 6000;
export const FLIES = 16;
export type Tape = { ticks: number; poses: Float64Array<ArrayBuffer>; active: Uint16Array<ArrayBuffer> };
export type Packed = Record<string, unknown> & { startTick: number; tickCount: number; flyCount: number; sequence: number; values: Float64Array<ArrayBuffer>; states: Uint32Array<ArrayBuffer> };
export const bufferNames = ["values", "states", "events", "motionOffsets", "motionValues", "motionStates", "tickNeuralSteps"] as const;
export const sha256 = async (bytes: BufferSource) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join("");
export async function packedHashes(chunk: Packed) {
  const header = Object.fromEntries(Object.entries(chunk).filter(([, value]) => !ArrayBuffer.isView(value)));
  const hashes: Record<string, string> = { header: await sha256(new TextEncoder().encode(JSON.stringify(header))) };
  for (const name of [...bufferNames, ...(chunk.retinaRgb ? ["retinaRgb"] : [])]) {
    const array = chunk[name] as Uint8Array<ArrayBuffer>;
    if (!ArrayBuffer.isView(array)) throw Error(`Missing packed ${name}`);
    hashes[name] = await sha256(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
  }
  return hashes;
}
export function poseTape(info: Pick<AttemptInfo, "initialBodies"> & { spec: Pick<AttemptInfo["spec"], "durationTicks" | "flyCount"> }): Tape {
  const ticks = info.spec.durationTicks;
  if (!Number.isInteger(ticks) || ticks < 1 || ticks > MAX_TICKS || info.spec.flyCount !== FLIES || info.initialBodies.length !== FLIES)
    throw Error("Pose tape requires 16 flies and 1–6000 ticks");
  const tape = { ticks, poses: new Float64Array(ticks * FLIES * 7), active: new Uint16Array(ticks) };
  for (const [id, body] of info.initialBodies.entries()) {
    if (body.outcome === null) tape.active[0] |= 1 << id;
    tape.poses.set([body.pose.position.x, body.height, body.pose.position.z, ...body.rotation], id * 7);
  }
  return tape;
}
export function appendPoses(tape: Tape, layout: Pick<RecordLayout, "valueFields" | "stateFields" | "groupIds" | "groupFields" | "outcomes" | "maxChunkTicks">, chunk: Packed) {
  const values = Object.fromEntries(layout.valueFields.map((name: string, i: number) => [name, i]));
  const states = Object.fromEntries(layout.stateFields.map((name: string, i: number) => [name, i]));
  const fields = ["x", "height", "z", "rotationX", "rotationY", "rotationZ", "rotationW"];
  if (fields.some(name => !Number.isInteger(values[name])) || !Number.isInteger(states.outcome)) throw Error("Missing pose layout");
  const stride = layout.valueFields.length + layout.groupIds.length * layout.groupFields.length;
  if (chunk.flyCount !== FLIES || chunk.tickCount < 1 || chunk.tickCount > layout.maxChunkTicks ||
      chunk.startTick < 1 || chunk.startTick + chunk.tickCount - 1 > tape.ticks ||
      chunk.values.length !== chunk.tickCount * FLIES * stride || chunk.states.length !== chunk.tickCount * FLIES * layout.stateFields.length)
    throw Error("Packed pose dimensions exceed the tape");
  for (let t = 0; t < chunk.tickCount; t++) {
    const outputTick = chunk.startTick + t;
    for (let id = 0; id < FLIES; id++) {
      const row = t * FLIES + id;
      const pose = fields.map(name => chunk.values[row * stride + values[name]]);
      if (!pose.every(Number.isFinite)) throw Error("Nonfinite baseline pose");
      // Output tick N becomes the pre-neural pose of N+1; the final output needs no tape slot.
      if (outputTick < tape.ticks) {
        tape.poses.set(pose, (outputTick * FLIES + id) * 7);
        if (layout.outcomes[chunk.states[row * layout.stateFields.length + states.outcome]] === null)
          tape.active[outputTick] |= 1 << id;
      }
    }
  }
}
