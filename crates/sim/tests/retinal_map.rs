#[path = "fixtures/retina.rs"]
mod retinal_fixture;
use serde_json::{json, Value};
use sim::{sensory::retinal_currents, vision::EyeProfile, Graph, RetinalMap};

#[test]
fn native_currents_match_the_offline_spatial_and_color_oracle() {
    let graph = Graph::from_bytes(
        include_bytes!("../../../data/processed/brain/graph.bin"),
        include_str!("../../../data/processed/brain/manifest.json"),
    )
    .unwrap();
    let map_json = include_str!("../../../specs/retinal-vision/assets/05/retinal-map.json");
    let data: Value = serde_json::from_str(map_json).unwrap();
    let ids = &data["identities"];
    let profile = EyeProfile {
        profile_hash: ids["profileHash"].as_str().unwrap().into(),
        layout_hash: ids["layoutHash"].as_str().unwrap().into(),
        rig_hash: ids["rigHash"].as_str().unwrap().into(),
        color_model_hash: ids["colorModelHash"].as_str().unwrap().into(),
        width: data["profile"]["capture"]["width"].as_u64().unwrap() as u32,
        height: data["profile"]["capture"]["height"].as_u64().unwrap() as u32,
        sample_count: data["profile"]["layout"]["cells"].as_array().unwrap().len() as u32,
    };
    let map = RetinalMap::from_json(&graph, &profile, map_json).unwrap();
    let oracle: Value = serde_json::from_str(include_str!(
        "../../../specs/retinal-vision/assets/05/current-fixtures.json"
    ))
    .unwrap();
    let indices = oracle["entryIndices"].as_array().unwrap();
    for case in oracle["cases"].as_array().unwrap() {
        let fill: Vec<u8> = serde_json::from_value(case["fillRgb8"].clone()).unwrap();
        let mut rgb = fill.repeat(profile.sample_count as usize * 2);
        for update in case["updates"].as_array().unwrap() {
            let eye = if update["eye"] == "L" { 0 } else { 1 };
            let sample = update["sample"].as_u64().unwrap() as usize;
            let offset = (eye * profile.sample_count as usize + sample) * 3;
            let value: Vec<u8> = serde_json::from_value(update["rgb8"].clone()).unwrap();
            rgb[offset..offset + 3].copy_from_slice(&value);
        }
        let currents = retinal_currents(&map, &rgb, oracle["gain"].as_f64().unwrap()).unwrap();
        let expected = case["expectedCurrentByEntry"].as_array().unwrap();
        assert_eq!(currents.len(), expected.len());
        for (i, &(index, current)) in currents.iter().enumerate() {
            assert_eq!(index as u64, indices[i].as_u64().unwrap());
            assert!(
                (current - expected[i].as_f64().unwrap()).abs() <= 1e-12,
                "{} cell {index}: {current} differs from {}",
                case["name"],
                expected[i]
            );
            assert!((0. ..=3.).contains(&current));
        }
    }
}

#[test]
fn invalid_map_identity_targets_channels_and_dose_are_rejected_on_load() {
    let (graph, config, valid) = retinal_fixture::fixture();
    let faults: [(&str, fn(&mut Value)); 13] = [
        ("graph identity", |m| {
            m["identities"]["graphHash"] = json!("a".repeat(64))
        }),
        ("annotation identity", |m| {
            m["identities"]["annotationHash"] = json!("a".repeat(64))
        }),
        ("layout identity", |m| {
            m["identities"]["layoutHash"] = json!("a".repeat(64))
        }),
        ("color model missing", |m| {
            m.as_object_mut().unwrap().remove("colorModel");
        }),
        ("motor target", |m| {
            m["entries"][0]["index"] = json!(0);
            m["entries"][0]["bodyId"] = json!("1");
        }),
        ("duplicate target", |m| {
            m["entries"][1] = m["entries"][0].clone()
        }),
        ("body ID mismatch", |m| {
            m["entries"][0]["bodyId"] = json!("6")
        }),
        ("negative tap", |m| {
            m["entries"][0]["taps"][0][1] = json!(-1)
        }),
        ("out of eye", |m| m["entries"][0]["taps"][0][0] = json!(2)),
        ("unsupported channel", |m| {
            m["entries"][0]["channel"] = json!(2)
        }),
        ("row over gain", |m| {
            m["entries"][0]["taps"][0][1] = json!(1.01)
        }),
        ("false support", |m| {
            m["support"]["Tm2"]["L"][0] = json!(false)
        }),
        ("independent family budget", |m| {
            m["budget"]["familyFractions"]["Tm20"] = json!(1)
        }),
    ];
    for (name, corrupt) in faults {
        let mut map = valid.clone();
        corrupt(&mut map);
        assert!(
            RetinalMap::from_json(&graph, &config.profile, &map.to_string()).is_err(),
            "accepted {name}"
        );
    }
    for coefficients in [
        json!([[0.2126, 0.7152, 0.0722], [0, 1, 0]]),
        json!([[0.2126, 0.7152, 0.0722], [-1, 0, 1]]),
    ] {
        let mut map = valid.clone();
        map["colorModel"]["rgbCoefficients"] = coefficients;
        let mut profile = config.profile.clone();
        profile.color_model_hash = retinal_fixture::hash(&map["colorModel"]);
        map["identities"]["colorModelHash"] = json!(profile.color_model_hash);
        assert!(
            RetinalMap::from_json(&graph, &profile, &map.to_string()).is_err(),
            "accepted an altered signed/spectral model with a matching hash"
        );
    }
    assert!(RetinalMap::from_json(
        &graph,
        &config.profile,
        &valid.to_string().replace("1.0]", "1e999]")
    )
    .is_err());
}

#[test]
fn rgb_is_transformed_before_spatial_pooling_and_never_accepted_incomplete() {
    let (graph, config, mut data) = retinal_fixture::fixture();
    data["entries"][0]["taps"] = json!([[0, 0.5], [1, 0.5]]);
    data["entries"][1]["taps"] = json!([[0, 0.5], [1, 0.5]]);
    data["support"]["Tm2"] = json!({"L":[true,true],"R":[true,true]});
    let map = RetinalMap::from_json(&graph, &config.profile, &data.to_string()).unwrap();
    let rgb = [255, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    assert_eq!(
        retinal_currents(&map, &rgb, 3.).unwrap(),
        vec![(2, 1.), (3, 0.), (4, 0.), (5, 0.)]
    );
    for gain in [-1., 3.001, f64::NAN, f64::INFINITY] {
        assert!(retinal_currents(&map, &rgb, gain).is_err());
    }
    assert!(retinal_currents(&map, &rgb[..6], 3.).is_err());
    assert!(
        retinal_currents(&map, &[], 0.).is_err(),
        "ablation still requires real observations"
    );
    assert_eq!(
        retinal_currents(&map, &rgb, 0.).unwrap(),
        vec![(2, 0.), (3, 0.), (4, 0.), (5, 0.)]
    );
}

#[test]
fn trusted_source_budget_cannot_be_relabelled_or_expanded() {
    let faults: [fn(&mut sim::RetinalBudget); 5] = [
        |budget| budget.source_graph_hash = "a".repeat(64),
        |budget| budget.annotation_hash = "a".repeat(64),
        |budget| budget.source_map_hash = "a".repeat(64),
        |budget| budget.weight_sum *= 2.,
        |budget| budget.weight_sum = f64::NAN,
    ];
    for fault in faults {
        let (mut graph, config, map) = retinal_fixture::fixture();
        let graph = std::sync::Arc::get_mut(&mut graph).unwrap();
        fault(graph.manifest.retinal_budget.as_mut().unwrap());
        assert!(RetinalMap::from_json(graph, &config.profile, &map.to_string()).is_err());
    }
    let (mut graph, config, map) = retinal_fixture::fixture();
    let graph = std::sync::Arc::get_mut(&mut graph).unwrap();
    graph.manifest.retinal_budget = None;
    assert!(RetinalMap::from_json(graph, &config.profile, &map.to_string()).is_err());
}

#[test]
fn directional_metadata_is_rejected_instead_of_retained_as_provenance() {
    let mut manifest: Value =
        serde_json::from_str(include_str!("../../../data/processed/brain/manifest.json")).unwrap();
    manifest["visionInput"] = json!({"entries":[]});
    let error = Graph::from_bytes(
        include_bytes!("../../../data/processed/brain/graph.bin"),
        &manifest.to_string(),
    )
    .err()
    .unwrap();
    assert!(error.contains("Directional vision metadata"));
}
