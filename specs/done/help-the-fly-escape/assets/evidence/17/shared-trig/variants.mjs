import { readFileSync } from 'node:fs';
const m = await import('/tmp/noise-sincos/probe-pkg/noise_sincos_probe.js');
m.initSync({ module: readFileSync('/tmp/noise-sincos/probe-pkg/noise_sincos_probe_bg.wasm') });
for (const n of [2_000_000, 2_000_000]) {
  const [bitDiffStd, bitDiffLibm, sepMs, stdMs, libmMs] = m.variant_probe(n);
  console.log(JSON.stringify({
    angles: n, bitDiffStdSinCos: bitDiffStd, bitDiffLibmSincos: bitDiffLibm,
    separateMs: +sepMs.toFixed(1), stdSinCosMs: +stdMs.toFixed(1), libmSincosMs: +libmMs.toFixed(1),
    stdSavedPct: +(100 * (sepMs - stdMs) / sepMs).toFixed(1),
    libmSavedPct: +(100 * (sepMs - libmMs) / sepMs).toFixed(1),
  }));
}
