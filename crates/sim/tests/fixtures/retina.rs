use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sim::{vision::*, Graph};
use std::sync::Arc;

pub fn hash(value: &Value) -> String {
    format!(
        "{:x}",
        Sha256::digest(format!("{}\n", serde_json::to_string(value).unwrap()))
    )
}

pub fn fixture() -> (Arc<Graph>, RetinalConfig, Value) {
    let mut bytes = b"FLYGRAPH".to_vec();
    for word in [1u32, 6, 0].into_iter().chain([0; 7]) {
        bytes.extend(word.to_le_bytes());
    }
    let graph_hash = format!("{:x}", Sha256::digest(&bytes));
    let annotation = "1".repeat(64);
    let source_map_hash = "3".repeat(64);
    let manifest = json!({
        "schemaVersion":1,"neuronCount":6,"edgeCount":0,"graphHash":graph_hash,
        "bodyIds":["1","2","3","4","5","6"],
        "motor":{"dnL":[0],"dnR":[1],"mnL":[],"mnR":[]},
        "pathways":{},"groups":(2..6).map(|index| json!({"id":format!("input-{index}"),"label":format!("Input {index}"),"indices":[index]})).collect::<Vec<_>>(),
        "groupLinks":[],"pathwayProvenance":"synthetic retinal transaction",
        "sources":[{"file":"body-annotations.feather","sha256":annotation}],
        "retinalBudget":{"sourceGraphHash":graph_hash,"annotationHash":annotation,
            "sourceMapHash":source_map_hash,"weightSum":4.0},
    });
    let graph = Arc::new(Graph::from_bytes(&bytes, &manifest.to_string()).unwrap());
    let layout = json!({"cells":[{"q":0,"r":0,"x":0,"y":0},{"q":1,"r":0,"x":1,"y":0}],"radius":1});
    let optical = json!({"capture":{"width":2,"height":1},"layout":layout,
        "eyeOrder":["L","R"],"rgbOrder":["R","G","B"],"rigSha256":"2".repeat(64)});
    let color = json!({"version":1,"graphHash":graph_hash,"annotationHash":annotation,
        "families":["Tm2","Tm20"],"rgbCoefficients":[[0.2126,0.7152,0.0722],[0,0,1]],
        "transfer":"q/(q+0.5)","baseline":0,"dose":{"gainMaximum":3}});
    let profile = EyeProfile {
        profile_hash: hash(&optical),
        layout_hash: hash(&layout),
        rig_hash: "2".repeat(64),
        color_model_hash: hash(&color),
        width: 2,
        height: 1,
        sample_count: 2,
    };
    let map = json!({
        "version":1,"identities":{"graphHash":graph_hash,"annotationHash":annotation,
            "profileHash":profile.profile_hash,"layoutHash":profile.layout_hash,
            "rigHash":profile.rig_hash,"colorModelHash":profile.color_model_hash,"baselineMapHash":source_map_hash},
        "profile":optical,"colorModel":color,
        "entries":[
            {"index":2,"bodyId":"3","eye":"L","channel":0,"taps":[[0,1.0]]},
            {"index":3,"bodyId":"4","eye":"R","channel":0,"taps":[[1,1.0]]},
            {"index":4,"bodyId":"5","eye":"L","channel":1,"taps":[[1,1.0]]},
            {"index":5,"bodyId":"6","eye":"R","channel":1,"taps":[[0,1.0]]}],
        "support":{"Tm2":{"L":[true,false],"R":[false,true]},"Tm20":{"L":[false,true],"R":[true,false]}},
        "budget":{"baselineWeightSum":4.0,"familyFractions":{"Tm2":0.5,"Tm20":0.5},
            "globalScale":1.0,"totalWeight":4.0,"maximumRowSum":1.0}
    });
    (
        graph,
        RetinalConfig {
            client_generation: 7,
            scene_id: "test-scene".into(),
            map_hash: format!("{:x}", Sha256::digest(map.to_string().as_bytes())),
            profile,
        },
        map,
    )
}
