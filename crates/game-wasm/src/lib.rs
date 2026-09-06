mod attempt_session;
pub use attempt_session::*;
use sim::{chamber::Chamber, Graph};
use std::sync::Arc;
use wasm_bindgen::prelude::*;

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
