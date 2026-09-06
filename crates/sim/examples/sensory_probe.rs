//! Paired current intervention in the real neural owner; no body or field model.
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sim::{Brain, Graph, Pathway, PRNG_ID};
use std::{sync::Arc, time::Instant};

const WARMUP: usize = 60;
const MEASURE: usize = 100;
const SEEDS: std::ops::Range<u64> = 0..30;

fn run(graph: &Arc<Graph>, seed: u64, inputs: &[u32], gain: f64, silence: &[u32]) -> [f64; 2] {
    let mut brain = Brain::new(graph.clone(), Brain::seed_for_fly(seed, 0));
    for _ in 0..WARMUP {
        brain.step();
    }
    brain.set_silenced_neurons(silence).unwrap();
    brain
        .set_external_current(&inputs.iter().map(|&i| (i, gain)).collect::<Vec<_>>())
        .unwrap();
    let mut sum = [0.0; 2];
    for _ in 0..MEASURE {
        let m = brain.step().motor;
        sum[0] += m.turn;
        sum[1] += m.flight_turn;
    }
    sum.map(|v| v / MEASURE as f64)
}
fn summary(values: &[[f64; 2]]) -> Value {
    let stats = |axis: usize| {
        let n = values.len() as f64;
        let mean = values.iter().map(|v| v[axis]).sum::<f64>() / n;
        let sd = (values.iter().map(|v| (v[axis] - mean).powi(2)).sum::<f64>() / (n - 1.0)).sqrt();
        // Student t(29), two-sided 95%; independent units are seed means, not ticks.
        let half = 2.045229642 * sd / n.sqrt();
        json!({"mean":mean,"sdAcrossSeeds":sd,"ci95":[mean-half,mean+half],"positiveSeeds":values.iter().filter(|v|v[axis]>0.0).count(),"negativeSeeds":values.iter().filter(|v|v[axis]<0.0).count()})
    };
    json!({"turn":stats(0),"flightTurn":stats(1)})
}
fn difference(a: &[[f64; 2]], b: &[[f64; 2]]) -> Vec<[f64; 2]> {
    a.iter()
        .zip(b)
        .map(|(a, b)| [a[0] - b[0], a[1] - b[1]])
        .collect()
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = std::env::args().collect();
    let path = args
        .get(1)
        .ok_or("Pass graph directory and output JSON path")?;
    let output = args.get(2).ok_or("Pass output JSON path")?;
    let bytes = std::fs::read(format!("{path}/graph.bin"))?;
    let manifest = std::fs::read_to_string(format!("{path}/manifest.json"))?;
    let graph = Arc::new(Graph::from_bytes(&bytes, &manifest)?);
    let start = Instant::now();
    let baseline: Vec<_> = SEEDS.map(|s| run(&graph, s, &[], 0.0, &[])).collect();
    let mut results = Vec::new();
    for pathway in ["EXCITATORY_LH_MOTOR", "INHIBITORY_LH_MOTOR", "AOTU"] {
        let (left, right) = if pathway == "AOTU" {
            (graph.pathway("AOTU_LEFT"), graph.pathway("AOTU_RIGHT"))
        } else {
            match &graph.manifest.pathways[pathway] {
                Pathway::Bilateral(p) => (p["L"].as_slice(), p["R"].as_slice()),
                _ => return Err("Expected bilateral pathway".into()),
            }
        };
        let silence: Vec<_> = left.iter().chain(right).copied().collect();
        let ablated_baseline: Vec<_> = SEEDS.map(|s| run(&graph, s, &[], 0.0, &silence)).collect();
        for gain in [0.1, 0.3, 1.0, 3.0] {
            let l: Vec<_> = SEEDS.map(|s| run(&graph, s, left, gain, &[])).collect();
            let r: Vec<_> = SEEDS.map(|s| run(&graph, s, right, gain, &[])).collect();
            let al: Vec<_> = SEEDS
                .map(|s| run(&graph, s, left, gain, &silence))
                .collect();
            let ar: Vec<_> = SEEDS
                .map(|s| run(&graph, s, right, gain, &silence))
                .collect();
            let dl = difference(&l, &baseline);
            let dr = difference(&r, &baseline);
            let dal = difference(&al, &ablated_baseline);
            let dar = difference(&ar, &ablated_baseline);
            let mirrored = difference(&l, &r);
            let row = json!({"pathway":pathway,"gain":gain,"leftCount":left.len(),"rightCount":right.len(),"leftMinusBaseline":summary(&dl),"rightMinusBaseline":summary(&dr),"leftMinusRight":summary(&mirrored),"ablatedLeftMinusAblatedBaseline":summary(&dal),"ablatedRightMinusAblatedBaseline":summary(&dar),"ablatedBaselineMinusBaseline":summary(&difference(&ablated_baseline,&baseline)),"seedMeans":{"baseline":baseline,"left":l,"right":r,"ablatedBaseline":ablated_baseline,"ablatedLeft":al,"ablatedRight":ar}});
            eprintln!(
                "{pathway} gain={gain} after {:.1}s: {}",
                start.elapsed().as_secs_f64(),
                row["leftMinusRight"]
            );
            results.push(row);
        }
    }
    let source_hashes: Value = [
        ("lif.rs", include_str!("../src/lif.rs")),
        ("graph.rs", include_str!("../src/graph.rs")),
        ("sensory_probe.rs", include_str!("sensory_probe.rs")),
    ]
    .into_iter()
    .map(|(name, text)| {
        (
            name.to_string(),
            json!(format!("{:x}", Sha256::digest(text.as_bytes()))),
        )
    })
    .collect();
    let evidence = json!({"graphHash":graph.manifest.graph_hash,"graphProvenance":graph.manifest.provenance,"manifestHash":format!("{:x}",Sha256::digest(manifest.as_bytes())),"sourceHashes":source_hashes,"prng":PRNG_ID,"rootSeeds":SEEDS.collect::<Vec<_>>(),"flyId":0,"params":sim::LifParams::default(),"warmupTicks":WARMUP,"measurementTicks":MEASURE,"conditions":"Every arm starts from the same seed and 60 unstimulated ticks. At tick 60 apply constant current to one annotated side, then average the next 100 motor outputs. Ablation silences both sides of the named pathway starting at tick 60, including voltage/spikes/external/incoming current; ablated comparisons use separately measured ablated no-current baseline. No fields, body feedback, taste or other sensory currents.","uncertainty":"Paired seed means; two-sided Student t(29) 95% confidence interval. Descriptive parameter sweep, not multiplicity-adjusted hypothesis tests.","interpretation":"Positive turn is positive heading (+Z/right at heading zero) when decoded without a sign inversion. Current-response signs alone do not demonstrate attraction, aversion, light avoidance, or shadow preference in a moving body. Identical light/shadow currents yield identical neural trajectories.","elapsedSeconds":start.elapsed().as_secs_f64(),"results":results});
    std::fs::write(output, serde_json::to_string_pretty(&evidence)?)?;
    Ok(())
}
