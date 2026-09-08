//! Temporary bit-exact neural trace/benchmark harness for the sparse-delivery change.
use sha2::{Digest, Sha256};
use sim::{Brain, Graph};
use std::{sync::Arc, time::Instant};

struct Trace(Sha256);
impl Trace {
    fn f(&mut self, v: &[f64]) {
        for x in v {
            self.0.update(x.to_bits().to_le_bytes());
        }
    }
    fn b(&mut self, v: &[bool]) {
        for x in v {
            self.0.update([u8::from(*x)]);
        }
    }
    fn u(&mut self, v: &[u32]) {
        for x in v {
            self.0.update(x.to_le_bytes());
        }
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let a: Vec<_> = std::env::args().collect();
    let path = a.get(1).ok_or("graph dir")?;
    let ticks: u32 = a.get(2).ok_or("ticks")?.parse()?;
    let load = Instant::now();
    let bytes = std::fs::read(format!("{path}/graph.bin"))?;
    let manifest = std::fs::read_to_string(format!("{path}/manifest.json"))?;
    let graph = Arc::new(Graph::from_bytes(&bytes, &manifest)?);
    let construct_seconds = load.elapsed().as_secs_f64();
    let n = graph.neuron_count();

    let mut brain = Brain::new(graph.clone(), Brain::seed_for_fly(20260908, 7));
    // Silence a deterministic scattered subset so the silencing path is on the traced route.
    let silenced: Vec<u32> = (0..n as u32).filter(|i| i % 997 == 3).collect();
    brain.set_silenced_neurons(&silenced)?;

    let mut t = Trace(Sha256::new());
    let mut spike_total: u64 = 0;
    let start = Instant::now();
    for tick in 0..ticks {
        // Time-varying external drive on a rotating slice keeps currents non-trivial.
        let currents: Vec<(u32, f64)> = (0..64u32)
            .map(|k| {
                let i = (tick.wrapping_mul(31).wrapping_add(k * 811)) % n as u32;
                (i, 0.3 * ((tick as f64 * 0.017 + k as f64).sin()))
            })
            .collect();
        brain.set_external_current(&currents)?;
        let out = brain.step();
        let d = brain.diagnostics();
        t.f(&d.synaptic_input);
        t.f(&d.dv);
        t.b(&d.can_spike);
        t.f(brain.voltage());
        t.b(brain.spikes());
        t.u(brain.refractory());
        t.f(&[
            out.motor.thrust,
            out.motor.turn,
            out.motor.flight_thrust,
            out.motor.flight_turn,
        ]);
        for g in &out.groups {
            t.f(&[g.mean_voltage, g.spike_fraction]);
        }
        t.u(&[out.spike_count]);
        spike_total += u64::from(out.spike_count);
    }
    let seconds = start.elapsed().as_secs_f64();
    println!(
        "{}",
        serde_json::json!({
            "graphHash": graph.manifest.graph_hash,
            "neurons": n,
            "edges": graph.edge_count(),
            "ticks": ticks,
            "traceHash": format!("{:x}", t.0.finalize()),
            "graphConstructSecondsIncludingIo": construct_seconds,
            "graphArrayBytes": graph.storage_bytes(),
            "brainArrayBytes": brain.state_storage_bytes(),
            "stepSeconds": seconds,
            "ticksPerSecond": f64::from(ticks) / seconds,
            "meanSpikeFraction": spike_total as f64 / (f64::from(ticks) * n as f64),
        })
    );
    Ok(())
}
