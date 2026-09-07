use sim::{attempt::LevelDef, body::ContactRegion, environment::*, placement::*};
fn level() -> LevelDef {
    let mut level = sim::swarm_lab::level(1).unwrap();
    level.sources.clear();
    level.placement_rules = PlacementRules {
        inventory: tool_catalog()
            .into_iter()
            .map(|t| ToolStock {
                kind: t.kind,
                count: 1,
            })
            .collect(),
        reserved: vec![ContactRegion {
            center: Point { x: 0., z: 0. },
            radius: 0.5,
        }],
    };
    level
}
fn item(id: u32, kind: ToolKind, x: f64, z: f64) -> Placement {
    Placement {
        id,
        kind,
        position: Point { x, z },
        heading: 0.,
    }
}
fn left(state: &PlacementState, kind: ToolKind) -> u32 {
    state
        .remaining
        .iter()
        .find(|s| s.kind == kind)
        .unwrap()
        .count
}
#[test]
fn invalid_edits_do_not_spend_inventory_and_removal_refunds_it() {
    let level = level();
    let placed = edit_placements(
        &level,
        &[],
        PlacementEdit::Place {
            placement: item(1, ToolKind::Fruit, 1., 1.),
        },
    )
    .unwrap();
    assert_eq!(left(&placed, ToolKind::Fruit), 0);
    assert_eq!(
        edit_placements(
            &level,
            &placed.placements,
            PlacementEdit::Place {
                placement: placed.placements[0].clone()
            }
        )
        .unwrap(),
        placed
    );
    assert!(edit_placements(
        &level,
        &placed.placements,
        PlacementEdit::Place {
            placement: item(1, ToolKind::Fruit, 3., 1.)
        }
    )
    .is_err());
    assert!(edit_placements(
        &level,
        &placed.placements,
        PlacementEdit::Place {
            placement: item(2, ToolKind::Fruit, 3., 1.)
        }
    )
    .unwrap_err()
    .contains("inventory"));
    assert!(edit_placements(
        &level,
        &placed.placements,
        PlacementEdit::Move {
            id: 1,
            position: Point { x: 0., z: 0. },
            heading: 0.
        }
    )
    .unwrap_err()
    .contains("reserved"));
    let moved = edit_placements(
        &level,
        &placed.placements,
        PlacementEdit::Move {
            id: 1,
            position: Point { x: 3., z: 3. },
            heading: 0.,
        },
    )
    .unwrap();
    assert_eq!(moved.placements[0].position, Point { x: 3., z: 3. });
    assert_eq!(left(&moved, ToolKind::Fruit), 0);
    let removed =
        edit_placements(&level, &moved.placements, PlacementEdit::Remove { id: 1 }).unwrap();
    assert_eq!(left(&removed, ToolKind::Fruit), 1);
    assert!(removed.placements.is_empty());
    assert_eq!(
        edit_placements(&level, &removed.placements, PlacementEdit::Remove { id: 1 }).unwrap(),
        removed
    );
    let replacement = edit_placements(
        &level,
        &removed.placements,
        PlacementEdit::Place {
            placement: item(3, ToolKind::Fruit, 1., 1.),
        },
    )
    .unwrap();
    assert_eq!(left(&replacement, ToolKind::Fruit), 0);
}

#[test]
fn placement_rejects_walls_spawn_props_exit_and_overlap() {
    let level = level();
    for (x, z, reason) in [
        (6., 2., "floor"),
        (20., 2., "floor"),
        (-2., -2., "spawn"),
        (0., 0., "reserved"),
        (7.75, 0., "exit"),
    ] {
        assert!(
            resolve_placements(&level, &[item(1, ToolKind::Fan, x, z)])
                .unwrap_err()
                .contains(reason),
            "{x},{z} should reject {reason}"
        );
    }
    assert!(resolve_placements(
        &level,
        &[
            item(1, ToolKind::Fruit, 1., 1.),
            item(2, ToolKind::Crumbs, 1.2, 1.)
        ]
    )
    .unwrap_err()
    .contains("overlap"));
    let mut unavailable = level.clone();
    unavailable.placement_rules.inventory.clear();
    assert!(
        resolve_placements(&unavailable, &[item(1, ToolKind::Crumbs, 1., 1.)])
            .unwrap_err()
            .contains("not available")
    );
}

#[test]
fn canonical_resolution_binds_each_tool_without_mixing_food_and_odor() {
    let level = level();
    let mut placements = vec![
        item(1, ToolKind::Fruit, -4., -4.),
        item(2, ToolKind::Crumbs, -2., -4.),
        item(3, ToolKind::Vinegar, 0., -4.),
        item(4, ToolKind::Lamp, 2., -4.),
        item(5, ToolKind::Shade, 4., -4.),
        item(6, ToolKind::Fan, 4., 1.),
    ];
    placements[5].heading = std::f64::consts::FRAC_PI_2;
    let resolved = resolve_placements(&level, &placements).unwrap();
    placements.reverse();
    assert_eq!(
        serde_json::to_value(&resolved).unwrap(),
        serde_json::to_value(resolve_placements(&level, &placements).unwrap()).unwrap()
    );
    assert_eq!(
        resolved.sources.iter().map(|s| s.kind).collect::<Vec<_>>(),
        vec![
            SourceKind::AttractiveOdor,
            SourceKind::AttractiveOdor,
            SourceKind::RepellentOdor,
            SourceKind::Lamp,
            SourceKind::Shade
        ]
    );
    assert_eq!(
        resolved.state.food,
        vec![sim::food::FoodDef {
            position: Point { x: -4., z: -4. },
            heading: 0.,
            shape: sim::food::FoodShape::Apple,
        }
        .surface(0)
        .unwrap()]
    );
    assert_eq!(
        resolved.field_config.fans[0].heading,
        std::f64::consts::FRAC_PI_2
    );
    assert!(resolved.state.remaining.iter().all(|s| s.count == 0));
    let mut no_replenishment = level;
    no_replenishment.body_config.feeding_rate = 0.;
    let ablated = resolve_placements(&no_replenishment, &placements).unwrap();
    assert_eq!(ablated.sources, resolved.sources);
    assert_eq!(ablated.state.food, resolved.state.food);
}

#[test]
fn repeating_a_raw_heading_placement_is_idempotent() {
    let level = level();
    for heading in [-std::f64::consts::FRAC_PI_2, -1e-16, std::f64::consts::TAU] {
        let mut placement = item(1, ToolKind::Fan, 1., 1.);
        placement.heading = heading;
        let edit = PlacementEdit::Place {
            placement: placement.clone(),
        };
        let placed = edit_placements(&level, &[], edit.clone()).unwrap();
        let repeated = edit_placements(&level, &placed.placements, edit).unwrap();
        assert_eq!(repeated, placed);
        assert_eq!(left(&repeated, ToolKind::Fan), 0);
        placement.position.x = 3.;
        assert!(edit_placements(
            &level,
            &placed.placements,
            PlacementEdit::Place { placement }
        )
        .is_err());
    }
}
