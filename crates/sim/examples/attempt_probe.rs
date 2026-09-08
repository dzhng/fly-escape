//! Active-work native feasibility benchmark. This is neither campaign content nor browser acceptance.
use serde_json::json;
use sha2::{Digest, Sha256};
use sim::{attempt::*, body::BodyMode, sensory::CuePathway, swarm_lab, Brain, Graph};
use std::{process::Command, sync::Arc, time::Instant};

fn command(program: &str, args: &[&str]) -> String {
    let out = Command::new(program)
        .args(args)
        .output()
        .expect("probe machine command");
    assert!(out.status.success(), "machine command failed: {program}");
    String::from_utf8(out.stdout).unwrap().trim().to_string()
}
fn rss_kib() -> u64 {
    command("ps", &["-o", "rss=", "-p", &std::process::id().to_string()])
        .parse()
        .unwrap()
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = std::env::args().collect();
    let path = args
        .get(1)
        .ok_or("Pass graph directory, fly count, measured ticks, output JSON")?;
    let count: u32 = args.get(2).ok_or("Pass fly count")?.parse()?;
    let ticks: u32 = args.get(3).ok_or("Pass measured ticks")?.parse()?;
    let output = args.get(4).ok_or("Pass output JSON")?;
    if !(1..=100).contains(&count) || !(1..=6000).contains(&ticks) {
        return Err("count1..100, ticks1..6000".into());
    }
    let machine = json!({"os":command("uname", &["-srv"]),"architecture":command("uname", &["-m"]),"model":command("sysctl", &["-n","hw.model"]),"cpu":command("sysctl", &["-n","machdep.cpu.brand_string"]),"physicalCores":command("sysctl", &["-n","hw.physicalcpu"]),"logicalCores":command("sysctl", &["-n","hw.logicalcpu"]),"memoryBytes":command("sysctl", &["-n","hw.memsize"]),"compiler":command("rustc", &["-Vv"])});
    let start = Instant::now();
    let bytes = std::fs::read(format!("{path}/graph.bin"))?;
    let manifest = std::fs::read_to_string(format!("{path}/manifest.json"))?;
    let manifest_file_hash = format!("{:x}", Sha256::digest(manifest.as_bytes()));
    let graph = Arc::new(Graph::from_bytes(&bytes, &manifest)?);
    drop(bytes);
    drop(manifest);
    let load_seconds = start.elapsed().as_secs_f64();
    let graph_payload = graph.storage_bytes();
    let brain_payload = Brain::new(graph.clone(), 0).state_storage_bytes();
    let graph_rss = rss_kib();
    let level = swarm_lab::level(count)?;
    let tuning = AttemptTuning {
        cues: vec![CueInput {
            pathway: CuePathway::ExcitatoryOdor,
            gain: 1.,
        }],
        taste_gain: 0.,
        ..Default::default()
    };
    let spec = Attempt::describe(&graph, &level, &tuning, "native-throughput", 42, count, &[])?;
    let start = Instant::now();
    let mut attempt = Attempt::new(graph.clone(), level.clone(), tuning.clone(), spec.clone())?;
    let construct_seconds = start.elapsed().as_secs_f64();
    let initialized_rss = rss_kib();
    let grid = attempt.field_grid();
    let grid_dimensions = [grid.width, grid.height];
    let grid_active_cells = grid.cells.iter().filter(|v| v.is_some()).count();
    drop(grid);
    let mut tick_seconds = Vec::with_capacity(ticks as usize);
    let mut blocks = vec![];
    let mut previous_steps = 0;
    let mut terminal_count = 0;
    let mut modes = [0u64; 4];
    let run_start = Instant::now();
    let mut block_start = Instant::now();
    let mut block_first = 1;
    for tick in 1..=ticks {
        let tick_start = Instant::now();
        let frame = attempt
            .step()?
            .ok_or("attempt terminated before measurement finished")?;
        tick_seconds.push(tick_start.elapsed().as_secs_f64());
        let active_this_tick = frame.neural_steps - previous_steps;
        if active_this_tick != count || frame.flies.iter().any(|f| f.neural.is_none()) {
            return Err(format!("inactive work at tick{tick}: {active_this_tick}/{count}").into());
        }
        previous_steps = frame.neural_steps;
        terminal_count = frame
            .flies
            .iter()
            .filter(|f| f.body.outcome.is_some())
            .count();
        for fly in &frame.flies {
            modes[match fly.body.mode {
                BodyMode::Walking => 0,
                BodyMode::Flying => 1,
                BodyMode::Landing => 3,
                BodyMode::Feeding => 2,
            }] += 1;
        }
        std::hint::black_box(&frame);
        drop(frame);
        if tick % 200 == 0 || tick == ticks {
            let elapsed = block_start.elapsed().as_secs_f64();
            let steps = (tick - block_first + 1) * count;
            blocks.push(json!({"firstTick":block_first,"lastTick":tick,"activeNeuralSteps":steps,"wallSeconds":elapsed,"neuralStepsPerSecond":steps as f64/elapsed}));
            eprintln!(
                "{count}flies tick{tick}/{ticks}: {:.1} neural steps/s",
                steps as f64 / elapsed
            );
            block_first = tick + 1;
            block_start = Instant::now();
        }
    }
    let run_seconds = run_start.elapsed().as_secs_f64();
    let final_rss = rss_kib();
    tick_seconds.sort_by(f64::total_cmp);
    let percentile =
        |q: f64| tick_seconds[((tick_seconds.len() - 1) as f64 * q).ceil() as usize] * 1000.;
    let full_completion = attempt.result().cloned();
    if ticks == 6000 && (full_completion.is_none() || attempt.step()?.is_some()) {
        return Err("full attempt did not complete once at its horizon".into());
    }
    let neural_rate = previous_steps as f64 / run_seconds;
    let evidence = json!({"spec":spec,"machine":machine,"profile":"cargo release; workspace opt-level3, thin LTO; single-threaded Attempt, graph shared by Arc","manifestFileHash":manifest_file_hash,"probeSourceHash":format!("{:x}",Sha256::digest(include_str!("attempt_probe.rs").as_bytes())),"level":level,"tuning":tuning,"graphNeurons":graph.neuron_count(),"graphEdges":graph.edge_count(),"loadSeconds":load_seconds,"constructSeconds":construct_seconds,"measuredTicks":ticks,"activeNeuralSteps":previous_steps,"wallSeconds":run_seconds,"activeNeuralStepsPerSecond":neural_rate,"simulatedSeconds":ticks as f64*GAME_TICK_SECONDS,"productionGameSecondsPerWallSecond":ticks as f64*GAME_TICK_SECONDS/run_seconds,"projection6000TicksWallSeconds":6000.*count as f64/neural_rate,"projectionIsNotMeasurement":ticks!=6000,"terminalFliesAtLastTick":terminal_count,"modeObservations":{"walking":modes[0],"flying":modes[1],"feeding":modes[2],"landing":modes[3]},"result":full_completion,"stepCallLatencyMs":{"p50":percentile(0.5),"p95":percentile(0.95),"p99":percentile(0.99),"max":percentile(1.)},"payloadBytes":{"graphArrays":graph_payload,"perBrainArrays":brain_payload,"allBrainArrays":brain_payload*count as usize,"graphAndBrainArrays":graph_payload+brain_payload*count as usize},"rssKiB":{"graphLoadedAfterTemporaryBrainCalibration":graph_rss,"attemptInitialized":initialized_rss,"afterStepping":final_rss},"sharedField":{"dimensions":grid_dimensions,"activeCells":grid_active_cells,"evolutions":ticks},"blocks":blocks,"measurementScope":"Every counted neural step is confirmed by AttemptFrame.neural_steps delta and present neural output; no terminal no-op contributes. Wall time includes step calls, frame destruction and light telemetry; excludes graph loading, construction, RSS commands, serialization and I/O. Frames are dropped each tick, so this does not measure replay archive/Worker transfer/rendering. RSS includes allocator/runtime/manifest overhead; graph+brain byte counts are exact owner-reported array payload only, excluding field arrays and allocation headers. A disconnected exit annex and timed life policy keep the neural workload active; benchmark content is not campaign tuning. Native feasibility is not browser acceptance."});
    std::fs::write(output, serde_json::to_string_pretty(&evidence)?)?;
    Ok(())
}
