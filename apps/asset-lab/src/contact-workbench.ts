import * as THREE from 'three';
import { WorldView, loadFlyModel } from '@fly-escape/game-renderer';
import data from '../../../assets/proportions/contact-fixture.json';
import flyUrl from '../../../assets/fly/fly.glb?url';

/** Fixed core query output isolates model attachment from neural motion and food behavior. */
export async function contactWorkbench() {
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = `<header><div><p>Diagnostic · surface attachment</p><h1>A fly on a curved surface</h1></div><a href="?">Fly workbench</a></header><main><div class="world"></div><aside><h2>Native contact pose</h2><p>Fixed Rust contact queries, not a game attempt. The mesh and contact points come from the same geometry. This checks attachment only; food behavior and final fruit art remain separate.</p><label>Surface position <select id="sample">${data.cases.map((_, i) => `<option value="${i}"${i === 4 ? ' selected' : ''}>Sample ${i + 1}</option>`).join('')}</select></label><label>Attachment <select id="attachment"><option value="supported">Surface aligned</option><option value="upright">Upright comparison</option></select></label><label>Animation <select id="clip"><option>Static</option><option>Walk</option><option>Feed</option><option>Land</option></select></label><label>Clip time <input id="time" type="range" min="0" max="2" step="0.025" value="0"></label><nav><button data-view="follow">Follow</button><button data-view="close">Extra close</button><button data-view="overview">Overview</button></nav><p id="contact-state"></p></aside></main>`;
  const world = app.querySelector<HTMLElement>('.world')!;
  const view = new WorldView(world, {
    rooms: [{ id: 1, min: { x: -0.5, z: -0.5 }, max: { x: 0.5, z: 0.5 } }],
    walls: [],
    solids: [],
  });
  const scene = new THREE.Group();
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.01, 1),
    new THREE.MeshStandardMaterial({ color: 0xccccbb }),
  );
  floor.position.y = -0.005;
  scene.add(floor);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(data.surface.vertices.flat(), 3),
  );
  geometry.setIndex(data.surface.triangles.flat());
  geometry.computeVertexNormals();
  const fruit = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.7 }),
  );
  fruit.castShadow = fruit.receiveShadow = true;
  scene.add(fruit);
  view.setHousePart('floor', scene);
  const model = await loadFlyModel(await (await fetch(flyUrl)).arrayBuffer());
  view.setFlyModel(model);
  view.enableSelection(id => view.selectFly(id));
  const control = (id: string) =>
    app.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
  function pose() {
    const sample = data.cases[Number(control('sample').value)];
    const [x, y, z] = sample.support.point;
    const clip = control('clip').value;
    view.setPoses([
      {
        x,
        y,
        z,
        heading: Math.PI / 2,
        rotation:
          control('attachment').value === 'supported'
            ? [sample.rotation[0], sample.rotation[1], sample.rotation[2], sample.rotation[3]]
            : undefined,
        animation:
          clip === 'Static'
            ? undefined
            : { clip: clip as 'Walk' | 'Feed' | 'Land', seconds: Number(control('time').value) },
      },
    ]);
  }
  for (const id of ['sample', 'attachment', 'clip', 'time'])
    control(id).addEventListener('input', pose);
  for (const button of app.querySelectorAll<HTMLButtonElement>('[data-view]'))
    button.onclick = () => {
      if (button.dataset.view === 'overview') view.overview();
      else {
        view.selectFly(0);
        if (button.dataset.view === 'close') view.zoomClose();
      }
    };
  pose();
  view.selectFly(0);
  view.zoomClose();
  let alive = true;
  const draw = () => {
    if (!alive) return;
    view.render();
    const camera = view.cameraState;
    app.dataset.report = JSON.stringify({
      camera,
      position: model.root.position.toArray(),
      rotation: model.root.quaternion.toArray(),
      sample: Number(control('sample').value),
      attachment: control('attachment').value,
    });
    app.querySelector('#contact-state')!.textContent =
      `Native model · display ${camera.displayScale.toFixed(1)}× · fixed contact sample`;
    app.dataset.ready = 'true';
    requestAnimationFrame(draw);
  };
  draw();
  addEventListener(
    'pagehide',
    () => {
      alive = false;
      view.dispose();
    },
    { once: true },
  );
}
