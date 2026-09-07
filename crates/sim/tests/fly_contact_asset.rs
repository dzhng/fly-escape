use serde::Deserialize;
use sha2::{Digest, Sha256};
use sim::surface::ContactHull;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BakedHull {
    asset_sha256: String,
    vertices: Vec<[f64; 3]>,
}

#[test]
fn native_contact_hull_matches_source_and_constructs_at_metre_scale() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../assets/fly");
    let baked: BakedHull =
        serde_json::from_slice(&std::fs::read(root.join("contact-hull.json")).unwrap()).unwrap();
    // Reading the GLB in this native test does not embed it in release WASM.
    let glb = std::fs::read(root.join("fly.glb")).unwrap();
    assert_eq!(baked.asset_sha256, format!("{:x}", Sha256::digest(glb)));
    ContactHull::new(&baked.vertices).expect("native envelope must form a bounded solid hull");
    let min_y = baked
        .vertices
        .iter()
        .map(|p| p[1])
        .fold(f64::INFINITY, f64::min);
    let max_y = baked
        .vertices
        .iter()
        .map(|p| p[1])
        .fold(f64::NEG_INFINITY, f64::max);
    assert!(min_y.abs() < 1e-8, "support pivot must remain at the feet");
    assert!(
        (0.001..0.01).contains(&max_y),
        "contact geometry must retain native metre scale"
    );
}
