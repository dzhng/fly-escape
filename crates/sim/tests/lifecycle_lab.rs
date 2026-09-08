use serde_json::json;
use sha2::{Digest, Sha256};
use sim::{body::*, lifecycle_lab::*, Graph};
use std::sync::Arc;
fn graph() -> Arc<Graph> {
    let mut bytes = b"FLYGRAPH".to_vec();
    for value in [1u32, 4, 0, 0, 0, 0, 0, 0] {
        bytes.extend(value.to_le_bytes());
    }
    let manifest = json!({"schemaVersion":1,"neuronCount":4,"edgeCount":0,"graphHash":format!("{:x}",Sha256::digest(&bytes)),"bodyIds":["1","2","3","4"],"motor":{"dnL":[0],"dnR":[1],"mnL":[],"mnR":[]},"pathways":{},"groups":[{"id":"taste","label":"Taste","indices":[2,3]},{"id":"odorExcL","label":"Left odor","indices":[2]},{"id":"odorExcR","label":"Right odor","indices":[3]},{"id":"proboscis","label":"Proboscis","indices":[3]}],"groupLinks":[],"pathwayProvenance":"synthetic attempt fixture"});
    Arc::new(Graph::from_bytes(&bytes, &manifest.to_string()).unwrap())
}

#[test]
fn wind_exit_pair_scores_only_the_opening_and_records_terminal_once() {
    for (scenario, escaped) in [
        (LifecycleScenario::OpenExit, true),
        (LifecycleScenario::BlockedExit, false),
    ] {
        let mut lab = LifecycleLab::new(graph(), 0, scenario).unwrap();
        while lab.step().unwrap().is_some() {}
        let result = lab.result().unwrap();
        assert_eq!(result.outcomes.escaped, u32::from(escaped));
        assert_eq!(result.outcomes.score, u32::from(escaped));
        assert_eq!(result.stars, u32::from(escaped));
        assert_eq!(
            lab.events()
                .iter()
                .filter(|e| matches!(e.event.kind, BodyEventKind::Terminal { .. }))
                .count(),
            1
        );
        let prior = lab.events().to_vec();
        assert!(lab.step().unwrap().is_none());
        assert_eq!(prior, lab.events());
    }
}

#[test]
#[ignore = "requires BRAIN_ARTIFACT_DIR containing the real graph"]
fn actual_graph_lifecycle_probe() {
    let path = std::env::var("BRAIN_ARTIFACT_DIR").unwrap();
    let graph = Arc::new(
        Graph::from_bytes(
            &std::fs::read(format!("{path}/graph.bin")).unwrap(),
            &std::fs::read_to_string(format!("{path}/manifest.json")).unwrap(),
        )
        .unwrap(),
    );
    let mut replenished_then_starved = 0;
    for seed in 0..10 {
        for scenario in [
            LifecycleScenario::MealThenStarvation,
            LifecycleScenario::ProboscisSilenced,
        ] {
            let mut lab = LifecycleLab::new(graph.clone(), seed, scenario).unwrap();
            if seed == LIFECYCLE_DEMO_SEED {
                println!(
                    "identity={}",
                    serde_json::to_string(&lab.info().spec).unwrap()
                );
            }
            let mut prior = lab.info().level.body_config.life.reserve().unwrap().initial;
            let mut gained = 0.;
            while let Some(frame) = lab.step().unwrap() {
                let fly = &frame.flies[0];
                gained += (fly.body.reserve - prior).max(0.);
                prior = fly.body.reserve;
                if matches!(scenario, LifecycleScenario::ProboscisSilenced) {
                    let g = fly
                        .neural
                        .as_ref()
                        .unwrap()
                        .groups
                        .iter()
                        .find(|g| g.id == "proboscis")
                        .unwrap();
                    assert_eq!((g.mean_voltage, g.spike_fraction), (0., 0.));
                }
            }
            let starts = lab
                .events()
                .iter()
                .filter(|e| matches!(e.event.kind, BodyEventKind::FeedingStarted))
                .count();
            if matches!(scenario, LifecycleScenario::ProboscisSilenced) {
                assert_eq!(starts, 0);
                assert_eq!(gained, 0.);
            } else if gained > 0. {
                assert_eq!(lab.result().unwrap().outcomes.starved, 1);
                assert!(lab.events().iter().any(|e| matches!(
                    e.event.kind,
                    BodyEventKind::FeedingEnded {
                        reason: FeedingEnd::ContactLost
                    }
                )));
                replenished_then_starved += 1;
            }
            assert_eq!(lab.result().unwrap().outcomes.score, 0);
            println!(
                "seed={seed} {scenario:?}: starts={starts} gained={gained:.3} terminalTick={}",
                lab.result().unwrap().completed_tick
            );
        }
    }
    // Demonstration existence across a declared bounded seed set, not an efficacy rate.
    assert!(replenished_then_starved > 0);
}
