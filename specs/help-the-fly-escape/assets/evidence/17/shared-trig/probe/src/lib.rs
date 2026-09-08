//! Scratch, out-of-repo WASM probe for the Box-Muller angle work.
//! Part 1 picks the implementation: separate sin/cos (shipped today) vs std
//! `f64::sin_cos` vs `libm::sincos`, comparing bits and time on real WASM.
use wasm_bindgen::prelude::*;

#[wasm_bindgen(inline_js = "export function js_now() { return performance.now(); }")]
extern "C" {
    fn js_now() -> f64;
}
fn now() -> f64 {
    js_now()
}

/// [worstBitDiff_stdSinCos, worstBitDiff_libmSincos, separateMs, stdSinCosMs, libmSincosMs, acc]
/// Bit diffs are against the shipped `(theta.cos(), theta.sin())` pair.
#[wasm_bindgen]
pub fn variant_probe(iters: u32) -> Vec<f64> {
    let angles: Vec<f64> = (0..iters)
        .map(|i| std::f64::consts::TAU * ((i as f64 + 0.5) / iters as f64))
        .collect();
    let (mut worst_std, mut worst_libm) = (0u64, 0u64);
    for &a in &angles {
        let (c, s) = (a.cos(), a.sin());
        let (ss, sc) = a.sin_cos();
        let (ls, lc) = libm::sincos(a);
        worst_std = worst_std.max((s.to_bits() ^ ss.to_bits()) | (c.to_bits() ^ sc.to_bits()));
        worst_libm = worst_libm.max((s.to_bits() ^ ls.to_bits()) | (c.to_bits() ^ lc.to_bits()));
    }
    let mut acc = 0.0;
    let t0 = now();
    for &a in &angles {
        acc += a.cos() + a.sin();
    }
    let separate = now() - t0;
    let t1 = now();
    for &a in &angles {
        let (s, c) = a.sin_cos();
        acc += c + s;
    }
    let std_sin_cos = now() - t1;
    let t2 = now();
    for &a in &angles {
        let (s, c) = libm::sincos(a);
        acc += c + s;
    }
    let libm_sincos = now() - t2;
    vec![
        worst_std as f64,
        worst_libm as f64,
        separate,
        std_sin_cos,
        libm_sincos,
        acc,
    ]
}

/// Part 2: the shipped `Brain::step` (this crate depends on the worktree's sim, so
/// this is the candidate code) against a replica of the *old* noise loop —
/// `theta.cos()` / `theta.sin()` — driven by an identical seed, inside real WASM.
use sim::{Brain, Graph, LifParams, NeuralState};
use std::sync::Arc;

struct OldLoop(u64);
impl OldLoop {
    fn uniform(&mut self) -> f64 {
        self.0 = self.0.wrapping_add(0x9e3779b97f4a7c15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xbf58476d1ce4e5b9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94d049bb133111eb);
        z ^= z >> 31;
        ((z >> 11) as f64 + 0.5) / 9007199254740992.0
    }
    /// Verbatim copy of the noise loop at baseline 518b184.
    fn tick(&mut self, out: &mut [f64], noise_std: f64) {
        for pair in out.chunks_mut(2) {
            let r = (-2.0 * self.uniform().ln()).sqrt() * noise_std;
            let theta = std::f64::consts::TAU * self.uniform();
            pair[0] = r * theta.cos();
            if pair.len() == 2 {
                pair[1] = r * theta.sin();
            }
        }
    }
}

fn worst(a: &[f64], b: &[f64]) -> u64 {
    a.iter()
        .zip(b)
        .map(|(x, y)| x.to_bits() ^ y.to_bits())
        .fold(0u64, |m, v| m.max(v))
}

/// Isolated-draw check: zero drive and an unreachable threshold make each membrane
/// hold exactly the sample drawn, so `voltage()` reads back the shipped noise vector.
/// Returns [worstBitDiff, neurons, ticks, firstSample].
#[wasm_bindgen]
pub fn shipped_noise_bits(bytes: &[u8], manifest: &str, seed: f64, ticks: u32) -> Vec<f64> {
    let graph = Arc::new(Graph::from_bytes(bytes, manifest).unwrap());
    let n = graph.neuron_count();
    let seed = seed as u64;
    let noise_std = 0.015;
    let mut brain = Brain::new(graph, seed);
    brain
        .set_params(LifParams {
            threshold: 100.0,
            dt: 1.0,
            noise_std,
            input_scale: 0.0,
            baseline_drive: 0.0,
            ..Default::default()
        })
        .unwrap();
    let mut old = OldLoop(seed);
    let mut expected = vec![0.0; n];
    let mut worst_bits = 0u64;
    let mut first = 0.0;
    for t in 0..ticks {
        brain
            .set_state(NeuralState {
                voltage: vec![0.0; n],
                spikes: vec![false; n],
                refractory: vec![0; n],
            })
            .unwrap();
        old.tick(&mut expected, noise_std);
        brain.step();
        if t == 0 {
            first = expected[0];
        }
        worst_bits = worst_bits.max(worst(brain.voltage(), &expected));
    }
    vec![worst_bits as f64, n as f64, ticks as f64, first]
}

/// Full-dynamics check: one brain draws its own noise through the shipped path, the
/// other is fed the old loop's samples. Default params, so spikes, refractory and the
/// CSR scan all run. Returns [worstVoltageBitDiff, spikeMismatches, neurons, ticks].
#[wasm_bindgen]
pub fn paired_run_bits(bytes: &[u8], manifest: &str, seed: f64, ticks: u32) -> Vec<f64> {
    let graph = Arc::new(Graph::from_bytes(bytes, manifest).unwrap());
    let n = graph.neuron_count();
    let seed = seed as u64;
    let noise_std = LifParams::default().noise_std;
    let mut shipped = Brain::new(graph.clone(), seed);
    let mut replayed = Brain::new(graph, seed);
    let mut old = OldLoop(seed);
    let mut noise = vec![0.0; n];
    let (mut worst_bits, mut spike_mismatches) = (0u64, 0u32);
    for _ in 0..ticks {
        let a = shipped.step();
        old.tick(&mut noise, noise_std);
        let b = replayed.step_with_noise(&noise).unwrap();
        if a.spike_count != b.spike_count || shipped.spikes() != replayed.spikes() {
            spike_mismatches += 1;
        }
        worst_bits = worst_bits.max(worst(shipped.voltage(), replayed.voltage()));
    }
    vec![
        worst_bits as f64,
        f64::from(spike_mismatches),
        n as f64,
        f64::from(ticks),
    ]
}

/// Odd-length tail: the real graph has an even neuron count, so the unpaired final
/// sample (cosine only) is exercised here on a replica of both loops.
#[wasm_bindgen]
pub fn odd_tail_bits(neurons: u32, seed: f64) -> Vec<f64> {
    let n = neurons as usize;
    let (seed, noise_std) = (seed as u64, 0.015);
    let mut old_out = vec![0.0; n];
    OldLoop(seed).tick(&mut old_out, noise_std);
    let mut new_out = vec![0.0; n];
    let mut rng = OldLoop(seed);
    for pair in new_out.chunks_mut(2) {
        let r = (-2.0 * rng.uniform().ln()).sqrt() * noise_std;
        let theta = std::f64::consts::TAU * rng.uniform();
        let (s, c) = libm::sincos(theta);
        pair[0] = r * c;
        if pair.len() == 2 {
            pair[1] = r * s;
        }
    }
    vec![
        worst(&old_out, &new_out) as f64,
        n as f64,
        old_out[n - 1],
        new_out[n - 1],
    ]
}
