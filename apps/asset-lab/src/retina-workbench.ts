import * as THREE from "three";
import { RetinaProjection, retinaProfile, type RetinaProfile } from "../../../packages/game-renderer/src/retina-projection";
import type { RetinalPose } from "../../../packages/game-renderer/src/retina-capture";
import { WorldView } from "@fly-escape/game-renderer";
import { campaignLevels } from "../../web/src/campaign-content";
import { loadWorldAssets } from "../../web/src/world-assets";
import type { CaptureCommand, CaptureReady, CaptureReply, CaptureResult } from "./retina-worker";
import contactFixture from "../../../assets/proportions/contact-fixture.json";
import { loadRetinaRigView } from "./retina-rig-view";
import "./retina.css";
import { mountRetinaAttempt } from "./retina-attempt";

export async function retinaWorkbench() {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.innerHTML = `<header><div><p>Fly escape · optical workbench</p><h1>Inside the eyes</h1></div><a href="/">Model workbench</a></header>
    <main class="retina-workbench"><div class="retina-world" aria-label="Room context"></div><aside>
      <h2>Left and right eye samples</h2><p>Color samples from a separate, fixed scene. This checkpoint does not drive a brain.</p>
      <div class="retina-pair"><figure><figcaption>Left eye</figcaption><canvas data-eye="left" aria-label="Left eye color samples"></canvas></figure><figure><figcaption>Right eye</figcaption><canvas data-eye="right" aria-label="Right eye color samples"></canvas></figure></div>
      <label>Pose <select id="retina-pose"><option value="landmarks">Landmarks</option><option value="ground">Ground</option><option value="tilted">Tilted support</option><option value="flight">Flight</option></select></label>
      <label><input id="retina-rig" type="checkbox"> Inspect native eye mounts (L cyan · R pink; first 1 mm of frusta)</label>
      <label>Heading <input id="retina-heading" type="range" min="-180" max="180" value="0" step="5"></label>
      <label>Height <input id="retina-height" type="range" min="0" max="2" value="0.45" step="0.01"></label>
      <label>Raster <select id="retina-size"><option>16</option><option selected>32</option><option>64</option><option>128</option><option>256</option></select></label>
      <label>Compound samples <select id="retina-radius"><option value="3">37</option><option value="4" selected>61</option><option value="5">91</option><option value="6">127</option><option value="8">217</option><option value="12">469</option><option value="15">721</option></select></label>
      <button id="retina-capture">Capture eyes</button><button id="retina-benchmark">Measure sixteen flies</button>
      <p role="status" id="retina-status">Loading authored room…</p><pre id="retina-report" data-testid="retina-report"></pre>
    </aside></main>`;
  const content = campaignLevels[0];
  const view = new WorldView(app.querySelector<HTMLDivElement>(".retina-world")!, content.level.geometry, 1, content.roomFloors, content.lighting);
  await loadWorldAssets(view, () => true, content.roomDetails);
  view.setPose({ x: 1, y: 0.45, z: 2.5, heading: 0 });
  view.selectFly(0);
  view.overview();
  view.enableSelection(id => view.selectFly(id));
  const rigView = await loadRetinaRigView();
  rigView.visible = false;
  view.setInspectionModel(rigView);
  let live = true;
  const render = () => { if (live) { view.render(0); requestAnimationFrame(render); } };
  render();
  let worker: Worker | undefined;
  let requestTimer: ReturnType<typeof setTimeout>;
  const status = app.querySelector<HTMLParagraphElement>("#retina-status")!;
  const report = app.querySelector<HTMLPreElement>("#retina-report")!;
  let projection = new RetinaProjection(retinaProfile);
  let resolve: ((value: CaptureReply) => void) | undefined;
  let reject: ((error: Error) => void) | undefined;
  let profile = { ...retinaProfile };
  let sceneId = "";
  let fixture: CaptureReady;
  const fail = (error: Error) => {
    clearTimeout(requestTimer);
    const no = reject; resolve = undefined; reject = undefined;
    worker?.terminate(); worker = undefined;
    app.dataset.retinaReady = "false";
    no?.(error);
  };
  const request = (command: CaptureCommand) => new Promise<CaptureReply>((yes, no) => {
    if (resolve) { no(new Error("An optical operation is already pending")); return; }
    if (!worker) {
      const current = new Worker(new URL("./retina-worker.ts", import.meta.url), { type: "module" });
      worker = current;
      current.onmessage = event => {
        if (worker !== current) return;
        const reply = event.data as CaptureReply;
        if (reply.type === "error") { fail(new Error(reply.message)); return; }
        clearTimeout(requestTimer);
        const done = resolve; resolve = undefined; reject = undefined;
        done?.(reply);
      };
      current.onerror = event => { if (worker === current) fail(new Error(event.message)); };
    }
    resolve = yes; reject = no;
    requestTimer = setTimeout(() => fail(new Error("Optical worker timed out; capture again to restart.")), command.type === "start" ? 30000 : 5000);
    worker.postMessage(command);
  });
  const supportedPose = contactFixture.cases[4].supported;
  const pose = (): RetinalPose => {
    if (app.querySelector<HTMLSelectElement>("#retina-pose")!.value === "tilted")
      return { position: [supportedPose.root[0] + 2, supportedPose.root[1], supportedPose.root[2] + 7.5], rotation: supportedPose.rotation as [number, number, number, number] };
    const heading = Number(app.querySelector<HTMLInputElement>("#retina-heading")!.value) * Math.PI / 180;
    const height = Number(app.querySelector<HTMLInputElement>("#retina-height")!.value);
    const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2 - heading);
    return { position: [1, height, 2.5], rotation: rotation.toArray() };
  };
  const inspect = (current: RetinalPose, reframe = false) => {
    rigView.visible = app.querySelector<HTMLInputElement>("#retina-rig")!.checked;
    rigView.position.fromArray(current.position); rigView.quaternion.fromArray(current.rotation);
    rigView.updateMatrixWorld(true);
    view.setPose({ x: current.position[0], y: current.position[1], z: current.position[2], rotation: current.rotation,
      heading: Number(app.querySelector<HTMLInputElement>("#retina-heading")!.value) * Math.PI / 180, hidden: rigView.visible });
    if (reframe) {
      if (rigView.visible) view.inspectModel(new THREE.Box3().setFromObject(rigView), .03, "mounting");
      else view.overview();
    }
  };
  const start = async (next: RetinaProfile) => {
    const nextProjection = new RetinaProjection(next);
    const support = app.querySelector<HTMLSelectElement>("#retina-pose")!.value === "tilted";
    const ready = await request({ type: "start", profile: next, placements: support
      ? [...content.level.fixedObjects, { id: 902, kind: "fruit", position: { x: 2, z: 7.5 }, heading: 0 }]
      : undefined }) as CaptureReady;
    fixture = ready;
    view.setPlacements([], ready.catalog, undefined, ready.placements);
    profile = next;
    sceneId = ready.sceneId;
    projection = nextProjection;
    report.textContent = JSON.stringify(ready, null, 2);
    app.dataset.retinaGpu = String(ready.gpu);
    for (const [selector, field] of [["#retina-size", "width"], ["#retina-radius", "radius"]] as const) {
      const select = app.querySelector<HTMLSelectElement>(selector)!;
      select.value = String(profile[field]);
      for (const option of select.options) {
        const value = Number(option.value);
        try {
          new RetinaProjection(field === "width" ? { ...profile, width: value, height: value } : { ...profile, radius: value });
          option.disabled = false;
        } catch { option.disabled = true; }
      }
    }
  };
  mountRetinaAttempt(app.querySelector("aside")!, (current, info, catalog) => {
    view.setPlacements(info.resolvedSetup.state.placements, catalog, undefined, info.resolvedSetup.fixedPlacements);
    inspect(current);
  });
  let captureCount = 0;
  const capture = async (flies = 1) => {
    app.dataset.retinaReady = "false";
    if (!worker) await start(profile);
    const current = pose();
    const result = await request({ type: "capture", poses: Array.from({ length: flies }, () => current) }) as CaptureResult;
    const samples = result.samples;
    const bytes = projection.cells.length * 3;
    for (let eye = 0; eye < 2; eye++) {
      const canvas = app.querySelectorAll<HTMLCanvasElement>("[data-eye]")[eye];
      canvas.width = profile.width; canvas.height = profile.height;
      canvas.getContext("2d")!.putImageData(new ImageData(projection.image(samples.subarray(eye * bytes, (eye + 1) * bytes)), profile.width, profile.height), 0, 0);
    }
    view.setPlacements([], fixture.catalog, undefined, fixture.placements);
    inspect(current, rigView.visible);
    report.textContent = JSON.stringify({ profile, sceneId, pose: current, gpu: app.dataset.retinaGpu, ...result, samples: Array.from(samples) }, null, 2);
    app.dataset.retinaReady = "true";
    app.dataset.retinaCaptureCount = String(++captureCount);
    return { ...result, samples: Array.from(samples) };
  };
  const act = async (operation: () => Promise<unknown>) => {
    app.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>("input, select, button").forEach(control => { if (!control.closest(".retina-attempt")) control.disabled = true; });
    status.textContent = "Acquiring optical samples…";
    try { await operation(); status.textContent = "Showing the acquired color samples."; }
    catch (error) {
      app.dataset.retinaReady = "false";
      status.textContent = String(error);
      report.textContent = "";
      app.querySelectorAll<HTMLCanvasElement>("[data-eye]").forEach(canvas => canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height));
    }
    finally { app.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>("input, select, button").forEach(control => { if (!control.closest(".retina-attempt")) control.disabled = false; }); }
  };
  const configure = async () => {
    const size = Number(app.querySelector<HTMLSelectElement>("#retina-size")!.value);
    await start({ ...profile, width: size, height: size, radius: Number(app.querySelector<HTMLSelectElement>("#retina-radius")!.value) });
    await capture();
  };
  app.querySelector("#retina-capture")!.addEventListener("click", () => void act(() => capture()));
  app.querySelectorAll("#retina-heading, #retina-height").forEach(input => input.addEventListener("change", () => { app.querySelector<HTMLSelectElement>("#retina-pose")!.value = "landmarks"; void act(configure); }));
  app.querySelectorAll("#retina-size, #retina-radius").forEach(select => select.addEventListener("change", () => void act(configure)));
  app.querySelector("#retina-rig")!.addEventListener("change", () => inspect(pose(), true));
  app.querySelector("#retina-pose")!.addEventListener("change", () => {
    const preset = app.querySelector<HTMLSelectElement>("#retina-pose")!.value;
    app.querySelector<HTMLInputElement>("#retina-height")!.value = preset === "ground" ? "0" : preset === "flight" ? "1.1" : preset === "tilted" ? String(supportedPose.root[1]) : "0.45";
    void act(configure);
  });
  app.querySelector("#retina-benchmark")!.addEventListener("click", () => void act(async () => {
    const runs = [];
    for (let i = 0; i < 50; i++) runs.push((await capture(16)).metrics);
    report.textContent = JSON.stringify({ profile, gpu: app.dataset.retinaGpu, runs }, null, 2);
  }));
  window.addEventListener("pagehide", () => { live = false; clearTimeout(requestTimer); worker?.terminate(); view.dispose(); }, { once: true });
  await act(async () => { await start(profile); await capture(); });
}
