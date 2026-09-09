import { AttemptClient } from "../../../packages/sim-client/src/attempt-client";
import { FrameArchive } from "../../../packages/sim-client/src/record";
import type { AttemptInfo, StartAttempt } from "../../../packages/sim-client/src/generated/sim";
import { RetinaProjection, retinaProfile } from "../../../packages/game-renderer/src/retina-projection";
import type { RetinalPose } from "../../../packages/game-renderer/src/retina-capture";
import { campaignLevels } from "../../web/src/campaign-content";

/** The diagnostic drives the same producer as a campaign; its slider only reads history. */
export function mountRetinaAttempt(parent: HTMLElement, inspect: (pose: RetinalPose, info: AttemptInfo) => void) {
  const content = campaignLevels[0];
  if (!content.lighting) throw new Error("The one-fly room needs authored lighting");
  const lighting = content.lighting;
  const projection = new RetinaProjection(retinaProfile);
  const { width, height } = projection.profile;
  const eyeBytes = projection.cells.length * 3;
  const section = document.createElement("section");
  section.className = "retina-attempt";
  section.innerHTML = `<h2>One fly through the circuit</h2>
    <p>Run 24 ticks in the authored room from a fixed walking start. The native body sets its height and orientation. Optical controls above apply only to the separate capture fixture.</p>
    <button data-run>Run one fly</button><button data-export disabled>Export consumed inputs</button>
    <p role="status" data-status>Ready to run · ${width}×${height} RGB · ${projection.cells.length} samples per eye</p>
    <label><span data-tick-label>Recorded tick —</span> <input data-tick type="range" min="1" max="24" value="1" disabled></label>
    <div class="retina-pair">${["Left", "Right"].map(eye => `<figure><figcaption>${eye} recorded eye</figcaption><canvas width="${width}" height="${height}" aria-label="${eye} one-fly recorded input"></canvas></figure>`).join("")}</div>
    <p data-summary>Input pixels and readouts will appear after capture.</p>
    <pre data-state>No neural tick recorded yet.</pre>`;
  parent.append(section);
  const run = section.querySelector<HTMLButtonElement>("[data-run]")!;
  const download = section.querySelector<HTMLButtonElement>("[data-export]")!;
  const slider = section.querySelector<HTMLInputElement>("[data-tick]")!;
  const status = section.querySelector<HTMLElement>("[data-status]")!;
  const state = section.querySelector<HTMLElement>("[data-state]")!;
  let archive: FrameArchive | undefined;
  let info: AttemptInfo | undefined;
  let input: StartAttempt;
  let client: AttemptClient | undefined;
  const show = () => {
    if (!archive) return;
    const tick = Number(slider.value);
    section.querySelector<HTMLElement>("[data-tick-label]")!.textContent = `Recorded tick ${tick} / ${archive.computedTick}`;
    const eye = archive.retina(tick, 0);
    const frame = archive.frame(tick);
    section.querySelectorAll<HTMLCanvasElement>("canvas").forEach((canvas, index) => {
      const context = canvas.getContext("2d")!;
      context.clearRect(0, 0, width, height);
      if (eye) context.putImageData(new ImageData(projection.image(eye.rgb.subarray(index * eyeBytes, (index + 1) * eyeBytes)), width, height), 0, 0);
    });
    if (eye && info) inspect(eye.pose, info);
    state.textContent = JSON.stringify({ tick, inputPose: eye?.pose ?? null, bodyAfterTick: frame.flies[0].body,
      neural: frame.flies[0].neural, note: "Group readouts include input cells; they are not the downstream causal proof." }, null, 2);
    const neural = frame.flies[0].neural;
    section.querySelector<HTMLElement>("[data-summary]")!.textContent = `Tick ${tick} · ${(tick * 0.1).toFixed(1)} s · ${neural?.spikeCount ?? 0} circuit spikes · ${eye?.rgb.length ?? 0} consumed RGB bytes. Group details below include input cells and are descriptive.`;
    section.dataset.tick = String(tick);
  };
  slider.addEventListener("input", show);
  run.addEventListener("click", () => {
    client?.dispose(); archive = undefined; info = undefined;
    run.disabled = true; download.disabled = true; slider.disabled = true;
    section.dataset.state = "running";
    section.querySelectorAll<HTMLCanvasElement>("canvas").forEach(canvas => canvas.getContext("2d")!.clearRect(0, 0, width, height));
    section.querySelector<HTMLElement>("[data-tick-label]")!.textContent = "Recorded tick —";
    section.querySelector<HTMLElement>("[data-summary]")!.textContent = "Waiting for captured inputs and readouts.";
    status.textContent = "Loading the production circuit and authored room…";
    state.textContent = "Waiting for the native pre-neural pose.";
    const spawn = content.level.spawn;
    const position = spawn.kind === "cluster" ? spawn.min : spawn.states[0].pose.position;
    input = { attemptId: "retina-one-fly", rootSeed: "42", flyCount: 1, placements: [], tuning: content.tuning,
      level: { ...content.level, durationTicks: 24, spawn: { kind: "fixed", states: [{ pose: { position, heading: 0 }, mode: "walking" }] } } };
    client = new AttemptClient(reply => {
      if (reply.type === "ready") {
        info = reply.info;
        archive = new FrameArchive(info.spec, info.recordLayout, info.archiveBytes, info.initialBodies);
      } else if (reply.type === "frames") {
        archive!.append(reply.chunk);
        slider.max = String(archive!.computedTick); slider.value = slider.max; show();
      } else if (reply.type === "complete") {
        section.dataset.state = "complete";
        status.textContent = `Recorded ${archive!.computedTick} ticks. Scrub exact consumed RGB and pre-neural poses below.`;
        run.disabled = false; download.disabled = false; slider.disabled = false;
      } else if (reply.type === "error") {
        section.dataset.state = "error"; status.textContent = reply.message; run.disabled = false;
      }
    }, progress => {
      if (progress.phase === "capture") status.textContent = `Tick ${progress.tick}: awaiting color input before the neural step…`;
      else if (progress.phase === "compute") status.textContent = progress.tick === undefined ? "Preparing the next native tick…" : `Tick ${progress.tick}: computing the neural and body step from captured input…`;
    });
    client.start(input, { roomFloors: content.roomFloors ?? [], roomDetails: content.roomDetails ?? [], lighting });
  });
  download.addEventListener("click", () => {
    if (!archive || !info) return;
    const frames = Array.from({ length: archive.computedTick }, (_, index) => archive!.frame(index + 1));
    const blob = new Blob([JSON.stringify({ input, config: info.retinalConfig, frames }, (_, value) => value instanceof Uint8Array ? Array.from(value) : value)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "retina-one-fly.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  });
  window.addEventListener("pagehide", () => client?.dispose(), { once: true });
}
