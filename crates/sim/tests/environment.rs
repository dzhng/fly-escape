use sim::environment::*;

fn room(id: u32, x0: f64, z0: f64, x1: f64, z1: f64) -> RectRoom {
    RectRoom {
        id,
        min: Point { x: x0, z: z0 },
        max: Point { x: x1, z: z1 },
    }
}
fn wall(x0: f64, z0: f64, x1: f64, z1: f64) -> Wall {
    Wall {
        a: Point { x: x0, z: z0 },
        b: Point { x: x1, z: z1 },
    }
}
fn chambers(open: bool) -> Geometry {
    let mut walls = vec![
        wall(0., 0., 8., 0.),
        wall(0., 4., 8., 4.),
        wall(0., 0., 0., 4.),
        wall(8., 0., 8., 4.),
    ];
    if open {
        walls.extend([wall(4., 0., 4., 1.), wall(4., 3., 4., 4.)]);
    } else {
        walls.push(wall(4., 0., 4., 4.));
    }
    Geometry {
        solids: vec![],
        rooms: vec![room(1, 0., 0., 4., 4.), room(2, 4., 0., 8., 4.)],
        walls,
    }
}
#[test]
fn walls_block_visibility_and_fast_motion_but_doorways_admit_both() {
    let a = Point { x: 2., z: 2. };
    let b = Point { x: 6., z: 2. };
    assert!(!chambers(false).line_of_sight(a, b));
    assert!(chambers(true).line_of_sight(a, b));
    assert!(chambers(false).sweep(a, b, 0.1).x < 3.91);
    assert_eq!(chambers(true).sweep(a, b, 0.1), b);
    assert!(
        chambers(true)
            .sweep(Point { x: 2., z: 0.5 }, Point { x: 6., z: 0.5 }, 0.1)
            .x
            < 4.
    );
}
#[test]
fn exit_cue_requires_same_room_radius_and_clear_sight() {
    let mut geometry = chambers(true);
    geometry.walls.push(wall(6., 0., 6., 1.5));
    let fields = FieldSet::new(
        geometry,
        FieldConfig::default(),
        vec![],
        Some(ExitCue {
            position: Point { x: 7., z: 1. },
            room_id: 2,
            radius: 4.,
            strength: 2.,
        }),
    )
    .unwrap();
    assert!(fields.sample_point(Point { x: 6.5, z: 1. }).exit_cue > 0.);
    assert_eq!(fields.sample_point(Point { x: 5., z: 1. }).exit_cue, 0.);
    assert_eq!(fields.sample_point(Point { x: 3., z: 2. }).exit_cue, 0.);
    assert_eq!(fields.sample_point(Point { x: 4.1, z: 3.9 }).exit_cue, 0.);
}
fn odor(chambers: Geometry, h: f64, wind: Point) -> FieldSet {
    FieldSet::new(
        chambers,
        FieldConfig {
            cell_size: h,
            wind,
            ..FieldConfig::default()
        },
        vec![Source {
            position: Point { x: 2., z: 2. },
            radius: 0.7,
            rate: 1.,
            kind: SourceKind::AttractiveOdor,
        }],
        None,
    )
    .unwrap()
}
fn run(fields: &mut FieldSet, seconds: usize) {
    for _ in 0..seconds * 10 {
        fields.advance(0.1).unwrap();
    }
}
fn mass_right(f: &FieldSet) -> f64 {
    let g = f.export_grid();
    g.cells
        .iter()
        .enumerate()
        .filter(|(i, _)| g.origin.x + (*i % g.width as usize) as f64 * g.cell_size >= 4.)
        .map(|(_, v)| v.map_or(0., |s| s.attractive_odor) * g.cell_size * g.cell_size)
        .sum()
}
#[test]
fn odor_crosses_open_doorway_but_not_solid_wall_at_two_resolutions() {
    for h in [0.25, 0.125] {
        let mut closed = odor(chambers(false), h, Point::default());
        let mut open = odor(chambers(true), h, Point::default());
        run(&mut closed, 12);
        run(&mut open, 12);
        assert_eq!(mass_right(&closed), 0.);
        assert!(mass_right(&open) > 0.1);
    }
}
fn arena() -> Geometry {
    Geometry {
        solids: vec![],
        rooms: vec![room(1, 0., 0., 12., 12.)],
        walls: vec![
            wall(0., 0., 12., 0.),
            wall(0., 12., 12., 12.),
            wall(0., 0., 0., 12.),
            wall(12., 0., 12., 12.),
        ],
    }
}
fn plume(h: f64, wind: Point, source: Point) -> FieldSet {
    FieldSet::new(
        arena(),
        FieldConfig {
            cell_size: h,
            wind,
            ..FieldConfig::default()
        },
        vec![Source {
            position: source,
            radius: 0.8,
            rate: 1.,
            kind: SourceKind::AttractiveOdor,
        }],
        None,
    )
    .unwrap()
}
fn centroid(f: &FieldSet) -> Point {
    let g = f.export_grid();
    let mut mass = 0.;
    let mut p = Point::default();
    for (i, v) in g.cells.iter().enumerate() {
        if let Some(v) = v {
            mass += v.attractive_odor;
            p.x += v.attractive_odor
                * (g.origin.x + (i % g.width as usize) as f64 * g.cell_size + g.cell_size / 2.);
            p.z += v.attractive_odor
                * (g.origin.z + (i / g.width as usize) as f64 * g.cell_size + g.cell_size / 2.);
        }
    }
    Point {
        x: p.x / mass,
        z: p.z / mass,
    }
}
#[test]
fn wind_moves_plume_downwind_and_rotates_in_world_space() {
    let mut calm = plume(0.25, Point::default(), Point { x: 6., z: 6. });
    let mut east = plume(0.25, Point { x: 0.8, z: 0. }, Point { x: 6., z: 6. });
    let mut south = plume(0.25, Point { x: 0., z: 0.8 }, Point { x: 6., z: 6. });
    run(&mut calm, 3);
    run(&mut east, 3);
    run(&mut south, 3);
    assert!(centroid(&east).x - centroid(&calm).x > 0.8);
    assert!((centroid(&east).x - centroid(&south).z).abs() < 1e-10);
    assert!((centroid(&east).z - centroid(&south).x).abs() < 1e-10);
    for heading in [0., 1., 2.] {
        assert_eq!(
            south.sample(Point { x: 6., z: 6. }, heading, 0).wind,
            Point { x: 0., z: 0.8 }
        );
    }
}
#[test]
fn doorway_transport_converges_with_grid_refinement() {
    // Isolate diffusion: competing advection truncation error can cancel it on a coarse grid.
    let mut masses = vec![];
    for h in [0.5, 0.25, 0.125, 0.0625] {
        let mut f = odor(chambers(true), h, Point::default());
        run(&mut f, 12);
        masses.push(mass_right(&f));
    }
    let errors: Vec<_> = masses[..3].iter().map(|m| (m - masses[3]).abs()).collect();
    assert!(errors[2] < errors[1] && errors[1] < errors[0]);
    assert!(
        errors[2] / masses[3] < 0.1,
        "finest comparison must agree within 10%: {masses:?}"
    );
}
#[test]
fn mirrored_fields_swap_antennae_and_export_exact_sampled_values() {
    let mut pair = vec![];
    for z in [5., 7.] {
        let sources = vec![
            Source {
                position: Point { x: 6., z },
                radius: 2.,
                rate: 3.,
                kind: SourceKind::Lamp,
            },
            Source {
                position: Point { x: 6., z },
                radius: 0.8,
                rate: 1.,
                kind: SourceKind::AttractiveOdor,
            },
        ];
        let mut f = FieldSet::new(arena(), FieldConfig::default(), sources, None).unwrap();
        run(&mut f, 2);
        pair.push(f);
    }
    let a = pair[0].sample(Point { x: 6., z: 6. }, 0., 20);
    let b = pair[1].sample(Point { x: 6., z: 6. }, 0., 20);
    assert!(
        a.left.brightness > a.right.brightness && a.left.attractive_odor > a.right.attractive_odor
    );
    assert!((a.left.brightness - b.right.brightness).abs() < 1e-12);
    assert!((a.left.attractive_odor - b.right.attractive_odor).abs() < 1e-12);
    assert!((a.right.attractive_odor - b.left.attractive_odor).abs() < 1e-12);
    let turned = pair[0].sample(Point { x: 6., z: 6. }, std::f64::consts::PI, 20);
    assert!(turned.left.attractive_odor < turned.right.attractive_odor);
    let g = pair[0].export_grid();
    for (i, cell) in g.cells.iter().enumerate() {
        let p = Point {
            x: g.origin.x + (i % g.width as usize) as f64 * g.cell_size + g.cell_size / 2.,
            z: g.origin.z + (i / g.width as usize) as f64 * g.cell_size + g.cell_size / 2.,
        };
        assert_eq!(*cell, Some(pair[0].sample_point(p)));
    }
}
#[test]
fn lamps_add_shade_subtracts_and_darkness_never_goes_negative() {
    let source = |kind, rate| Source {
        position: Point { x: 2.125, z: 2.125 },
        radius: 1.,
        rate,
        kind,
    };
    let make =
        |sources| FieldSet::new(chambers(false), FieldConfig::default(), sources, None).unwrap();
    let p = Point { x: 2.125, z: 2.125 };
    assert_eq!(
        make(vec![source(SourceKind::Lamp, 3.)])
            .sample_point(p)
            .brightness,
        4.
    );
    assert_eq!(
        make(vec![source(SourceKind::Shade, 3.)])
            .sample_point(p)
            .brightness,
        0.
    );
    let combined = make(vec![
        source(SourceKind::Lamp, 3.),
        source(SourceKind::Shade, 2.),
    ])
    .sample_point(p);
    assert_eq!(combined.brightness, 2.);
    assert_eq!(combined.shade, 2.);
}
#[test]
fn bounded_solver_preserves_mass_positivity_and_state_on_rejection() {
    let config = FieldConfig {
        wind: Point { x: 5., z: 3. },
        decay: 0.,
        ..FieldConfig::default()
    };
    let mut f = FieldSet::new(
        chambers(false),
        config,
        vec![Source {
            position: Point { x: 2., z: 2. },
            radius: 0.7,
            rate: 2.,
            kind: SourceKind::AttractiveOdor,
        }],
        None,
    )
    .unwrap();
    run(&mut f, 5);
    let grid = f.export_grid();
    let mass: f64 = grid
        .cells
        .iter()
        .flatten()
        .map(|v| {
            assert!(v.attractive_odor.is_finite() && v.attractive_odor >= 0.);
            v.attractive_odor * grid.cell_size.powi(2)
        })
        .sum();
    assert!(
        (mass - 10.).abs() < 1e-10,
        "solid walls must retain all emitted mass: {mass}"
    );
    assert!(f.advance(1e9).unwrap_err().contains("work limit"));
    assert_eq!(f.export_grid(), grid);
    f.advance(0.1).unwrap();
    assert_ne!(f.export_grid(), grid);
}
#[test]
fn decay_reduces_total_concentration_at_the_declared_rate() {
    let mut f = odor(chambers(false), 0.25, Point::default());
    run(&mut f, 10);
    let grid = f.export_grid();
    let mass: f64 = grid
        .cells
        .iter()
        .flatten()
        .map(|v| v.attractive_odor * grid.cell_size.powi(2))
        .sum();
    let continuous = (1. - (-0.1_f64 * 10.).exp()) / 0.1;
    assert!((mass - continuous).abs() / continuous < 0.01);
}
#[test]
fn dead_end_branch_has_one_physical_connection_and_no_remote_exit_cue() {
    let mut g = chambers(true);
    g.rooms.push(room(3, 4., 4., 6., 7.));
    g.walls.retain(|w| *w != wall(0., 4., 8., 4.));
    g.walls.extend([
        wall(0., 4., 4., 4.),
        wall(6., 4., 8., 4.),
        wall(4., 4., 4., 7.),
        wall(6., 4., 6., 7.),
        wall(4., 7., 6., 7.),
    ]);
    let branch = Point { x: 5., z: 6. };
    let main = Point { x: 5., z: 2. };
    assert_eq!(g.room_at(branch), Some(3));
    assert_eq!(g.sweep(branch, main, 0.1), main);
    assert!(g.sweep(branch, Point { x: 7., z: 6. }, 0.1).x < 6.);
    let f = FieldSet::new(
        g,
        FieldConfig::default(),
        vec![],
        Some(ExitCue {
            position: main,
            room_id: 2,
            radius: 8.,
            strength: 1.,
        }),
    )
    .unwrap();
    assert!(f.geometry().line_of_sight(branch, main));
    assert_eq!(f.sample_point(branch).exit_cue, 0.);
}

#[test]
fn mixed_odors_transport_independently_through_the_same_doorway() {
    for open in [false, true] {
        let source = |kind, x| Source {
            position: Point { x, z: 2. },
            radius: 0.7,
            rate: 1.,
            kind,
        };
        let make =
            |sources| FieldSet::new(chambers(open), FieldConfig::default(), sources, None).unwrap();
        let mut attractive = make(vec![source(SourceKind::AttractiveOdor, 2.)]);
        let mut repellent = make(vec![source(SourceKind::RepellentOdor, 6.)]);
        let mut mixed = make(vec![
            source(SourceKind::AttractiveOdor, 2.),
            source(SourceKind::RepellentOdor, 6.),
        ]);
        for field in [&mut attractive, &mut repellent, &mut mixed] {
            run(field, 12);
        }
        let a = attractive.export_grid();
        let r = repellent.export_grid();
        let m = mixed.export_grid();
        for ((a, r), m) in a.cells.iter().zip(&r.cells).zip(&m.cells) {
            if let (Some(a), Some(r), Some(m)) = (a, r, m) {
                assert_eq!(m.attractive_odor, a.attractive_odor);
                assert_eq!(m.repellent_odor, r.repellent_odor);
                assert_eq!(a.repellent_odor, 0.);
                assert_eq!(r.attractive_odor, 0.);
            }
        }
        assert_eq!(
            mixed.sample_point(Point { x: 2., z: 2. }).repellent_odor > 0.,
            open
        );
        assert_eq!(
            mixed.sample_point(Point { x: 6., z: 2. }).attractive_odor > 0.,
            open
        );
    }
}

#[test]
fn fan_wind_is_local_directional_and_blocked_by_walls() {
    let fan = FanField {
        position: Point { x: 2., z: 2. },
        heading: 0.,
        reach: 5.,
        half_width: 1.,
        speed: 2.,
    };
    let make = |open, fan| {
        FieldSet::new(
            chambers(open),
            FieldConfig {
                fans: vec![fan],
                ..Default::default()
            },
            vec![],
            None,
        )
        .unwrap()
    };
    let closed = make(false, fan.clone());
    let wind = |fields: &FieldSet, x, z| fields.sample(Point { x, z }, 0., 0).wind;
    assert!(wind(&closed, 3., 2.).x > 0.);
    assert_eq!(wind(&closed, 1., 2.), Point::default());
    assert_eq!(wind(&closed, 3., 3.5), Point::default());
    assert_eq!(wind(&closed, 6., 2.), Point::default());
    let open = make(true, fan.clone());
    assert!(wind(&open, 6., 2.).x > 0.);
    let rotated = make(
        true,
        FanField {
            heading: std::f64::consts::FRAC_PI_2,
            ..fan
        },
    );
    assert!(wind(&rotated, 2., 3.).z > 0.);
    assert!(wind(&rotated, 2., 3.).x.abs() < 1e-12);
    let grid = open.export_grid();
    for (i, expected) in grid.wind_cells.iter().enumerate() {
        let p = Point {
            x: grid.origin.x
                + (i % grid.width as usize) as f64 * grid.cell_size
                + grid.cell_size / 2.,
            z: grid.origin.z
                + (i / grid.width as usize) as f64 * grid.cell_size
                + grid.cell_size / 2.,
        };
        assert_eq!(open.sample(p, 0., 0).wind, *expected);
    }
}

#[test]
fn local_fans_advect_odor_conservatively_without_global_drift() {
    let make = |fans| {
        FieldSet::new(
            chambers(true),
            FieldConfig {
                fans,
                diffusion: 0.,
                decay: 0.,
                ..Default::default()
            },
            vec![Source {
                position: Point { x: 3., z: 2. },
                radius: 0.7,
                rate: 1.,
                kind: SourceKind::AttractiveOdor,
            }],
            None,
        )
        .unwrap()
    };
    let mut still = make(vec![]);
    let mut blowing = make(vec![FanField {
        position: Point { x: 2., z: 2. },
        heading: 0.,
        reach: 5.,
        half_width: 1.,
        speed: 8.,
    }]);
    for field in [&mut still, &mut blowing] {
        run(field, 2);
    }
    let centroid = |field: &FieldSet| {
        let grid = field.export_grid();
        let mut mass = 0.;
        let mut weighted_x = 0.;
        for (i, cell) in grid.cells.iter().enumerate() {
            if let Some(cell) = cell {
                assert!(cell.attractive_odor >= 0. && cell.attractive_odor.is_finite());
                let amount = cell.attractive_odor * grid.cell_size.powi(2);
                mass += amount;
                weighted_x += amount
                    * (grid.origin.x
                        + (i % grid.width as usize) as f64 * grid.cell_size
                        + grid.cell_size / 2.);
            }
        }
        assert!((mass - 2.).abs() < 1e-12);
        weighted_x / mass
    };
    assert!(centroid(&blowing) > centroid(&still) + 0.5);
}

#[test]
fn forward_and_lateral_sample_points_rotate_with_the_body() {
    let fields = FieldSet::new(
        chambers(true),
        FieldConfig {
            antenna_offset: 0.2,
            antenna_forward: 0.4,
            ..FieldConfig::default()
        },
        vec![],
        None,
    )
    .unwrap();
    let position = Point { x: 2., z: 2. };
    for (heading, expected) in [
        (0., [(2.4, 1.8), (2.4, 2.2)]),
        (std::f64::consts::FRAC_PI_2, [(2.2, 2.4), (1.8, 2.4)]),
        (std::f64::consts::PI, [(1.6, 2.2), (1.6, 1.8)]),
    ] {
        let points = fields.sample_points(position, heading);
        for (point, (x, z)) in points.iter().zip(expected) {
            assert!((point.x - x).abs() < 1e-12 && (point.z - z).abs() < 1e-12);
        }
        let sample = fields.sample(position, heading, 0);
        assert_eq!(sample.left, fields.sample_point(points[0]));
        assert_eq!(sample.right, fields.sample_point(points[1]));
    }
}
