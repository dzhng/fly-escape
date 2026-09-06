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
        let graph = Graph::from_bytes(bytes, manifest).map_err(|e| JsValue::from_str(&e))?;
        for id in ["smellL", "smellR"] {
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
        Ok(Self {
            chamber: Chamber::new(Arc::new(graph), seed as u64),
        })
    }

    pub fn info(&self) -> Result<String, JsValue> {
        serde_json::to_string(&self.chamber.info()).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    pub fn inject(&mut self, indices: &[u32], values: &[f64]) -> Result<(), JsValue> {
        if indices.len() != values.len() {
            return Err(JsValue::from_str("Injection indices and values must match"));
        }
        let currents: Vec<_> = indices
            .iter()
            .copied()
            .zip(values.iter().copied())
            .collect();
        self.chamber
            .brain
            .set_external_current(&currents)
            .map_err(|e| JsValue::from_str(&e))
    }

    pub fn step(&mut self) -> Result<String, JsValue> {
        serde_json::to_string(&self.chamber.step()).map_err(|e| JsValue::from_str(&e.to_string()))
    }
}
