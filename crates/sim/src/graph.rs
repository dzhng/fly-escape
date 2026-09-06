use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use ts_rs::TS;

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
    #[serde(flatten)]
    pub provenance: HashMap<String, serde_json::Value>,
}
pub struct Graph {
    pub manifest: Manifest,
    pub(crate) rows: Vec<u32>,
    pub(crate) columns: Vec<u32>,
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
        let weights: Vec<_> = (0..e)
            .map(|i| {
                f64::from_le_bytes(bytes[start + i * 8..start + i * 8 + 8].try_into().unwrap())
            })
            .collect();
        if weights.iter().any(|w| !w.is_finite()) {
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
        Ok(Self {
            manifest,
            rows,
            columns,
            weights,
            body_lookup,
        })
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
        self.rows.len() * 4 + self.columns.len() * 4 + self.weights.len() * 8
    }
}
