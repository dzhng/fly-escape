import initWasm, { resolve_setup, tool_catalog } from "../../packages/sim-client/src/wasm/game_wasm";
import { campaignLevels } from "../../apps/web/src/campaign-content";
import type { AttemptInfo, AttemptResult, ToolDef, ResolvedSetup } from "../../packages/sim-client/src/generated/sim";
import type { AttemptReply } from "../../packages/sim-client/src/attempt-protocol";
import type { RetinaWorldDefinition } from "../../packages/game-renderer/src/retina-world";
import type { captureControlReport } from "./retinal-baseline-control";
import { FLIES, MAX_TICKS, appendPoses, packedHashes, poseTape, sha256, type Tape, type Packed } from "./retinal-baseline-record";

type Mode = "baseline" | "captureOnly" | "final";
type Factories = Record<Mode, () => Worker>;
type CaptureReport = ReturnType<typeof captureControlReport>;
type RunReport = { mode: Mode; inputHash: string; spec: AttemptInfo["spec"]; producerMs: number; neuralSteps: number;
  actualTicks: number; producerMsPerNeuralStep: number; loadMs: number; observerMs: number; wallMs: number;
  wasmBytes: number; totalChunkBytes: number; chunks: Record<string,string>[]; result: AttemptResult;
  initialBodiesHash: string; recordLayout: AttemptInfo["recordLayout"]; tapeHash?: {poses:string;active:string}; tapeBytes?:number; captureControl?: CaptureReport };
type RunResult = {info:AttemptInfo;tape?:Tape;report:RunReport};
const require = (ok: unknown, message: string) => { if (!ok) throw Error(message); };
export async function runBaselineComparison(factories: Factories, levelIndex: number, ticks: number) {
  require((levelIndex === 0 || levelIndex === 1) && Number.isInteger(ticks) && ticks >= 1 && ticks <= MAX_TICKS, "Invalid campaign/horizon");
  const content = campaignLevels[levelIndex];
  const input = { attemptId: "retinal-baseline-control", rootSeed: "42", flyCount: FLIES,
    level: { ...content.level, durationTicks: ticks }, tuning: content.tuning, placements: [] };
  if (!content.roomDetails || !content.roomFloors || !content.lighting) throw Error("Campaign optical authoring is incomplete");
  const authoring = { roomDetails: content.roomDetails, roomFloors: content.roomFloors, lighting: content.lighting };
  const inputHash = await sha256(new TextEncoder().encode(JSON.stringify(input)));
  const definitionBegan = performance.now();
  await initWasm();
  const resolved = JSON.parse(resolve_setup(JSON.stringify(input.level), JSON.stringify(input.placements))) as ResolvedSetup;
  const definition: RetinaWorldDefinition = { ...authoring, geometry: input.level.geometry,
    placements: [...resolved.fixedPlacements, ...resolved.state.placements], catalog: JSON.parse(tool_catalog()) as ToolDef[] };
  const opticalDefinitionPreparationMs = performance.now() - definitionBegan;
  async function run(mode: Mode, control?: { tape: Tape; definition: RetinaWorldDefinition }) {
    const began = performance.now(), worker = factories[mode]();
    let info: AttemptInfo, tape: Tape | undefined, captureControl: CaptureReport | undefined;
    let producerMs = 0, observerMs = 0, wasmBytes = 0, neuralSteps = 0, actualTicks = 0, totalChunkBytes = 0, loadMs = 0;
    const chunks: Record<string, string>[] = [];
    let queued = Promise.resolve();
    return new Promise<RunResult>((resolve, reject) => {
      const deadline = setTimeout(() => fail(Error(`${mode} exceeded the 15-minute deadline`)), 900000);
      function fail(error: unknown) { clearTimeout(deadline); worker.terminate(); reject(error); }
      const start = () => worker.postMessage({ type: "start", generation: 1, input, ...(mode === "final" ? { opticalWorld: authoring } : {}) });
      const credit = () => worker.postMessage({ type: "grantCredits", generation: 1, attemptId: input.attemptId, count: 1 });
      worker.onerror = event => fail(Error(event.message));
      worker.onmessage = ({ data }) => {
        if (data.type === "progress") return;
        queued = queued.then(async () => {
          if (data.type === "fatal" || data.type === "baselineCaptureError") throw Error(data.message);
          if (data.type === "setup") {
            if (data.error) throw Error(data.error);
            if (control) worker.postMessage({ type: "baselineCaptureConfig", ...control }, [control.tape.poses.buffer, control.tape.active.buffer]);
            else start();
            return;
          }
          if (data.type === "baselineCaptureReady") { start(); return; }
          if (data.type === "baselineCaptureDone") { captureControl = data.report; return; }
          const reply = data.reply as AttemptReply;
          require(data.generation === 1 && reply?.attemptId === input.attemptId, "Unexpected worker identity");
          if (reply.type === "error") throw Error(reply.message);
          if (reply.type === "ready") {
            info = reply.info;
            loadMs = reply.loadMs;
            wasmBytes = reply.wasmBytes;
            if (mode === "baseline") tape = poseTape(info);
            credit();
          } else if (reply.type === "frames") {
            const observed = performance.now(), chunk = reply.chunk as Packed;
            require(chunk.sequence === chunks.length && chunk.startTick === actualTicks + 1, "Packed sequence skipped or repeated");
            require(chunk.tickCount >= 1 && chunk.tickCount <= info.recordLayout.maxChunkTicks && chunk.flyCount === FLIES, "Packed dimensions changed");
            actualTicks += chunk.tickCount;
            require(actualTicks <= ticks, "Producer exceeded the horizon");
            chunks.push(await packedHashes(chunk));
            for (const value of Object.values(chunk)) if (ArrayBuffer.isView(value)) totalChunkBytes += value.byteLength;
            if (tape) appendPoses(tape, info.recordLayout, chunk);
            producerMs += reply.metrics.productionMs;
            neuralSteps += reply.metrics.activeNeuralSteps;
            wasmBytes = Math.max(wasmBytes, reply.metrics.wasmBytes);
            observerMs += performance.now() - observed;
            if (chunks.length % 50 === 0 || chunk.result) console.log("retinal-baseline-progress", JSON.stringify({ levelIndex, mode, tick: actualTicks, producerMs, neuralSteps }));
            if (!chunk.result) credit();
          } else if (reply.type === "complete") {
            require(chunks.length > 0 && actualTicks === reply.result.completedTick, "Completion differs from retained chunk timing");
            clearTimeout(deadline); worker.terminate();
            const tapeHash = tape ? { poses: await sha256(tape.poses), active: await sha256(tape.active) } : undefined;
            resolve({ info, tape, report: { mode, inputHash, spec: info.spec, producerMs, neuralSteps, actualTicks,
              producerMsPerNeuralStep: producerMs / neuralSteps, loadMs, observerMs, wallMs: performance.now() - began,
              wasmBytes, totalChunkBytes, chunks, result: reply.result, tapeHash,
              tapeBytes: tape ? tape.poses.byteLength + tape.active.byteLength : undefined,
              recordLayout: info.recordLayout,
              initialBodiesHash: await sha256(new TextEncoder().encode(JSON.stringify(info.initialBodies))), captureControl } });
          }
        }).catch(fail);
      };
      worker.postMessage({ type: "setup", requestId: 1, command: { type: "catalog" } });
    });
  }
  const baseline = await run("baseline");
  const capture = await run("captureOnly", { tape: baseline.tape!, definition });
  require(JSON.stringify(capture.info.spec) === JSON.stringify(baseline.info.spec) && JSON.stringify(capture.info.recordLayout) === JSON.stringify(baseline.info.recordLayout), "Capture-only changed experiment or record identity");
  require(capture.report.chunks.length === baseline.report.chunks.length, "Capture-only changed chunk count");
  for (let i = 0; i < baseline.report.chunks.length; i++)
    for (const [name, hash] of Object.entries(baseline.report.chunks[i]))
      require(capture.report.chunks[i][name] === hash, `Capture-only changed packed ${name} in chunk ${i}`);
  require(JSON.stringify(capture.report.result) === JSON.stringify(baseline.report.result), "Capture-only changed outcomes");
  require(capture.report.initialBodiesHash === baseline.report.initialBodiesHash && capture.report.neuralSteps === baseline.report.neuralSteps, "Capture-only changed initial state or neural work");
  require(capture.report.captureControl!.tick === baseline.report.actualTicks && capture.report.captureControl!.activeFlyTicks === baseline.report.neuralSteps, "Capture work differs from baseline active bodies");
  const final = await run("final");
  for (const key of ["levelHash", "tuningHash", "graphHash"] as const)
    require(baseline.info.spec[key] === final.info.spec[key], `Final ${key} differs from baseline inputs`);
  require(final.info.recordLayout.retinalConfig?.sceneId === capture.report.captureControl!.sceneId, "Capture-only scene differs from final physical scene");
  return { levelIndex, input, inputHash, opticalDefinitionPreparationMs, requestedTicks: ticks, baseline: baseline.report, captureOnly: capture.report, final: final.report,
    exactCaptureControl: true, captureOnlyAddedProducerMs: capture.report.producerMs - baseline.report.producerMs,
    finalAddedProducerMs: final.report.producerMs - baseline.report.producerMs };
}
