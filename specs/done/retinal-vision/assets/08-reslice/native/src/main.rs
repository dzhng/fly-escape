//! Input-only native oracle. Deliberately imports no Brain and evaluates no neural state.
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sim::{sensory::retinal_currents, vision::EyeProfile, Graph, RetinalMap};
use std::{fs, path::Path};

fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = std::env::args().collect();
    if args.len() != 3 {
        return Err("usage: retinal-input-proposal REPO_ROOT PROPOSAL_JSON".into());
    }
    let root = Path::new(&args[1]);
    let path = Path::new(&args[2]);
    let bytes = fs::read(path)?;
    let proposal: Value = serde_json::from_slice(&bytes)?;
    if proposal["runAuthorized"] != false {
        return Err("this helper accepts input-only proposals".into());
    }
    let graph_bytes = fs::read(root.join("data/processed/brain/graph.bin"))?;
    let manifest_bytes = fs::read(root.join("data/processed/brain/manifest.json"))?;
    let map_text =
        fs::read_to_string(root.join("specs/done/retinal-vision/assets/05/retinal-map.json"))?;
    if hash(map_text.as_bytes()) != proposal["mapSha256"].as_str().ok_or("map identity")? {
        return Err("map hash mismatch".into());
    }
    if hash(&graph_bytes)
        != proposal["originalIdentities"]["graphHash"]
            .as_str()
            .ok_or("graph identity")?
        || hash(&manifest_bytes)
            != proposal["originalIdentities"]["manifestHash"]
                .as_str()
                .ok_or("manifest identity")?
    {
        return Err("graph/manifest identity mismatch".into());
    }
    let graph = Graph::from_bytes(&graph_bytes, std::str::from_utf8(&manifest_bytes)?)?;
    let mapping: Value = serde_json::from_str(&map_text)?;
    let id = &mapping["identities"];
    let capture = &mapping["profile"]["capture"];
    let profile: EyeProfile = serde_json::from_value(
        json!({"profileHash":id["profileHash"],"layoutHash":id["layoutHash"],"rigHash":id["rigHash"],"colorModelHash":id["colorModelHash"],"width":capture["width"],"height":capture["height"],"sampleCount":mapping["profile"]["layout"]["cells"].as_array().ok_or("cells")?.len()}),
    )?;
    let map = RetinalMap::from_json(&graph, &profile, &map_text)?;
    let entries = mapping["entries"].as_array().ok_or("entries")?;
    let mut candidate_screen = vec![];
    for candidate in proposal["colorSearch"]["candidates"]
        .as_array()
        .ok_or("candidate domain")?
    {
        let mut levels = vec![];
        for offset in [0_u64, 100] {
            let mut colors = vec![];
            let mut currents = vec![];
            let mut luminances = vec![];
            for key in ["a", "b"] {
                let color: Vec<u8> = candidate[key]
                    .as_array()
                    .ok_or("candidate RGB")?
                    .iter()
                    .enumerate()
                    .map(|(i, v)| (v.as_u64().unwrap() + if i < 2 { offset } else { 0 }) as u8)
                    .collect();
                let raw = color.repeat(profile.sample_count as usize * 2);
                currents.push(retinal_currents(&map, &raw, 3.)?);
                luminances.push(
                    color
                        .iter()
                        .zip([0.2126, 0.7152, 0.0722])
                        .map(|(&v, c)| v as f64 / 255. * c)
                        .sum::<f64>(),
                );
                colors.push(color);
            }
            let brightness_equal = entries
                .iter()
                .zip(currents[0].iter().zip(&currents[1]))
                .filter(|(e, _)| e["channel"] == 0)
                .all(|(_, (a, b))| a == b);
            levels.push(json!({"colors":colors,"brightnessCurrentsExactlyEqual":brightness_equal,"diagnosticLuminance":luminances,"diagnosticLuminanceExactlyEqual":luminances[0]==luminances[1]}));
        }
        candidate_screen.push(json!({"candidate":candidate,"levels":levels}));
    }
    let mut panels = serde_json::Map::new();
    for slice in ["08", "09"] {
        let mut conditions = vec![];
        for spec in proposal["panels"][slice]["conditions"]
            .as_array()
            .ok_or("conditions")?
        {
            let rgb = fs::read(
                path.parent()
                    .ok_or("directory")?
                    .join(spec["rgbPath"].as_str().ok_or("RGB path")?),
            )?;
            if hash(&rgb) != spec["rgbSha256"].as_str().ok_or("RGB hash")? {
                return Err("RGB hash mismatch".into());
            }
            let requested = retinal_currents(&map, &rgb, proposal["gain"].as_f64().ok_or("gain")?)?;
            let mut effective = requested.clone();
            for (entry, (_, value)) in entries.iter().zip(effective.iter_mut()) {
                if spec["zeroCurrent"] == true
                    || spec["silenceInputs"] == true
                    || (spec["chromatic"] == false && entry["channel"] == 1)
                {
                    *value = 0.;
                }
            }
            if spec["permuteRows"] == true {
                for eye in ["L", "R"] {
                    for channel in [0, 1] {
                        let mut rows: Vec<_> = entries
                            .iter()
                            .enumerate()
                            .filter(|(_, e)| e["eye"] == eye && e["channel"] == channel)
                            .map(|(i, _)| i)
                            .collect();
                        rows.sort_by_key(|&i| entries[i]["index"].as_u64().unwrap());
                        let prior = effective.clone();
                        for (position, &row) in rows.iter().enumerate() {
                            effective[row].1 = prior[rows[(position + 1) % rows.len()]].1;
                        }
                    }
                }
            }
            // Silenced conditions receive zero delivered current, matching the experiment harness.
            conditions.push(json!({"name":spec["name"],"rgbSha256":hash(&rgb),"requested":requested,"effective":effective,
                "diagnosticLuminance":rgb.chunks_exact(3).map(|px|px.iter().zip([0.2126,0.7152,0.0722]).map(|(&v,c)|v as f64/255.*c).sum::<f64>()).collect::<Vec<_>>()}));
        }
        panels.insert(slice.to_string(), json!(conditions));
    }
    let output = json!({"scope":"Native retinal_currents only; Graph loaded for map validation; zero Brain instances or steps", "proposalHash":hash(&bytes),"graphHash":hash(&graph_bytes),"manifestHash":hash(&manifest_bytes),"mapHash":hash(map_text.as_bytes()),"adapterSourceHash":hash(&fs::read(root.join("crates/sim/src/sensory.rs"))?),"helperSourceHash":hash(&fs::read(root.join("specs/done/retinal-vision/assets/08-reslice/native/src/main.rs"))?),"panels":panels,"candidateScreen":candidate_screen});
    println!("{}", serde_json::to_string(&output)?);
    Ok(())
}
