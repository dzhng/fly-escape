import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { retinalEyeRig } from "../../packages/game-renderer/src/retina-eye-rig.ts";
import { retinaCameraProjection, RetinaProjection, retinaProfile } from "../../packages/game-renderer/src/retina-projection.ts";

const THREE = createRequire(resolve("packages/game-renderer/package.json"))("three");
const output = resolve(process.env.RETINA_EVIDENCE_DIR ?? "/tmp/fly-retina-optics");
const base = process.env.RETINA_URL ?? "http://127.0.0.1:5174";
const hash = bytes => createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
const pose = (position, heading = 0, roll = 0) => ({ position, rotation: new THREE.Quaternion()
  .setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2 - heading)
  .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll)).toArray() });
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${base}/retina`);
  await page.waitForFunction(() => document.querySelector("#app")?.dataset.retinaReady === "true");
  const displayed = async () => JSON.parse(await page.locator("#retina-report").textContent()).samples;
  const captureDisplayed = async () => {
    const before = Number(await page.locator("#app").getAttribute("data-retina-capture-count"));
    await page.locator("#retina-capture").click();
    await page.waitForFunction(() => !document.querySelector("#retina-capture").disabled);
    assert.equal(await page.locator("#app").getAttribute("data-retina-ready"), "true", await page.locator("#retina-status").textContent());
    assert.ok(Number(await page.locator("#app").getAttribute("data-retina-capture-count")) > before, "Invariance requires a newly successful acquisition");
    return displayed();
  };
  const initial = await displayed();
  const report = { browser: browser.version(), gpu: await page.locator("#app").getAttribute("data-retina-gpu"), invariance: [], fixtures: [], errors };
  assert.ok(!/SwiftShader|llvmpipe|software/i.test(report.gpu));
  await page.screenshot({ path: `${output}/world-before.png` });
  const canvas = page.locator(".retina-world canvas");
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(box.x + box.width / 2 + 130, box.y + box.height / 2 - 40, { steps: 12 });
  await page.mouse.up({ button: "right" });
  assert.deepEqual(await captureDisplayed(), initial);
  report.invariance.push("player orbit");
  await canvas.click({ position: { x: 25, y: 25 } });
  assert.deepEqual(await captureDisplayed(), initial);
  report.invariance.push("fly deselection and presentation cutaways");
  await page.setViewportSize({ width: 1180, height: 900 });
  assert.deepEqual(await captureDisplayed(), initial);
  report.invariance.push("viewport resize");
  await page.screenshot({ path: `${output}/world-after.png` });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator("#retina-rig").check();
  assert.deepEqual(await captureDisplayed(), initial);
  report.invariance.push("native mounting inspection camera");
  await page.screenshot({ path: `${output}/mounted-rig.png` });
  await page.locator("#retina-pose").selectOption("tilted");
  await page.waitForFunction(() => !document.querySelector("#retina-capture").disabled);
  assert.notDeepEqual(await displayed(), initial, "Full body tilt must affect optical input");
  await page.screenshot({ path: `${output}/tilted-rig.png` });
  await page.locator("#retina-rig").uncheck();

  await page.evaluate(() => {
    const worker = new Worker(new URL("/src/retina-worker.ts", location.href), { type: "module" });
    window.opticalRequest = command => new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Optical fixture timed out")), 10000);
      worker.onmessage = ({ data }) => { clearTimeout(timeout); data.type === "error" ? reject(new Error(data.message)) : resolve(data); };
      worker.onerror = event => { clearTimeout(timeout); reject(new Error(event.message)); };
      worker.postMessage(command);
    });
    window.disposeOpticalProbe = () => worker.terminate();
  });
  const request = command => page.evaluate(command => window.opticalRequest(command), command);
  const projection = new RetinaProjection(retinaProfile);
  const save = async (name, frozen, ready) => {
    const frame = await request({ type: "capture", poses: [frozen], cameraImages: true });
    const samples = Array.from(frame.samples);
    const images = await page.evaluate(async ({ samples, cameraImages, source }) => {
      const { RetinaProjection, retinaProfile } = await import(source);
      const projection = new RetinaProjection(retinaProfile);
      return [0, 1].flatMap(eye => [projection.image(new Uint8Array(samples.slice(eye * 2163, (eye + 1) * 2163))), new Uint8ClampedArray(Object.values(cameraImages[eye]))])
        .map(pixels => { const canvas = document.createElement("canvas"); canvas.width = canvas.height = 128; canvas.getContext("2d").putImageData(new ImageData(pixels, 128, 128), 0, 0); return canvas.toDataURL(); });
    }, { samples, cameraImages: frame.cameraImages, source: `/@fs${resolve("packages/game-renderer/src/retina-projection.ts")}` });
    for (const [index, suffix] of ["L", "L-camera", "R", "R-camera"].entries())
      await writeFile(`${output}/${name}-${suffix}.png`, Buffer.from(images[index].split(",")[1], "base64"));
    report.fixtures.push({ name, pose: frozen, sceneId: ready.sceneId, samplesHash: hash(samples), samples, oracleMaxByteDifference: frame.oracleMaxByteDifference });
    assert.ok(frame.oracleMaxByteDifference <= 1);
    return { ...frame, samples };
  };
  let ready = await request({ type: "start", landmarks: false });
  for (const [name, frozen] of [
    ["ground", pose([1, 0, 2.5])], ["flight", pose([1, 1.1, 2.5])],
    ["tilted", pose([1, .45, 2.5], 0, .6)],
    ["sofa-under", pose([1.25, .025, .675])], ["sofa-above", pose([1.25, 1.1, .675])],
  ]) await save(name, frozen, ready);
  assert.notEqual(report.fixtures.find(f => f.name === "sofa-under").samplesHash, report.fixtures.find(f => f.name === "sofa-above").samplesHash);

  ready = await request({ type: "start" });
  const targets = [[2, .35, 2, 0], [2, .35, 3, 2], [2, .9, 2.5, 1]];
  report.orientation = [];
  for (const [name, frozen] of [["markers-flat", pose([1, .45, 2.5])], ["markers-tilted", pose([1, .45, 2.5], 0, .6)]]) {
    const frame = await save(name, frozen, ready);
    const body = new THREE.Quaternion(...frozen.rotation);
    for (let eye = 0; eye < 2; eye++) {
      const rig = retinalEyeRig.eyes[eye];
      const origin = new THREE.Vector3(...rig.positionMetres).applyQuaternion(body).add(new THREE.Vector3(...frozen.position));
      const rotation = body.clone().multiply(new THREE.Quaternion(...rig.cameraToBodyQuaternion));
      for (const [x, y, z, channel] of targets) {
        const local = new THREE.Vector3(x, y, z).sub(origin).applyQuaternion(rotation.clone().invert());
        if (local.z >= 0) continue;
        const t = Math.tan(retinaCameraProjection.verticalFovDegrees * Math.PI / 360);
        const col = Math.floor(64 * (1 + local.x / -local.z / t / retinaCameraProjection.aspect));
        const row = Math.floor(64 * (1 - local.y / -local.z / t));
        if (col < 1 || col >= 127 || row < 1 || row >= 127) continue;
        const pixels = Object.values(frame.cameraImages[eye]);
        let found = false;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          const rgb = pixels.slice(((row + dr) * 128 + col + dc) * 4, ((row + dr) * 128 + col + dc) * 4 + 3);
          if (rgb[channel] > 100 && rgb.every((v, i) => i === channel || rgb[channel] > v * 2)) found = true;
        }
        assert.ok(found, `${name} eye${eye} channel${channel} expected at ${col},${row}`);
        report.orientation.push({ name, eye, channel, col, row });
      }
    }
  }
  assert.ok(report.orientation.length >= 6);

  const adjacent = pose([.063, .45, 1.2], Math.PI);
  ready = await request({ type: "start", stimuli: [{ position: [-.5, .45, 1.2], size: [.1, .5, .5], color: 0x0000ff }] });
  const wall = await save("wall-adjacent", adjacent, ready);
  assert.equal(wall.samples.filter((b, i, all) => i % 3 === 2 && b > 32 && b > all[i - 1] * 2 && b > all[i - 2] * 2).length, 0, "Wall-adjacent eyes must not leak the hidden blue target");
  const lampPose = pose([1, .25, 2.5]);
  ready = await request({ type: "start", landmarks: false, placements: [{ id: 901, kind: "lamp", position: { x: 1.35, z: 2.15 }, heading: 0 }] });
  const lamp = await save("lamp-near", lampPose, ready);
  const lampScene = ready.sceneId;
  ready = await request({ type: "start", landmarks: false, placements: [{ id: 901, kind: "lamp", position: { x: 3.2, z: 3.5 }, heading: 0 }] });
  const moved = await save("lamp-moved", lampPose, ready);
  assert.notEqual(lampScene, ready.sceneId);
  assert.notDeepEqual(lamp.samples, moved.samples, "Resolved lamp movement must affect physical capture");
  const contact = JSON.parse(await readFile(resolve("assets/proportions/contact-fixture.json"), "utf8")).cases[0];
  ready = await request({ type: "start", landmarks: false, placements: [{ id: 902, kind: "fruit", position: { x: 2, z: 7.5 }, heading: 0 }] });
  for (const kind of ["supported", "upright"]) {
    const native = contact[kind];
    await save(`apple-${kind}`, { position: [native.root[0] + 2, native.root[1], native.root[2] + 7.5], rotation: native.rotation }, ready);
  }
  report.supportFixture = "assets/proportions/contact-fixture.json cases[0]; native body roots/quaternions translated with the actual apple asset";
  ready = await request({ type: "start", landmarks: false, levelIndex: 1 });
  await save("turn-corner", pose([8.125, .45, 9.3], -Math.PI / 2), ready);
  await request({ type: "dispose" });
  await page.evaluate(() => window.disposeOpticalProbe());
  assert.deepEqual(errors, []);
  await writeFile(`${output}/optics.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ invariance: report.invariance, fixtures: report.fixtures.length, orientationChecks: report.orientation.length, errors }));
} finally { await browser.close(); }
