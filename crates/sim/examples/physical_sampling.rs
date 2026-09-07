//! Diagnostic composition for slice25. Production parameters and adapter are unchanged.
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sim::{
    body::{desired_pose, BodyPose, Locomotion},
    environment::{FieldSet, Point, SensorySample},
    field_lab::{fixture, FieldScenario},
    sensory::{cue_currents, CuePathway},
    Brain, Graph,
};
use std::{sync::Arc, time::Instant};
const MEASURE: u32 = 100;
const WARMUP: u32 = 60;
const PHYSICAL_OFFSET: f64 = 0.00020207253103162883;
const PHYSICAL_FORWARD: f64 = 0.0014145078816978175;
const PHYSICAL_RADIUS: f64 = 0.0026313360997825106;
fn sampling(fields: &FieldSet, pose: BodyPose, offset: f64, forward: f64) -> SensorySample {
    let centre = Point {
        x: pose.position.x + forward * pose.heading.cos(),
        z: pose.position.z + forward * pose.heading.sin(),
    };
    let dx = pose.heading.sin() * offset;
    let dz = -pose.heading.cos() * offset;
    SensorySample {
        left: fields.sample_point(Point {
            x: centre.x + dx,
            z: centre.z + dz,
        }),
        right: fields.sample_point(Point {
            x: centre.x - dx,
            z: centre.z - dz,
        }),
        wind: fields.sample(pose.position, pose.heading, 0).wind,
    }
}
fn values(sample: &SensorySample, cue: CuePathway) -> [f64; 2] {
    match cue {
        CuePathway::ExcitatoryOdor => [sample.left.repellent_odor, sample.right.repellent_odor],
        CuePathway::InhibitoryOdor => [sample.left.attractive_odor, sample.right.attractive_odor],
        _ => [sample.left.brightness, sample.right.brightness],
    }
}
fn relative(v: [f64; 2]) -> f64 {
    if v[0] + v[1] > 0. {
        (v[0] - v[1]).abs() / (v[0] + v[1])
    } else {
        0.
    }
}
fn run(
    graph: &Arc<Graph>,
    seed: u64,
    scenario: FieldScenario,
    mirror: f64,
    phase: f64,
    physical: bool,
    enabled: bool,
    silence: &[u32],
) -> Result<Value, String> {
    let (mut fields, cue) = fixture(scenario, mirror)?;
    let (offset, forward, radius) = if physical {
        (PHYSICAL_OFFSET, PHYSICAL_FORWARD, PHYSICAL_RADIUS)
    } else {
        (0.15, 0., 0.08)
    };
    let mut brain = Brain::new(graph.clone(), Brain::seed_for_fly(seed, 0));
    for _ in 0..WARMUP {
        brain.step();
    }
    brain.set_silenced_neurons(silence)?;
    let mut pose = BodyPose {
        position: Point { x: -2., z: phase },
        heading: 0.,
    };
    let mut ticks = vec![];
    let mut active = 0;
    let mut effective_active = 0;
    let mut sum = 0.;
    let mut flight_sum = 0.;
    for tick in 1..=MEASURE {
        fields.advance(0.1)?;
        let sample = sampling(&fields, pose, offset, forward);
        let values = values(&sample, cue);
        let proposed = cue_currents(graph, &sample, cue, 1.)?;
        let currents = if enabled { proposed.clone() } else { vec![] };
        let nonzero = currents.iter().filter(|(_, v)| *v > 0.).count();
        if nonzero > 0 {
            active += 1;
        }
        brain.set_external_current(&currents)?;
        let effective_count = currents
            .iter()
            .filter(|(id, _)| brain.external_current()[*id as usize] > 0.)
            .count();
        let effective_sum = currents
            .iter()
            .map(|(id, _)| brain.external_current()[*id as usize])
            .sum::<f64>();
        if effective_count > 0 {
            effective_active += 1;
        }
        let neural = brain.step();
        sum += neural.motor.turn;
        flight_sum += neural.motor.flight_turn;
        let input = pose;
        let desired = desired_pose(
            pose,
            Locomotion {
                thrust: neural.motor.thrust,
                turn: neural.motor.turn,
                speed: 0.12,
                turn_gain: 8.,
            },
            sample.wind,
            0.1,
        );
        pose = BodyPose {
            position: fields
                .geometry()
                .sweep(pose.position, desired.position, radius),
            heading: desired.heading,
        };
        ticks.push(json!({"tick":tick,"inputPose":input,"pose":pose,"sample":sample,"relativeContrast":relative(values),"proposedNonzeroCurrents":proposed.iter().filter(|(_,v)|*v>0.).count(),"requestedNonzeroCurrents":nonzero,"requestedCurrentSum":currents.iter().map(|(_,v)|v).sum::<f64>(),"effectiveNonzeroCurrents":effective_count,"effectiveCurrentSum":effective_sum,"motor":neural.motor,"spikeCount":neural.spike_count}));
    }
    Ok(
        json!({"seed":seed,"mirror":mirror,"phase":phase,"physical":physical,"enabled":enabled,"silenced":!silence.is_empty(),"offset":offset,"forward":forward,"radius":radius,"requestedActiveTicks":active,"effectiveActiveTicks":effective_active,"meanTurn":sum/MEASURE as f64,"meanFlightTurn":flight_sum/MEASURE as f64,"finalPose":pose,"ticks":ticks}),
    )
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = std::env::args().collect();
    if args.len() != 3 {
        return Err("physical_sampling GRAPH_DIR OUTPUT_JSON".into());
    }
    let bytes = std::fs::read(format!("{}/graph.bin", args[1]))?;
    let manifest = std::fs::read_to_string(format!("{}/manifest.json", args[1]))?;
    let graph = Arc::new(Graph::from_bytes(&bytes, &manifest)?);
    drop(bytes);
    let start = Instant::now();
    let mut phase_scan = vec![];
    let mut rows = vec![];
    for (scenario, groups) in [
        (FieldScenario::ExcitatoryOdor, ["odorExcL", "odorExcR"]),
        (FieldScenario::InhibitoryOdor, ["odorInhL", "odorInhR"]),
    ] {
        let silence: Vec<_> = groups
            .iter()
            .flat_map(|id| {
                graph
                    .manifest
                    .groups
                    .iter()
                    .find(|g| g.id == *id)
                    .unwrap()
                    .indices
                    .iter()
                    .copied()
            })
            .collect();
        for physical in [false, true] {
            let (offset, forward) = if physical {
                (PHYSICAL_OFFSET, PHYSICAL_FORWARD)
            } else {
                (0.15, 0.)
            };
            for mirror in [1., -1.] {
                let (fields, cue) = fixture(scenario, mirror)?;
                let mut samples = vec![];
                for step in 0..=4096 {
                    let phase = -0.125 + 0.25 * step as f64 / 4096.;
                    let sample = sampling(
                        &fields,
                        BodyPose {
                            position: Point { x: -2., z: phase },
                            heading: 0.,
                        },
                        offset,
                        forward,
                    );
                    let values = values(&sample, cue);
                    let currents = cue_currents(&graph, &sample, cue, 1.)?;
                    samples.push(json!({"phase":phase,"values":values,"relativeContrast":relative(values),"nonzeroCurrents":currents.iter().filter(|(_,v)|*v>0.).count()}));
                }
                phase_scan.push(json!({"scenario":scenario,"physical":physical,"mirror":mirror,"samples":samples}));
            }
            for phase in [0., 0.125] {
                for seed in 0..3 {
                    // Neutral and silenced-neutral share the same phase/seed; source has no physical force.
                    for (mirror, enabled, ablated) in [
                        (1., false, false),
                        (1., true, false),
                        (-1., true, false),
                        (1., false, true),
                        (1., true, true),
                        (-1., true, true),
                    ] {
                        let row = run(
                            &graph,
                            seed,
                            scenario,
                            mirror,
                            phase,
                            physical,
                            enabled,
                            if ablated { &silence } else { &[] },
                        )?;
                        eprintln!("{scenario:?} physical={physical} phase={phase} seed={seed} mirror={mirror} cue={enabled} silenced={ablated} active={} meanTurn={}",row["requestedActiveTicks"],row["meanTurn"]);
                        rows.push(json!({"scenario":scenario,"observation":row}));
                    }
                }
            }
        }
    }
    let report = json!({"graphHash":graph.manifest.graph_hash,"manifestHash":format!("{:x}",Sha256::digest(manifest.as_bytes())),"simulationBuildId":sim::attempt::SIMULATION_BUILD_ID,"probeSourceHash":format!("{:x}",Sha256::digest(include_bytes!("physical_sampling.rs"))),"conditions":"Existing field_lab mirrored odor fixtures settle100 fields ticks. Each Brain warms60 neutral stationary ticks (scientific control only), then100 measured ground-body ticks. Canonical sample_point/cue_currents/Brain/desired_pose/sweep; cue gain1, threshold5%, speed0.12m/s and turnGain8 unchanged. Diagnostic sampling adds measured lateral/forward coordinates without modifying FieldConfig or production APIs. Old collision radius0.08m; proposed rest AABB corner2.631336mm. Geometry/field grid/sources unchanged. No reserve/flight-mode model in this ground-moving sensory fixture.","phaseScan":phase_scan,"rows":rows,"elapsedSeconds":start.elapsed().as_secs_f64(),"campaignAccepted":false});
    std::fs::write(&args[2], serde_json::to_string_pretty(&report)?)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn diagnostic_legacy_coordinates_match_canonical_sampler() {
        let (fields, _) = fixture(FieldScenario::InhibitoryOdor, 1.).unwrap();
        for heading in [0., 0.37, std::f64::consts::FRAC_PI_2, -2.4] {
            for z in [0., 0.125, -0.31] {
                let pose = BodyPose {
                    position: Point { x: -2., z },
                    heading,
                };
                assert_eq!(
                    sampling(&fields, pose, 0.15, 0.),
                    fields.sample(pose.position, pose.heading, 0)
                );
            }
        }
    }
}
