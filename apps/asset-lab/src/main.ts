import { WorldView, loadFlyModel, type FlyAnimation } from "@fly-escape/game-renderer";
import modelUrl from "../../../assets/fly/fly.glb?url";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<header><div><p>Fly escape · model workbench</p><h1>Meet the fly</h1></div><label>Replace model <input type="file" accept=".glb" aria-label="Replace fly model"></label></header>
<main><div class="world" aria-label="Fly model preview"></div><aside><h2>Inspect the model</h2><p>Use the wheel to zoom. Drag to pan. Choose a view to return to the fly.</p><nav><button data-view="overview">Overview</button><button data-view="follow">Follow</button><button data-view="close">Extra close</button></nav><p class="status" role="status">Loading fly…</p><p id="resources"></p><h3>Model contract</h3><p>GLB, +Y up and +Z forward. Ground contact at the origin; one unit equals one game world unit. Inspect the head and feet to verify orientation and scale.</p><p>Up to 20,000 triangles, 3 materials and 1024-pixel textures.</p><h3>Animation</h3><label>Clip <select id="clip"><option>Static</option><option>Walk</option><option>Fly</option><option>Land</option><option>Feed</option></select></label><label>Clip time (seconds) <input id="time" type="range" min="0" max="2" step="0.025" value="0"></label><output id="phase">0.000 s</output><button id="play">Play animation</button><button id="heading">Turn 90°</button></aside></main>`;
const world = app.querySelector<HTMLDivElement>(".world")!;
const status = app.querySelector<HTMLParagraphElement>(".status")!;
const view = new WorldView(world, {
  rooms: [{ id: 1, min: { x: -3, z: -3 }, max: { x: 3, z: 3 } }],
  walls: [],
});
view.enableSelection((id) => view.selectFly(id));
let heading = 0;
let seconds = 0;
let playing = false;
const clipControl = app.querySelector<HTMLSelectElement>("#clip")!;
const timeControl = app.querySelector<HTMLInputElement>("#time")!;
const playControl = app.querySelector<HTMLButtonElement>("#play")!;
function pose() {
  const clip = clipControl.value;
  view.setPose({
    x: 0,
    y: clip === "Fly" ? 0.6 : 0,
    z: 0,
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
  raf = requestAnimationFrame(draw);
}
raf = requestAnimationFrame(draw);
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  ++generation;
  cancelAnimationFrame(raf);
  view.dispose();
});
