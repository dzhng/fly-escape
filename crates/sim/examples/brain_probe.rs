use sim::{Brain, Graph, PRNG_ID};
use std::{sync::Arc, time::Instant};
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let path = std::env::args()
        .nth(1)
        .ok_or("Pass prepared brain directory")?;
    let start = Instant::now();
    let bytes = std::fs::read(format!("{path}/graph.bin"))?;
    let manifest = std::fs::read_to_string(format!("{path}/manifest.json"))?;
    let graph = Arc::new(Graph::from_bytes(&bytes, &manifest)?);
    let load_ms = start.elapsed().as_secs_f64() * 1000.0;
    let mut brain = Brain::new(graph.clone(), Brain::seed_for_fly(42, 0));
    for _ in 0..20 {
        brain.step();
    }
    let start = Instant::now();
    let mut last = brain.step();
    for _ in 1..200 {
        last = brain.step();
    }
    let seconds = start.elapsed().as_secs_f64();
    println!(
        "{}",
        serde_json::json!({"graphHash":graph.manifest.graph_hash,"neurons":graph.neuron_count(),"edges":graph.edge_count(),"prng":PRNG_ID,"loadMs":load_ms,"activeTicks":200,"activeTicksPerSecond":200.0/seconds,"graphArrayBytes":graph.storage_bytes(),"brainArrayBytes":brain.state_storage_bytes(),"memoryScope":"array payload only; excludes manifest, allocator, input buffers and executable","last":last})
    );
    Ok(())
}
