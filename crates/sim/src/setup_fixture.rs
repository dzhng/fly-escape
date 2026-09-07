//! Five-room UI integration content, deliberately separate from campaign balancing.
use crate::{attempt::*, body::*, environment::*, placement::*, sensory::CuePathway};
use serde::Serialize;
use ts_rs::TS;
#[derive(Serialize, TS)]
pub struct SetupFixture {
    pub level: LevelDef,
    pub tuning: AttemptTuning,
    pub catalog: Vec<ToolDef>,
}
pub fn fixture() -> Result<SetupFixture, String> {
    let geometry: Geometry =
        serde_json::from_str(include_str!("../../../assets/house/five-rooms.json"))
            .map_err(|e| e.to_string())?;
    geometry.validate()?;
    let point = |x, z| Point { x, z };
    let fixture = SetupFixture {
        level: LevelDef {
            fixed_objects: vec![],
            id: "five-room-setup".into(),
            geometry,
            spawn: crate::spawn::SpawnDef::Cluster {
                min: point(0.7, 1.4),
                max: point(1.9, 2.3),
                flying_count: 10,
            },
            exit: ExitOpening {
                a: point(16., 1.5),
                b: point(16., 2.5),
                outward: point(1., 0.),
            },
            exit_cue: Some(ExitCue {
                position: point(16., 2.),
                room_id: 4,
                radius: 2.,
                strength: 1.,
            }),
            food: vec![],
            zappers: vec![],
            sources: vec![],
            field_config: FieldConfig::default(),
            body_config: BodyConfig {
                walk_speed: 0.12,
                flight_speed: 0.24,
                turn_gain: 8.,
                reserve_capacity: 30.,
                ..Default::default()
            },
            initial_reserve: 20.,
            duration_ticks: 600,
            star_thresholds: [1, 10, 18],
            placement_rules: PlacementRules {
                fan_heading: 0.,
                inventory: tool_catalog()
                    .iter()
                    .map(|tool| ToolStock {
                        kind: tool.kind,
                        count: 2,
                    })
                    .collect(),
                reserved: vec![],
            },
        },
        tuning: AttemptTuning {
            cues: [
                CuePathway::InhibitoryOdor,
                CuePathway::ExcitatoryOdor,
                CuePathway::Vision,
            ]
            .into_iter()
            .map(|pathway| CueInput { pathway, gain: 1. })
            .collect(),
            ..Default::default()
        },
        catalog: tool_catalog(),
    };
    Ok(fixture)
}
