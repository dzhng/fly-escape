use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use ts_rs::TS;

mod retinal;
pub use retinal::RetinalMap;

#[derive(Clone, Debug, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Group {
    pub id: String,
    pub label: String,
    pub indices: Vec<u32>,
}
#[derive(Clone, Debug, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GroupLink {
    pub source: String,
    pub target: String,
    pub edge_count: u32,
    pub positive_weight: f64,
    pub negative_weight: f64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MotorGroups {
    #[serde(rename = "dnL")]
    pub dn_left: Vec<u32>,
    #[serde(rename = "dnR")]
    pub dn_right: Vec<u32>,
    #[serde(rename = "mnL")]
    pub mn_left: Vec<u32>,
    #[serde(rename = "mnR")]
    pub mn_right: Vec<u32>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Pathway {
    Indices(Vec<u32>),
    Bilateral(HashMap<String, Vec<u32>>),
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VisionNeuron {
    pub index: u32,
    pub weights: [f64; 8],
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VisionInput {
    pub graph_hash: String,
    pub annotation_hash: String,
    pub family: String,
    pub registration: String,
    pub entries: Vec<VisionNeuron>,
}
/// Frozen aggregate dose, bound to the graph and archived source-map identity.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RetinalBudget {
    pub source_graph_hash: String,
    pub annotation_hash: String,
    pub source_map_hash: String,
    pub weight_sum: f64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Manifest {
    pub schema_version: u32,
    pub neuron_count: u32,
    pub edge_count: u32,
    pub graph_hash: String,
    pub body_ids: Vec<String>,
    pub motor: MotorGroups,
    pub pathways: HashMap<String, Pathway>,
    pub groups: Vec<Group>,
    pub group_links: Vec<GroupLink>,
    pub pathway_provenance: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vision_input: Option<VisionInput>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub retinal_budget: Option<RetinalBudget>,
    #[serde(flatten)]
    pub provenance: HashMap<String, serde_json::Value>,
}
pub struct Graph {
    pub manifest: Manifest,
    /// Outgoing adjacency in CSR by presynaptic source: `source_offsets[s]..source_offsets[s + 1]`
    /// indexes `targets` and `weights` for the edges neuron `s` drives. The file stores incoming
    /// rows; loading validates those and then transposes once, so a tick can skip whole sources
    /// that did not spike. Targets stay ascending inside a source, so visiting sources ascending
    /// reaches each target in the same ascending-source order its incoming row had.
    pub(crate) source_offsets: Vec<u32>,
    pub(crate) targets: Vec<u32>,
    pub(crate) weights: Vec<f64>,
    pub(crate) body_lookup: HashMap<String, u32>,
}
impl Graph {
    pub fn from_bytes(bytes: &[u8], manifest_json: &str) -> Result<Self, String> {
        let manifest: Manifest = serde_json::from_str(manifest_json)
            .map_err(|e| format!("Invalid graph manifest: {e}"))?;
        if bytes.len() < 20 || &bytes[..8] != b"FLYGRAPH" {
            return Err("Invalid graph header".into());
        }
        let word = |at: usize| u32::from_le_bytes(bytes[at..at + 4].try_into().unwrap());
        let (version, n, e) = (word(8), word(12) as usize, word(16) as usize);
        if version != 1 || manifest.schema_version != 1 {
            return Err("Unsupported graph version".into());
        }
        let expected = 20u64 + (n as u64 + 1) * 4 + e as u64 * 12;
        if expected != bytes.len() as u64 || n == 0 {
            return Err("Invalid graph length or empty graph".into());
        }
        if manifest.neuron_count as usize != n
            || manifest.edge_count as usize != e
            || manifest.body_ids.len() != n
        {
            return Err("Graph and manifest dimensions disagree".into());
        }
        if format!("{:x}", Sha256::digest(bytes)) != manifest.graph_hash {
            return Err("Graph SHA-256 mismatch".into());
        }
        let rows: Vec<_> = (0..=n).map(|i| word(20 + i * 4)).collect();
        if rows[0] != 0 || rows[n] as usize != e || rows.windows(2).any(|p| p[0] > p[1]) {
            return Err("Invalid CSR row offsets".into());
        }
        let columns: Vec<_> = (0..e).map(|i| word(20 + (n + 1 + i) * 4)).collect();
        if columns.iter().any(|&i| i as usize >= n) {
            return Err("Presynaptic index out of bounds".into());
        }
        let start = 20 + (n + 1 + e) * 4;
        // Weights are read straight from the file into their transposed slot below, so the
        // incoming order never occupies a second array of its own.
        let weight = |at: usize| {
            f64::from_le_bytes(
                bytes[start + at * 8..start + at * 8 + 8]
                    .try_into()
                    .unwrap(),
            )
        };
        if (0..e).any(|i| !weight(i).is_finite()) {
            return Err("Nonfinite graph weight".into());
        }
        for row in rows.windows(2) {
            if columns[row[0] as usize..row[1] as usize]
                .windows(2)
                .any(|p| p[0] >= p[1])
            {
                return Err("CSR columns must be sorted and unique".into());
            }
        }
        let mut body_lookup = HashMap::new();
        for (i, id) in manifest.body_ids.iter().enumerate() {
            if id.is_empty()
                || !id.bytes().all(|c| c.is_ascii_digit())
                || (id.len() > 1 && id.starts_with('0'))
                || body_lookup.insert(id.clone(), i as u32).is_some()
            {
                return Err("Invalid or duplicate body ID".into());
            }
        }
        let valid_indices = |indices: &[u32]| -> Result<(), String> {
            let mut seen = HashSet::new();
            if indices.iter().any(|&i| i as usize >= n || !seen.insert(i)) {
                Err("Invalid or duplicate group index".into())
            } else {
                Ok(())
            }
        };
        let m = &manifest.motor;
        for indices in [&m.dn_left, &m.dn_right, &m.mn_left, &m.mn_right] {
            valid_indices(indices)?;
        }
        for pathway in manifest.pathways.values() {
            match pathway {
                Pathway::Indices(ids) => valid_indices(ids)?,
                Pathway::Bilateral(sides) => {
                    for ids in sides.values() {
                        valid_indices(ids)?
                    }
                }
            }
        }
        let mut groups = HashSet::new();
        if manifest.groups.len() > 16 {
            return Err("At most 16 activity groups are supported".into());
        }
        for g in &manifest.groups {
            valid_indices(&g.indices)?;
            if g.id.is_empty() || !groups.insert(g.id.as_str()) {
                return Err("Invalid or duplicate activity group ID".into());
            }
        }
        for link in &manifest.group_links {
            if !groups.contains(link.source.as_str())
                || !groups.contains(link.target.as_str())
                || !link.positive_weight.is_finite()
                || !link.negative_weight.is_finite()
                || link.positive_weight < 0.0
                || link.negative_weight < 0.0
            {
                return Err("Invalid group connectivity".into());
            }
        }
        // Transpose the validated incoming rows once, so a tick can skip non-spiking sources.
        let mut source_offsets = vec![0u32; n + 1];
        for &source in &columns {
            source_offsets[source as usize + 1] += 1;
        }
        for i in 0..n {
            source_offsets[i + 1] += source_offsets[i];
        }
        let mut cursor = source_offsets[..n].to_vec();
        let (mut targets, mut weights) = (vec![0u32; e], vec![0.0; e]);
        for (target, row) in rows.windows(2).enumerate() {
            for j in row[0] as usize..row[1] as usize {
                let slot = &mut cursor[columns[j] as usize];
                targets[*slot as usize] = target as u32;
                weights[*slot as usize] = weight(j);
                *slot += 1;
            }
        }
        let graph = Self {
            manifest,
            source_offsets,
            targets,
            weights,
            body_lookup,
        };
        if let Some(map) = &graph.manifest.vision_input {
            let annotation_source = graph
                .manifest
                .provenance
                .get("sources")
                .and_then(|sources| sources.as_array())
                .and_then(|sources| {
                    sources
                        .iter()
                        .find(|source| source["file"] == "body-annotations.feather")
                })
                .and_then(|source| source["sha256"].as_str());
            if map.graph_hash != graph.manifest.graph_hash
                || map.annotation_hash.len() != 64
                || !map.annotation_hash.bytes().all(|b| b.is_ascii_hexdigit())
                || annotation_source != Some(map.annotation_hash.as_str())
                || map.family.trim().is_empty()
                || map.registration.trim().is_empty()
            {
                return Err("Visual input provenance does not match graph annotations".into());
            }
            let readouts = crate::sensory::motor_readout_indices(&graph);
            let mut used = HashSet::new();
            let mut columns = [0.; 8];
            for entry in &map.entries {
                if entry.index as usize >= n
                    || readouts.contains(&entry.index)
                    || !used.insert(entry.index)
                    || entry.weights.iter().any(|w| !w.is_finite() || *w < 0.)
                    || entry.weights.iter().sum::<f64>() > 1. + 1e-12
                    || !entry.weights.iter().any(|w| *w > 0.)
                {
                    return Err("Visual input requires unique non-motor cells with bounded nonnegative receptive fields".into());
                }
                for (sum, weight) in columns.iter_mut().zip(entry.weights) {
                    *sum += weight;
                }
            }
            if columns.iter().any(|sum| {
                *sum <= 0. || !sum.is_finite() || (sum - columns[0]).abs() > 1e-10 * columns[0]
            }) {
                return Err(
                    "Visual input must cover all eight directions with equal total weight".into(),
                );
            }
        }
        Ok(graph)
    }
    pub fn neuron_count(&self) -> usize {
        self.manifest.neuron_count as usize
    }
    pub fn edge_count(&self) -> usize {
        self.weights.len()
    }
    pub fn pathway(&self, name: &str) -> &[u32] {
        match self.manifest.pathways.get(name) {
            Some(Pathway::Indices(v)) => v,
            _ => &[],
        }
    }
    pub fn storage_bytes(&self) -> usize {
        self.source_offsets.len() * 4 + self.targets.len() * 4 + self.weights.len() * 8
    }
}
