//! Seeded initialization only. No random values enter ongoing body or neural control.
use crate::{
    attempt::LevelDef,
    body::{Body, BodyMode, BodyPose, BodyState},
    environment::Point,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use ts_rs::TS;

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum SpawnMode {
    Walking,
    Flying,
}
impl SpawnMode {
    pub fn body_mode(self) -> BodyMode {
        match self {
            Self::Walking => BodyMode::Walking,
            Self::Flying => BodyMode::Flying,
        }
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SpawnState {
    pub pose: BodyPose,
    pub mode: SpawnMode,
}
#[derive(Clone, Debug, Serialize, Deserialize, TS)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum SpawnDef {
    Fixed {
        states: Vec<SpawnState>,
    },
    Cluster {
        min: Point,
        max: Point,
        flying_count: u32,
    },
}
impl SpawnDef {
    pub fn fixed(poses: Vec<BodyPose>) -> Self {
        Self::Fixed {
            states: poses
                .into_iter()
                .map(|pose| SpawnState {
                    pose,
                    mode: SpawnMode::Walking,
                })
                .collect(),
        }
    }
    pub fn excludes(&self, point: Point, radius: f64) -> bool {
        match self {
            Self::Fixed { states } => states
                .iter()
                .any(|s| s.pose.position.distance(point) <= radius),
            Self::Cluster { min, max, .. } if min.x <= max.x && min.z <= max.z => {
                point.distance(Point {
                    x: point.x.clamp(min.x, max.x),
                    z: point.z.clamp(min.z, max.z),
                }) <= radius
            }
            Self::Cluster { .. } => true,
        }
    }
}
// SHA-256 counter samples are domain separated from Brain's per-fly RNG and from
// mode assignment. Each 53-bit uniform is in [0,1); no rejection consumes neural noise.
fn draw(seed: u64, domain: &[u8], fly: u32, candidate: u32) -> [u8; 32] {
    let mut hash = Sha256::new();
    hash.update(b"fly-spawn-v1");
    hash.update(domain);
    hash.update(seed.to_le_bytes());
    hash.update(fly.to_le_bytes());
    hash.update(candidate.to_le_bytes());
    hash.finalize().into()
}
fn uniform(bytes: &[u8]) -> f64 {
    (u64::from_le_bytes(bytes.try_into().unwrap()) >> 11) as f64 / 9007199254740992.
}
pub fn validate(level: &LevelDef, count: u32) -> Result<(), String> {
    if !(1..=100).contains(&count) {
        return Err("spawn count must be 1..100".into());
    }
    Body::new(
        BodyPose {
            position: Point { x: 0., z: 0. },
            heading: 0.,
        },
        level.body_config.clone(),
    )?;
    match &level.spawn {
        SpawnDef::Fixed { states } if states.len() < count as usize || states.len() > 100 => {
            Err("fixed spawn requires enough states, at most 100".into())
        }
        SpawnDef::Cluster {
            min,
            max,
            flying_count,
        } if ![min.x, min.z, max.x, max.z].iter().all(|x| x.is_finite())
            || min.x >= max.x
            || min.z >= max.z
            || *flying_count == 0
            || *flying_count >= count =>
        {
            Err("cluster requires finite positive area and both walking and flying starts".into())
        }
        _ => Ok(()),
    }
}
pub fn resolve(level: &LevelDef, seed: u64, count: u32) -> Result<Vec<BodyState>, String> {
    validate(level, count)?;
    let radius = level.body_config.body_radius;
    let legal = |p: Point| {
        level.geometry.contains_body(p, radius)
            && !level
                .zappers
                .iter()
                .any(|z| p.distance(z.center) <= radius + z.radius)
    };
    let states = match &level.spawn {
        SpawnDef::Fixed { states } => states[..count as usize].to_vec(),
        SpawnDef::Cluster {
            min,
            max,
            flying_count,
        } => {
            let mut order: Vec<_> = (0..count).collect();
            order.sort_by_key(|&id| (draw(seed, b"mode", id, 0), id));
            let mut states: Vec<SpawnState> = Vec::with_capacity(count as usize);
            for id in 0..count {
                let mut chosen = None;
                for candidate in 0..128 {
                    let bytes = draw(seed, b"pose", id, candidate);
                    let pose = BodyPose {
                        position: Point {
                            x: min.x + (max.x - min.x) * uniform(&bytes[0..8]),
                            z: min.z + (max.z - min.z) * uniform(&bytes[8..16]),
                        },
                        heading: std::f64::consts::TAU * uniform(&bytes[16..24]),
                    };
                    if legal(pose.position)
                        && states
                            .iter()
                            .all(|s| s.pose.position.distance(pose.position) > 2. * radius)
                    {
                        chosen = Some(pose);
                        break;
                    }
                }
                let pose=chosen.ok_or_else(||format!("cluster cannot place fly {id} legally within 128 samples; enlarge or clear the authored area"))?;
                states.push(SpawnState {
                    pose,
                    mode: if order[..*flying_count as usize].contains(&id) {
                        SpawnMode::Flying
                    } else {
                        SpawnMode::Walking
                    },
                });
            }
            states
        }
    };
    states
        .into_iter()
        .map(|s| {
            if !level.geometry.contains_body(s.pose.position, radius) {
                return Err("spawn body must clear room floor, walls and solid props".into());
            }
            Ok(
                Body::new_in_mode(s.pose, level.body_config.clone(), s.mode.body_mode())?
                    .state()
                    .clone(),
            )
        })
        .collect()
}
