//! Preregistered fixed-RGB diagnostics; never captures images or steers a body.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sim::{
    sensory::{motor_readout_indices, retinal_currents},
    vision::EyeProfile,
    Brain, Graph, LifParams, MotorOutput, RetinalMap, PRNG_ID,
};
use std::{
    collections::{BTreeMap, BTreeSet, HashMap, HashSet, VecDeque},
    fs,
    io::Write,
    path::{Component, Path},
    sync::Arc,
    time::Instant,
};

const WARMUP: usize = 60;
const TICKS: usize = 100;
const GAIN: f64 = 3.;
fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn json_hash(value: &impl Serialize) -> String {
    hash(&serde_json::to_vec(value).unwrap())
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Condition {
    name: String,
    rgb_path: String,
    rgb_sha256: String,
    chromatic: bool,
    silence_inputs: bool,
    zero_current: bool,
    permute_rows: bool,
    origin: Value,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Pack {
    version: u32,
    slice: String,
    phase: String,
    profile: Value,
    conditions: Vec<Condition>,
    primary_contrasts: Vec<[String; 2]>,
    exact_pairs: Vec<[String; 2]>,
    chromatic_off_pairs: Vec<[String; 2]>,
    dose_pairs: Vec<DosePair>,
    #[serde(default)]
    reslice: Option<ResliceBinding>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BoundFile {
    path: String,
    sha256: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ResliceBinding {
    proposal: BoundFile,
    baseline: BoundFile,
    currents: BoundFile,
    protocol: BoundFile,
    manifest_sha256: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DosePair {
    a: String,
    b: String,
    scope: String,
    #[serde(default)]
    equal_brightness: bool,
}
#[derive(Deserialize)]
struct Entry {
    index: u32,
    eye: String,
    channel: usize,
}
struct Model {
    graph: Arc<Graph>,
    map: RetinalMap,
    entries: Vec<Entry>,
    inputs: Vec<u32>,
    endpoints: Vec<u32>,
    downstream: Vec<u32>,
    readouts: Vec<u32>,
    identities: Value,
}
struct Stimulus {
    spec: Condition,
    rgb: Vec<u8>,
    requested: Vec<(u32, f64)>,
    effective: Vec<(u32, f64)>,
}

fn outgoing(bytes: &[u8]) -> Vec<Vec<u32>> {
    let word = |at| u32::from_le_bytes(bytes[at..at + 4].try_into().unwrap()) as usize;
    let n = word(12);
    let mut edges = vec![vec![]; n];
    for post in 0..n {
        for edge in word(20 + post * 4)..word(24 + post * 4) {
            edges[word(20 + (n + 1 + edge) * 4)].push(post as u32);
        }
    }
    edges
}

fn load_model(graph_dir: &Path, map_dir: &Path) -> Result<Model, Box<dyn std::error::Error>> {
    let graph_bytes = fs::read(graph_dir.join("graph.bin"))?;
    let manifest_text = fs::read_to_string(graph_dir.join("manifest.json"))?;
    let graph = Arc::new(Graph::from_bytes(&graph_bytes, &manifest_text)?);
    let map_text = fs::read_to_string(map_dir.join("retinal-map.json"))?;
    let mapping: Value = serde_json::from_str(&map_text)?;
    let id = &mapping["identities"];
    let capture = &mapping["profile"]["capture"];
    let profile: EyeProfile = serde_json::from_value(json!({
        "profileHash":id["profileHash"],"layoutHash":id["layoutHash"],"rigHash":id["rigHash"],
        "colorModelHash":id["colorModelHash"],"width":capture["width"],"height":capture["height"],
        "sampleCount":mapping["profile"]["layout"]["cells"].as_array().ok_or("missing layout")?.len()
    }))?;
    let map = RetinalMap::from_json(&graph, &profile, &map_text)?;
    let entries: Vec<Entry> = serde_json::from_value(mapping["entries"].clone())?;
    let inputs: BTreeSet<u32> = entries.iter().map(|entry| entry.index).collect();
    if inputs.len() != 1176 {
        return Err("protocol requires all 1176 frozen injected indices".into());
    }
    let readouts = motor_readout_indices(&graph);
    if !inputs.is_disjoint(&readouts.iter().copied().collect()) {
        return Err("inputs overlap motor readouts".into());
    }
    let edges = outgoing(&graph_bytes);
    let audit_bytes = fs::read(map_dir.join("audit.json"))?;
    let audit: Value = serde_json::from_slice(&audit_bytes)?;
    let bodies: HashMap<&str, u32> = graph
        .manifest
        .body_ids
        .iter()
        .enumerate()
        .map(|(i, body)| (body.as_str(), i as u32))
        .collect();
    let mut endpoints = BTreeSet::new();
    let mut audited_inputs = BTreeSet::new();
    for cell in audit["cells"].as_array().ok_or("missing audited cells")? {
        let index = cell["index"].as_u64().ok_or("missing audited index")? as u32;
        if !inputs.contains(&index) {
            continue;
        }
        audited_inputs.insert(index);
        for key in ["relayPath", "readoutPath"] {
            let path = cell[key]
                .as_array()
                .ok_or("missing audited path")?
                .iter()
                .map(|body| {
                    bodies
                        .get(body.as_str().ok_or("invalid path body")?)
                        .copied()
                        .ok_or("audited body absent")
                })
                .collect::<Result<Vec<_>, _>>()?;
            if path.first() != Some(&index)
                || path
                    .windows(2)
                    .any(|pair| !edges[pair[0] as usize].contains(&pair[1]))
            {
                return Err("audited path is not a directed path from its injected cell".into());
            }
            endpoints.extend(
                path.into_iter()
                    .skip(1)
                    .filter(|i| !inputs.contains(i) && !readouts.contains(i)),
            );
        }
    }
    if audited_inputs != inputs || endpoints.is_empty() {
        return Err("incomplete preregistered endpoint provenance".into());
    }
    let mut reachable = inputs.clone();
    let mut queue: VecDeque<u32> = inputs.iter().copied().collect();
    while let Some(index) = queue.pop_front() {
        for &target in &edges[index as usize] {
            if reachable.insert(target) {
                queue.push_back(target);
            }
        }
    }
    let downstream: Vec<_> = reachable
        .into_iter()
        .filter(|index| !inputs.contains(index) && !readouts.contains(index))
        .collect();
    let mut readouts: Vec<_> = readouts.into_iter().collect();
    readouts.sort_unstable();
    let identities = json!({"graphHash":hash(&graph_bytes),"manifestHash":hash(manifest_text.as_bytes()),
        "mapHash":hash(map_text.as_bytes()),"auditHash":hash(&audit_bytes),"mappingIdentities":id,"profile":profile,
        "sources":{"probe":hash(include_bytes!("retinal_neural_probe.rs")),"lif":hash(include_bytes!("../src/lif.rs")),
        "graph":hash(include_bytes!("../src/graph.rs")),"retinalMap":hash(include_bytes!("../src/graph/retinal.rs")),
        "sensory":hash(include_bytes!("../src/sensory.rs"))}});
    Ok(Model {
        graph,
        map,
        entries,
        inputs: inputs.into_iter().collect(),
        endpoints: endpoints.into_iter().collect(),
        downstream,
        readouts,
        identities,
    })
}

fn controlled_currents(
    entries: &[Entry],
    requested: &[(u32, f64)],
    condition: &Condition,
) -> Vec<(u32, f64)> {
    let mut values: Vec<_> = requested
        .iter()
        .zip(entries)
        .map(|(&(index, value), entry)| {
            assert_eq!(index, entry.index);
            (
                index,
                if condition.zero_current
                    || condition.silence_inputs
                    || (!condition.chromatic && entry.channel == 1)
                {
                    0.
                } else {
                    value
                },
            )
        })
        .collect();
    if condition.permute_rows {
        let mut groups: BTreeMap<(&str, usize), Vec<usize>> = BTreeMap::new();
        for (position, entry) in entries.iter().enumerate() {
            groups
                .entry((&entry.eye, entry.channel))
                .or_default()
                .push(position);
        }
        for group in groups.values_mut() {
            group.sort_by_key(|&position| entries[position].index);
            let currents: Vec<_> = group.iter().map(|&position| values[position].1).collect();
            for (j, &position) in group.iter().enumerate() {
                values[position].1 = currents[(j + 1) % group.len()];
            }
        }
    }
    values
}

fn read_bound(directory: &Path, file: &BoundFile) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    let path = Path::new(&file.path);
    if path.is_absolute()
        || path
            .components()
            .any(|p| !matches!(p, Component::Normal(_)))
    {
        return Err("bound input path must be local to its pack".into());
    }
    let bytes = fs::read(directory.join(path))?;
    if hash(&bytes) != file.sha256 {
        return Err("bound input identity mismatch".into());
    }
    Ok(bytes)
}

fn protocol(version: u32, phase: &str) -> Result<(&'static str, Vec<u64>), String> {
    match (version, phase) {
        (1, "diagnostic") => Ok(("retinal-fixed-input-diagnostic-v1", (1..7).collect())),
        (1, "confirmation") => Ok(("retinal-fixed-input-diagnostic-v1", (100..130).collect())),
        (2, "reslice-confirmation") => Ok((
            "retinal-supported-area-confirmation-v2",
            (200..230).collect(),
        )),
        _ => Err("unsupported protocol version/seed phase combination".into()),
    }
}

fn require_cutover(manifest: &Value, mapping: &Value) -> Result<(), String> {
    let id = &mapping["identities"];
    let expected = json!({"sourceGraphHash":id["graphHash"],"annotationHash":id["annotationHash"],
        "sourceMapHash":id["baselineMapHash"],"weightSum":mapping["budget"]["baselineWeightSum"]});
    if manifest.get("visionInput").is_some() || manifest["retinalBudget"] != expected {
        return Err(
            "reslice freeze/run requires the completed compact retinalBudget cutover".into(),
        );
    }
    Ok(())
}

fn verify_reslice(
    model: &Model,
    pack: &Pack,
    raw_pack: &Value,
    directory: &Path,
    stimuli: &[Stimulus],
    seeds: &[u64],
) -> Result<Value, Box<dyn std::error::Error>> {
    let binding = pack
        .reslice
        .as_ref()
        .ok_or("v2 requires accepted reslice bindings")?;
    let proposal_bytes = read_bound(directory, &binding.proposal)?;
    let proposal: Value = serde_json::from_slice(&proposal_bytes)?;
    let baseline: Value = serde_json::from_slice(&read_bound(directory, &binding.baseline)?)?;
    let currents: Value = serde_json::from_slice(&read_bound(directory, &binding.currents)?)?;
    read_bound(directory, &binding.protocol)?;
    if model.identities["manifestHash"] != binding.manifest_sha256
        || model.identities["graphHash"] != baseline["identities"]["graphHash"]
        || model.identities["mapHash"] != proposal["mapSha256"]
        || binding.baseline.sha256 != proposal["sourceHashes"]["original08Freeze"]
        || currents["proposalHash"] != hash(&proposal_bytes)
        || currents["mapHash"] != model.identities["mapHash"]
        || currents["graphHash"] != model.identities["graphHash"]
        || raw_pack["analysisSha256"]
            != hash(include_bytes!(
                "../../../specs/retinal-vision/assets/08/analyze.py"
            ))
        || raw_pack["statisticsOwnerSha256"]
            != hash(include_bytes!(
                "../../../scripts/connectome/analyze_neural_vision.py"
            ))
        || binding.protocol.sha256
            != hash(include_bytes!(
                "../../../specs/retinal-vision/assets/08-reslice/preregistration.md"
            ))
        || raw_pack["preregistrationSha256"] != binding.protocol.sha256
    {
        return Err("reslice source/accepted-input identity differs".into());
    }
    for (name, actual) in [
        ("inputs", &model.inputs),
        ("endpoints", &model.endpoints),
        ("downstream", &model.downstream),
        ("motorReadouts", &model.readouts),
    ] {
        if json!(actual) != baseline[name] {
            return Err(format!("reslice changed retained {name}").into());
        }
    }
    if model.endpoints.len() != 438
        || json!(&model.endpoints) != proposal["endpoints"]
        || json!(seeds) != proposal["proposedSeeds"]
        || json!(LifParams::default()) != proposal["lifParams"]
        || proposal["gain"] != GAIN
        || proposal["warmupTicks"] != WARMUP
        || proposal["measuredTicks"] != TICKS
        || proposal["prng"] != PRNG_ID
        || proposal["voltageResponseFloor"] != 1e-9
        || proposal["statistics"]["comparisonsByPanel"][&pack.slice]
            != 2 * 438 * pack.primary_contrasts.len()
    {
        return Err("reslice changed retained model/population/statistical contract".into());
    }
    for key in [
        "conditions",
        "primaryContrasts",
        "exactPairs",
        "chromaticOffPairs",
        "dosePairs",
    ] {
        if raw_pack[key] != proposal["panels"][&pack.slice][key] {
            return Err(format!("reslice changed accepted {key}").into());
        }
    }
    let expected_currents = currents["panels"][&pack.slice]
        .as_array()
        .ok_or("accepted current panel")?;
    if expected_currents.len() != stimuli.len() {
        return Err("accepted current panel incomplete".into());
    }
    for (actual, expected) in stimuli.iter().zip(expected_currents) {
        if expected["name"] != actual.spec.name
            || expected["rgbSha256"] != hash(&actual.rgb)
            || serde_json::from_value::<Vec<(u32, f64)>>(expected["requested"].clone())?
                != actual.requested
            || serde_json::from_value::<Vec<(u32, f64)>>(expected["effective"].clone())?
                != actual.effective
        {
            return Err("post-cutover currents differ from accepted native input evidence".into());
        }
    }
    let find = |name: &str| {
        stimuli
            .iter()
            .find(|s| s.spec.name == name)
            .ok_or("missing accepted control")
    };
    for [a, b] in &pack.chromatic_off_pairs {
        if find(a)?.effective != find(b)?.effective {
            return Err("v2 requires exact chromatic-off vectors".into());
        }
    }
    for pair in pack.dose_pairs.iter().filter(|p| p.equal_brightness) {
        let a = find(&pair.a)?;
        let b = find(&pair.b)?;
        if model
            .entries
            .iter()
            .zip(a.requested.iter().zip(&b.requested))
            .any(|(e, (a, b))| e.channel == 0 && a != b)
        {
            return Err("v2 requires exact Tm2 vectors within color swaps".into());
        }
        let luminance = |rgb: &[u8]| {
            rgb.iter()
                .zip([0.2126, 0.7152, 0.0722])
                .map(|(&v, c)| v as f64 / 255. * c)
                .sum::<f64>()
        };
        if a.rgb
            .chunks_exact(3)
            .zip(b.rgb.chunks_exact(3))
            .any(|(a, b)| luminance(a) != luminance(b))
        {
            return Err("v2 requires exact diagnostic luminance within color swaps".into());
        }
    }
    if pack.slice == "09" {
        let difference = |level| -> Result<Vec<f64>, &str> {
            Ok(find(&format!("color-{level}-a"))?
                .effective
                .iter()
                .zip(&find(&format!("color-{level}-b"))?.effective)
                .map(|(a, b)| a.1 - b.1)
                .collect())
        };
        if difference(1)? != difference(2)? {
            return Err("v2 color contrast differs across luminance contexts".into());
        }
    }
    Ok(
        json!({"retainedPopulationsExactlyEqual":true,"acceptedCurrentVectorsExactlyEqual":true,
        "exactBrightnessControls":true,"colorContrastAcrossContextsExactlyEqual":true,
        "acceptedProposalHash":binding.proposal.sha256,"acceptedCurrentEvidenceHash":binding.currents.sha256,
        "baselineFreezeHash":binding.baseline.sha256,"manifestHash":binding.manifest_sha256}),
    )
}

fn load_stimuli(
    model: &Model,
    pack: &Pack,
    directory: &Path,
) -> Result<Vec<Stimulus>, Box<dyn std::error::Error>> {
    let mut names = HashSet::new();
    let mut stimuli = vec![];
    for condition in &pack.conditions {
        if !names.insert(condition.name.clone()) {
            return Err("duplicate condition name".into());
        }
        let path = Path::new(&condition.rgb_path);
        if path.is_absolute()
            || path
                .components()
                .any(|p| !matches!(p, Component::Normal(_)))
        {
            return Err("input path must be local to its pack".into());
        }
        let rgb = fs::read(directory.join(path))?;
        if hash(&rgb) != condition.rgb_sha256 {
            return Err(format!("RGB identity mismatch: {}", condition.name).into());
        }
        let requested = retinal_currents(&model.map, &rgb, GAIN)?;
        let effective = controlled_currents(&model.entries, &requested, condition);
        stimuli.push(Stimulus {
            spec: condition.clone(),
            rgb,
            requested,
            effective,
        });
    }
    if pack.primary_contrasts.is_empty()
        || pack
            .primary_contrasts
            .iter()
            .flatten()
            .any(|name| !names.contains(name))
    {
        return Err("invalid preregistered contrasts".into());
    }
    Ok(stimuli)
}

fn dose(entries: &[Entry], currents: &[(u32, f64)]) -> Value {
    let mut by_eye_channel = [[0.; 2]; 2];
    for (entry, &(_, value)) in entries.iter().zip(currents) {
        by_eye_channel[usize::from(entry.eye == "R")][entry.channel] += value;
    }
    json!({"total":currents.iter().map(|(_, v)| v).sum::<f64>(),"maximumCell":currents.iter().map(|(_, v)| *v).fold(0., f64::max),
        "byEyeChannel":by_eye_channel,"currentHash":json_hash(&currents)})
}
fn control_checks(model: &Model, pack: &Pack, stimuli: &[Stimulus]) -> Result<Value, String> {
    let find = |name: &str| {
        stimuli
            .iter()
            .find(|s| s.spec.name == name)
            .ok_or_else(|| format!("missing control {name}"))
    };
    let mut checks = vec![];
    for [a, b] in &pack.exact_pairs {
        let a = find(a)?;
        let b = find(b)?;
        if a.effective != b.effective || a.spec.silence_inputs != b.spec.silence_inputs {
            return Err("exact control inputs are unequal".into());
        }
        checks.push(
            json!({"kind":"exact effective input","a":a.spec.name,"b":b.spec.name,"passed":true}),
        );
    }
    for [a, b] in &pack.chromatic_off_pairs {
        let a = find(a)?;
        let b = find(b)?;
        let error = a
            .effective
            .iter()
            .zip(&b.effective)
            .map(|(a, b)| (a.1 - b.1).abs())
            .fold(0., f64::max);
        if a.spec.chromatic || b.spec.chromatic || error > 1e-12 {
            return Err("chromatic-off brightness control differs".into());
        }
        checks.push(json!({"kind":"chromatic-off current","a":a.spec.name,"b":b.spec.name,"maximumDifference":error,"passed":true}));
    }
    for pair in &pack.dose_pairs {
        let a = find(&pair.a)?;
        let b = find(&pair.b)?;
        let totals = |s: &Stimulus| {
            let mut sums = [0.; 4];
            for (entry, (_, current)) in model.entries.iter().zip(&s.effective) {
                sums[usize::from(entry.eye == "R") * 2 + entry.channel] += current;
            }
            sums
        };
        let left = totals(a);
        let right = totals(b);
        let error = match pair.scope.as_str() {
            "total" => (left.iter().sum::<f64>() - right.iter().sum::<f64>()).abs(),
            "eyeChannel" => left
                .iter()
                .zip(right)
                .map(|(a, b)| (a - b).abs())
                .fold(0., f64::max),
            _ => return Err("unknown dose comparison".into()),
        };
        if error > 1e-9 {
            return Err("matched-dose control exceeds tolerance".into());
        }
        let mut brightness_error = 0.;
        let mut luminance_error = 0.;
        if pair.equal_brightness {
            brightness_error = model
                .entries
                .iter()
                .zip(a.requested.iter().zip(&b.requested))
                .filter(|(entry, _)| entry.channel == 0)
                .map(|(_, (a, b))| (a.1 - b.1).abs())
                .fold(0., f64::max);
            let luminance = |rgb: &[u8]| {
                rgb.iter()
                    .zip([0.2126, 0.7152, 0.0722])
                    .map(|(&v, c)| v as f64 / 255. * c)
                    .sum::<f64>()
            };
            luminance_error = a
                .rgb
                .chunks_exact(3)
                .zip(b.rgb.chunks_exact(3))
                .map(|(a, b)| (luminance(a) - luminance(b)).abs())
                .fold(0., f64::max);
            if brightness_error > 1e-12 || luminance_error > 1e-12 {
                return Err("color pair leaks diagnostic brightness".into());
            }
        }
        checks.push(json!({"kind":"matched dose","a":pair.a,"b":pair.b,"scope":pair.scope,"doseDifference":error,
            "brightnessCurrentMaximumDifference":brightness_error,"luminanceMaximumDifference":luminance_error,"passed":true}));
    }
    for stimulus in stimuli.iter().filter(|s| s.spec.permute_rows) {
        let mut original = stimulus.spec.clone();
        original.permute_rows = false;
        let original = controlled_currents(&model.entries, &stimulus.requested, &original);
        let before = dose(&model.entries, &original);
        let after = dose(&model.entries, &stimulus.effective);
        let before: Vec<Vec<f64>> =
            serde_json::from_value(before["byEyeChannel"].clone()).map_err(|e| e.to_string())?;
        let after: Vec<Vec<f64>> =
            serde_json::from_value(after["byEyeChannel"].clone()).map_err(|e| e.to_string())?;
        let error = before
            .iter()
            .flatten()
            .zip(after.iter().flatten())
            .map(|(a, b)| (a - b).abs())
            .fold(0., f64::max);
        if error > 1e-12 {
            return Err("row permutation changes channel dose".into());
        }
        checks.push(json!({"kind":"permutation dose","condition":stimulus.spec.name,"maximumDifference":error,"passed":true}));
    }
    Ok(Value::Array(checks))
}

fn state_bytes(brain: &Brain, bytes: &mut Vec<u8>) {
    bytes.clear();
    for ((voltage, spike), refractory) in brain
        .voltage()
        .iter()
        .zip(brain.spikes())
        .zip(brain.refractory())
    {
        bytes.extend(voltage.to_le_bytes());
        bytes.push(u8::from(*spike));
        bytes.extend(refractory.to_le_bytes());
    }
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Observation {
    seed: u64,
    brain_seed: u64,
    initial_state_hash: String,
    warmup_state_hash: String,
    input_mean_voltage: f64,
    input_spike_count: u64,
    endpoint_mean_voltage: Vec<f64>,
    endpoint_spike_count: Vec<u32>,
    downstream_spike_count: u64,
    downstream_active_cell_count: usize,
    downstream_per_tick: Vec<u32>,
    downstream_spike_counts: Vec<u32>,
    downstream_trajectory_hash: String,
    input_spike_trajectory_hash: String,
    motor_mean: MotorOutput,
    neural_trajectory_hash: String,
}
fn run(
    model: &Model,
    stimulus: &Stimulus,
    seed: u64,
    total_counts: &mut [u64],
) -> Result<Observation, String> {
    let brain_seed = Brain::seed_for_fly(seed, 0);
    let mut brain = Brain::new(model.graph.clone(), brain_seed);
    let mut state = Vec::with_capacity(model.graph.neuron_count() * 13);
    state_bytes(&brain, &mut state);
    let initial_state_hash = hash(&state);
    for _ in 0..WARMUP {
        brain.step();
    }
    state_bytes(&brain, &mut state);
    let warmup_state_hash = hash(&state);
    if stimulus.spec.silence_inputs {
        brain.set_silenced_neurons(&model.inputs)?;
    }
    brain.set_external_current(&stimulus.effective)?;
    let mut counts = vec![0u32; model.downstream.len()];
    let mut result = Observation {
        seed,
        brain_seed,
        initial_state_hash,
        warmup_state_hash,
        input_mean_voltage: 0.,
        input_spike_count: 0,
        endpoint_mean_voltage: vec![0.; model.endpoints.len()],
        endpoint_spike_count: vec![0; model.endpoints.len()],
        downstream_spike_count: 0,
        downstream_active_cell_count: 0,
        downstream_per_tick: Vec::with_capacity(TICKS),
        downstream_spike_counts: vec![],
        downstream_trajectory_hash: String::new(),
        input_spike_trajectory_hash: String::new(),
        motor_mean: MotorOutput {
            thrust: 0.,
            turn: 0.,
            flight_thrust: 0.,
            flight_turn: 0.,
        },
        neural_trajectory_hash: String::new(),
    };
    let mut trajectory = Sha256::new();
    let mut downstream_trajectory = Sha256::new();
    let mut input_spikes = Sha256::new();
    for _ in 0..TICKS {
        let frame = brain.step();
        result.motor_mean.thrust += frame.motor.thrust;
        result.motor_mean.turn += frame.motor.turn;
        result.motor_mean.flight_thrust += frame.motor.flight_thrust;
        result.motor_mean.flight_turn += frame.motor.flight_turn;
        for &index in &model.inputs {
            result.input_mean_voltage += brain.voltage()[index as usize];
            result.input_spike_count += u64::from(brain.spikes()[index as usize]);
        }
        for (j, &index) in model.endpoints.iter().enumerate() {
            result.endpoint_mean_voltage[j] += brain.voltage()[index as usize];
            result.endpoint_spike_count[j] += u32::from(brain.spikes()[index as usize]);
        }
        let mut tick_count = 0;
        for (j, &index) in model.downstream.iter().enumerate() {
            let spike = u32::from(brain.spikes()[index as usize]);
            counts[j] += spike;
            tick_count += spike;
        }
        result.downstream_per_tick.push(tick_count);
        state_bytes(&brain, &mut state);
        trajectory.update(&state);
        state.clear();
        for &index in &model.downstream {
            state.extend(brain.voltage()[index as usize].to_le_bytes());
            state.push(u8::from(brain.spikes()[index as usize]));
            state.extend(brain.refractory()[index as usize].to_le_bytes());
        }
        downstream_trajectory.update(&state);
        for &index in &model.inputs {
            input_spikes.update([u8::from(brain.spikes()[index as usize])]);
        }
    }
    result.input_mean_voltage /= (TICKS * model.inputs.len()) as f64;
    for voltage in &mut result.endpoint_mean_voltage {
        *voltage /= TICKS as f64;
    }
    for (total, &count) in total_counts.iter_mut().zip(&counts) {
        *total += count as u64;
    }
    result.downstream_spike_count = counts.iter().map(|&count| count as u64).sum();
    result.downstream_active_cell_count = counts.iter().filter(|&&count| count > 0).count();
    result.motor_mean.thrust /= TICKS as f64;
    result.motor_mean.turn /= TICKS as f64;
    result.motor_mean.flight_thrust /= TICKS as f64;
    result.motor_mean.flight_turn /= TICKS as f64;
    result.downstream_spike_counts = counts;
    result.downstream_trajectory_hash = format!("{:x}", downstream_trajectory.finalize());
    result.input_spike_trajectory_hash = format!("{:x}", input_spikes.finalize());
    result.neural_trajectory_hash = format!("{:x}", trajectory.finalize());
    Ok(result)
}
fn write_new(path: &Path, bytes: &[u8]) -> Result<(), Box<dyn std::error::Error>> {
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)?;
    file.write_all(bytes)?;
    Ok(())
}
// Flush completed conditions so output memory is bounded by one condition.
fn write_report(
    path: &Path,
    freeze_hash: &str,
    frozen: &Value,
    conditions: impl Iterator<Item = Result<Value, Box<dyn std::error::Error>>>,
    start: Instant,
) -> Result<(), Box<dyn std::error::Error>> {
    let file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)?;
    let mut writer = std::io::BufWriter::new(file);
    writer.write_all(br#"{"freezeHash":"#)?;
    serde_json::to_writer(&mut writer, freeze_hash)?;
    writer.write_all(br#", "frozen":"#)?;
    serde_json::to_writer(&mut writer, frozen)?;
    writer.write_all(br#", "conditions":["#)?;
    for (index, condition) in conditions.enumerate() {
        let condition = condition?;
        if index > 0 {
            writer.write_all(b",")?;
        }
        serde_json::to_writer(&mut writer, &condition)?;
        writer.flush()?;
    }
    writer.write_all(br#"], "elapsedSeconds":"#)?;
    serde_json::to_writer(&mut writer, &start.elapsed().as_secs_f64())?;
    writer.write_all(br#", "scope":"#)?;
    serde_json::to_writer(&mut writer, "offline fixed supplied RGB8; no native renderer, body movement, optical feedback, browser transaction, or navigation acceptance")?;
    writer.write_all(b"}")?;
    writer.flush()?;
    Ok(())
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = std::env::args().collect();
    if args.len() != 6 || !matches!(args[1].as_str(), "freeze" | "run") {
        return Err(
            "usage: retinal_neural_probe freeze|run GRAPH_DIR MAP_DIR INPUT_PACK_JSON OUTPUT_DIR"
                .into(),
        );
    }
    let pack_path = Path::new(&args[4]);
    let pack_bytes = fs::read(pack_path)?;
    let pack: Pack = serde_json::from_slice(&pack_bytes)?;
    if !matches!(pack.slice.as_str(), "08" | "09") {
        return Err("unsupported retinal experiment pack".into());
    }
    let (protocol_id, seeds) = protocol(pack.version, &pack.phase)?;
    if (pack.version == 2) != pack.reslice.is_some() {
        return Err("protocol/reslice binding mismatch".into());
    }
    if pack.version == 2 {
        let manifest: Value =
            serde_json::from_slice(&fs::read(Path::new(&args[2]).join("manifest.json"))?)?;
        let mapping: Value =
            serde_json::from_slice(&fs::read(Path::new(&args[3]).join("retinal-map.json"))?)?;
        require_cutover(&manifest, &mapping)?;
    }
    let model = load_model(Path::new(&args[2]), Path::new(&args[3]))?;
    if pack.profile != model.identities["mappingIdentities"] {
        return Err("input pack profile/map identities differ".into());
    }
    let stimuli = load_stimuli(
        &model,
        &pack,
        pack_path.parent().ok_or("pack needs a directory")?,
    )?;
    let controls = control_checks(&model, &pack, &stimuli)?;
    let raw_pack: Value = serde_json::from_slice(&pack_bytes)?;
    let reslice_checks = if pack.version == 2 {
        verify_reslice(
            &model,
            &pack,
            &raw_pack,
            pack_path.parent().ok_or("pack directory")?,
            &stimuli,
            &seeds,
        )?
    } else {
        Value::Null
    };
    let summaries: Vec<_> = stimuli.iter().map(|stimulus| json!({"condition":stimulus.spec,"requested":dose(&model.entries,&stimulus.requested),"effective":dose(&model.entries,&stimulus.effective)})).collect();
    let expected = json!({"protocol":protocol_id,"slice":pack.slice,"phase":pack.phase,
        "inputPackHash":hash(&pack_bytes),"pack":serde_json::from_slice::<Value>(&pack_bytes)?,"identities":model.identities,
        "gain":GAIN,"lifParams":LifParams::default(),"prng":PRNG_ID,"warmupTicks":WARMUP,"measuredTicks":TICKS,"seeds":seeds,
        "initialState":"native Brain zero voltage, false spikes, zero refractory; no sensory current in warmup",
        "inputs":model.inputs,"currentEntryIndices":model.entries.iter().map(|e|e.index).collect::<Vec<_>>(),
        "currentEntryChannels":model.entries.iter().map(|e|e.channel).collect::<Vec<_>>(),
        "currentEntryEyes":model.entries.iter().map(|e|&e.eye).collect::<Vec<_>>(),"endpoints":model.endpoints,"downstream":model.downstream,"motorReadouts":model.readouts,
        "endpointBodyIds":model.endpoints.iter().map(|&index| &model.graph.manifest.body_ids[index as usize]).collect::<Vec<_>>(),
        "endpointRule":"all non-input/non-motor nodes on every audited directed relay/readout path; no response selection",
        "downstreamRule":"all graph-reachable nodes from any injected index, excluding every injected and motor/readout index",
        "voltageResponseFloor":1e-9,
        "statistics":"mean voltage primary, spike counts secondary; paired two-sided Bonferroni 95% intervals across two endpoint measures times contrasts times cells; motors descriptive",
        "stimuli":summaries,"controlChecks":controls,"resliceChecks":reslice_checks});
    let output = Path::new(&args[5]);
    fs::create_dir_all(output)?;
    if args[1] == "freeze" {
        write_new(
            &output.join("freeze.json"),
            &serde_json::to_vec_pretty(&expected)?,
        )?;
        eprintln!("Frozen {} conditions, {} inputs, {} endpoints, {} full downstream cells; no Brain ran.",stimuli.len(),model.inputs.len(),model.endpoints.len(),model.downstream.len());
        return Ok(());
    }
    let freeze_bytes = fs::read(output.join("freeze.json"))?;
    if serde_json::from_slice::<Value>(&freeze_bytes)? != expected {
        return Err(
            "freeze no longer matches exact inputs, model, source or endpoint identities".into(),
        );
    }
    write_new(
        &output.join("run-started.json"),
        &serde_json::to_vec(&json!({"freezeHash":hash(&freeze_bytes)}))?,
    )?;
    let start = Instant::now();
    let conditions = stimuli.iter().map(|stimulus| {
        let mut downstream_spike_totals = vec![0u64; model.downstream.len()];
        let observations = seeds
            .iter()
            .map(|&seed| run(&model, stimulus, seed, &mut downstream_spike_totals))
            .collect::<Result<Vec<_>, _>>()?;
        let condition = json!({"name":stimulus.spec.name,"rgbSha256":hash(&stimulus.rgb),
            "requested":dose(&model.entries,&stimulus.requested),"effective":dose(&model.entries,&stimulus.effective),
            "requestedCurrentByEntry":stimulus.requested.iter().map(|(_,v)| v).collect::<Vec<_>>(),
            "effectiveCurrentByEntry":stimulus.effective.iter().map(|(_,v)| v).collect::<Vec<_>>(),
            "observations":observations,"downstreamSpikeTotalsByIndex":downstream_spike_totals});
        eprintln!(
            "{} {} complete ({:.1}s)",
            pack.slice,
            stimulus.spec.name,
            start.elapsed().as_secs_f64()
        );
        Ok(condition)
    });
    write_report(
        &output.join("report.json"),
        &hash(&freeze_bytes),
        &expected,
        conditions,
        start,
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cutover_rejects_coexisting_legacy_input_and_changed_budget() {
        let mapping = json!({"identities":{"graphHash":"graph","annotationHash":"annotation","baselineMapHash":"baseline"},"budget":{"baselineWeightSum":7.5}});
        let mut manifest = json!({"retinalBudget":{"sourceGraphHash":"graph","annotationHash":"annotation","sourceMapHash":"baseline","weightSum":7.5}});
        assert!(require_cutover(&manifest, &mapping).is_ok());
        manifest["visionInput"] = json!({"entries":[]});
        assert!(require_cutover(&manifest, &mapping).is_err());
        manifest.as_object_mut().unwrap().remove("visionInput");
        manifest["retinalBudget"]["weightSum"] = json!(8.0);
        assert!(require_cutover(&manifest, &mapping).is_err());
        assert!(protocol(2, "confirmation").is_err());
        assert!(protocol(1, "reslice-confirmation").is_err());
    }
    #[test]
    fn report_flushes_each_condition_and_preserves_json_values() {
        let path = std::env::temp_dir().join(format!("retinal-report-{}.json", std::process::id()));
        let _ = fs::remove_file(&path);
        let expected = vec![
            json!({"name":"quoted \"color\"", "values":[0, 1.5, -2]}),
            json!({"name":"second", "nested":{"seed":42}}),
        ];
        let conditions = expected.iter().enumerate().map(|(index, value)| {
            if index == 1 {
                let prefix = fs::read_to_string(&path).unwrap();
                let partial: Value = serde_json::from_str(&(prefix + "]}"))
                    .expect("first condition is flushed before the next is evaluated");
                assert_eq!(partial["conditions"][0], expected[0]);
            }
            Ok(value.clone())
        });
        write_report(
            &path,
            "fixture-hash",
            &json!({"seeds":[1,2]}),
            conditions,
            Instant::now(),
        )
        .unwrap();
        let report: Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        assert_eq!(report["conditions"], json!(expected));
        assert_eq!(report["freezeHash"], "fixture-hash");
        assert_eq!(report["frozen"], json!({"seeds":[1,2]}));
        assert!(report["elapsedSeconds"].as_f64().unwrap() >= 0.0);
        fs::remove_file(path).unwrap();
    }
    #[test]
    fn controls_preserve_full_input_identity_and_permute_only_within_eye_channel() {
        let entries = vec![
            Entry {
                index: 10,
                eye: "L".into(),
                channel: 0,
            },
            Entry {
                index: 11,
                eye: "L".into(),
                channel: 0,
            },
            Entry {
                index: 12,
                eye: "L".into(),
                channel: 1,
            },
            Entry {
                index: 13,
                eye: "R".into(),
                channel: 0,
            },
        ];
        let requested = vec![(10, 0.), (11, 0.25), (12, 0.5), (13, 0.75)];
        let mut condition = Condition {
            name: "control".into(),
            rgb_path: "unused".into(),
            rgb_sha256: "unused".into(),
            chromatic: true,
            silence_inputs: false,
            zero_current: false,
            permute_rows: true,
            origin: Value::Null,
        };
        assert_eq!(
            controlled_currents(&entries, &requested, &condition),
            vec![(10, 0.25), (11, 0.), (12, 0.5), (13, 0.75)]
        );
        condition.permute_rows = false;
        condition.chromatic = false;
        assert_eq!(
            controlled_currents(&entries, &requested, &condition),
            vec![(10, 0.), (11, 0.25), (12, 0.), (13, 0.75)]
        );
        condition.silence_inputs = true;
        assert_eq!(
            controlled_currents(&entries, &requested, &condition),
            vec![(10, 0.), (11, 0.), (12, 0.), (13, 0.)]
        );
    }
}
