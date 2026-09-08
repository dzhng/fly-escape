//! One-tick WASM adapter; the worker owns scheduling and cancellation.
use sim::{attempt::*, record::*, Graph};
use std::sync::Arc;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct AttemptSession {
    attempt: Attempt,
    info: AttemptInfo,
    frames: Vec<AttemptFrame>,
    sequence: u32,
    tick: u32,
    neural_steps: u32,
    archive_bytes: u64,
}
#[wasm_bindgen]
impl AttemptSession {
    #[wasm_bindgen(constructor)]
    pub fn new(bytes: &[u8], manifest: &str, request: &str) -> Result<Self, JsValue> {
        let request = serde_json::from_str::<StartAttempt>(request).map_err(js_error)?;
        let graph = Arc::new(crate::verified_graph(bytes, manifest)?);
        Self::build(graph, request).map_err(js_error)
    }
    pub fn info(&self) -> Result<String, JsValue> {
        serde_json::to_string(&self.info).map_err(js_error)
    }
    pub fn step(&mut self) -> Result<String, JsValue> {
        serde_json::to_string(&self.advance().map_err(js_error)?).map_err(js_error)
    }
    pub fn take_chunk(&mut self) -> Result<Option<AttemptChunk>, JsValue> {
        self.flush().map_err(js_error)
    }
}
impl AttemptSession {
    fn build(graph: Arc<Graph>, request: StartAttempt) -> Result<Self, String> {
        let seed = request
            .root_seed
            .parse::<u64>()
            .map_err(|_| "invalid decimal root seed")?;
        if seed.to_string() != request.root_seed {
            return Err("root seed must be a canonical decimal u64".into());
        }
        let layout =
            RecordLayout::new(graph.manifest.groups.iter().map(|g| g.id.clone()).collect())?;
        // Reject an oversized fixed record before allocating brains; variable motion
        // remains subject to the cumulative archive quota during production.
        let archive_bytes =
            layout.archive_bytes(request.fly_count, request.level.duration_ticks)? as u32;
        let spec = Attempt::describe(
            &graph,
            &request.level,
            &request.tuning,
            &request.attempt_id,
            seed,
            request.fly_count,
            &request.placements,
        )?;
        let graph_bytes =
            u32::try_from(graph.storage_bytes()).map_err(|_| "graph byte count exceeds u32")?;
        let level = request.level.clone();
        let attempt = Attempt::new(graph.clone(), request.level, request.tuning, spec.clone())?;
        let info = AttemptInfo {
            initial_bodies: attempt.initial_bodies(),
            initial_sensory_points: attempt.initial_sensory_points(),
            spec: spec.clone(),
            level,
            resolved_setup: attempt.resolved_setup().clone(),
            groups: graph.manifest.groups.clone(),
            group_links: graph.manifest.group_links.clone(),
            record_layout: layout,
            archive_bytes,
            graph_bytes,
            brain_state_bytes: u32::try_from(attempt.brain_state_bytes())
                .map_err(|_| "brain byte count exceeds u32")?,
        };
        Ok(Self {
            attempt,
            info,
            frames: Vec::with_capacity(MAX_CHUNK_TICKS as usize),
            sequence: 0,
            tick: 0,
            neural_steps: 0,
            archive_bytes: 16384,
        })
    }
    fn advance(&mut self) -> Result<AttemptStep, String> {
        if self.frames.len() >= MAX_CHUNK_TICKS as usize {
            return Err("drain the full record chunk before stepping".into());
        }
        if let Some(frame) = self.attempt.step()? {
            self.tick = frame.tick;
            self.neural_steps = frame.neural_steps;
            self.frames.push(frame);
        }
        Ok(AttemptStep {
            tick: self.tick,
            neural_steps: self.neural_steps,
            buffered_ticks: self.frames.len() as u32,
            complete: self.attempt.result().is_some(),
        })
    }
    fn flush(&mut self) -> Result<Option<AttemptChunk>, String> {
        if self.frames.is_empty() {
            return Ok(None);
        }
        let chunk = PackedChunk::encode(
            &self.info.spec.attempt_id,
            self.sequence,
            &self.info.record_layout,
            &self.frames,
        )?;
        let bytes = 1024
            + (chunk.values.len() + chunk.motion_values.len()) as u64 * 8
            + (chunk.states.len()
                + chunk.events.len()
                + chunk.tick_neural_steps.len()
                + chunk.motion_offsets.len()
                + chunk.motion_states.len()) as u64
                * 4;
        if self.archive_bytes + bytes > u64::from(self.info.archive_bytes) {
            return Err("record archive capacity exceeded".into());
        }
        self.archive_bytes += bytes;
        self.frames.clear();
        self.sequence += 1;
        Ok(Some(AttemptChunk { chunk }))
    }
}
#[wasm_bindgen]
pub struct AttemptChunk {
    chunk: PackedChunk,
}
#[wasm_bindgen]
impl AttemptChunk {
    pub fn header(&self) -> Result<String, JsValue> {
        let c = &self.chunk;
        serde_json::to_string(&ChunkHeader {
            schema_version: c.schema_version,
            attempt_id: c.attempt_id.clone(),
            sequence: c.sequence,
            start_tick: c.start_tick,
            tick_count: c.tick_count,
            fly_count: c.fly_count,
            result: c.result.clone(),
        })
        .map_err(js_error)
    }
    // wasm-bindgen copies returned Vec data into owned JS typed arrays before
    // freeing its WASM allocation. These methods drain each buffer exactly once.
    pub fn take_motion_values(&mut self) -> Vec<f64> {
        std::mem::take(&mut self.chunk.motion_values)
    }
    pub fn take_motion_states(&mut self) -> Vec<u32> {
        std::mem::take(&mut self.chunk.motion_states)
    }
    pub fn take_motion_offsets(&mut self) -> Vec<u32> {
        std::mem::take(&mut self.chunk.motion_offsets)
    }
    pub fn take_values(&mut self) -> Vec<f64> {
        std::mem::take(&mut self.chunk.values)
    }
    pub fn take_states(&mut self) -> Vec<u32> {
        std::mem::take(&mut self.chunk.states)
    }
    pub fn take_events(&mut self) -> Vec<u32> {
        std::mem::take(&mut self.chunk.events)
    }
    pub fn take_tick_neural_steps(&mut self) -> Vec<u32> {
        std::mem::take(&mut self.chunk.tick_neural_steps)
    }
}
fn js_error(error: impl std::fmt::Display) -> JsValue {
    JsValue::from_str(&error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn graph() -> Arc<Graph> {
        let mut bytes = b"FLYGRAPH".to_vec();
        for v in [1u32, 4, 0, 0, 0, 0, 0, 0] {
            bytes.extend(v.to_le_bytes());
        }
        let manifest = serde_json::json!({"schemaVersion":1,"neuronCount":4,"edgeCount":0,"graphHash":"fd5d3220183daecf3a5867ef65c6420ebf879970ffec348f19c8de1207248ca5","bodyIds":["1","2","3","4"],"motor":{"dnL":[0],"dnR":[1],"mnL":[],"mnR":[]},"pathways":{},"groups":[],"groupLinks":[],"pathwayProvenance":"synthetic transport fixture"});
        Arc::new(Graph::from_bytes(&bytes, &manifest.to_string()).unwrap())
    }
    fn request() -> StartAttempt {
        let mut level = sim::swarm_lab::level(2).unwrap();
        level.duration_ticks = 12;
        StartAttempt {
            placements: vec![],
            attempt_id: "test".into(),
            root_seed: "42".into(),
            fly_count: 2,
            level,
            tuning: AttemptTuning::default(),
        }
    }
    #[test]
    fn motion_archive_overflow_keeps_chunk_pending_and_fails_explicitly() {
        let mut session = AttemptSession::build(graph(), request()).unwrap();
        session.advance().unwrap();
        session.info.archive_bytes = 16384;
        assert!(session.flush().err().unwrap().contains("capacity exceeded"));
        assert_eq!(session.frames.len(), 1);
        assert_eq!(session.sequence, 0);
        assert_eq!(session.archive_bytes, 16384);
    }
    #[test]
    fn one_tick_backpressure_flush_and_terminal_result_preserve_frames() {
        let graph = graph();
        let request = request();
        let spec =
            Attempt::describe(&graph, &request.level, &request.tuning, "test", 42, 2, &[]).unwrap();
        let mut direct = Attempt::new(
            graph.clone(),
            request.level.clone(),
            request.tuning.clone(),
            spec,
        )
        .unwrap();
        let mut session = AttemptSession::build(graph, request).unwrap();
        let mut expected = vec![];
        for tick in 1..=10 {
            let status = session.advance().unwrap();
            assert_eq!(
                (status.tick, status.neural_steps, status.complete),
                (tick, tick * 2, false)
            );
            expected.push(direct.step().unwrap().unwrap());
        }
        assert!(session.advance().is_err());
        let first = session.flush().unwrap().unwrap();
        assert_eq!(
            first.chunk.decode(&session.info.record_layout).unwrap(),
            expected
        );
        assert!(first.chunk.result.is_none());
        assert_eq!(first.chunk.sequence, 0);
        expected.clear();
        for _ in 0..2 {
            session.advance().unwrap();
            expected.push(direct.step().unwrap().unwrap());
        }
        let complete = session.advance().unwrap();
        assert_eq!(
            (complete.tick, complete.neural_steps, complete.complete),
            (12, 24, true)
        );
        let mut last = session.flush().unwrap().unwrap();
        assert_eq!(
            last.chunk.decode(&session.info.record_layout).unwrap(),
            expected
        );
        assert_eq!(last.chunk.result.as_ref().unwrap().outcomes.timed_out, 2);
        assert_eq!(last.chunk.sequence, 1);
        let values = last.take_values();
        assert!(!values.is_empty());
        assert!(last.take_values().is_empty());
        assert!(session.flush().unwrap().is_none());
        assert_eq!(session.advance().unwrap().neural_steps, 24);
    }
    #[test]
    fn invalid_seed_and_oversized_archive_fail_before_brain_allocation() {
        let graph = graph();
        for seed in ["01", "+1", "-1", "18446744073709551616", ""] {
            let mut r = request();
            r.root_seed = seed.into();
            assert!(AttemptSession::build(graph.clone(), r).is_err());
            assert_eq!(Arc::strong_count(&graph), 1);
        }
        let mut r = request();
        r.fly_count = 100;
        r.level = sim::swarm_lab::level(100).unwrap();
        assert!(AttemptSession::build(graph.clone(), r).is_err());
        assert_eq!(Arc::strong_count(&graph), 1);
        let layout = RecordLayout::new((0..16).map(|n| n.to_string()).collect()).unwrap();
        assert!(layout.archive_bytes(20, 6000).is_ok());
        assert!(layout.archive_bytes(100, 100).is_ok());
    }
}

/// Selects bounded diagnostic content; ordinary game starts supply resolved content.
#[wasm_bindgen]
pub fn swarm_request(
    attempt_id: &str,
    root_seed: &str,
    fly_count: u32,
    duration_ticks: u32,
) -> Result<String, JsValue> {
    if !(1..=6000).contains(&duration_ticks) {
        return Err(JsValue::from_str("horizon must be 1..6000 ticks"));
    }
    let mut level = sim::swarm_lab::level(fly_count).map_err(|e| JsValue::from_str(&e))?;
    level.duration_ticks = duration_ticks;
    let request = StartAttempt {
        attempt_id: attempt_id.into(),
        root_seed: root_seed.into(),
        fly_count,
        placements: vec![],
        level,
        tuning: sim::attempt::AttemptTuning {
            cues: vec![sim::attempt::CueInput {
                // Paired with the lab level's repellent source.
                pathway: sim::sensory::CuePathway::InhibitoryOdor,
                gain: 1.0,
            }],
            ..Default::default()
        },
    };
    serde_json::to_string(&request).map_err(|e| JsValue::from_str(&e.to_string()))
}
