import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { equalPixels } from './equal-pixels.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '');
const output = process.env.SURFACE_EVIDENCE ?? '/tmp/fly-surface-clearance';
const dishes = JSON.parse(await readFile(new URL('../../assets/proportions/dishes-contact-fixture.json', import.meta.url), 'utf8'));
const apple = JSON.parse(await readFile(new URL('../../assets/proportions/contact-fixture.json', import.meta.url), 'utf8'));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/surface-fixture.html', route => route.fulfill({ contentType: 'text/html',
    body: '<body style="margin:0"><div id="world" style="width:100vw;height:100vh"></div></body>' }));
  await page.goto((process.env.BRAIN_URL ?? 'http://127.0.0.1:5173') + '/surface-fixture.html');
  await page.evaluate(async root => {
    const THREE = await import(`/@fs${root}/node_modules/three/build/three.module.js`);
    const { WorldView, loadFlyModel, loadHouseAssets } = await import(`/@fs${root}/packages/game-renderer/src/index.ts`);
    const { loadPlacementAssets } = await import('/src/placement-assets.ts');
    const content = (await import('/src/levels/open-window.ts')).default;
    const view = new WorldView(document.querySelector('#world'), content.level.geometry, 16);
    await Promise.all([loadHouseAssets(view, () => true), loadPlacementAssets(view, () => true)]);
    const model = await loadFlyModel(await (await fetch(`/@fs${root}/assets/fly/fly.glb`)).arrayBuffer());
    view.setFlyModel(model);
    view.setContactGeometry([], [], content.level.exit, false);
    const surfaces = {
      dirtyDishes: (await import(`/@fs${root}/assets/household/dirty-dishes/contact.json`)).default,
      fruit: (await import(`/@fs${root}/assets/food/apple/contact.json`)).default,
    };
    window.fixture = { view, model, THREE, surfaces, offset: [2, 7.5] };
  }, root);

  const scenarios = [
    ...[4.5, 3, 0.9].map(distance => ({ name: `dishes-landing-${distance}`, kind: 'dirtyDishes', pose: dishes.cases[0], distance, clip: 'Land', mode: 'landing' })),
    { name: 'dishes-inner-rim', kind: 'dirtyDishes', pose: dishes.cases[1], distance: 0.9, clip: 'Walk', mode: 'walking' },
    { name: 'dishes-outer-rim', kind: 'dirtyDishes', pose: dishes.cases[4], distance: 0.9, clip: 'Walk', mode: 'walking' },
    { name: 'bowl-landing-side', kind: 'dirtyDishes', pose: dishes.bowlUpright[0], distance: 1.5, clip: 'Land', mode: 'landing' },
    { name: 'bowl-landing-close', kind: 'dirtyDishes', pose: dishes.bowlUpright[1], distance: 0.6, clip: 'Land', mode: 'landing' },
    { name: 'apple-slope', kind: 'fruit', pose: apple.cases[4].supported, distance: 0.55, clip: 'Walk', mode: 'walking' },
  ];
  const rows = [];
  async function draw(scenario, clear) {
    return page.evaluate(({ scenario, clear }) => {
      const { view, model, THREE, surfaces, offset } = window.fixture;
      const surface = surfaces[scenario.kind];
      const vertices = surface.vertices.map(([x, y, z]) => [x + offset[0], y, z + offset[1]]);
      view.setSupportSurfaces([{ ...surface, vertices }]);
      view.setPlacements([{ id: 1, kind: scenario.kind, position: { x: offset[0], z: offset[1] }, heading: 0 }],
        [{ kind: scenario.kind, contact: scenario.kind === 'fruit' ? 'apple' : scenario.kind, footprintRadius: 0.14 }]);
      const [x, y, z] = scenario.pose.root;
      view.setPoses(Array.from({ length: 16 }, (_, id) => ({ x: x + offset[0], y, z: z + offset[1], heading: 0, rotation: scenario.pose.rotation,
        hidden: id > 0, bodyMode: clear ? scenario.mode : undefined, animation: { clip: scenario.clip, seconds: 0.15 } })));
      view.inspectModel(new THREE.Box3(new THREE.Vector3(offset[0] - 0.14, 0, offset[1] - 0.14),
        new THREE.Vector3(offset[0] + 0.14, 0.14, offset[1] + 0.14)), scenario.distance);
      view.render(0);
      // Independent upper-surface oracle over the actual animated mesh vertices.
      const triangles = surface.triangles.map(indices => {
        const p = indices.map(i => vertices[i]);
        return { p, minX: Math.min(...p.map(v => v[0])), maxX: Math.max(...p.map(v => v[0])),
          minZ: Math.min(...p.map(v => v[2])), maxZ: Math.max(...p.map(v => v[2])) };
      });
      let buried = 0, checked = 0, deepest = 0;
      model.root.updateMatrixWorld(true);
      model.root.traverse(node => {
        if (!node.isMesh) return;
        if (node.isSkinnedMesh) node.skeleton.update();
        for (let i = 0; i < node.geometry.attributes.position.count; i++) {
          const v = node.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(node.matrixWorld);
          let top = -Infinity;
          for (const t of triangles) {
            if (v.x < t.minX || v.x > t.maxX || v.z < t.minZ || v.z > t.maxZ) continue;
            const [a, b, c] = t.p;
            const denominator = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
            if (Math.abs(denominator) < 1e-20) continue;
            const u = ((b[2] - c[2]) * (v.x - c[0]) + (c[0] - b[0]) * (v.z - c[2])) / denominator;
            const w = ((c[2] - a[2]) * (v.x - c[0]) + (a[0] - c[0]) * (v.z - c[2])) / denominator;
            if (u >= -1e-10 && w >= -1e-10 && u + w <= 1 + 1e-10)
              top = Math.max(top, u * a[1] + w * b[1] + (1 - u - w) * c[1]);
          }
          checked++;
          if (v.y < top - 1e-7) { buried++; deepest = Math.max(deepest, top - v.y); }
        }
      });
      return { camera: view.cameraState, buried, deepest, checked };
    }, { scenario, clear });
  }
  for (const scenario of scenarios) {
    for (const clear of [false, true]) {
      const report = await draw(scenario, clear);
      const name = `${scenario.name}-${clear ? 'after' : 'before'}`;
      if (clear) assert.equal(report.buried, 0, `${name}: animated vertices enter the object`);
      assert.ok(report.checked > 0);
      const fly = report.camera.flies[0];
      assert.deepEqual(fly.recordedPosition, [scenario.pose.root[0] + 2, scenario.pose.root[1], scenario.pose.root[2] + 7.5]);
      assert.equal(fly.worldPosition[0], fly.recordedPosition[0]);
      assert.equal(fly.worldPosition[2], fly.recordedPosition[2]);
      assert.ok(fly.visible);
      await page.screenshot({ path: `${output}/${name}.png` });
      const clip = { x: Math.max(0, Math.min(1240, Math.round(fly.x - 100))),
        y: Math.max(0, Math.min(700, Math.round(fly.y - 100))), width: 200, height: 200 };
      await page.screenshot({ path: `${output}/${name}-crop.png`, clip });
      rows.push({ name, ...report });
    }
  }
  assert.ok(rows.some(row => row.name.endsWith('before') && row.buried > 0), 'the negative control must reproduce surface penetration');
  await draw(scenarios[0], true);
  const before = await page.locator('canvas').screenshot();
  await draw(scenarios[2], true);
  await draw(scenarios[0], true);
  equalPixels(await page.locator('canvas').screenshot(), before, 'zooming back must restore the same visible surface pose');
  const performanceReport = await page.evaluate(async pose => {
    const { view, offset } = window.fixture;
    const gl = document.querySelector('canvas').getContext('webgl2');
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const runs = [];
    for (const clearance of [false, true]) {
      const timings = [];
      for (let frame = 0; frame < 50; frame++) {
        await new Promise(requestAnimationFrame);
        const start = performance.now();
        view.setPoses(Array.from({ length: 16 }, (_, id) => ({
          x: pose.root[0] + offset[0] + (id % 4) * 0.001, y: pose.root[1], z: pose.root[2] + offset[1] + Math.floor(id / 4) * 0.001,
          heading: 0, rotation: pose.rotation, bodyMode: clearance ? 'landing' : undefined,
          animation: { clip: 'Land', seconds: frame * 0.02 },
        })));
        view.render(0);
        if (frame >= 10) timings.push(performance.now() - start);
      }
      timings.sort((a, b) => a - b);
      runs.push({ clearance, medianCpuMs: timings[Math.floor(timings.length / 2)], p95CpuMs: timings[Math.floor(timings.length * 0.95)] });
    }
    return { gpu, visibleFlies: 16, runs };
  }, scenarios[0].pose);
  assert.deepEqual(errors, []);
  await writeFile(`${output}/report.json`, JSON.stringify({ rows, performanceReport, errors }, null, 2));
  console.log(`All ${scenarios.length} surface views clear; zoom return is pixel-identical.`);
} finally { await browser.close(); }
