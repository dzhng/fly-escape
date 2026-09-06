use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sim::{Brain, Graph};
use std::sync::Arc;
fn fixture() -> Value {
    serde_json::from_str(include_str!("../../../tests/reference/lif_synthetic.json")).unwrap()
}
fn artifact(case: &Value) -> (Vec<u8>, Value) {
    let n = case["body_ids"].as_array().unwrap().len();
    let mut edges: Vec<(usize, usize, f64)> = case["edges"]
        .as_array()
        .unwrap()
        .iter()
        .map(|e| {
            (
                e[1].as_u64().unwrap() as usize,
                e[0].as_u64().unwrap() as usize,
                e[2].as_f64().unwrap(),
            )
        })
        .collect();
    edges.sort_by_key(|e| (e.0, e.1));
    let mut bytes = b"FLYGRAPH".to_vec();
    for v in [1, n as u32, edges.len() as u32] {
        bytes.extend(v.to_le_bytes());
    }
    for i in 0..=n {
        bytes.extend((edges.iter().filter(|e| e.0 < i).count() as u32).to_le_bytes());
    }
    for e in &edges {
        bytes.extend((e.1 as u32).to_le_bytes());
    }
    for e in &edges {
        bytes.extend(e.2.to_le_bytes());
    }
    let g = &case["motor_groups"];
    let manifest = json!({"schemaVersion":1,"neuronCount":n,"edgeCount":edges.len(),"graphHash":format!("{:x}",Sha256::digest(&bytes)),"bodyIds":case["body_ids"],"motor":{"dnL":g["dn_left"],"dnR":g["dn_right"],"mnL":g["mn_left"],"mnR":g["mn_right"]},"pathways":{"OLFACTORY_DN_LEFT":g["olf_dn_left"],"OLFACTORY_DN_RIGHT":g["olf_dn_right"],"FLIGHT_DN_LEFT":g["flight_dn_left"],"FLIGHT_DN_RIGHT":g["flight_dn_right"]},"groups":[{"id":"overlap","label":"Overlap","indices":[0,2]}],"groupLinks":[],"pathwayProvenance":"synthetic numerical fixture"});
    (bytes, manifest)
}
fn near(actual: f64, expected: f64, tol: &Value) {
    let limit = tol["absolute_tolerance"].as_f64().unwrap()
        + tol["relative_tolerance"].as_f64().unwrap() * expected.abs();
    assert!(
        (actual - expected).abs() <= limit,
        "actual={actual}, expected={expected}"
    );
}
fn floats(actual: &[f64], expected: &Value, tol: &Value) {
    for (&a, b) in actual.iter().zip(expected.as_array().unwrap()) {
        near(a, b.as_f64().unwrap(), tol)
    }
}
#[test]
fn injected_noise_matches_python_intermediates_and_readouts() {
    let f = fixture();
    for case in f["cases"].as_array().unwrap() {
        let (bytes, m) = artifact(case);
        let graph = Arc::new(Graph::from_bytes(&bytes, &m.to_string()).unwrap());
        let mut brain = Brain::new(graph, 42);
        brain
            .set_params(serde_json::from_value(case["params"].clone()).unwrap())
            .unwrap();
        brain
            .set_state(serde_json::from_value(case["initial"].clone()).unwrap())
            .unwrap();
        for (tick, e) in case["ticks"]
            .as_array()
            .unwrap()
            .iter()
            .zip(case["expected"].as_array().unwrap())
        {
            brain
                .set_external_by_body(
                    &serde_json::from_value(tick["external_by_body"].clone()).unwrap(),
                )
                .unwrap();
            let out = brain
                .step_with_noise(
                    &serde_json::from_value::<Vec<f64>>(tick["noise"].clone()).unwrap(),
                )
                .unwrap();
            let tol = &f["float_comparison"];
            floats(brain.voltage(), &e["voltage"], tol);
            floats(brain.external_current(), &e["external_current"], tol);
            floats(
                &brain.diagnostics().synaptic_input,
                &e["synaptic_input"],
                tol,
            );
            floats(&brain.diagnostics().dv, &e["dV"], tol);
            assert_eq!(json!(brain.spikes()), e["spikes"]);
            assert_eq!(json!(brain.refractory()), e["refractory"]);
            assert_eq!(json!(brain.diagnostics().can_spike), e["can_spike"]);
            for (actual, key) in [
                (out.motor.thrust, "thrust"),
                (out.motor.turn, "turn"),
                (out.motor.flight_thrust, "flight_thrust"),
                (out.motor.flight_turn, "flight_turn"),
            ] {
                near(actual, e[key].as_f64().unwrap(), tol)
            }
            near(
                out.groups[0].mean_voltage,
                (brain.voltage()[0] + brain.voltage()[2]) / 2.0,
                tol,
            );
            near(
                out.groups[0].spike_fraction,
                (u8::from(brain.spikes()[0]) + u8::from(brain.spikes()[2])) as f64 / 2.0,
                tol,
            );
        }
    }
}
#[test]
fn malformed_artifacts_fail_without_panicking() {
    let (bytes, m) = artifact(&fixture()["cases"][0]);
    for len in 0..bytes.len() {
        assert!(Graph::from_bytes(&bytes[..len], &m.to_string()).is_err());
    }
    let check = |mut b: Vec<u8>, offset: usize, value: &[u8], expected: &str| {
        b[offset..offset + value.len()].copy_from_slice(value);
        let mut manifest = m.clone();
        manifest["graphHash"] = json!(format!("{:x}", Sha256::digest(&b)));
        assert!(Graph::from_bytes(&b, &manifest.to_string())
            .err()
            .unwrap()
            .contains(expected));
    };
    check(bytes.clone(), 8, &2u32.to_le_bytes(), "version");
    check(bytes.clone(), 20, &1u32.to_le_bytes(), "row offsets");
    check(bytes.clone(), 40, &99u32.to_le_bytes(), "out of bounds");
    check(bytes.clone(), 56, &f64::NAN.to_le_bytes(), "Nonfinite");
    let mut bad = m.clone();
    bad["groups"][0]["indices"] = json!([99]);
    assert!(Graph::from_bytes(&bytes, &bad.to_string()).is_err());
    bad = m.clone();
    bad["bodyIds"][1] = json!("10");
    assert!(Graph::from_bytes(&bytes, &bad.to_string()).is_err());
    bad = m.clone();
    bad["graphHash"] = json!("wrong");
    assert!(Graph::from_bytes(&bytes, &bad.to_string()).is_err());
}
#[test]
fn fly_streams_are_reproducible_and_independent() {
    let (bytes, m) = artifact(&fixture()["cases"][0]);
    let graph = Arc::new(Graph::from_bytes(&bytes, &m.to_string()).unwrap());
    let make = |id| Brain::new(graph.clone(), Brain::seed_for_fly(123, id));
    let (mut a, mut b, mut other) = (make(0), make(0), make(1));
    for _ in 0..20 {
        a.step();
        other.step();
        other.step();
        b.step();
        assert_eq!(a.voltage(), b.voltage());
    }
    assert_ne!(a.voltage(), other.voltage());
}

#[test]
fn silenced_neuron_rejects_external_noise_and_network_drive() {
    let case = json!({"body_ids":["1","2","3"], "edges":[[0,1,10000.0],[1,2,10000.0]], "motor_groups":{"dn_left":[1],"dn_right":[2],"mn_left":[],"mn_right":[],"olf_dn_left":[],"olf_dn_right":[],"flight_dn_left":[],"flight_dn_right":[]}});
    let (bytes, manifest) = artifact(&case);
    let graph = Arc::new(Graph::from_bytes(&bytes, &manifest.to_string()).unwrap());
    let mut brain = Brain::new(graph, 42);
    brain
        .set_state(sim::NeuralState {
            voltage: vec![0.0, 0.9, 0.0],
            spikes: vec![true, true, false],
            refractory: vec![0; 3],
        })
        .unwrap();
    brain.set_silenced_neurons(&[1]).unwrap();
    assert_eq!(brain.voltage()[1], 0.0);
    assert!(!brain.spikes()[1]);
    for _ in 0..5 {
        brain.set_external_current(&[(0, 3.0), (1, 100.0)]).unwrap();
        brain.step_with_noise(&[0.0, 100.0, 0.0]).unwrap();
        assert_eq!(brain.voltage()[1], 0.0);
        assert!(!brain.spikes()[1]);
        assert_eq!(brain.external_current()[1], 0.0);
        assert_eq!(brain.diagnostics().synaptic_input[1], 0.0);
        assert_eq!(brain.diagnostics().synaptic_input[2], 0.0);
    }
    brain.set_silenced_neurons(&[]).unwrap();
    brain.set_external_current(&[(1, 100.0)]).unwrap();
    brain.step_with_noise(&[0.0; 3]).unwrap();
    assert!(brain.spikes()[1]);
}
