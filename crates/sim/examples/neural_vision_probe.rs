//! Bounded, paired neural-vision experiment. No body or neural-model tuning.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sim::{
    environment::{
        FieldConfig, FieldSet, Geometry, Point, RectRoom, SensorySample, SolidProp, Source,
        SourceKind, Wall,
    },
    sensory::{cue_currents, CuePathway},
    Brain, Graph, LifParams,
};
use std::{
    collections::{BTreeSet, HashMap, HashSet},
    fs,
    io::Write,
    path::Path,
    sync::Arc,
    time::Instant,
};

const WARMUP: usize = 60;
const TICKS: usize = 100;
const PROTOCOL: &str = "overlapping-cosine-gain3-v1";
const NEURAL_PROTOCOL: &str = "overlapping-Tm2-neural-confirmation-v1";
const NEURAL_MAP_HASH: &str = "c0ac5957037012b486cc7300ccad56015fd3215ad4c764ce4ba0b27c82a262da";

fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Observation {
    seed: u64,
    thrust: f64,
    turn: f64,
    flight_thrust: f64,
    flight_turn: f64,
    input_voltage: f64,
    input_spikes: f64,
    relay_voltage: Vec<f64>,
    relay_spikes: Vec<f64>,
    neural_trajectory_hash: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Condition {
    name: String,
    sample: SensorySample,
    requested_current_hash: String,
    current_hash: String,
    total_current: f64,
    silence: String,
    observations: Vec<Observation>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Statistics {
    n: usize,
    mean: f64,
    standard_error: f64,
    ci95: [f64; 2],
    absolute_t: Option<f64>,
    excludes_zero: bool,
}

fn statistics(values: &[f64]) -> Statistics {
    let n = values.len();
    let mean = values.iter().sum::<f64>() / n as f64;
    let variance = values.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / (n - 1) as f64;
    let se = (variance / n as f64).sqrt();
    let critical = match n {
        6 => 2.57058183661474,
        30 => 2.045229642132703,
        _ => panic!("unplanned seed count"),
    };
    let interval = [mean - critical * se, mean + critical * se];
    Statistics {
        n,
        mean,
        standard_error: se,
        ci95: interval,
        absolute_t: if se > 0. {
            Some(mean.abs() / se)
        } else if mean != 0. {
            Some(f64::MAX)
        } else {
            None
        },
        excludes_zero: interval[0] > 0. || interval[1] < 0.,
    }
}

fn paired(a: &Condition, b: &Condition, f: impl Fn(&Observation) -> f64) -> Statistics {
    assert_eq!(a.observations.len(), b.observations.len());
    statistics(
        &a.observations
            .iter()
            .zip(&b.observations)
            .map(|(a, b)| {
                assert_eq!(a.seed, b.seed);
                f(a) - f(b)
            })
            .collect::<Vec<_>>(),
    )
}

fn geometry(blocker: &str) -> Geometry {
    let mut g = Geometry {
        rooms: vec![RectRoom {
            id: 0,
            min: Point { x: -4., z: -4. },
            max: Point { x: 4., z: 4. },
        }],
        walls: vec![],
        solids: vec![],
    };
    // The right lamp is at (0,1), with an immobile fly at (0,0).
    if blocker == "wall" {
        g.walls.push(Wall {
            a: Point { x: -1., z: 0.5 },
            b: Point { x: 1., z: 0.5 },
        });
    }
    if blocker == "opening" {
        for (a, b) in [(-1., -0.2), (0.2, 1.)] {
            g.walls.push(Wall {
                a: Point { x: a, z: 0.5 },
                b: Point { x: b, z: 0.5 },
            });
        }
    }
    if blocker == "furniture" {
        g.solids.push(SolidProp {
            id: 0,
            furnishing: None,
            min: Point { x: -0.2, z: 0.4 },
            max: Point { x: 0.2, z: 0.6 },
            height: 0.5,
        });
    }
    g
}

fn sample(lamp: Option<(f64, f64)>, ambient: f64, blocker: &str) -> Result<SensorySample, String> {
    let sources = lamp
        .map(|(side, rate)| {
            vec![Source {
                position: Point { x: 0., z: side },
                radius: 3.,
                rate,
                kind: SourceKind::Lamp,
            }]
        })
        .unwrap_or_default();
    let fields = FieldSet::new(
        geometry(blocker),
        FieldConfig {
            baseline_brightness: ambient,
            ..Default::default()
        },
        sources,
        None,
    )?;
    Ok(fields.sample(Point::default(), 0., 0))
}

fn stimuli(confirm: bool) -> Result<Vec<(String, SensorySample, &'static str)>, String> {
    let dark = sample(None, 0., "")?;
    let mut out = vec![
        ("dark".into(), dark, "none"),
        ("uniform".into(), sample(None, 0.125, "")?, "none"),
    ];
    for b in 0..8 {
        let mut s = dark;
        s.vision.brightness[b] = 1.;
        out.push((format!("basis-{b}"), s, "none"));
    }
    for (name, side) in [("left", -1.), ("right", 1.)] {
        for rate in if confirm { vec![0.5, 1., 2.] } else { vec![1.] } {
            out.push((
                format!("lamp-{name}-{rate}"),
                sample(Some((side, rate)), 0., "")?,
                "none",
            ));
        }
    }
    if confirm {
        for block in ["wall", "furniture", "opening"] {
            out.push((block.into(), sample(Some((1., 1.)), 0., block)?, "none"));
        }
        for silence in ["inputs", "sham"] {
            out.push((format!("dark-{silence}"), dark, silence));
            for (name, side) in [("left", -1.), ("right", 1.)] {
                out.push((
                    format!("lamp-{name}-{silence}"),
                    sample(Some((side, 1.)), 0., "")?,
                    silence,
                ));
            }
        }
    }
    Ok(out)
}

fn neural_stimuli() -> Result<Vec<(String, SensorySample, &'static str)>, String> {
    let mut conditions = stimuli(true)?;
    let mut names: Vec<_> = (0..8).map(|b| format!("basis-{b}")).collect();
    for side in ["left", "right"] {
        for rate in ["0.5", "2"] {
            names.push(format!("lamp-{side}-{rate}"));
        }
    }
    for name in names {
        let sample = conditions.iter().find(|c| c.0 == name).unwrap().1;
        conditions.push((format!("{name}-inputs"), sample, "inputs"));
    }
    Ok(conditions)
}

// Parse the validated committed incoming CSR only to choose/verify observation cells.
fn outgoing(bytes: &[u8]) -> Vec<Vec<u32>> {
    let word = |at| u32::from_le_bytes(bytes[at..at + 4].try_into().unwrap()) as usize;
    let n = word(12);
    let mut result = vec![vec![]; n];
    for post in 0..n {
        for edge in word(20 + post * 4)..word(24 + post * 4) {
            result[word(20 + (n + 1 + edge) * 4)].push(post as u32);
        }
    }
    result
}

fn readouts(graph: &Graph) -> HashSet<u32> {
    let m = &graph.manifest.motor;
    m.dn_left
        .iter()
        .chain(&m.dn_right)
        .chain(&m.mn_left)
        .chain(&m.mn_right)
        .copied()
        .chain(
            [
                "OLFACTORY_DN_LEFT",
                "OLFACTORY_DN_RIGHT",
                "FLIGHT_DN_LEFT",
                "FLIGHT_DN_RIGHT",
            ]
            .into_iter()
            .flat_map(|p| graph.pathway(p).iter().copied()),
        )
        .chain(
            graph
                .manifest
                .groups
                .iter()
                .filter(|g| matches!(g.id.as_str(), "proboscis" | "landingL" | "landingR"))
                .flat_map(|g| g.indices.iter().copied()),
        )
        .collect()
}

fn populations(
    graph: &Graph,
    mapping: &Value,
    audit: &Value,
    edges: &[Vec<u32>],
) -> Result<(Vec<u32>, Vec<u32>, Vec<u32>), String> {
    let inputs: BTreeSet<u32> = mapping["entries"]
        .as_array()
        .unwrap()
        .iter()
        .map(|entry| entry["index"].as_u64().unwrap() as u32)
        .collect();
    let excluded = readouts(graph);
    if inputs.iter().any(|i| excluded.contains(i)) {
        return Err("mapped input intersects readout".into());
    }
    let by_body: HashMap<&str, u32> = graph
        .manifest
        .body_ids
        .iter()
        .enumerate()
        .map(|(i, b)| (b.as_str(), i as u32))
        .collect();
    let family = mapping["family"].as_str().unwrap();
    let mut relays = BTreeSet::new();
    for cell in audit["candidates"][family]["cells"]
        .as_array()
        .ok_or("missing audit cells")?
    {
        if !inputs.contains(&(cell["index"].as_u64().unwrap() as u32)) {
            continue;
        }
        for key in ["relayPath", "readoutPath"] {
            let path: Vec<u32> = cell[key]
                .as_array()
                .ok_or("missing audited path")?
                .iter()
                .map(|b| by_body[b.as_str().unwrap()])
                .collect();
            if path
                .windows(2)
                .any(|e| !edges[e[0] as usize].contains(&e[1]))
            {
                return Err("audit path absent from actual CSR".into());
            }
            for i in path.into_iter().skip(1) {
                if !inputs.contains(&i) && !excluded.contains(&i) {
                    relays.insert(i);
                }
            }
        }
    }
    if relays.is_empty() {
        return Err("no downstream observation cells".into());
    }
    let sham: Vec<u32> = edges
        .iter()
        .enumerate()
        .filter(|(i, e)| {
            e.is_empty()
                && !inputs.contains(&(*i as u32))
                && !excluded.contains(&(*i as u32))
                && !relays.contains(&(*i as u32))
        })
        .map(|(i, _)| i as u32)
        .take(inputs.len())
        .collect();
    if sham.len() != inputs.len() {
        return Err("insufficient zero-outgoing sham cells".into());
    }
    Ok((
        inputs.into_iter().collect(),
        relays.into_iter().collect(),
        sham,
    ))
}

fn run(
    graph: &Arc<Graph>,
    seed: u64,
    currents: &[(u32, f64)],
    silence: &[u32],
    inputs: &[u32],
    relays: &[u32],
) -> Result<Observation, String> {
    let mut brain = Brain::new(graph.clone(), Brain::seed_for_fly(seed, 0));
    for _ in 0..WARMUP {
        brain.step();
    }
    brain.set_silenced_neurons(silence)?;
    brain.set_external_current(currents)?;
    let mut out = Observation {
        seed,
        thrust: 0.,
        turn: 0.,
        flight_thrust: 0.,
        flight_turn: 0.,
        input_voltage: 0.,
        input_spikes: 0.,
        relay_voltage: vec![0.; relays.len()],
        relay_spikes: vec![0.; relays.len()],
        neural_trajectory_hash: String::new(),
    };
    let mut digest = Sha256::new();
    let mut state_bytes = Vec::with_capacity(graph.neuron_count() * 13);
    for _ in 0..TICKS {
        let frame = brain.step();
        out.thrust += frame.motor.thrust;
        out.turn += frame.motor.turn;
        out.flight_thrust += frame.motor.flight_thrust;
        out.flight_turn += frame.motor.flight_turn;
        for &i in inputs {
            out.input_voltage += brain.voltage()[i as usize];
            out.input_spikes += f64::from(brain.spikes()[i as usize]);
        }
        for (j, &i) in relays.iter().enumerate() {
            out.relay_voltage[j] += brain.voltage()[i as usize];
            out.relay_spikes[j] += f64::from(brain.spikes()[i as usize]);
        }
        state_bytes.clear();
        for ((v, s), r) in brain
            .voltage()
            .iter()
            .zip(brain.spikes())
            .zip(brain.refractory())
        {
            state_bytes.extend(v.to_le_bytes());
            state_bytes.push(u8::from(*s));
            state_bytes.extend(r.to_le_bytes());
        }
        digest.update(&state_bytes);
    }
    out.thrust /= TICKS as f64;
    out.turn /= TICKS as f64;
    out.flight_thrust /= TICKS as f64;
    out.flight_turn /= TICKS as f64;
    out.input_voltage /= (TICKS * inputs.len()) as f64;
    out.input_spikes /= (TICKS * inputs.len()) as f64;
    for x in out.relay_voltage.iter_mut().chain(&mut out.relay_spikes) {
        *x /= TICKS as f64;
    }
    out.neural_trajectory_hash = format!("{:x}", digest.finalize());
    Ok(out)
}

fn condition<'a>(conditions: &'a [Condition], name: &str) -> &'a Condition {
    conditions.iter().find(|c| c.name == name).unwrap()
}

fn comparison(a: &Condition, b: &Condition, relays: &[u32]) -> Value {
    json!({"a":a.name,"b":b.name,"thrust":paired(a,b,|o|o.thrust),"turn":paired(a,b,|o|o.turn),"flightThrust":paired(a,b,|o|o.flight_thrust),"flightTurn":paired(a,b,|o|o.flight_turn),
        "relayVoltage":relays.iter().enumerate().map(|(j,i)|json!({"index":i,"statistics":paired(a,b,|o|o.relay_voltage[j])})).collect::<Vec<_>>(),
        "relaySpikes":relays.iter().enumerate().map(|(j,i)|json!({"index":i,"statistics":paired(a,b,|o|o.relay_spikes[j])})).collect::<Vec<_>>(),
        "exactNeuralTrajectoriesEqual":a.observations.iter().zip(&b.observations).all(|(a,b)| a.seed==b.seed && a.neural_trajectory_hash==b.neural_trajectory_hash)})
}

fn write(path: &Path, value: &Value) -> Result<(), Box<dyn std::error::Error>> {
    fs::write(path, serde_json::to_vec(value)?)?;
    Ok(())
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 5 {
        return Err("usage: neural_vision_probe pilot|confirm|neural-freeze|neural-confirm GRAPH_DIR MAP_DIR OUTPUT_DIR (confirmation reads OUTPUT_DIR/freeze.json)".into());
    }
    let neural = matches!(args[1].as_str(), "neural-freeze" | "neural-confirm");
    let freeze_only = args[1] == "neural-freeze";
    let protocol = if neural { NEURAL_PROTOCOL } else { PROTOCOL };
    let confirm = match args[1].as_str() {
        "pilot" | "neural-freeze" => false,
        "confirm" | "neural-confirm" => true,
        _ => return Err("unknown mode".into()),
    };
    let graph_dir = Path::new(&args[2]);
    let maps = Path::new(&args[3]);
    let output = Path::new(&args[4]);
    fs::create_dir_all(output)?;
    if output.join("pilot-summary.json").exists() {
        let prior: Value = serde_json::from_slice(&fs::read(output.join("pilot-summary.json"))?)?;
        if neural || prior["protocol"] != PROTOCOL {
            return Err(
                "output directory contains a different pilot protocol; preserve its evidence"
                    .into(),
            );
        }
    }
    let bytes = fs::read(graph_dir.join("graph.bin"))?;
    let base: Value = serde_json::from_slice(&fs::read(graph_dir.join("manifest.json"))?)?;
    // Validate before reading CSR offsets or using source annotations.
    Graph::from_bytes(&bytes, &serde_json::to_string(&base)?)?;
    let edges = outgoing(&bytes);
    let audit_bytes = fs::read(maps.join("audit.json"))?;
    let audit: Value = serde_json::from_slice(&audit_bytes)?;
    let frozen: Option<Value> = if confirm {
        Some(serde_json::from_slice(&fs::read(
            output.join("freeze.json"),
        )?)?)
    } else {
        None
    };
    if let Some(f) = &frozen {
        if f["protocol"] != protocol {
            return Err("freeze belongs to a different projection protocol".into());
        }
        if f["gain"].as_f64() != Some(3.) {
            return Err("overlapping-input protocol freezes gain three".into());
        }
        if !neural && !matches!(f["axis"].as_str(), Some("turn" | "flightTurn")) {
            return Err("freeze must name the pilot-selected turn or flightTurn axis".into());
        }
    }
    let families: Vec<&str> = if neural {
        vec!["Tm2"]
    } else if let Some(f) = &frozen {
        vec![f["family"]
            .as_str()
            .ok_or("freeze has no selected family")?]
    } else {
        vec!["Tm2", "Tm20"]
    };
    let seeds: Vec<u64> = if confirm {
        (100..130).collect()
    } else {
        (1..7).collect()
    };
    let mut candidates = vec![];
    let started = Instant::now();
    for family in families {
        let map_bytes = fs::read(maps.join(format!("{family}.json")))?;
        let mapping: Value = serde_json::from_slice(&map_bytes)?;
        let map_hash = hash(&map_bytes);
        if neural && map_hash != NEURAL_MAP_HASH {
            return Err("neural protocol requires its preregistered corrected Tm2 map".into());
        }
        if let Some(f) = &frozen {
            if f["mappingHash"] != map_hash {
                return Err("frozen mapping hash differs".into());
            }
        }
        let mut manifest = base.clone();
        manifest["visionInput"] = mapping.clone();
        let graph = Arc::new(Graph::from_bytes(
            &bytes,
            &serde_json::to_string(&manifest)?,
        )?);
        let (inputs, relays, sham) = populations(&graph, &mapping, &audit, &edges)?;
        if neural {
            let bodies = |indices: &[u32]| {
                indices
                    .iter()
                    .map(|&i| graph.manifest.body_ids[i as usize].clone())
                    .collect::<Vec<_>>()
            };
            let expected = json!({
                "protocol":NEURAL_PROTOCOL,"family":"Tm2","gain":3,
                "mappingHash":map_hash,"graphHash":graph.manifest.graph_hash,
                "annotationHash":mapping["annotationHash"],"auditHash":hash(&audit_bytes),
                "manifestHash":hash(&serde_json::to_vec(&manifest)?),
                "probeSourceHash":hash(include_bytes!("neural_vision_probe.rs")),
                "sensorySourceHash":hash(include_bytes!("../src/sensory.rs")),
                "lifSourceHash":hash(include_bytes!("../src/lif.rs")),
                "graphSourceHash":hash(include_bytes!("../src/graph.rs")),
                "fieldsSourceHash":hash(include_bytes!("../src/environment/fields.rs")),
                "geometrySourceHash":hash(include_bytes!("../src/environment/mod.rs")),
                "lifParams":LifParams::default(),"warmupTicks":WARMUP,"measuredTicks":TICKS,
                "seeds":(100..130).collect::<Vec<u64>>(),
                "inputs":inputs,"inputBodyIds":bodies(&inputs),
                "relays":relays,"relayBodyIds":bodies(&relays),
                "sham":sham,"shamBodyIds":bodies(&sham),
                "conditions":neural_stimuli()?.into_iter().map(|c|c.0).collect::<Vec<_>>(),
                "primaryContrasts":[["basis-0","basis-4"],["basis-1","basis-5"],["basis-2","basis-6"],["basis-3","basis-7"],["lamp-left-1","lamp-right-1"],["lamp-left-2","lamp-left-0.5"],["lamp-right-2","lamp-right-0.5"]],
                "endpoint":"Every cell in the sorted non-input/non-motor union on audited relayPath and readoutPath witnesses. Voltage is primary; no post-hoc neuron selection. This is not a pure anatomical cell class or a unique causal route.",
                "statistics":"Two-sided simultaneous Bonferroni 95% paired t intervals over 7 * relay count, df29; every contrast needs at least one corrected interval excluding zero. Spikes and all motor outputs are descriptive.",
                "exactGates":"Input-silenced basis and all lamp rates match dark-inputs full neural trajectories. Wall/furniture match dark; opening matches visible. Zero-outgoing sham retains unsilenced downstream voltage/spike vectors exactly. No post-hoc tolerance."
            });
            if freeze_only {
                let mut file = fs::OpenOptions::new()
                    .write(true)
                    .create_new(true)
                    .open(output.join("freeze.json"))?;
                file.write_all(&serde_json::to_vec_pretty(&expected)?)?;
                eprintln!("Frozen {} inputs and {} endpoints; no Brain was instantiated and no held-out seed was run.",inputs.len(),relays.len());
                return Ok(());
            }
            if frozen.as_ref() != Some(&expected) {
                return Err("neural freeze no longer matches source identities, conditions or endpoint population".into());
            }
            // A failed or interrupted execution cannot silently consume the held-out panel again.
            let mut started_file = fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(output.join("run-started.json"))?;
            started_file.write_all(&serde_json::to_vec(&json!({"protocol":NEURAL_PROTOCOL,"freezeHash":hash(&fs::read(output.join("freeze.json"))?)}))?)?;
        }
        let effective_population: [f64; 8] = std::array::from_fn(|b| {
            mapping["entries"]
                .as_array()
                .unwrap()
                .iter()
                .map(|entry| entry["weights"][b].as_f64().unwrap())
                .sum()
        });
        let gains = if let Some(f) = &frozen {
            vec![f["gain"].as_f64().ok_or("freeze missing gain")?]
        } else {
            vec![3.]
        };
        for gain in gains {
            let mut conditions = vec![];
            let conditions_to_run = if neural {
                neural_stimuli()?
            } else {
                stimuli(confirm)?
            };
            for (name, sample, silence) in conditions_to_run {
                let currents = cue_currents(&graph, &sample, CuePathway::Vision, gain)?;
                let silenced = match silence {
                    "inputs" => inputs.as_slice(),
                    "sham" => sham.as_slice(),
                    _ => &[],
                };
                let observations = seeds
                    .iter()
                    .map(|&seed| run(&graph, seed, &currents, silenced, &inputs, &relays))
                    .collect::<Result<Vec<_>, _>>()?;
                let effective_currents: Vec<_> = currents
                    .iter()
                    .map(|&(i, v)| (i, if silenced.contains(&i) { 0. } else { v }))
                    .collect();
                conditions.push(Condition {
                    name: name.clone(),
                    sample,
                    requested_current_hash: hash(&serde_json::to_vec(&currents)?),
                    current_hash: hash(&serde_json::to_vec(&effective_currents)?),
                    total_current: effective_currents.iter().map(|(_, v)| v).sum(),
                    silence: silence.into(),
                    observations,
                });
                eprintln!(
                    "{} {family} gain {gain}: {name} complete ({:.1}s)",
                    args[1],
                    started.elapsed().as_secs_f64()
                );
            }
            let left = condition(&conditions, "lamp-left-1");
            let right = condition(&conditions, "lamp-right-1");
            let turn = paired(left, right, |o| o.turn);
            let flight = paired(left, right, |o| o.flight_turn);
            let mut comparisons = vec![comparison(left, right, &relays)];
            for b in 0..4 {
                comparisons.push(comparison(
                    condition(&conditions, &format!("basis-{b}")),
                    condition(&conditions, &format!("basis-{}", b + 4)),
                    &relays,
                ));
            }
            if confirm {
                let intensity = if neural {
                    [
                        ("lamp-left-2", "lamp-left-0.5"),
                        ("lamp-right-2", "lamp-right-0.5"),
                    ]
                } else {
                    [
                        ("lamp-left-0.5", "lamp-left-2"),
                        ("lamp-right-0.5", "lamp-right-2"),
                    ]
                };
                for (a, b) in intensity.into_iter().chain([
                    ("wall", "dark"),
                    ("furniture", "dark"),
                    ("opening", "lamp-right-1"),
                    ("lamp-left-inputs", "lamp-right-inputs"),
                    ("lamp-left-inputs", "dark-inputs"),
                    ("lamp-left-sham", "lamp-right-sham"),
                ]) {
                    comparisons.push(comparison(
                        condition(&conditions, a),
                        condition(&conditions, b),
                        &relays,
                    ));
                }
            }
            let primary = frozen.as_ref().filter(|_| !neural).map(|f| {
                let stats=if f["axis"]=="turn" { &turn } else { &flight };
                json!({"axis":f["axis"],"statistics":stats,"directionalGatePassed":stats.excludes_zero,"pilotMean":f["statistics"]["mean"],"sameSignAsPilot":f["statistics"]["mean"].as_f64().map(|m|m.signum()==stats.mean.signum())})
            });
            let frozen_neural = frozen.as_ref().filter(|_| neural);
            let freeze_hash = if confirm {
                Some(hash(&fs::read(output.join("freeze.json"))?))
            } else {
                None
            };
            let report = json!({"protocol":protocol,"mode":args[1],"family":family,"gain":gain,"mappingHash":map_hash,"effectivePopulationPerDirection":effective_population,"graphHash":graph.manifest.graph_hash,"annotationHash":mapping["annotationHash"],"manifestHash":hash(&serde_json::to_vec(&manifest)?),"auditHash":hash(&audit_bytes),"probeSourceHash":hash(include_bytes!("neural_vision_probe.rs")),"sensorySourceHash":hash(include_bytes!("../src/sensory.rs")),"lifSourceHash":hash(include_bytes!("../src/lif.rs")),"graphSourceHash":hash(include_bytes!("../src/graph.rs")),
                "fieldsSourceHash":hash(include_bytes!("../src/environment/fields.rs")),
                "geometrySourceHash":hash(include_bytes!("../src/environment/mod.rs")),"frozenPrimary":primary,"frozenNeural":frozen_neural,"freezeHash":freeze_hash,"warmupTicks":WARMUP,"measuredTicks":TICKS,"lifParams":LifParams::default(),"fixedPose":{"position":{"x":0,"z":0},"heading":0},"inputs":inputs,"relays":relays,"sham":sham,"shamSelection":"Ascending graph indices, zero outgoing edges, matched input count, outside all mapped inputs, audited relay paths and motor readouts; this tests silencing machinery without a connected-neuron perturbation.","conditions":conditions,"comparisons":comparisons,"scope":"Paired seed means. Neural protocol acceptance belongs to the independent Bonferroni analysis of frozenNeural endpoints; all intervals computed here are descriptive for that protocol. In the separate motor protocol only frozenPrimary is confirmatory. Actual retained paths establish connectivity, not a unique causal route. Basis stimuli replace only recorded brightness at the sensory seam; lamps use production FieldSet. Neural hashes cover voltage, spikes and refractory state on all measured ticks."});
            let filename = format!("{}-{family}-{gain}.json", args[1]);
            write(&output.join(&filename), &report)?;
            let (axis, stats) = if flight.absolute_t.unwrap_or(0.) > turn.absolute_t.unwrap_or(0.) {
                ("flightTurn", &flight)
            } else {
                ("turn", &turn)
            };
            candidates.push(json!({"protocol":PROTOCOL,"family":family,"gain":gain,"population":inputs.len(),"mappingHash":map_hash,"axis":axis,"statistics":stats,"report":filename}));
        }
    }
    if !confirm {
        candidates.sort_by(|a, b| {
            b["statistics"]["absoluteT"]
                .as_f64()
                .unwrap_or(0.)
                .total_cmp(&a["statistics"]["absoluteT"].as_f64().unwrap_or(0.))
                .then(a["population"].as_u64().cmp(&b["population"].as_u64()))
                .then(
                    a["gain"]
                        .as_f64()
                        .unwrap()
                        .total_cmp(&b["gain"].as_f64().unwrap()),
                )
        });
        let selected = candidates
            .iter()
            .find(|c| c["statistics"]["excludesZero"] == true)
            .cloned();
        write(
            &output.join("pilot-summary.json"),
            &json!({"protocol":PROTOCOL,"candidates":candidates,"selected":selected,"rule":"Exactly Tm2/Tm20 at gain3, seeds1..6. Largest absolute paired t for mirrored actual lamps in existing turn or flightTurn, pilot 95% interval excludes zero; ties smaller input population. No desired motor sign."}),
        )?;
        // The caller reviews the pilot and explicitly writes freeze.json; this process never runs held-out seeds.
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn neural_panel_matches_each_silenced_stimulus_to_its_unsilenced_sample() {
        let panel = neural_stimuli().unwrap();
        assert_eq!(panel.len(), 37);
        assert_eq!(panel.iter().map(|c| &c.0).collect::<HashSet<_>>().len(), 37);
        let mut pairs: Vec<_> = (0..8)
            .map(|b| (format!("basis-{b}"), format!("basis-{b}-inputs")))
            .collect();
        for side in ["left", "right"] {
            for rate in ["0.5", "1", "2"] {
                let silenced = if rate == "1" {
                    format!("lamp-{side}-inputs")
                } else {
                    format!("lamp-{side}-{rate}-inputs")
                };
                pairs.push((format!("lamp-{side}-{rate}"), silenced));
            }
        }
        pairs.push(("dark".into(), "dark-inputs".into()));
        for (plain, silenced) in pairs {
            let a = panel.iter().find(|c| c.0 == plain).unwrap();
            let b = panel.iter().find(|c| c.0 == silenced).unwrap();
            assert_eq!(a.1, b.1);
            assert_eq!(a.2, "none");
            assert_eq!(b.2, "inputs");
        }
    }
    #[test]
    fn optical_controls_isolate_visibility_at_the_same_pose() {
        let dark = sample(None, 0., "").unwrap();
        let visible = sample(Some((1., 1.)), 0., "").unwrap();
        assert!(visible.vision.brightness[2] > 0.);
        for blocker in ["wall", "furniture"] {
            let blocked = sample(Some((1., 1.)), 0., blocker).unwrap();
            assert_eq!(blocked.vision.brightness, dark.vision.brightness);
            assert_eq!(blocked.vision.blocked, visible.vision.brightness);
        }
        assert_eq!(
            sample(Some((1., 1.)), 0., "opening").unwrap().vision,
            visible.vision
        );
    }
    #[test]
    fn equal_dose_basis_and_seed_level_statistics() {
        for (_, s, _) in stimuli(false)
            .unwrap()
            .into_iter()
            .filter(|(n, _, _)| n.starts_with("basis-") || n == "uniform")
        {
            assert_eq!(s.vision.brightness.iter().sum::<f64>(), 1.);
        }
        let s = statistics(&[-3., -2., -1., 1., 2., 3.]);
        assert_eq!(s.mean, 0.);
        assert!(!s.excludes_zero);
        let s = statistics(&[1.; 6]);
        assert_eq!(s.ci95, [1., 1.]);
        assert!(s.excludes_zero);
    }
}
