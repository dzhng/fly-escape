import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = process.env.RECOVERY_OUTPUT ?? '/tmp/fly-wasm-recovery';
assert.ok(process.env.TRAP_WASM_PATH, "TRAP_WASM_PATH must name the historical panic fixture WASM (see recovery evidence)");
const faultWasm = await readFile(process.env.TRAP_WASM_PATH);
const input = JSON.parse(await readFile(root + 'specs/done/help-the-fly-escape/assets/evidence/30/seed42-contact/seed42-request.json', 'utf8'));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { console: [], errors: [], wasmRequests: 0 };
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(120000);
  page.on('console', message => report.console.push({ type: message.type(), message: message.text() }));
  page.on('pageerror', error => report.errors.push(error.message));
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.workerLifetime = { created: 0, terminated: 0 };
    window.Worker = class extends NativeWorker {
      constructor(...args) {
        super(...args);
        window.workerLifetime.created++;
        const terminate = this.terminate.bind(this);
        this.terminate = () => { window.workerLifetime.terminated++; terminate(); };
      }
    };
  });
  await page.route('**/*game_wasm_bg*.wasm*', async route => {
    report.wasmRequests++;
    if (report.wasmRequests === 1) await route.fulfill({ body: faultWasm, contentType: 'application/wasm' });
    else await route.continue();
  });
  await page.goto((process.env.BRAIN_URL ?? 'http://127.0.0.1:5173') + '/?about');
  await page.evaluate(async ({ path, input }) => {
    const { renderMeal } = await import(path);
    await Promise.race([renderMeal(input), new Promise((_, reject) => setTimeout(() => reject(Error('Player mount timed out')), 30000))]);
  }, { path: '/@fs' + root + 'tests/browser/meal-playback.tsx', input });
  await page.getByRole('alert').waitFor();
  await page.screenshot({ path: output + '/interrupted.png' });
  report.spec = JSON.parse(await page.getByTestId('playback-report').textContent()).spec;
  report.failedWasmRequests = report.wasmRequests;
  report.failed = await page.evaluate(() => ({ ...window.workerLifetime }));
  assert.ok(report.console.some(entry => entry.message.includes('RuntimeError: unreachable')), 'the captured native panic reaches the developer console');
  assert.ok(report.console.some(entry => entry.message.includes('failed attempt cleanup')), 'the actual borrowed Rust value cannot be freed after this panic');
  assert.equal(report.failed.terminated, 1, 'the trapped WASM instance is retired');
  await page.getByRole('button', { name: 'New attempt', exact: true }).click();
  await page.waitForFunction(() => {
    const player = document.querySelector('[data-testid="playback-lab"]');
    return player?.dataset.playbackState === 'playing' && Number(player.dataset.cursorTick) >= 10;
  });
  report.retried = await page.evaluate(() => ({ ...window.workerLifetime }));
  assert.deepEqual(report.retried, { created: 2, terminated: 1 });
  assert.equal(report.wasmRequests, report.failedWasmRequests + 1, 'retry loads a new worker module alongside the existing replay sampler');
  report.retriedSpec = JSON.parse(await page.getByTestId('playback-report').textContent()).spec;
  assert.notEqual(report.retriedSpec.simulationBuildId, report.spec.simulationBuildId);
  await page.screenshot({ path: output + '/retry.png' });
  report.passed = true;
} catch (error) {
  report.failure = String(error);
  process.exitCode = 1;
} finally {
  await writeFile(output + '/report.json', JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ passed: report.passed ?? false, failure: report.failure, failed: report.failed, retried: report.retried }));
