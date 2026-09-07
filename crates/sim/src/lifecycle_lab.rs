//! Diagnostic content for the shared Attempt owner. Wind deliberately transports
//! bodies away from food or through an exit; these are lifecycle demonstrations,
//! not evidence of neural foraging or successful navigation.
use crate::{attempt::*, body::*, environment::*, Graph};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use ts_rs::TS;

/// Selected from a bounded ten-seed probe to demonstrate a meal followed by starvation.
/// This is a review seed, not evidence of population-level feeding efficacy.
pub const LIFECYCLE_DEMO_SEED: u64 = 6;

#[derive(Clone, Copy, Debug, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum LifecycleScenario {
    MealThenStarvation,
    ProboscisSilenced,
    OpenExit,
    BlockedExit,
}
#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct LifecycleInfo {
    pub scenario: LifecycleScenario,
    pub spec: AttemptSpec,
    pub level: LevelDef,
    pub initial_grid: FieldGrid,
    pub initial_bodies: Vec<BodyState>,
}
#[derive(Clone, Debug, PartialEq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct LifecycleEvent {
    pub fly_id: u32,
    pub event: BodyEvent,
}
pub struct LifecycleLab {
    scenario: LifecycleScenario,
    attempt: Attempt,
    events: Vec<LifecycleEvent>,
}
impl LifecycleLab {
    pub fn new(graph: Arc<Graph>, seed: u64, scenario: LifecycleScenario) -> Result<Self, String> {
        let level = fixture(scenario);
        let mut tuning = AttemptTuning {
            taste_gain: 1.,
            ..Default::default()
        };
        if matches!(scenario, LifecycleScenario::ProboscisSilenced) {
            tuning.silenced_neurons = graph
                .manifest
                .groups
                .iter()
                .find(|g| g.id == "proboscis" && !g.indices.is_empty())
                .ok_or("lifecycle ablation requires annotated proboscis neurons")?
                .indices
                .clone();
        }
        let spec = Attempt::describe(&graph, &level, &tuning, "lifecycle-lab", seed, 1, &[])?;
        Ok(Self {
            scenario,
            attempt: Attempt::new(graph, level, tuning, spec)?,
            events: vec![],
        })
    }
    pub fn info(&self) -> LifecycleInfo {
        LifecycleInfo {
            initial_bodies: self.attempt.initial_bodies(),
            scenario: self.scenario,
            spec: self.attempt.spec().clone(),
            level: self.attempt.level().clone(),
            initial_grid: self.attempt.field_grid(),
        }
    }
    pub fn step(&mut self) -> Result<Option<AttemptFrame>, String> {
        let frame = self.attempt.step()?;
        if let Some(frame) = &frame {
            for fly in &frame.flies {
                self.events
                    .extend(fly.events.iter().cloned().map(|event| LifecycleEvent {
                        fly_id: fly.id,
                        event,
                    }));
            }
        }
        Ok(frame)
    }
    pub fn events(&self) -> &[LifecycleEvent] {
        &self.events
    }
    pub fn result(&self) -> Option<&AttemptResult> {
        self.attempt.result()
    }
}
fn fixture(scenario: LifecycleScenario) -> LevelDef {
    let p = |x, z| Point { x, z };
    let exit_case = matches!(
        scenario,
        LifecycleScenario::OpenExit | LifecycleScenario::BlockedExit
    );
    let mut walls = vec![
        Wall {
            a: p(-3., -2.),
            b: p(3., -2.),
        },
        Wall {
            a: p(-3., 2.),
            b: p(3., 2.),
        },
        Wall {
            a: p(-3., -2.),
            b: p(-3., 2.),
        },
        Wall {
            a: p(3., -2.),
            b: p(3., -1.),
        },
        Wall {
            a: p(3., 1.),
            b: p(3., 2.),
        },
    ];
    if !matches!(scenario, LifecycleScenario::OpenExit) {
        walls.push(Wall {
            a: p(3., -1.),
            b: p(3., 1.),
        });
    }
    LevelDef {
        id: if exit_case {
            "lifecycle-exit"
        } else {
            "lifecycle-meal"
        }
        .into(),
        geometry: Geometry {
            solids: vec![],
            rooms: vec![RectRoom {
                id: 0,
                min: p(-3., -2.),
                max: p(3., 2.),
            }],
            walls,
        },
        spawn: crate::spawn::SpawnDef::fixed(vec![BodyPose {
            position: if exit_case { p(2.5, 0.) } else { p(-1., 0.) },
            heading: 0.,
        }]),
        exit: ExitOpening {
            a: p(3., -1.),
            b: p(3., 1.),
            outward: p(1., 0.),
        },
        exit_cue: None,
        food: if exit_case {
            vec![]
        } else {
            vec![ContactRegion {
                center: p(-1., 0.),
                // Covers the floor approach plus bounded horizontal travel during descent.
                radius: 1.5,
            }]
        },
        zappers: vec![],
        sources: vec![],
        field_config: FieldConfig {
            wind: p(if exit_case { 2. } else { 0.1 }, 0.),
            ..Default::default()
        },
        // Costs compress finite life into a short review; locomotion stays neural.
        body_config: BodyConfig {
            reserve_capacity: 10.,
            idle_cost: 0.5,
            walking_cost: 0.6,
            flying_cost: 0.8,
            feeding_rate: 3.,
            walk_speed: 0.12,
            flight_speed: 0.12,
            turn_gain: 8.,
            ..Default::default()
        },
        initial_reserve: 8.,
        duration_ticks: 300,
        star_thresholds: [1, 2, 3],
        placement_rules: Default::default(),
    }
}
