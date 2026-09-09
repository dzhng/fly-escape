import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Exercise the native record fixture through the real browser decoder, then the
// actual 16-fly campaign worker and UI. The dev origin exposes module imports;
// production frame pacing remains the separate playback acceptance surface.
const base = process.env.BRAIN_URL ?? 'http://127.0.0.1:5173';
const production = process.env.VISION_PRODUCTION_URL ?? base;
const visionGain = Number(process.env.VISION_CUE_GAIN ?? 0);
assert.ok(Number.isFinite(visionGain) && visionGain >= 0 && visionGain <= 3);
const output = process.env.VISION_OUTPUT ?? 'specs/done/directional-vision/assets/browser';
await mkdir(output, { recursive: true });
const fixture = JSON.parse(execFileSync('cargo', ['run', '-q', '-p', 'sim', '--example', 'record_fixture'], { encoding: 'utf8' }));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.setDefaultTimeout(90000);
try {
  await page.goto(base);
  const decoded = await page.evaluate(async ({ fixture, moduleRoot }) => {
    const { FrameArchive } = await import(`${moduleRoot}/record.ts`);
    const initial = [0, 1].map(id => ({ pose: { position: { x: id, z: 0 }, heading: 0 }, mode: 'walking', reserve: 10, height: 0, support: null, rotation: [0, 0, 0, 1], outcome: null }));
    const archive = new FrameArchive({ attemptId: 'fixture', flyCount: 2, durationTicks: 4 }, fixture.layout, fixture.archiveByteBound, initial);
    for (const chunk of fixture.chunks) {
      for (const name of ['values', 'motionValues']) chunk[name] = new Float64Array(chunk[name]);
      for (const name of ['states', 'events', 'tickNeuralSteps', 'motionOffsets', 'motionStates']) chunk[name] = new Uint32Array(chunk[name]);
      archive.append(chunk);
    }
    return { frames: [1, 3, 2, 4, 1].map(tick => archive.frame(tick)), initial: archive.frame(0), schema: fixture.layout.schemaVersion };
  }, { fixture, moduleRoot: '/@fs' + fileURLToPath(new URL('../../packages/sim-client/src', import.meta.url)) });
  assert.equal(decoded.schema, 5);
  for (const frame of decoded.frames) assert.deepEqual(frame, fixture.frames[frame.tick - 1]);
  assert.ok(decoded.frames[0].flies[0].sensory.vision.brightness.some(value => value > 0));
  assert.ok(decoded.frames[0].flies[0].sensory.vision.blocked.some(value => value > 0));
  assert.equal(decoded.initial.flies[0].sensory, null);
  const workerSample = await page.evaluate(async ({ moduleRoot, visionGain }) => {
    const { AttemptClient } = await import(`${moduleRoot}/attempt-client.ts`);
    const { FrameArchive } = await import(`${moduleRoot}/record.ts`);
    const { default: content } = await import('/src/levels/open-window.ts');
    const level = structuredClone(content.level);
    level.durationTicks = 30;
    level.sources.push({ kind: 'lamp', position: { x: 2.6, z: 6.9 }, radius: 3, rate: 2 });
    const tuning = visionGain ? { ...content.tuning, cues: [{ pathway: 'vision', gain: visionGain }], tasteGain: 0 } : content.tuning;
    return new Promise((resolve, reject) => {
      let archive;
      const timer = setTimeout(() => { client.dispose(); reject(new Error('Directional worker timeout')); }, 60000);
      const client = new AttemptClient(reply => {
        if (reply.type === 'error') { clearTimeout(timer); client.dispose(); reject(new Error(reply.message)); }
        if (reply.type === 'ready') archive = new FrameArchive(reply.info.spec, reply.info.recordLayout, reply.info.archiveBytes, reply.info.initialBodies);
        if (reply.type === 'frames') {
          archive.append(reply.chunk);
          if (archive.complete) { clearTimeout(timer); const first = archive.frame(1); client.dispose(); resolve({ first, computedTick: archive.computedTick }); }
        }
      });
      client.start({ level, tuning, placements: [], flyCount: 16, attemptId: 'vision-worker', rootSeed: '42' });
    });
  }, { moduleRoot: '/@fs' + fileURLToPath(new URL('../../packages/sim-client/src', import.meta.url)), visionGain });
  assert.equal(workerSample.computedTick, 30);
  for (const fly of workerSample.first.flies) {
    const { brightness, blocked } = fly.sensory.vision;
    assert.equal(brightness.length, 8);
    assert.equal(blocked.length, 8);
    assert.ok([...brightness, ...blocked].every(value => Number.isFinite(value) && value >= 0));
    assert.ok(Math.max(...brightness) > Math.min(...brightness));
  }
  await page.goto(production);
  await page.waitForFunction(() => document.querySelector('.run-setup')?.disabled === false);
  await page.getByRole('button', { name: 'Release the flies', exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector('[data-testid="playback-lab"]')?.dataset.cursorTick) >= 30);
  const report = async () => JSON.parse(await page.getByTestId('playback-report').textContent());
  const playing = await report();
  assert.equal(playing.spec.flyCount, 16);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Select fly 1', exact: true }).click();
  const seek = page.getByTestId('playback-seek');
  const move = async tick => { await seek.fill(String(tick)); await seek.dispatchEvent('input'); await page.waitForFunction(tick => document.querySelector('[data-testid="selected-fly"]')?.dataset.sampleTick === String(tick), tick); };
  await move(10);
  const first = await page.getByTestId('selected-fly').innerText();
  await move(20); await move(10);
  assert.equal(await page.getByTestId('selected-fly').innerText(), first);
  const paused = await report();
  await page.screenshot({ path: `${output}/paused-rewind.png` });
  if (visionGain) {
    await page.getByRole('button', { name: 'Vision L', exact: true }).click();
    await page.getByTestId('selected-fly').evaluate(element => element.scrollIntoView({ block: 'start' }));
    await page.waitForFunction(() => document.querySelector('.science-group-picker')?.textContent.includes('Tm2'));
    await page.screenshot({ path: `${output}/vision-details.png` });
    await page.getByRole('button', { name: 'Explain Modeled vision · Tm2 · left', exact: true }).click();
    await page.screenshot({ path: `${output}/vision-explanation.png` });
    assert.ok((await page.getByRole('region', { name: 'Modeled vision · Tm2 · left explained', exact: true }).innerText()).includes('modeling assumptions'));
  }
  assert.equal(paused.sampleTick, 10);
  assert.equal(paused.underruns, 0);
  assert.ok(playing.cursorTick >= 30);
  assert.deepEqual(errors, []);
  await writeFile(`${output}/report.json`, JSON.stringify({ nativeFixtureRoundTrip: true, seekOrder: decoded.frames.map(frame => frame.tick), schema: decoded.schema, visionGain, workerSample, playbackOrigin: production, playing, paused, errors }, null, 2));
} finally { await browser.close(); }
