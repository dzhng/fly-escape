use crate::Graph;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::Arc};
use ts_rs::TS;

pub const PRNG_ID: &str = "splitmix64-box-muller-v1";
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct LifParams {
    pub tau: f64,
    pub threshold: f64,
    pub reset: f64,
    pub dt: f64,
    pub refractory: u32,
    pub noise_std: f64,
    pub input_scale: f64,
    pub baseline_drive: f64,
}
impl Default for LifParams {
    fn default() -> Self {
        Self {
            tau: 20.0,
            threshold: 1.0,
            reset: 0.0,
            dt: 1.0,
            refractory: 2,
            noise_std: 0.015,
            input_scale: 0.0002,
            baseline_drive: 0.05,
        }
    }
}
#[derive(Clone, Debug, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MotorOutput {
    pub thrust: f64,
    pub turn: f64,
    pub flight_thrust: f64,
    pub flight_turn: f64,
}
#[derive(Clone, Debug, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GroupActivity {
    pub id: String,
    pub mean_voltage: f64,
    pub spike_fraction: f64,
}
#[derive(Clone, Debug, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StepOutput {
    pub motor: MotorOutput,
    pub groups: Vec<GroupActivity>,
    pub spike_count: u32,
}
#[derive(Clone, Debug, Deserialize)]
pub struct NeuralState {
    pub voltage: Vec<f64>,
    pub spikes: Vec<bool>,
    pub refractory: Vec<u32>,
}
/// Last tick intermediates, reused in place; never retained as neuron history.
pub struct Diagnostics {
    pub synaptic_input: Vec<f64>,
    pub dv: Vec<f64>,
    pub can_spike: Vec<bool>,
}
struct Rng(u64);
impl Rng {
    fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9e3779b97f4a7c15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xbf58476d1ce4e5b9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94d049bb133111eb);
        z ^ (z >> 31)
    }
    fn uniform(&mut self) -> f64 {
        ((self.next() >> 11) as f64 + 0.5) / 9007199254740992.0
    }
}
pub struct Brain {
    graph: Arc<Graph>,
    params: LifParams,
    state: NeuralState,
    external: Vec<f64>,
    noise: Vec<f64>,
    rng: Rng,
    diagnostics: Diagnostics,
}
impl Brain {
    pub fn new(graph: Arc<Graph>, seed: u64) -> Self {
        let n = graph.neuron_count();
        Self {
            graph,
            params: LifParams::default(),
            state: NeuralState {
                voltage: vec![0.0; n],
                spikes: vec![false; n],
                refractory: vec![0; n],
            },
            external: vec![0.0; n],
            noise: vec![0.0; n],
            rng: Rng(seed),
            diagnostics: Diagnostics {
                synaptic_input: vec![0.0; n],
                dv: vec![0.0; n],
                can_spike: vec![true; n],
            },
        }
    }
    pub fn seed_for_fly(root: u64, fly_id: u32) -> u64 {
        let mut rng = Rng(root.wrapping_add((fly_id as u64).wrapping_mul(0x9e3779b97f4a7c15)));
        rng.next()
    }
    pub fn set_params(&mut self, p: LifParams) -> Result<(), String> {
        if [
            p.tau,
            p.threshold,
            p.reset,
            p.dt,
            p.noise_std,
            p.input_scale,
            p.baseline_drive,
        ]
        .iter()
        .any(|v| !v.is_finite())
            || p.tau <= 0.0
            || p.dt <= 0.0
            || p.noise_std < 0.0
        {
            return Err("Invalid LIF parameters".into());
        }
        self.params = p;
        Ok(())
    }
    pub fn set_state(&mut self, state: NeuralState) -> Result<(), String> {
        let n = self.graph.neuron_count();
        if state.voltage.len() != n
            || state.spikes.len() != n
            || state.refractory.len() != n
            || state.voltage.iter().any(|v| !v.is_finite())
        {
            return Err("Invalid neural state".into());
        }
        self.state = state;
        Ok(())
    }
    pub fn voltage(&self) -> &[f64] {
        &self.state.voltage
    }
    pub fn spikes(&self) -> &[bool] {
        &self.state.spikes
    }
    pub fn refractory(&self) -> &[u32] {
        &self.state.refractory
    }
    pub fn diagnostics(&self) -> &Diagnostics {
        &self.diagnostics
    }
    pub fn external_current(&self) -> &[f64] {
        &self.external
    }
    pub fn set_external_current(&mut self, currents: &[(u32, f64)]) -> Result<(), String> {
        if currents
            .iter()
            .any(|&(i, v)| i as usize >= self.external.len() || !v.is_finite())
        {
            return Err("Invalid external current".into());
        }
        self.external.fill(0.0);
        for &(i, v) in currents {
            self.external[i as usize] = v;
        }
        Ok(())
    }
    pub fn set_external_by_body(&mut self, currents: &HashMap<String, f64>) -> Result<(), String> {
        if currents.values().any(|v| !v.is_finite()) {
            return Err("Invalid external current".into());
        }
        self.external.fill(0.0);
        for (id, &v) in currents {
            if let Some(&i) = self.graph.body_lookup.get(id) {
                self.external[i as usize] = v;
            }
        }
        Ok(())
    }
    pub fn step(&mut self) -> StepOutput {
        for pair in self.noise.chunks_mut(2) {
            let r = (-2.0 * self.rng.uniform().ln()).sqrt() * self.params.noise_std;
            let theta = std::f64::consts::TAU * self.rng.uniform();
            pair[0] = r * theta.cos();
            if pair.len() == 2 {
                pair[1] = r * theta.sin();
            }
        }
        self.advance()
    }
    /// Samples are already scaled additive noise, matching the Python fixture.
    pub fn step_with_noise(&mut self, noise: &[f64]) -> Result<StepOutput, String> {
        if noise.len() != self.noise.len() || noise.iter().any(|v| !v.is_finite()) {
            return Err("Invalid injected noise".into());
        }
        self.noise.copy_from_slice(noise);
        Ok(self.advance())
    }
    fn advance(&mut self) -> StepOutput {
        let p = &self.params;
        // Complete incoming currents before changing any previous-tick spikes.
        for (i, rows) in self.graph.rows.windows(2).enumerate() {
            let mut input = 0.0;
            for j in rows[0] as usize..rows[1] as usize {
                if self.state.spikes[self.graph.columns[j] as usize] {
                    input += self.graph.weights[j];
                }
            }
            self.diagnostics.synaptic_input[i] = input * p.input_scale;
        }
        for i in 0..self.state.voltage.len() {
            let can = self.state.refractory[i] == 0;
            let dv = (-self.state.voltage[i] / p.tau
                + self.diagnostics.synaptic_input[i]
                + self.external[i]
                + self.noise[i]
                + p.baseline_drive)
                * p.dt;
            self.diagnostics.dv[i] = dv;
            self.diagnostics.can_spike[i] = can;
            self.state.voltage[i] += dv * f64::from(can);
            let spike = self.state.voltage[i] > p.threshold && can;
            self.state.spikes[i] = spike;
            if spike {
                self.state.voltage[i] = p.reset;
                self.state.refractory[i] = p.refractory;
            }
            self.state.refractory[i] = self.state.refractory[i].saturating_sub(1);
            self.state.voltage[i] = self.state.voltage[i].clamp(-2.0, 2.0);
        }
        StepOutput {
            motor: self.motor_output(),
            groups: self
                .graph
                .manifest
                .groups
                .iter()
                .map(|g| GroupActivity {
                    id: g.id.clone(),
                    mean_voltage: self.mean(&g.indices),
                    spike_fraction: if g.indices.is_empty() {
                        0.0
                    } else {
                        g.indices
                            .iter()
                            .filter(|&&i| self.state.spikes[i as usize])
                            .count() as f64
                            / g.indices.len() as f64
                    },
                })
                .collect(),
            spike_count: self.state.spikes.iter().filter(|&&v| v).count() as u32,
        }
    }
    fn mean(&self, ids: &[u32]) -> f64 {
        if ids.is_empty() {
            0.0
        } else {
            ids.iter()
                .map(|&i| self.state.voltage[i as usize])
                .sum::<f64>()
                / ids.len() as f64
        }
    }
    pub fn motor_output(&self) -> MotorOutput {
        let m = &self.graph.manifest.motor;
        let (dl, dr, ml, mr) = (
            self.mean(&m.dn_left),
            self.mean(&m.dn_right),
            self.mean(&m.mn_left),
            self.mean(&m.mn_right),
        );
        let ol = self.graph.pathway("OLFACTORY_DN_LEFT");
        let or = self.graph.pathway("OLFACTORY_DN_RIGHT");
        let has_olf = !ol.is_empty() && !or.is_empty();
        let olf = if has_olf {
            self.mean(or) - self.mean(ol)
        } else {
            0.0
        };
        let (thrust, turn) = if m.dn_left.is_empty() && m.mn_left.is_empty() {
            (0.0, 0.0)
        } else {
            (
                (dl + dr + ml + mr) / 4.0,
                if has_olf {
                    olf
                } else {
                    ((dr + mr) - (dl + ml)) / 4.0
                },
            )
        };
        let fl = self.graph.pathway("FLIGHT_DN_LEFT");
        let fr = self.graph.pathway("FLIGHT_DN_RIGHT");
        let (flight, steer) = if !fl.is_empty() && !fr.is_empty() {
            (
                (self.mean(fl) + self.mean(fr)) / 2.0,
                self.mean(fr) - self.mean(fl),
            )
        } else {
            (0.0, 0.0)
        };
        MotorOutput {
            thrust,
            turn,
            flight_thrust: flight * 1.5 + (dl + dr) / 2.0 * 0.5,
            flight_turn: steer * 0.5 + olf,
        }
    }
    pub fn state_storage_bytes(&self) -> usize {
        self.state.voltage.len() * (8 * 5 + 4 + 2)
    }
}
