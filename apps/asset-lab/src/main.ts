import { foodWorkbench } from "./food-workbench";
import { WorldView, loadFlyModel, loadHousePart, type HousePart, type FlyAnimation } from "@fly-escape/game-renderer";
import modelUrl from "../../../assets/fly/fly.glb?url";
import "./style.css";
import { HouseProbeClient } from "@fly-escape/sim-client";
import solidUrl from "../../../assets/house/solid.glb?url";
import houseGeometry from "../../../assets/house/five-rooms.json";
import wallUrl from "../../../assets/house/wall.glb?url";
import floorUrl from "../../../assets/house/floor.glb?url";
import { doorwayProbes } from "./house-probes";
const house = new URLSearchParams(location.search).get("fixture") === "house";
const doorways = doorwayProbes(houseGeometry);

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<header><div><p>Fly escape · model workbench</p><h1>Meet the fly</h1></div><label>Replace model <input type="file" accept=".glb" aria-label="Replace fly model"></label></header>
<main><div class="world" aria-label="Fly model preview"></div><aside><h2>Inspect the model</h2><p>Use the wheel to zoom. Drag to pan. Choose a view to return to the fly.</p><nav><button data-view="overview">Overview</button><button data-view="follow">Follow</button><button data-view="close">Extra close</button></nav><p class="status" role="status">Loading fly…</p><p id="resources"></p><h3>Animation</h3><label>Clip <select id="clip"><option>Static</option><option>Walk</option><option>Fly</option><option>Land</option><option>Feed</option></select></label><label>Clip time (seconds) <input id="time" type="range" min="0" max="2" step="0.025" value="0"></label><output id="phase">0.000 s</output><button id="play">Play animation</button><button id="heading">Turn 90°</button><h3>Model contract</h3><p>GLB, +Y up and +Z forward. Ground contact at the origin; one unit equals one game world unit. Inspect the head and feet to verify orientation and scale.</p><p>Up to 20,000 triangles, 3 materials and 1024-pixel textures.</p></aside></main>`;
const world = app.querySelector<HTMLDivElement>(".world")!;
const status = app.querySelector<HTMLParagraphElement>(".status")!;
const view = new WorldView(world, house ? houseGeometry : {
  rooms: [{ id: 1, min: { x: -3, z: -3 }, max: { x: 3, z: 3 } }],
  walls: [],
  solids: [],
});
view.enableSelection((id) => view.selectFly(id));
app.querySelector("aside")!.insertAdjacentHTML("afterbegin", `<p><a href="${house ? "?" : "?fixture=house"}">${house ? "Fly workbench" : "Five-room house"}</a></p>`);
if (house) {
  app.querySelector("h1")!.textContent = "Five-room house";
  app.querySelector("aside")!.insertAdjacentHTML("afterbegin", `<h2>Geometry inspection</h2><p>Rooms 1–4 form the hall; room 5 is the one-door pantry. Paths below are diagnostic poses, not neural locomotion.</p><label>Room <select id="room">${houseGeometry.rooms.map(r => `<option value="${r.id}">Room ${r.id}${r.id === 5 ? " · pantry" : ""}</option>`).join("")}</select></label><button id="inspect-room">Inspect room</button><button id="cutaway">Follow at wall</button><label>Doorway <select id="doorway">${doorways.map((d, i) => `<option value="${i}">${d.label}</option>`).join("")}</select></label><label>Cross doorway <input id="crossing" type="range" min="-1" max="1" step="0.01" value="0"></label><label>Replace house part <select id="part"><option value="wall">Wall</option><option value="floor">Floor</option><option value="solid">Solid</option></select><input id="house-file" type="file" accept=".glb" aria-label="Replace house part"></label><p id="house-status" role="status">Loading modular kit…</p><p>Replacement must preserve the kit bounds and pivot. Walls: 1 × 0.6 × 0.12; floor: 1 × 0.25 × 1, top at Y=0. Solid: 1 × 1 × 1, base at Y=0. All solid footprints block every body mode.</p><h3>Solid collision probe</h3><p>Diagnostic core sweep, not neural motion.</p><label>Path <select id="solid-path"><option value="blocked">Through solid</option><option value="detour">Beside solid</option></select></label><label>Approach <input id="solid-progress" type="range" min="0" max="1" step="0.01" value="0"></label><button id="probe-solid">Inspect solid</button><p id="solid-status" role="status">Choose Inspect solid to run the core query.</p>`);
}
if (!house) void foodWorkbench(view, app.querySelector<HTMLElement>("aside")!);
const firstRoom = houseGeometry.rooms[0];
let position = house ? { x: (firstRoom.min.x + firstRoom.max.x) / 2, z: (firstRoom.min.z + firstRoom.max.z) / 2 } : { x: 0, z: 0 };
let heading = 0;
let seconds = 0;
let playing = false;
const clipControl = app.querySelector<HTMLSelectElement>("#clip")!;
const timeControl = app.querySelector<HTMLInputElement>("#time")!;
const playControl = app.querySelector<HTMLButtonElement>("#play")!;
const probeClient = house ? new HouseProbeClient(reply => {
  const label = app.querySelector<HTMLElement>("#solid-status")!;
  if ("error" in reply) { label.textContent = reply.error; return; }
  const probe = reply.probe;
  position = probe.stopped;
  heading = 0;
  clipControl.value = "Static";
  pose(); view.selectFly(0);
  label.textContent = `${probe.stopped.x < probe.requested.x - 1e-6 ? "Stopped before solid" : "Path clear"} · sight ${probe.lineOfSight ? "clear" : "blocked"} · body radius ${probe.radius}`;
  app.dataset.solidProbe = JSON.stringify(probe);
}) : undefined;
function pose() {
  const clip = clipControl.value;
  view.setPose({
    x: position.x,
    y: clip === "Fly" ? (house ? 0.15 : 0.6) : 0,
    z: position.z,
    heading,
    animation: clip === "Static" ? undefined : { clip: clip as FlyAnimation["clip"], seconds },
  });
  app.querySelector<HTMLOutputElement>("#phase")!.value = `${seconds.toFixed(3)} s`;
  app.dataset.motion = JSON.stringify({ clip, seconds, playing });
}
clipControl.addEventListener("change", () => {
  seconds = 0;
  timeControl.value = "0";
  pose();
});
timeControl.addEventListener("input", () => {
  seconds = Number(timeControl.value);
  pose();
});
playControl.addEventListener("click", () => {
  playing = !playing;
  playControl.textContent = playing ? "Pause animation" : "Play animation";
});
view.setPose({ x: 0, y: 0, z: 0, heading });
let generation = 0;
const houseGenerations = { wall: 0, floor: 0, solid: 0 };
async function replace(source: Promise<ArrayBuffer>) {
  const ticket = ++generation;
  status.textContent = "Loading fly…";
  try {
    const bytes = await source;
    if (ticket !== generation) return;
    const model = await loadFlyModel(bytes);
    if (ticket !== generation) {
      model.dispose();
      return;
    }
    view.setFlyModel(model);
    view.selectFly(0);
    pose();
    view.render();
    const stats = view.statistics;
    app.querySelector<HTMLParagraphElement>("#resources")!.textContent =
      `${stats.geometries} GPU geometries · ${stats.textures} textures`;
    app.dataset.resources = JSON.stringify(stats);
    status.textContent = `Model loaded · ${model.triangles.toLocaleString()} triangles · ${model.materialCount} materials · ${model.clips.length} animation clips`;
  } catch (error) {
    if (ticket === generation)
      status.textContent = `Could not load model. ${app.dataset.resources ? "The previous fly is still displayed." : "Choose a valid GLB to continue."} ${error instanceof Error ? error.message : String(error)}`;
  }
}
app.querySelector<HTMLInputElement>("input")!.addEventListener("change", async (event) => {
  const file = (event.currentTarget as HTMLInputElement).files?.[0];
  if (file) await replace(file.arrayBuffer());
});
app.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.view === "overview") view.overview();
    else {
      view.selectFly(0);
      if (button.dataset.view === "close") view.zoomClose();
    }
  });
});
app.querySelector<HTMLButtonElement>("#heading")!.addEventListener("click", () => {
  heading += Math.PI / 2;
  pose();
});
void replace(
  fetch(modelUrl).then((response) => {
    if (!response.ok) throw new Error(`Model request failed (${response.status})`);
    return response.arrayBuffer();
  }),
);
if (house) {
  async function replacePart(part: HousePart, bytes: Promise<ArrayBuffer>) {
    const ticket = ++houseGenerations[part];
    const label = app.querySelector<HTMLElement>("#house-status")!;
    try {
      const model = await loadHousePart(await bytes, part);
      if (ticket !== houseGenerations[part]) { model.dispose(); return false; }
      view.setHousePart(part, model.root);
      view.render();
      label.textContent = `${part} loaded · source files unchanged`;
      return true;
    } catch (error) { if (ticket === houseGenerations[part]) label.textContent = `Previous part retained. ${error instanceof Error ? error.message : error}`; return false; }
  }
  app.dataset.houseReady = "false";
  const parts: [HousePart, string][] = [["wall", wallUrl], ["floor", floorUrl], ["solid", solidUrl]];
  void Promise.all(parts.map(([part, url]) => replacePart(part, fetch(url).then(response => {
    if (!response.ok) throw new Error(`House ${part} request failed (${response.status})`);
    return response.arrayBuffer();
  })))).then(loaded => {
    app.dataset.houseReady = String(loaded.every(Boolean));
    if (!loaded.every(Boolean)) app.querySelector<HTMLElement>("#house-status")!.textContent = "House kit failed to load. Reload to retry.";
  });
  app.querySelector<HTMLInputElement>("#house-file")!.addEventListener("change", event => {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (file) void replacePart(app.querySelector<HTMLSelectElement>("#part")!.value as HousePart, file.arrayBuffer());
  });
  app.querySelector<HTMLButtonElement>("#inspect-room")!.addEventListener("click", () => {
    probeClient?.cancel();
    const room = houseGeometry.rooms.find(r => r.id === Number(app.querySelector<HTMLSelectElement>("#room")!.value))!;
    position = { x: (room.min.x + room.max.x) / 2, z: (room.min.z + room.max.z) / 2 };
    clipControl.value = "Static"; pose(); view.selectFly(0);
  });
  app.querySelector("#cutaway")!.addEventListener("click", () => {
    probeClient?.cancel();
    const room = houseGeometry.rooms.find(r => r.id === Number(app.querySelector<HTMLSelectElement>("#room")!.value))!;
    position = { x: room.max.x - 0.15, z: room.max.z - 0.15 };
    clipControl.value = "Static"; pose(); view.selectFly(0);
  });
  const cross = () => {
    probeClient?.cancel();
    const door = doorways[Number(app.querySelector<HTMLSelectElement>("#doorway")!.value)];
    const t = Number(app.querySelector<HTMLInputElement>("#crossing")!.value);
    position = { x: door.x + door.dx * t, z: door.z + door.dz * t };
    heading = Math.atan2(door.dz, door.dx);
    clipControl.value = "Fly"; pose(); view.selectFly(0);
    app.dataset.crossing = JSON.stringify({ ...position, t, door: door.label });
  };
  const querySolid = () => probeClient!.request(Number(app.querySelector<HTMLInputElement>("#solid-progress")!.value), app.querySelector<HTMLSelectElement>("#solid-path")!.value === "detour");
  app.querySelector("#solid-progress")!.addEventListener("input", querySolid);
  app.querySelector("#solid-path")!.addEventListener("change", querySolid);
  app.querySelector("#probe-solid")!.addEventListener("click", querySolid);
  app.querySelector("#crossing")!.addEventListener("input", cross);
  app.querySelector("#doorway")!.addEventListener("change", cross);
}
let raf = 0;
let lastTime: number | undefined;
function draw(now: number) {
  if (playing && lastTime !== undefined && !document.hidden) {
    seconds = (seconds + Math.min(0.1, (now - lastTime) / 1000)) % 2;
    timeControl.value = String(seconds);
  }
  lastTime = now;
  pose();
  view.render();
  if (house) {
    app.dataset.houseResources = JSON.stringify(view.statistics);
    app.dataset.houseVisibility = JSON.stringify(view.houseVisibility);
    app.dataset.houseCamera = JSON.stringify(view.cameraState);
  }
  raf = requestAnimationFrame(draw);
}
raf = requestAnimationFrame(draw);
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  ++generation;
  ++houseGenerations.wall;
  ++houseGenerations.floor;
  ++houseGenerations.solid;
  cancelAnimationFrame(raf);
  probeClient?.dispose();
  view.dispose();
});
