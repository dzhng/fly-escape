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

/// Reference incoming current: sum active-source weights in ascending source order,
/// then scale and zero silenced targets. This defines the result independently of
/// the runtime adjacency layout.
fn incoming_accumulation(
    edges: &[(u32, u32, f64)],
    n: usize,
    spikes: &[bool],
    silenced: &[u32],
    input_scale: f64,
) -> Vec<f64> {
    (0..n as u32)
        .map(|target| {
            if silenced.contains(&target) {
                return 0.0;
            }
            let mut sources: Vec<_> = edges.iter().filter(|e| e.1 == target).collect();
            sources.sort_by_key(|e| e.0);
            let mut input = 0.0;
            for e in sources {
                if spikes[e.0 as usize] {
                    input += e.2;
                }
            }
            input * input_scale
        })
        .collect()
}

#[test]
fn spiking_sources_deliver_exactly_what_an_incoming_scan_accumulates() {
    // Fan-in and fan-out disagree everywhere, no edge is reciprocated, and neurons 6 and 8
    // are pure targets while 3, 4 and 7 are pure sources. Targets 5 and 6 each take a
    // cancelling pair astride a small weight, so a delivery order other than ascending
    // source would leave 1.0 where exact ascending accumulation leaves 0.0. Neuron 7 is a
    // silenced source whose enormous weights must never arrive; 8 is a silenced target.
    let edges: Vec<(u32, u32, f64)> = vec![
        (0, 1, 3.0),
        (0, 2, -2.5),
        (0, 5, 1.0),
        (0, 6, 1e16),
        (0, 8, 7.0),
        (1, 6, 1.0),
        (2, 6, -1e16),
        (3, 5, 1e16),
        (4, 5, -1e16),
        (5, 1, 0.75),
        (7, 5, 1e300),
        (7, 8, 1e300),
    ];
    let n = 9;
    let silenced = [7u32, 8];
    let case = json!({
        "body_ids": (1..=n).map(|i| i.to_string()).collect::<Vec<_>>(),
        "edges": edges.iter().map(|e| json!([e.0, e.1, e.2])).collect::<Vec<_>>(),
        "motor_groups": {"dn_left":[1],"dn_right":[5],"mn_left":[6],"mn_right":[2],
            "olf_dn_left":[],"olf_dn_right":[],"flight_dn_left":[],"flight_dn_right":[]},
    });
    let (bytes, manifest) = artifact(&case);
    let graph = Arc::new(Graph::from_bytes(&bytes, &manifest.to_string()).unwrap());
    let input_scale = 0.5;
    let mut brain = Brain::new(graph, 11);
    brain
        .set_params(sim::LifParams {
            input_scale,
            noise_std: 0.0,
            baseline_drive: 0.0,
            ..Default::default()
        })
        .unwrap();
    brain.set_silenced_neurons(&silenced).unwrap();

    let mut previous_spikes = brain.spikes().to_vec();
    let mut patterns = std::collections::HashSet::new();
    let mut cancelled_ticks = 0;
    for tick in 0..24u32 {
        // Rotating drive keeps the spiking set changing, so the delivery set changes too.
        let currents: Vec<(u32, f64)> = (0..n as u32)
            .map(|i| (i, if (tick / (i + 1)) % 2 == 0 { 1.4 } else { -0.3 }))
            .collect();
        brain.set_external_current(&currents).unwrap();
        let noise: Vec<f64> = (0..n).map(|i| 0.01 * (i as f64 - 4.0)).collect();
        brain.step_with_noise(&noise).unwrap();

        let expected = incoming_accumulation(&edges, n, &previous_spikes, &silenced, input_scale);
        for (i, (&actual, &want)) in brain
            .diagnostics()
            .synaptic_input
            .iter()
            .zip(expected.iter())
            .enumerate()
        {
            assert_eq!(
                actual.to_bits(),
                want.to_bits(),
                "tick {tick} neuron {i}: {actual} is not the bit-exact incoming sum {want}"
            );
        }
        if previous_spikes[0] && previous_spikes[3] && previous_spikes[4] {
            cancelled_ticks += 1;
        }
        previous_spikes = brain.spikes().to_vec();
        patterns.insert(previous_spikes.clone());
    }
    assert!(
        patterns.len() > 3,
        "drive must exercise several delivery sets, saw {}",
        patterns.len()
    );
    assert!(
        cancelled_ticks > 0,
        "no tick delivered the full cancelling triple, so ordering went untested"
    );
}
