use sim::environment::{FieldConfig, FieldSet, Geometry, Point};
use std::collections::BTreeSet;

#[test]
fn five_room_review_house_has_a_route_and_one_door_pantry() {
    let geometry: Geometry =
        serde_json::from_str(include_str!("../../../assets/house/five-rooms.json")).unwrap();
    FieldSet::new(geometry.clone(), FieldConfig::default(), vec![], None).unwrap();
    let mut links = BTreeSet::new();
    // Adjacent grid centers cross actual collision openings, not a second door map.
    for x in 0..64 {
        for z in 0..32 {
            let from = Point {
                x: x as f64 * 0.25 + 0.125,
                z: z as f64 * 0.25 + 0.125,
            };
            let Some(a) = geometry.room_at(from) else {
                continue;
            };
            for (dx, dz) in [(0.25, 0.), (0., 0.25)] {
                let to = Point {
                    x: from.x + dx,
                    z: from.z + dz,
                };
                let Some(b) = geometry.room_at(to) else {
                    continue;
                };
                if a != b && geometry.sweep(from, to, 0.1) == to {
                    links.insert((a.min(b), a.max(b)));
                }
            }
        }
    }
    assert_eq!(links, BTreeSet::from([(1, 2), (2, 3), (2, 5), (3, 4)]));
    let pantry = Point { x: 6., z: 6. };
    let hall = Point { x: 6., z: 2. };
    assert_eq!(geometry.sweep(pantry, hall, 0.1), hall);
    assert!(geometry.sweep(pantry, Point { x: 6., z: 9. }, 0.1).z < 8.);
    let beside_door = Point { x: 4.5, z: 3. };
    assert!(geometry.sweep(beside_door, Point { x: 4.5, z: 5. }, 0.1).z < 4.);
    let outside = Point { x: 17., z: 2. };
    assert_eq!(
        geometry.sweep(Point { x: 14., z: 2. }, outside, 0.1),
        outside
    );
}

#[test]
fn solid_footprint_stops_sweeps_and_visibility_while_detour_stays_open() {
    let geometry: Geometry =
        serde_json::from_str(include_str!("../../../assets/house/five-rooms.json")).unwrap();
    let prop = &geometry.solids[0];
    let z = (prop.min.z + prop.max.z) / 2.;
    let from = Point {
        x: prop.min.x - 0.5,
        z,
    };
    let to = Point {
        x: prop.max.x + 0.3,
        z,
    };
    let stopped = geometry.sweep(from, to, 0.1);
    assert!((stopped.x - (prop.min.x - 0.1)).abs() < 1e-7);
    assert!(!geometry.line_of_sight(from, to));
    assert!(!geometry.contains_body(
        Point {
            x: (prop.min.x + prop.max.x) / 2.,
            z
        },
        0.1
    ));
    let around = prop.min.z - 0.2;
    let from = Point {
        x: from.x,
        z: around,
    };
    let to = Point { x: to.x, z: around };
    assert_eq!(geometry.sweep(from, to, 0.1), to);
    assert!(geometry.line_of_sight(from, to));
}

#[test]
fn solids_exclude_field_cells_and_tool_placement() {
    use sim::environment::{Source, SourceKind};
    use sim::placement::{resolve_placements, Placement, PlacementRules, ToolKind, ToolStock};
    let geometry: Geometry =
        serde_json::from_str(include_str!("../../../assets/house/five-rooms.json")).unwrap();
    let prop = &geometry.solids[0];
    let center = Point {
        x: (prop.min.x + prop.max.x) / 2.,
        z: (prop.min.z + prop.max.z) / 2.,
    };
    let mut fields = FieldSet::new(
        geometry.clone(),
        FieldConfig::default(),
        vec![Source {
            kind: SourceKind::AttractiveOdor,
            position: Point {
                x: prop.min.x - 0.3,
                z: center.z,
            },
            radius: 2.,
            rate: 1.,
        }],
        None,
    )
    .unwrap();
    fields.advance(1.).unwrap();
    let grid = fields.export_grid();
    for (i, cell) in grid.cells.iter().enumerate() {
        let p = Point {
            x: grid.origin.x
                + (i % grid.width as usize) as f64 * grid.cell_size
                + grid.cell_size / 2.,
            z: grid.origin.z
                + (i / grid.width as usize) as f64 * grid.cell_size
                + grid.cell_size / 2.,
        };
        if p.x >= prop.min.x && p.x <= prop.max.x && p.z >= prop.min.z && p.z <= prop.max.z {
            assert!(cell.is_none());
        }
    }
    assert_eq!(fields.sample_point(center).attractive_odor, 0.);
    let mut level = sim::swarm_lab::level(1).unwrap();
    level.geometry = geometry;
    level.spawn = sim::spawn::SpawnDef::fixed(vec![]);
    level.placement_rules = PlacementRules {
        fan_heading: 0.,
        inventory: vec![ToolStock {
            kind: ToolKind::Fruit,
            count: 1,
        }],
        reserved: vec![],
    };
    let error = resolve_placements(
        &level,
        &[Placement {
            id: 1,
            kind: ToolKind::Fruit,
            position: center,
            heading: 0.,
        }],
    )
    .unwrap_err();
    assert!(error.contains("solid"));
}

#[test]
fn invalid_solid_bounds_overlap_and_wall_intersections_are_rejected() {
    let geometry: Geometry =
        serde_json::from_str(include_str!("../../../assets/house/five-rooms.json")).unwrap();
    let mut cases = Vec::new();
    let mut invalid = geometry.clone();
    invalid.solids[0].height = 0.;
    cases.push(invalid);
    let mut invalid = geometry.clone();
    invalid.solids[0].max.x = invalid.solids[0].min.x;
    cases.push(invalid);
    let mut invalid = geometry.clone();
    invalid.solids[0].min.x = f64::NAN;
    cases.push(invalid);
    let mut invalid = geometry.clone();
    invalid.solids[0].max.x = 9.;
    cases.push(invalid);
    let mut invalid = geometry.clone();
    invalid.solids[0].min.z = 4.;
    cases.push(invalid);
    let mut invalid = geometry.clone();
    invalid.solids.push(invalid.solids[0].clone());
    cases.push(invalid);
    let mut invalid = geometry.clone();
    let mut overlap = invalid.solids[0].clone();
    overlap.id += 1;
    invalid.solids.push(overlap);
    cases.push(invalid);
    for invalid in cases {
        assert!(FieldSet::new(invalid, FieldConfig::default(), vec![], None)
            .err()
            .unwrap()
            .contains("solids"));
    }
}

#[test]
fn furnished_props_keep_native_dimensions_and_the_existing_collision_owner() {
    use sim::environment::{FurnitureModel, Point};
    let value: serde_json::Value =
        serde_json::from_str(include_str!("../../../assets/proportions/scale.json")).unwrap();
    let geometry: sim::environment::Geometry =
        serde_json::from_value(value["geometry"].clone()).unwrap();
    let prepare = |g: &Geometry| FieldSet::new(g.clone(), FieldConfig::default(), vec![], None);
    prepare(&geometry).unwrap();
    let cabinet = &geometry.solids[0];
    assert_eq!(cabinet.furnishing.unwrap().model, FurnitureModel::Cabinet);
    let approach = Point { x: 0.9, z: 1. };
    let inside = Point { x: 0.9, z: 0.3 };
    let mut plain = geometry.clone();
    plain.solids[0].furnishing = None;
    assert_eq!(
        geometry.sweep(approach, inside, 0.002),
        plain.sweep(approach, inside, 0.002)
    );
    assert_eq!(
        geometry.line_of_sight(approach, inside),
        plain.line_of_sight(approach, inside)
    );
    assert!(!geometry.contains_body(inside, 0.002));

    let mut turned = geometry.clone();
    let cabinet = &mut turned.solids[0];
    cabinet.furnishing.as_mut().unwrap().quarter_turns = 1;
    assert!(
        prepare(&turned).is_err(),
        "turning the model alone cannot silently change its physical footprint"
    );
    let cabinet = &mut turned.solids[0];
    cabinet.min = Point { x: 0.3, z: 0.1 };
    cabinet.max = Point { x: 0.75, z: 1.3 };
    prepare(&turned).unwrap();
    turned.solids[0].height *= 2.;
    assert!(
        prepare(&turned).is_err(),
        "native furniture cannot be stretched to fit another solid"
    );
    let encoded = serde_json::to_value(&geometry).unwrap();
    assert_eq!(
        encoded["solids"][0]["furnishing"],
        serde_json::json!({"model":"cabinet","quarterTurns":0})
    );
}
