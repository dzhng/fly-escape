import * as THREE from "three";
import { loadStaticHouseModel, type WorldView } from "@fly-escape/game-renderer";
import windowUrl from "../../../assets/house/window/window.glb?url";
import sconceUrl from "../../../assets/house/sconce/sconce.glb?url";
import plantUrl from "../../../assets/house/plant/plant.glb?url";
import proportions from "../../../assets/proportions/scale.json";

const windowSize = proportions.visualOnly.window;
// Explicit review envelopes; these do not register core furnishings or placement rules.
const inspectionShapes = {
  window: { url: windowUrl, size: [windowSize.width, windowSize.height, windowSize.depth], position: [0.9, 1.05, 0.10] },
  sconce: { url: sconceUrl, size: [0.22, 0.32, 0.16], position: [2.5, 1.35, 0.14] },
  plant: { url: plantUrl, size: [0.3, 1.05, 0.3], position: [2.4, 0, 0.9] },
} satisfies Record<string, { url: string; size: number[]; position: number[] }>;
type Shape = keyof typeof inspectionShapes;

/** Replacement UI within the existing room workbench; WorldView owns installed resources. */
export function houseInspection(view: WorldView, aside: HTMLElement) {
  const panel = document.createElement("section");
  panel.innerHTML = `<h2>Prepared household shapes</h2><p>Appearance inspection only. Window and sconce backs meet the diagnostic wall; plant rests on clear floor. No opening, light or contact is added.</p><label>Shape <select id="shape">${Object.keys(inspectionShapes).map(key => `<option>${key}</option>`).join("")}</select></label><nav><button id="inspect-shape">Inspect shape</button><button id="shape-detail">Shape detail</button><button id="shape-mounting" hidden>Mounting view</button></nav><label>Replace selected shape <input id="shape-file" type="file" accept=".glb"></label><p id="shape-status" role="status">Loading prepared shapes…</p><p id="shape-measures"></p>`;
  aside.prepend(panel);
  const root = new THREE.Group();
  view.setInspectionModel(root);
  const models = new Map<Shape, Awaited<ReturnType<typeof loadStaticHouseModel>>>();
  const generations = { window: 0, sconce: 0, plant: 0 };
  let alive = true;
  const control = panel.querySelector<HTMLSelectElement>("#shape")!;
  const status = panel.querySelector<HTMLElement>("#shape-status")!;
  const selected = () => control.value as Shape;
  const report = () => {
    const rows = [...models].map(([key, model]) => ({ key, nativeBounds: [...model.bounds.min, ...model.bounds.max], worldBounds: (() => { const box = new THREE.Box3().setFromObject(model.root); return [...box.min, ...box.max]; })(), scale: model.root.scale.toArray(), forward: new THREE.Vector3(0, 0, 1).transformDirection(model.root.matrixWorld).toArray(), triangles: model.triangles }));
    panel.dataset.models = JSON.stringify(rows);
    panel.dataset.ready = String(models.size === Object.keys(inspectionShapes).length);
    panel.querySelector<HTMLButtonElement>("#shape-mounting")!.hidden = selected() !== "sconce";
    const shape = inspectionShapes[selected()];
    panel.querySelector("#shape-measures")!.textContent = `Native ${shape.size.join(" × ")} m · +Y up, +Z front · bottom-centred local origin. ${selected() === "plant" ? "Planter base rests on floor." : "Wall fixtures mount above floor."} Replacement must preserve these bounds.`;
  };
  async function replace(key: Shape, source: Promise<ArrayBuffer>) {
    const ticket = ++generations[key];
    status.textContent = `Loading ${key}…`;
    try {
      const bytes = await source;
      if (!alive || ticket !== generations[key]) return false;
      const [x, y, z] = inspectionShapes[key].size;
      const model = await loadStaticHouseModel(bytes, { name: key, bounds: [-x / 2, 0, -z / 2, x / 2, y, z / 2] });
      if (!alive || ticket !== generations[key]) { model.dispose(); return false; }
      const previous = models.get(key);
      if (previous) { root.remove(previous.root); previous.dispose(); }
      const [px, py, pz] = inspectionShapes[key].position;
      model.root.position.set(px, py, pz);
      root.add(model.root);
      models.set(key, model);
      root.updateMatrixWorld(true);
      report();
      status.textContent = `${key} loaded · native size preserved · source file unchanged`;
      panel.dataset.revision = String(Number(panel.dataset.revision ?? 0) + 1);
      return true;
    } catch (error) {
      if (alive && ticket === generations[key]) status.textContent = `Could not replace ${key}. ${models.has(key) ? "Previous shape retained." : "Shape unavailable."} ${error instanceof Error ? error.message : error}`;
      return false;
    }
  }
  const inspect = (detail: boolean, mounting = false) => {
    const model = models.get(selected());
    if (!model) return;
    const bounds = new THREE.Box3().setFromObject(model.root);
    view.inspectModel(bounds, Math.max(...inspectionShapes[selected()].size) * (detail ? 1.8 : 2.7), mounting ? "mounting" : "rts");
  };
  control.onchange = () => { report(); inspect(false); };
  panel.querySelector<HTMLButtonElement>("#inspect-shape")!.onclick = () => inspect(false);
  panel.querySelector<HTMLButtonElement>("#shape-detail")!.onclick = () => inspect(true);
  panel.querySelector<HTMLButtonElement>("#shape-mounting")!.onclick = () => inspect(false, true);
  panel.querySelector<HTMLInputElement>("#shape-file")!.onchange = event => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ""; // Re-exporting the same filename must remain replaceable.
    if (file) void replace(selected(), file.arrayBuffer());
  };
  panel.dataset.ready = "false";
  void Promise.all((Object.keys(inspectionShapes) as Shape[]).map(key => replace(key, fetch(inspectionShapes[key].url).then(response => {
    if (!response.ok) throw new Error(`Shape request failed (${response.status})`);
    return response.arrayBuffer();
  })))).then(() => {
    if (!alive) return;
    const missing = (Object.keys(inspectionShapes) as Shape[]).filter(key => !models.has(key));
    status.textContent = missing.length ? `Shapes unavailable: ${missing.join(", ")}. Replace with valid files or reload.` : "Prepared shapes loaded · appearance only";
  });
  return () => { alive = false; };
}
