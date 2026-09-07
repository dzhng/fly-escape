use sim::{
    attempt::LevelDef,
    environment::{FieldSet, Point},
    placement::{resolve_placements, tool_catalog, Placement},
};
use std::collections::BTreeSet;
#[test]
fn prepared_corner_has_real_fork_and_fan_crossing() {
    let mut data: serde_json::Value = serde_json::from_str(include_str!(
        "../../../specs/help-the-fly-escape/assets/evidence/16/prepared/candidate.json"
    ))
    .unwrap();
    let poses = data["level"]
        .as_object_mut()
        .unwrap()
        .remove("spawnPoses")
        .unwrap();
    data["level"]["spawn"] = serde_json::json!({"kind":"fixed","states":poses.as_array().unwrap().iter().map(|pose|serde_json::json!({"pose":pose,"mode":"walking"})).collect::<Vec<_>>()});
    // Historical evidence keeps its original schema; this fixture supplies its original zero forward offset.
    data["level"]["fieldConfig"]["antennaForward"] = serde_json::json!(0.0);
    let level: LevelDef = serde_json::from_value(data["level"].clone()).unwrap();
    let g = &level.geometry;
    let r = level.body_config.body_radius;
    for body in sim::spawn::resolve(&level, 0, 20).unwrap() {
        let pose = body.pose;
        assert!(g.contains_body(pose.position, r));
    }
    let mut links = BTreeSet::new();
    // Bounded scan for this prepared fixture, not a general campaign validator.
    for x in 0..65 {
        for z in 0..60 {
            let a = Point {
                x: x as f64 * 0.1 + 0.05,
                z: z as f64 * 0.1 + 0.05,
            };
            for (dx, dz) in [(0.1, 0.), (0., 0.1)] {
                let b = Point {
                    x: a.x + dx,
                    z: a.z + dz,
                };
                if let (Some(i), Some(j)) = (g.room_at(a), g.room_at(b)) {
                    if i != j
                        && g.contains_body(a, r)
                        && g.contains_body(b, r)
                        && g.sweep(a, b, r) == b
                    {
                        links.insert((i.min(j), i.max(j)));
                    }
                }
            }
        }
    }
    assert_eq!(
        links,
        BTreeSet::from([(1, 2), (2, 3), (3, 4), (3, 5), (4, 6)])
    );
    let route = [
        Point { x: 0.8, z: 1.5 },
        Point { x: 2.4, z: 1.5 },
        Point { x: 4., z: 1.5 },
        Point { x: 4., z: 4.5 },
        Point { x: 5.6, z: 4.5 },
        Point { x: 6.5, z: 4.5 },
    ];
    for p in route.windows(2) {
        assert_eq!(g.sweep(p[0], p[1], r), p[1]);
        assert_eq!(g.sweep(p[1], p[0], r), p[0]);
    }
    assert!(
        g.sweep(Point { x: 5.6, z: 1.5 }, Point { x: 5.6, z: 4.5 }, r)
            .z
            < 3.
    );
    for key in ["reference", "poor"] {
        let placements: Vec<Placement> = serde_json::from_value(data[key].clone()).unwrap();
        let setup = resolve_placements(&level, &placements).unwrap();
        let fields = FieldSet::new(
            g.clone(),
            setup.field_config,
            setup.sources,
            level.exit_cue.clone(),
        )
        .unwrap();
        if key == "reference" {
            let wind = fields.sample(Point { x: 4., z: 3.2 }, 0., 0).wind;
            assert!(
                wind.z > 0.1,
                "fork wind must cross actual north doorway: {wind:?}"
            );
        }
    }
    if let Ok(path) = std::env::var("GREYBOX_CATALOG_OUTPUT") {
        std::fs::write(path, serde_json::to_string_pretty(&tool_catalog()).unwrap()).unwrap();
    }
    println!("links {links:?}; route, dead end, placements and fork wind verified; no neural run");
}
