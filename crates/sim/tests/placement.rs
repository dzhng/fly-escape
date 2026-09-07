use sim::{attempt::LevelDef, body::ContactRegion, environment::*, placement::*};
fn level() -> LevelDef {
    let mut level = sim::swarm_lab::level(1).unwrap();
    level.sources.clear();
    level.placement_rules = PlacementRules {
        fan_heading: 0.,
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
        level.placement_rules.fan_heading
    );
    assert!(resolved
        .state
        .remaining
        .iter()
        .all(|s| s.count == u32::from(!placements.iter().any(|p| p.kind == s.kind))));
    let mut no_replenishment = level;
    no_replenishment.body_config.feeding_rate = 0.;
    let ablated = resolve_placements(&no_replenishment, &placements).unwrap();
    assert_eq!(ablated.sources, resolved.sources);
    assert_eq!(ablated.state.food, resolved.state.food);
}

#[test]
fn repeating_a_fan_with_ignored_input_headings_is_idempotent() {
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

#[test]
fn banana_spends_its_own_stock_and_resolves_native_edible_geometry() {
    let level = level();
    let placed = resolve_placements(
        &level,
        &[
            item(1, ToolKind::Banana, 1., 1.),
            item(2, ToolKind::Crumbs, 2., 1.),
        ],
    )
    .unwrap();
    assert_eq!(left(&placed.state, ToolKind::Banana), 0);
    assert_eq!(left(&placed.state, ToolKind::Fruit), 1);
    let native = sim::food::FoodDef {
        position: Point { x: 1., z: 1. },
        heading: 0.,
        shape: sim::food::FoodShape::Banana,
    }
    .surface(0)
    .unwrap();
    assert_eq!(
        placed.state.food,
        vec![native],
        "scent crumbs remain odor-only"
    );
}

#[test]
fn fixed_objects_keep_effects_and_space_without_spending_editable_stock() {
    let mut level = level();
    level.fixed_objects = vec![
        item(2, ToolKind::Vinegar, 3., 1.),
        item(1, ToolKind::Banana, 1., 1.),
    ];
    let fixed = resolve_placements(&level, &[]).unwrap();
    assert!(fixed.state.placements.is_empty());
    assert_eq!(left(&fixed.state, ToolKind::Banana), 1);
    assert!(
        fixed.state.food
            == vec![sim::food::FoodDef {
                position: Point { x: 1., z: 1. },
                heading: 0.,
                shape: sim::food::FoodShape::Banana
            }
            .surface(0)
            .unwrap()],
        "fixed banana must preserve its native edible surface"
    );
    assert_eq!(
        fixed.sources.iter().map(|s| s.kind).collect::<Vec<_>>(),
        vec![SourceKind::AttractiveOdor, SourceKind::RepellentOdor]
    );
    assert_eq!(
        edit_placements(&level, &[], PlacementEdit::Remove { id: 1 }).unwrap(),
        fixed.state
    );
    assert!(edit_placements(
        &level,
        &[],
        PlacementEdit::Move {
            id: 1,
            position: Point { x: 4., z: 1. },
            heading: 0.,
        }
    )
    .is_err());
    assert!(
        resolve_placements(&level, &[item(1, ToolKind::Fruit, 1., 1.)])
            .unwrap_err()
            .contains("overlap")
    );
    let editable = resolve_placements(&level, &[item(1, ToolKind::Banana, 4., 3.)]).unwrap();
    assert_eq!(editable.state.placements.len(), 1);
    assert_eq!(editable.state.food.len(), 2);
    assert_eq!(left(&editable.state, ToolKind::Banana), 0);
    level.fixed_objects.reverse();
    assert_eq!(
        serde_json::to_value(resolve_placements(&level, &[]).unwrap()).unwrap(),
        serde_json::to_value(fixed).unwrap()
    );
    level.fixed_objects[1].id = level.fixed_objects[0].id;
    assert!(resolve_placements(&level, &[]).unwrap_err().contains("IDs"));
}

#[test]
fn household_native_contacts_keep_their_non_edible_role_and_modeled_odor_sources() {
    let level = level();
    let resolved = resolve_placements(
        &level,
        &[
            item(1, ToolKind::WornShoes, -4., -4.),
            item(2, ToolKind::DirtyDishes, -2., -4.),
            item(3, ToolKind::Laundry, 0., -4.),
            item(4, ToolKind::SleepingCat, 2., -4.),
            item(5, ToolKind::Fruit, 4., -4.),
        ],
    )
    .unwrap();
    assert!(resolved
        .sources
        .iter()
        .all(|s| s.kind == SourceKind::AttractiveOdor));
    assert!(
        !resolved
            .sources
            .iter()
            .any(|s| s.position == Point { x: 2., z: -4. }),
        "the sleeping cat has no odor source"
    );
    let mut fields = FieldSet::new(
        level.geometry.clone(),
        resolved.field_config.clone(),
        resolved.sources.clone(),
        None,
    )
    .unwrap();
    for _ in 0..10 {
        fields.advance(0.1).unwrap();
    }
    let odor = |x| fields.sample_point(Point { x, z: -4. }).attractive_odor;
    assert!(
        odor(-2.) > odor(4.),
        "dirty dishes model a stronger odor than fruit"
    );
    assert!(
        odor(4.) > odor(-4.) && odor(4.) > odor(0.),
        "shoes and laundry model weaker cues than fruit"
    );
    assert!(odor(-4.) > 0. && odor(0.) > 0.);
    assert_eq!(resolved.state.food.len(), 1);
    let food = &resolved.state.food[0];
    assert!(
        food.vertices.iter().all(|p| p[0] > 3.5),
        "only the fruit is edible"
    );
    assert!(!resolved.state.objects.is_empty());
    assert!(resolved.state.objects.iter().all(|s| s.id != food.id));
    sim::body::BodyWorld::new(
        &level.geometry,
        &resolved.state.food,
        &resolved.state.objects,
        &level.zappers,
        level.exit,
        level.duration_ticks,
    )
    .unwrap();
    // Reordering edits cannot change the IDs consumed by support and role lookup.
    let mut reversed = resolved.state.placements.clone();
    reversed.reverse();
    assert_eq!(
        resolve_placements(&level, &reversed).unwrap().state,
        resolved.state
    );
}

#[test]
fn fan_direction_is_owned_by_the_map_for_place_repeat_move_and_fixed_objects() {
    let mut level = level();
    level.placement_rules.fan_heading = std::f64::consts::PI;
    let fan = item(7, ToolKind::Fan, 1., 1.);
    let placed = edit_placements(
        &level,
        &[],
        PlacementEdit::Place {
            placement: fan.clone(),
        },
    )
    .unwrap();
    assert_eq!(placed.placements[0].heading, std::f64::consts::PI);
    let mut turned = fan;
    turned.heading = 1.23;
    let repeated = edit_placements(
        &level,
        &placed.placements,
        PlacementEdit::Place {
            placement: turned.clone(),
        },
    )
    .unwrap();
    assert_eq!(placed, repeated);
    let moved = edit_placements(
        &level,
        &placed.placements,
        PlacementEdit::Move {
            id: 7,
            position: Point { x: 3., z: 3. },
            heading: 0.,
        },
    )
    .unwrap();
    let resolved = resolve_placements(&level, &moved.placements).unwrap();
    assert_eq!(resolved.field_config.fans[0].heading, std::f64::consts::PI);
    assert_eq!(
        resolved.field_config.fans[0].position,
        Point { x: 3., z: 3. }
    );
    level.fixed_objects = vec![turned];
    let fixed = resolve_placements(&level, &[]).unwrap();
    assert_eq!(fixed.field_config.fans[0].heading, std::f64::consts::PI);
    let mut ordinary = item(8, ToolKind::Banana, 3., 3.);
    ordinary.heading = 0.7;
    assert_eq!(
        resolve_placements(&level, &[ordinary])
            .unwrap()
            .state
            .placements[0]
            .heading,
        0.7
    );
}

#[test]
fn map_fan_rule_requires_a_finite_canonical_heading() {
    assert!(serde_json::from_value::<PlacementRules>(
        serde_json::json!({"inventory":[],"reserved":[]})
    )
    .is_err());
    let mut level = level();
    for heading in [f64::NAN, f64::INFINITY, -0.1, std::f64::consts::TAU] {
        level.placement_rules.fan_heading = heading;
        assert!(
            resolve_placements(&level, &[]).is_err(),
            "invalid map heading {heading}"
        );
    }
    for heading in [0., std::f64::consts::PI] {
        level.placement_rules.fan_heading = heading;
        let resolved = resolve_placements(&level, &[item(1, ToolKind::Fan, 1., 1.)]).unwrap();
        assert_eq!(resolved.state.placements[0].heading, heading);
    }
}
