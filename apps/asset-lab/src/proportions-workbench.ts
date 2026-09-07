import { houseInspection } from "./house-inspection";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { WorldView, loadFlyModel, flyAnimation, loadHouseAssets, disposeObjectResources } from "@fly-escape/game-renderer";
import { AttemptClient, FrameArchive, type AttemptInfo, type Geometry } from "@fly-escape/sim-client";
import spec from "../../../assets/proportions/scale.json";
import flyUrl from "../../../assets/fly/fly.glb?url";
import floorUrl from "../../../assets/proportions/neutral-floor.glb?url";

/** Scale diagnostic using native furnishings with a neutral room composite. */
export async function proportionsWorkbench() {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.innerHTML = `<header><div><p>Diagnostic · proportions only</p><h1>A fly in a human room</h1></div><a href="?">Fly workbench</a></header><main><div class="world"></div><aside><h2>1 world unit = 1 metre</h2><p>Neutral geometry; house materials and composition are unfinished. Furniture envelopes are core solids. Fruit and window are visual-only: feeding/contact is unvalidated.</p><label>Recorded subject <select id="subject">${Array.from({ length: 20 }, (_, i) => `<option value="${i}"${i === 5 ? " selected" : ""}>Fly ${i + 1}${i === 5 ? " · clear floor" : i === 0 ? " · beside apple" : ""}</option>`).join("")}</select></label><nav><button data-view="context">Context</button><button data-view="follow">Follow</button><button data-view="close">Extra close</button><button data-view="overview">Overview</button></nav><p role="status" id="proportion-status">Loading physical-size fly and recording 20 real neural bodies…</p><label>Recorded tick <input id="recorded-tick" type="range" min="0" max="40" value="0" step="1"></label><p id="scale-sheet"></p><p id="camera-measures"></p><p>Room 4 × 4 × 2.6 m; doorway 0.9 × 2.1 m; cabinet 1.2 × 0.45 × 0.85 m; seat envelope 1.9 × 0.85 × 0.85 m; pot envelope 0.3 × 0.3 × 0.4 m. Proxy apple Ø80 mm; proxy banana 180 mm.</p><p><strong>Physical dimensions:</strong> native 3 mm model and measured collision/sensory dimensions. Food surface contact remains unvalidated. Fields are planar; the measurements expose their horizontal sample positions.</p></aside></main>`;
  const world = app.querySelector<HTMLElement>(".world")!;
  const view = new WorldView(world, spec.geometry as Geometry, 20);
  let alive = true;
  let stopInspection = () => {};
  let client: AttemptClient | undefined;
  addEventListener("pagehide", () => { alive = false; stopInspection(); client?.dispose(); view.dispose(); }, { once: true });
  await loadHouseAssets(view, () => alive, ["cabinet", "sofa"]);
  if (!alive) return;
  let selected = 5;
  view.enableSelection(id => { selected = id; app.querySelector<HTMLSelectElement>("#subject")!.value = String(id); view.selectFly(id); });
  // This one-room composition uses the existing scene owner, without relaxing any GLB kit bounds.
  const { scene: floor } = await new GLTFLoader().parseAsync(await (await fetch(floorUrl)).arrayBuffer(), "");
  if (!alive) { disposeObjectResources(floor); return; }
  // The prepared inspection model owns window appearance; the composite supplies floor/food context.
  const windowProxies: THREE.Object3D[] = [];
  floor.traverse(object => { if (object.name.startsWith("Window")) windowProxies.push(object); });
  for (const proxy of windowProxies) { proxy.removeFromParent(); }
  // The original composite shares its neutral material; only removed geometry is retired here.
  for (const proxy of windowProxies) if (proxy instanceof THREE.Mesh) proxy.geometry.dispose();
  view.setHousePart("floor", floor);
  stopInspection = houseInspection(view, app.querySelector("aside")!);
  const wall = new THREE.Group();
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1, spec.wallHeight, 0.12), new THREE.MeshStandardMaterial());
  panel.position.y = spec.wallHeight / 2; panel.castShadow = panel.receiveShadow = true; wall.add(panel);
  view.setHousePart("wall", wall);
  const native = await loadFlyModel(await (await fetch(flyUrl)).arrayBuffer());
  if (!alive) { native.dispose(); return; }
  native.root.updateMatrixWorld(true);
  const body = new THREE.Box3();
  native.root.traverse(object => { if (/^(Head|Thorax|Abdomen)/.test(object.name)) body.union(new THREE.Box3().setFromObject(object)); });
  const nativeBodyLength = body.getSize(new THREE.Vector3()).z;
  if (!(nativeBodyLength > 0)) throw new Error("Fly body landmarks are missing");
  if (Math.abs(nativeBodyLength - spec.flyBodyLength) > 1e-8) throw new Error("Native fly dimensions do not match the metre contract");
  const model = native;
  const modelSize = model.bounds.getSize(new THREE.Vector3());
  const anatomy = { antennaTips: [] as number[][], conservativeFootprintRadius: 0 };
  model.root.traverse(object => {
    if (/^AntennaTip/.test(object.name)) anatomy.antennaTips.push(new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()).toArray());
  });
  for (const x of [model.bounds.min.x, model.bounds.max.x]) for (const z of [model.bounds.min.z, model.bounds.max.z])
    anatomy.conservativeFootprintRadius = Math.max(anatomy.conservativeFootprintRadius, Math.hypot(x, z));
  view.setFlyModel(model);
  let info: AttemptInfo | undefined, archive: FrameArchive | undefined;
  let tick = 0;
  const initial = Array.from({ length: 20 }, (_, i) => ({ position: { x: spec.inspectFly.x + (i % 5) * 0.17, z: spec.inspectFly.z + Math.floor(i / 5) * 0.17 }, heading: i * 0.71 }));
  function pose() {
    const frame = archive?.frame(tick);
    const motion = archive?.motion(tick);
    view.setPoses(initial.map((start, i) => {
      const body = frame?.flies[i].body;
      const p = body?.pose ?? start;
      return { x: p.position.x, z: p.position.z, heading: p.heading, y: body?.height ?? 0, rotation: body?.rotation, animation: motion ? flyAnimation(motion[i], 0.1) : undefined };
    }));
  }
  pose();
  function context() {
    view.selectFly(selected);
    world.querySelector("canvas")!.dispatchEvent(new WheelEvent("wheel", { deltaY: Math.log(1.2 / view.cameraState.distance) / 0.0015, cancelable: true }));
  }
  context();
  app.querySelector<HTMLSelectElement>("#subject")!.onchange = event => { selected = Number((event.target as HTMLSelectElement).value); context(); };
  app.querySelectorAll<HTMLButtonElement>("[data-view]").forEach(button => button.onclick = () => {
    if (button.dataset.view === "overview") view.overview();
    else { view.selectFly(selected); if (button.dataset.view === "close") view.zoomClose(); if (button.dataset.view === "context") context(); }
  });
  app.querySelector<HTMLInputElement>("#recorded-tick")!.oninput = event => {
    tick = Math.min(Number((event.target as HTMLInputElement).value), archive?.computedTick ?? 0); pose();
  };
  client = new AttemptClient(reply => {
    if (reply.type === "ready") { info = reply.info; archive = new FrameArchive(info.spec, info.recordLayout, info.archiveBytes, info.initialBodies); pose(); }
    else if (reply.type === "frames") archive!.append(reply.chunk);
    else if (reply.type === "error") { app.querySelector("#proportion-status")!.textContent = reply.message; app.dataset.error = reply.message; }
    else if (reply.type === "complete") { app.dataset.ready = "true"; app.querySelector("#proportion-status")!.textContent = "40 recorded ticks · 20 real-connectome flies · fixed diagnostic start · no path rescaling"; }
  });
  const fixture = await client.setup({ type: "fixture" });
  if (!alive) return;
  const level = structuredClone(fixture.level);
  Object.assign(level, { id: "neutral-proportions-diagnostic", geometry: spec.geometry, spawn: { kind: "fixed", states: initial.map(pose => ({ pose, mode: "walking" })) }, durationTicks: 40, sources: [], food: [], zappers: [], exitCue: null, exit: { a: spec.geometry.walls[3].b, b: spec.geometry.walls[4].a, outward: { x: 1, z: 0 } } });
  client.start({ attemptId: "proportions-19", rootSeed: "1901", flyCount: 20, level, tuning: fixture.tuning, placements: [] });
  app.querySelector("#scale-sheet")!.textContent = `Native authored body ${(nativeBodyLength * 1000).toFixed(1)} mm. Full fly bounds ${(modelSize.x * 1000).toFixed(2)} × ${(modelSize.y * 1000).toFixed(2)} × ${(modelSize.z * 1000).toFixed(2)} mm. Apple/body diameter ratio ${(0.08 / spec.flyBodyLength).toFixed(1)}:1.`;
  function draw() {
    if (!alive) return;
    view.render();
    const renderedAntennae: number[][] = [];
    if (tick === 0) model.root.traverse(object => {
      if (/^AntennaTip/.test(object.name)) renderedAntennae.push(new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()).toArray());
    });
    const camera = view.cameraState;
    app.querySelector("#camera-measures")!.textContent = `Display ${camera.displayScale.toFixed(1)}× · camera distance ${(camera.distance * 1000).toFixed(1)} mm · near ${(camera.near * 1000).toFixed(3)} mm · selected centre ${camera.flies[selected].visible ? "in frustum" : "outside frustum"}`;
    app.dataset.measurements = JSON.stringify({ tick, camera, nativeBodyLength, modelScale: 1, modelBounds: modelSize.toArray(), modelMin: model.bounds.min.toArray(), modelMax: model.bounds.max.toArray(), anatomy, coreAntennaOffset: level.fieldConfig.antennaOffset, coreAntennaForward: level.fieldConfig.antennaForward, initialSensoryPoints: info?.initialSensoryPoints, renderedAntennae, coreFieldSpacing: level.fieldConfig.cellSize, bodyLength: spec.flyBodyLength, worldUnitMetres: 1, statistics: view.statistics, exterior: view.exteriorStats, spec: info?.spec, coreBodyRadius: level.bodyConfig.bodyRadius, recordedFrame: tick && archive ? archive.frame(tick) : null });
    requestAnimationFrame(draw);
  }
  draw();
}
