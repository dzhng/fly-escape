//! Load-time validation of the offline spatial and color assignment.
use crate::{sensory::motor_readout_indices, vision::EyeProfile, Graph};
use serde::Deserialize;
use serde_json::{value::RawValue, Value};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashSet};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Identities {
    graph_hash: String,
    annotation_hash: String,
    profile_hash: String,
    layout_hash: String,
    rig_hash: String,
    color_model_hash: String,
    baseline_map_hash: String,
}

#[derive(Clone, Copy, Deserialize)]
pub(crate) enum Eye {
    L,
    R,
}
impl Eye {
    pub(crate) fn index(self) -> usize {
        match self {
            Self::L => 0,
            Self::R => 1,
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RetinalNeuron {
    pub index: u32,
    body_id: String,
    pub eye: Eye,
    pub channel: usize,
    pub taps: Vec<(usize, f64)>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Budget {
    baseline_weight_sum: f64,
    family_fractions: BTreeMap<String, f64>,
    global_scale: f64,
    total_weight: f64,
    maximum_row_sum: f64,
}

#[derive(Deserialize)]
struct MapFile<'a> {
    version: u32,
    identities: Identities,
    #[serde(borrow)]
    profile: &'a RawValue,
    #[serde(borrow, rename = "colorModel")]
    color_model: &'a RawValue,
    entries: Vec<RetinalNeuron>,
    support: BTreeMap<String, BTreeMap<String, Vec<bool>>>,
    budget: Budget,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Profile<'a> {
    capture: Capture,
    eye_order: [String; 2],
    rgb_order: [String; 3],
    rig_sha256: String,
    #[serde(borrow)]
    layout: &'a RawValue,
}
#[derive(Deserialize)]
struct Capture {
    width: u32,
    height: u32,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ColorModel {
    version: u32,
    graph_hash: String,
    annotation_hash: String,
    families: [String; 2],
    rgb_coefficients: [[f64; 3]; 2],
    transfer: String,
    baseline: f64,
    dose: ColorDose,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ColorDose {
    gain_maximum: f64,
}

/// Immutable after validation; no per-tick map parsing or graph lookup.
pub struct RetinalMap {
    pub(crate) sample_count: usize,
    pub(crate) entries: Vec<RetinalNeuron>,
    pub(crate) coefficients: [[f64; 3]; 2],
}

impl RetinalMap {
    pub fn from_json(graph: &Graph, profile: &EyeProfile, json: &str) -> Result<Self, String> {
        profile.validate()?;
        let file: MapFile<'_> =
            serde_json::from_str(json).map_err(|e| format!("invalid retinal map: {e}"))?;
        let optical: Profile<'_> = serde_json::from_str(file.profile.get())
            .map_err(|e| format!("invalid retinal optical profile: {e}"))?;
        let color: ColorModel = serde_json::from_str(file.color_model.get())
            .map_err(|e| format!("invalid retinal color model: {e}"))?;
        let annotation_hash = graph
            .manifest
            .provenance
            .get("sources")
            .and_then(Value::as_array)
            .and_then(|sources| {
                sources
                    .iter()
                    .find(|source| source["file"] == "body-annotations.feather")
            })
            .and_then(|source| source["sha256"].as_str());
        let ids = &file.identities;
        if file.version != 1
            || ids.graph_hash != graph.manifest.graph_hash
            || annotation_hash != Some(ids.annotation_hash.as_str())
            || ids.profile_hash != profile.profile_hash
            || ids.layout_hash != profile.layout_hash
            || ids.rig_hash != profile.rig_hash
            || ids.color_model_hash != profile.color_model_hash
            || raw_hash(file.profile) != ids.profile_hash
            || raw_hash(optical.layout) != ids.layout_hash
            || raw_hash(file.color_model) != ids.color_model_hash
            || optical.rig_sha256 != ids.rig_hash
            || optical.capture.width != profile.width
            || optical.capture.height != profile.height
            || optical.eye_order != ["L", "R"]
            || optical.rgb_order != ["R", "G", "B"]
        {
            return Err("retinal map identity does not match the graph and optical profile".into());
        }
        let layout: Value = serde_json::from_str(optical.layout.get())
            .map_err(|e| format!("invalid retinal layout: {e}"))?;
        if layout["cells"].as_array().map(Vec::len) != Some(profile.sample_count as usize) {
            return Err("retinal layout sample count mismatch".into());
        }
        if color.version != 1
            || color.graph_hash != ids.graph_hash
            || color.annotation_hash != ids.annotation_hash
            || color.families != ["Tm2", "Tm20"]
            || color.rgb_coefficients != [[0.2126, 0.7152, 0.0722], [0., 0., 1.]]
            || color.transfer != "q/(q+0.5)"
            || color.baseline != 0.
            || color.dose.gain_maximum != 3.
        {
            return Err("retinal color model differs from the frozen visible-RGB response".into());
        }
        let baseline = graph
            .manifest
            .retinal_budget
            .as_ref()
            .ok_or("retinal map requires a trusted aggregate visual budget")?;
        if baseline.source_graph_hash != ids.graph_hash
            || baseline.annotation_hash != ids.annotation_hash
            || baseline.source_map_hash != ids.baseline_map_hash
            || baseline.source_map_hash.len() != 64
            || !baseline
                .source_map_hash
                .bytes()
                .all(|b| b.is_ascii_hexdigit())
            || !baseline.weight_sum.is_finite()
            || baseline.weight_sum <= 0.
        {
            return Err("retinal source budget identity mismatch".into());
        }
        let baseline_total = baseline.weight_sum;
        let budget = &file.budget;
        if !near(budget.baseline_weight_sum, baseline_total)
            || !budget.global_scale.is_finite()
            || !(0. ..=1.).contains(&budget.global_scale)
            || budget.global_scale == 0.
            || budget.family_fractions.len() != 2
            || budget.family_fractions.get("Tm2") != Some(&0.5)
            || budget.family_fractions.get("Tm20") != Some(&0.5)
        {
            return Err(
                "retinal map must share the baseline current budget between both families".into(),
            );
        }
        let samples = profile.sample_count as usize;
        let mut columns = vec![vec![0.; samples * 2]; 2];
        let mut seen = HashSet::new();
        let motors = motor_readout_indices(graph);
        let mut maximum_row = 0f64;
        if file.entries.is_empty() || file.entries.len() > graph.neuron_count() {
            return Err("retinal map has no targets or exceeds the graph".into());
        }
        for entry in &file.entries {
            if entry.index as usize >= graph.neuron_count()
                || graph.manifest.body_ids.get(entry.index as usize) != Some(&entry.body_id)
                || motors.contains(&entry.index)
                || !seen.insert(entry.index)
                || entry.channel > 1
                || entry.taps.is_empty()
                || entry.taps.len() > 3
            {
                return Err(
                    "retinal target must be unique, source-bound, nonmotor and locally sampled"
                        .into(),
                );
            }
            let mut taps = HashSet::new();
            let mut row = 0.;
            for &(sample, weight) in &entry.taps {
                if sample >= samples || !weight.is_finite() || weight <= 0. || !taps.insert(sample)
                {
                    return Err(
                        "retinal spatial taps must be distinct, positive and inside one eye".into(),
                    );
                }
                row += weight;
                columns[entry.channel][entry.eye.index() * samples + sample] += weight;
            }
            if row > 1. + 1e-9 {
                return Err("retinal neuron exceeds the shared gain budget".into());
            }
            maximum_row = maximum_row.max(row);
        }
        let family_budget = baseline_total * 0.5 * budget.global_scale;
        if file.support.len() != 2 {
            return Err("retinal support must describe exactly the two modeled families".into());
        }
        for (channel, family) in ["Tm2", "Tm20"].iter().enumerate() {
            let support = file
                .support
                .get(*family)
                .ok_or("missing retinal family support")?;
            if support.len() != 2 {
                return Err("retinal support requires both eyes".into());
            }
            let supported = columns[channel]
                .iter()
                .filter(|&&weight| weight > 0.)
                .count();
            if supported == 0 || !near(columns[channel].iter().sum(), family_budget) {
                return Err("retinal family allocation differs from the combined budget".into());
            }
            let column_budget = family_budget / supported as f64;
            for (eye, name) in ["L", "R"].iter().enumerate() {
                let mask = support.get(*name).ok_or("missing retinal eye support")?;
                if mask.len() != samples {
                    return Err("retinal support shape mismatch".into());
                }
                for (sample, &present) in mask.iter().enumerate() {
                    let weight = columns[channel][eye * samples + sample];
                    if present != (weight > 0.) || (present && !near(weight, column_budget)) {
                        return Err(
                            "retinal support and equal-area spatial weights disagree".into()
                        );
                    }
                }
            }
        }
        let total: f64 = columns.iter().flatten().sum();
        if !near(budget.total_weight, total)
            || total > baseline_total + 1e-9
            || !near(budget.maximum_row_sum, maximum_row)
        {
            return Err("retinal combined current budget mismatch".into());
        }
        Ok(Self {
            sample_count: samples,
            entries: file.entries,
            coefficients: color.rgb_coefficients,
        })
    }
}

fn raw_hash(value: &RawValue) -> String {
    hash_bytes(value.get())
}
fn hash_bytes(value: &str) -> String {
    let mut hash = Sha256::new();
    hash.update(value.as_bytes());
    hash.update(b"\n");
    format!("{:x}", hash.finalize())
}
fn near(a: f64, b: f64) -> bool {
    a.is_finite() && b.is_finite() && (a - b).abs() <= 1e-9 * b.abs().max(1.)
}
