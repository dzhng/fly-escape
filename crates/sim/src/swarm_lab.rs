//! Shared active-work diagnostic content for native and browser throughput probes.
use crate::{attempt::*, body::*, environment::*, record::RecordLayout, Group, GroupLink};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct StartAttempt {
    pub attempt_id: String,
    pub root_seed: String,
    pub fly_count: u32,
    pub level: LevelDef,
    pub tuning: AttemptTuning,
}
#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct AttemptInfo {
    pub spec: AttemptSpec,
    pub level: LevelDef,
    pub groups: Vec<Group>,
    pub group_links: Vec<GroupLink>,
    pub record_layout: RecordLayout,
    pub archive_bytes: u32,
    pub graph_bytes: u32,
    pub brain_state_bytes: u32,
}
#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct AttemptStep {
    pub tick: u32,
    pub neural_steps: u32,
    pub buffered_ticks: u32,
    pub complete: bool,
}
#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ChunkHeader {
    pub schema_version: u32,
    pub attempt_id: String,
    pub sequence: u32,
    pub start_tick: u32,
    pub tick_count: u32,
    pub fly_count: u32,
    pub result: Option<AttemptResult>,
}
fn point(x: f64, z: f64) -> Point {
    Point { x, z }
}
pub fn level(count: u32) -> Result<LevelDef, String> {
    if !(1..=100).contains(&count) {
        return Err("swarm fixture requires 1..100 flies".into());
    }
    // The occupied room is closed. A valid physical exit is in a disconnected annex,
    // guaranteeing no early escape without disabling body motion or neural stepping.
    let mut walls = vec![];
    for (min, max) in [
        (point(-6., -6.), point(6., 6.)),
        (point(7., -1.), point(8., 1.)),
    ] {
        walls.extend([
            Wall {
                a: min,
                b: point(max.x, min.z),
            },
            Wall {
                a: min,
                b: point(min.x, max.z),
            },
            Wall {
                a: point(min.x, max.z),
                b: max,
            },
        ]);
    }
    walls.push(Wall {
        a: point(6., -6.),
        b: point(6., 6.),
    });
    walls.extend([
        Wall {
            a: point(8., -1.),
            b: point(8., -0.5),
        },
        Wall {
            a: point(8., 0.5),
            b: point(8., 1.),
        },
    ]);
    Ok(LevelDef {
        id: "active-native-benchmark".into(),
        geometry: Geometry {
            rooms: vec![
                RectRoom {
                    id: 0,
                    min: point(-6., -6.),
                    max: point(6., 6.),
                },
                RectRoom {
                    id: 1,
                    min: point(7., -1.),
                    max: point(8., 1.),
                },
            ],
            walls,
        },
        spawn_poses: (0..count)
            .map(|id| BodyPose {
                position: point(-2. + (id % 10) as f64 * 0.4, -2. + (id / 10) as f64 * 0.4),
                heading: 0.,
            })
            .collect(),
        exit: ExitOpening {
            a: point(8., -0.5),
            b: point(8., 0.5),
            outward: point(1., 0.),
        },
        exit_cue: None,
        food: vec![],
        zappers: vec![],
        sources: vec![Source {
            position: point(0., 0.),
            radius: 1.,
            rate: 1.,
            kind: SourceKind::Odor,
        }],
        field_config: FieldConfig {
            wind: point(0., 0.),
            ..FieldConfig::default()
        },
        body_config: BodyConfig {
            reserve_capacity: 1000.,
            ..BodyConfig::default()
        },
        initial_reserve: 1000.,
        duration_ticks: 6000,
        star_thresholds: [1, 10, 20],
    })
}
