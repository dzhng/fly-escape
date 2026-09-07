import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Inject destructor/extraction faults at the generated WASM API boundary;
// the actual Worker, transport client and healthy retry still execute normally.
const root = '/@fs' + fileURLToPath(new URL('../../packages/sim-client/src/', import.meta.url));
const output = process.env.CLEANUP_OUTPUT ?? '/tmp/fly-worker-cleanup';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const reports = [];
try {
  for (const scenario of ['cancel', 'replace', 'complete', 'info', 'chunk']) {
    const page = await browser.newPage();
    const report = { scenario, console: [], errors: [] };
    reports.push(report);
    page.on('console', event => report.console.push(event.text()));
    page.on('pageerror', error => report.errors.push(error.message));
    let injected = false;
    await page.route('**/attempt-worker.ts?*', async route => {
      const response = await route.fetch();
      let body = await response.text();
      if (!injected) {
        injected = true;
        const glue = body.match(/from "([^"]*\/wasm\/game_wasm.js[^\"]*)"/)[1];
        const patch = scenario === 'chunk'
          ? 'FaultChunk.prototype.take_values = () => { throw new WebAssembly.RuntimeError("primary chunk fault"); }; FaultChunk.prototype.free = () => { throw Error("cleanup fault"); };'
          : 'AttemptSession.prototype.free = () => { throw Error("cleanup fault"); };' +
            (scenario === 'info' ? 'AttemptSession.prototype.info = () => { throw new WebAssembly.RuntimeError("primary info fault"); };' : '');
        body = `import { AttemptChunk as FaultChunk } from ${JSON.stringify(glue)};\n${patch}\n${body}`;
      }
      await route.fulfill({ response, body });
    });
    await page.goto((process.env.BRAIN_URL ?? 'http://127.0.0.1:5173') + '/?about');
    report.result = await page.evaluate(async ({ root, scenario }) => {
      const NativeWorker = window.Worker;
      const lifetime = { created: 0, terminated: 0 };
      window.Worker = class extends NativeWorker {
        constructor(...args) {
          super(...args);
          lifetime.created++;
          const terminate = this.terminate.bind(this);
          this.terminate = () => { lifetime.terminated++; terminate(); };
        }
      };
      const { AttemptClient } = await import(root + 'attempt-client.ts');
      const messages = [];
      const client = new AttemptClient(reply => {
        messages.push({ type: reply.type, id: reply.attemptId, message: reply.message });
        if (reply.type === 'ready' && reply.attemptId === 'fault') {
          if (scenario === 'cancel') client.cancel();
          if (scenario === 'replace') client.startLab('replacement', '42', 1, 1);
        }
      });
      const until = async predicate => {
        const deadline = performance.now() + 30000;
        while (!predicate()) {
          if (performance.now() > deadline) throw Error('Cleanup test timed out: ' + JSON.stringify({ lifetime, messages }));
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      };
      try {
        client.startLab('fault', '42', 1, 1);
        await until(() => lifetime.terminated === 1);
        const failed = { ...lifetime };
        const catalog = await client.setup({ type: 'catalog' });
        client.startLab('retry', '42', 1, 1);
        await until(() => messages.some(reply => reply.type === 'complete' && reply.id === 'retry'));
        return { failed, recovered: { ...lifetime }, catalogSize: catalog.length, messages };
      } finally { client.dispose(); }
    }, { root, scenario });
    assert.deepEqual(report.result.failed, { created: 1, terminated: 1 });
    assert.deepEqual(report.result.recovered, { created: 2, terminated: 1 });
    assert.ok(report.result.catalogSize > 0);
    assert.ok(report.console.some(message => message.includes('failed attempt cleanup')));
    assert.ok(!report.result.messages.some(reply => reply.type === 'complete' && reply.id !== 'retry'));
    if (scenario !== 'cancel') {
      const failure = report.result.messages.find(reply => reply.type === 'error');
      assert.ok(failure?.message.includes(['info', 'chunk'].includes(scenario) ? `primary ${scenario} fault` : 'cleanup fault'));
    }
    assert.deepEqual(report.errors, []);
    report.passed = true;
    await page.close();
  }
} catch (error) {
  reports.push({ failure: String(error) });
  process.exitCode = 1;
} finally {
  await mkdir(output, { recursive: true });
  await writeFile(output + '/report.json', JSON.stringify(reports, null, 2));
  await browser.close();
}
console.log(JSON.stringify(reports.map(({ scenario, passed, failure }) => ({ scenario, passed, failure }))));
