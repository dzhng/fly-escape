mod attempt_session;
pub use attempt_session::*;
use sim::{chamber::Chamber, Graph};
use std::sync::Arc;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console, js_name = error)]
    fn report_panic(message: &str);
}

#[wasm_bindgen(start)]
pub fn install_panic_diagnostics() {
    std::panic::set_hook(Box::new(|info| report_panic(&info.to_string())));
}

#[wasm_bindgen]
pub struct BrainSession {
    chamber: Chamber,
}

#[wasm_bindgen]
impl BrainSession {
    #[wasm_bindgen(constructor)]
    pub fn new(bytes: &[u8], manifest: &str, seed: u32) -> Result<BrainSession, JsValue> {
        let graph = verified_graph(bytes, manifest)?;
        Ok(Self {
            chamber: Chamber::new(Arc::new(graph), seed as u64)
                .map_err(|e| JsValue::from_str(&e))?,
        })
    }

    pub fn info(&self) -> Result<String, JsValue> {
        serde_json::to_string(&self.chamber.info()).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    pub fn inject(&mut self, left: f64, right: f64) -> Result<(), JsValue> {
        self.chamber
            .inject_odor(left, right)
            .map_err(|e| JsValue::from_str(&e))
    }

    pub fn step(&mut self) -> Result<String, JsValue> {
        serde_json::to_string(&self.chamber.step().map_err(|e| JsValue::from_str(&e))?)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
}

fn verified_graph(bytes: &[u8], manifest: &str) -> Result<Graph, JsValue> {
    let graph = Graph::from_bytes(bytes, manifest).map_err(|e| JsValue::from_str(&e))?;
    for id in ["odorExcL", "odorExcR"] {
        if !graph
            .manifest
            .groups
            .iter()
            .any(|group| group.id == id && !group.indices.is_empty())
        {
            return Err(JsValue::from_str(&format!(
                "Missing required chamber group: {id}"
            )));
        }
    }
    if graph.manifest.provenance.get("synthetic") != Some(&serde_json::Value::Bool(false)) {
        return Err(JsValue::from_str(
            "The brain chamber requires a verified real-data artifact",
        ));
    }
    Ok(graph)
}

#[wasm_bindgen]
pub struct FieldSession {
    lab: sim::field_lab::FieldLab,
}
#[wasm_bindgen]
impl FieldSession {
    #[wasm_bindgen(constructor)]
    pub fn new(
        bytes: &[u8],
        manifest: &str,
        seed: u32,
        scenario: &str,
    ) -> Result<FieldSession, JsValue> {
        let graph = verified_graph(bytes, manifest)?;
        let scenario = serde_json::from_str(scenario)
            .map_err(|e| JsValue::from_str(&format!("Invalid field scenario: {e}")))?;
        Ok(Self {
            lab: sim::field_lab::FieldLab::new(Arc::new(graph), seed as u64, scenario)
                .map_err(|e| JsValue::from_str(&e))?,
        })
    }
    pub fn info(&self) -> Result<String, JsValue> {
        serde_json::to_string(&self.lab.info()).map_err(|e| JsValue::from_str(&e.to_string()))
    }
    pub fn step(&mut self) -> Result<String, JsValue> {
        serde_json::to_string(&self.lab.step().map_err(|e| JsValue::from_str(&e))?)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
}

#[wasm_bindgen]
pub struct LifecycleSession {
    lab: sim::lifecycle_lab::LifecycleLab,
}
#[wasm_bindgen]
impl LifecycleSession {
    #[wasm_bindgen(constructor)]
    pub fn new(bytes: &[u8], manifest: &str, seed: u32, scenario: &str) -> Result<Self, JsValue> {
        let graph = verified_graph(bytes, manifest)?;
        let scenario = serde_json::from_str(scenario)
            .map_err(|e| JsValue::from_str(&format!("Invalid lifecycle scenario: {e}")))?;
        Ok(Self {
            lab: sim::lifecycle_lab::LifecycleLab::new(Arc::new(graph), seed as u64, scenario)
                .map_err(|e| JsValue::from_str(&e))?,
        })
    }
    pub fn info(&self) -> Result<String, JsValue> {
        serde_json::to_string(&self.lab.info()).map_err(|e| JsValue::from_str(&e.to_string()))
    }
    pub fn step(&mut self) -> Result<String, JsValue> {
        serde_json::to_string(&self.lab.step().map_err(|e| JsValue::from_str(&e))?)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
}

#[wasm_bindgen]
pub fn tool_catalog() -> Result<String, JsValue> {
    serde_json::to_string(&sim::placement::tool_catalog())
        .map_err(|e| JsValue::from_str(&e.to_string()))
}

#[wasm_bindgen]
pub fn resolve_setup(level: &str, placements: &str) -> Result<String, JsValue> {
    let level = serde_json::from_str(level)
        .map_err(|e| JsValue::from_str(&format!("invalid level: {e}")))?;
    let placements: Vec<sim::placement::Placement> = serde_json::from_str(placements)
        .map_err(|e| JsValue::from_str(&format!("invalid placements: {e}")))?;
    let resolved = sim::placement::resolve_placements(&level, &placements)
        .map_err(|e| JsValue::from_str(&e))?;
    serde_json::to_string(&resolved).map_err(|e| JsValue::from_str(&e.to_string()))
}

#[wasm_bindgen]
pub fn edit_setup(level: &str, current: &str, edit: &str) -> Result<String, JsValue> {
    let level = serde_json::from_str(level)
        .map_err(|e| JsValue::from_str(&format!("invalid level: {e}")))?;
    let current: Vec<sim::placement::Placement> = serde_json::from_str(current)
        .map_err(|e| JsValue::from_str(&format!("invalid placements: {e}")))?;
    let edit = serde_json::from_str(edit)
        .map_err(|e| JsValue::from_str(&format!("invalid placement edit: {e}")))?;
    let state = sim::placement::edit_placements(&level, &current, edit)
        .map_err(|e| JsValue::from_str(&e))?;
    serde_json::to_string(&state).map_err(|e| JsValue::from_str(&e.to_string()))
}

#[wasm_bindgen]
pub fn setup_fixture() -> Result<String, JsValue> {
    serde_json::to_string(&sim::setup_fixture::fixture().map_err(|e| JsValue::from_str(&e))?)
        .map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Diagnostic geometry query; no neural or attempt state runs on this path.
#[wasm_bindgen]
pub fn house_probe(progress: f64, detour: bool) -> Result<String, JsValue> {
    let probe = sim::house_lab::probe(progress, detour).map_err(|e| JsValue::from_str(&e))?;
    serde_json::to_string(&probe).map_err(|e| JsValue::from_str(&e.to_string()))
}

#[wasm_bindgen]
pub fn sample_motion(
    values: &[f64],
    states: &[u32],
    offsets: &[u32],
    fraction: f64,
) -> Result<Box<[f64]>, JsValue> {
    sim::record::sample_motion(values, states, offsets, fraction)
        .map(Vec::into_boxed_slice)
        .map_err(|e| JsValue::from_str(&e))
}
