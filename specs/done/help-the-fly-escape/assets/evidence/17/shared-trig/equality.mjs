// Bitwise equality of the shipped (candidate) noise draw against the old loop, in real WASM.
import { readFileSync } from 'node:fs';
const m = await import('/tmp/noise-sincos/probe-pkg/noise_sincos_probe.js');
m.initSync({ module: readFileSync('/tmp/noise-sincos/probe-pkg/noise_sincos_probe_bg.wasm') });
const root = '/private/tmp/fly-timed-rounds';
const bytes = readFileSync(`${root}/data/processed/brain/graph.bin`);
const manifest = readFileSync(`${root}/data/processed/brain/manifest.json`, 'utf8');
for (const seed of [12345, 11716541513791412824 % 2 ** 53, 1]) {
  const [bits, n, ticks, first] = m.shipped_noise_bits(bytes, manifest, seed, 5);
  console.log(JSON.stringify({ probe: 'shipped_noise_bits', seed, neurons: n, ticks, worstBitDiff: bits, firstSample: first }));
}
const [vbits, spikes, n2, t2] = m.paired_run_bits(bytes, manifest, 12345, 25);
console.log(JSON.stringify({ probe: 'paired_run_bits', neurons: n2, ticks: t2, worstVoltageBitDiff: vbits, spikeMismatchTicks: spikes }));
const [obits, on, oldTail, newTail] = m.odd_tail_bits(70001, 7);
console.log(JSON.stringify({ probe: 'odd_tail_bits', neurons: on, worstBitDiff: obits, oldTail, newTail }));
