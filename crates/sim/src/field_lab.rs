//! Mirrored observation fixtures using the production field and neural owners.
use crate::{
    chamber::{BrainFrame, BrainInfo, Chamber},
    environment::*,
    sensory::CuePathway,
    Graph,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use ts_rs::TS;

#[derive(Clone, Copy, Debug, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum FieldScenario {
    ExcitatoryOdor,
    InhibitoryOdor,
    Lamp,
    Shade,
    Wind,
    Exit,
}
#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct FieldLabInfo {
    pub brain: BrainInfo,
    pub scenario: FieldScenario,
    pub grids: [FieldGrid; 2],
}
#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct FieldLabFrame {
    pub tick: u32,
    pub flies: [BrainFrame; 2],
    pub grids: [FieldGrid; 2],
}
pub struct FieldLab {
    chambers: [Chamber; 2],
    scenario: FieldScenario,
}
impl FieldLab {
    pub fn new(graph: Arc<Graph>, seed: u64, scenario: FieldScenario) -> Result<Self, String> {
        let make = |mirror: f64| -> Result<Chamber, String> {
            let (fields, cue) = fixture(scenario, mirror)?;
            Ok(Chamber::with_fields(
                graph.clone(),
                seed,
                fields,
                Some((cue, 1.0)),
            ))
        };
        Ok(Self {
            chambers: [make(1.)?, make(-1.)?],
            scenario,
        })
    }
    pub fn info(&self) -> FieldLabInfo {
        FieldLabInfo {
            brain: self.chambers[0].info(),
            scenario: self.scenario,
            grids: std::array::from_fn(|i| self.chambers[i].fields.export_grid()),
        }
    }
    pub fn step(&mut self) -> Result<FieldLabFrame, String> {
        let left = self.chambers[0].step()?;
        let right = self.chambers[1].step()?;
        Ok(FieldLabFrame {
            tick: left.tick,
            flies: [left, right],
            grids: std::array::from_fn(|i| self.chambers[i].fields.export_grid()),
        })
    }
}
pub fn fixture(scenario: FieldScenario, mirror: f64) -> Result<(FieldSet, CuePathway), String> {
    let p = |x, z| Point { x, z };
    let geometry = Geometry {
        solids: vec![],
        rooms: vec![
            RectRoom {
                id: 0,
                min: p(-6., -4.),
                max: p(0., 4.),
            },
            RectRoom {
                id: 1,
                min: p(0., -4.),
                max: p(6., 4.),
            },
        ],
        walls: vec![
            Wall {
                a: p(-6., -4.),
                b: p(6., -4.),
            },
            Wall {
                a: p(-6., 4.),
                b: p(6., 4.),
            },
            Wall {
                a: p(-6., -4.),
                b: p(-6., 4.),
            },
            Wall {
                a: p(6., -4.),
                b: p(6., 4.),
            },
            Wall {
                a: p(0., -4.),
                b: p(0., -0.75),
            },
            Wall {
                a: p(0., 0.75),
                b: p(0., 4.),
            },
        ],
    };
    let mut config = FieldConfig {
        // Controlled historical chamber span; campaign defaults use authored anatomy.
        antenna_offset: 0.15,
        antenna_forward: 0.,
        baseline_brightness: 0.2,
        ..FieldConfig::default()
    };
    let mut exit = None;
    let mut source = Source {
        position: p(-2., -mirror),
        radius: 0.75,
        rate: 1.,
        kind: SourceKind::AttractiveOdor,
    };
    let cue = match scenario {
        FieldScenario::ExcitatoryOdor => CuePathway::ExcitatoryOdor,
        FieldScenario::InhibitoryOdor => {
            source.kind = SourceKind::RepellentOdor;
            CuePathway::InhibitoryOdor
        }
        FieldScenario::Lamp => {
            source.kind = SourceKind::Lamp;
            source.radius = 1.5;
            CuePathway::Vision
        }
        FieldScenario::Shade => {
            source.kind = SourceKind::Shade;
            source.radius = 1.5;
            source.rate = 0.2;
            CuePathway::Vision
        }
        FieldScenario::Wind => {
            config.wind = p(0., mirror * 0.5);
            CuePathway::None
        }
        FieldScenario::Exit => {
            exit = Some(ExitCue {
                position: p(5., -mirror),
                room_id: 1,
                radius: 3.,
                strength: 1.,
            });
            CuePathway::ExcitatoryOdor
        }
    };
    let sources = if matches!(scenario, FieldScenario::Exit) {
        vec![]
    } else {
        vec![source]
    };
    let mut fields = FieldSet::new(geometry, config, sources, exit)?;
    // Settle only the field before observation; brains still begin at tick zero.
    for _ in 0..100 {
        fields.advance(0.1)?;
    }
    Ok((fields, cue))
}
