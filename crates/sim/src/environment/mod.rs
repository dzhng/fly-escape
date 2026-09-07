//! Single planar geometry and sensory-field owner. Distances are world units;
//! time is game seconds, concentrations and brightness are modeled cue units.
mod fields;
pub use fields::*;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize, TS)]
pub struct Point {
    pub x: f64,
    pub z: f64,
}
impl Point {
    pub(crate) fn distance(self, other: Self) -> f64 {
        (self.x - other.x).hypot(self.z - other.z)
    }
    pub(crate) fn finite(self) -> bool {
        self.x.is_finite() && self.z.is_finite()
    }
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
pub struct RectRoom {
    pub id: u32,
    pub min: Point,
    pub max: Point,
}
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, TS)]
pub struct Wall {
    pub a: Point,
    pub b: Point,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum FurnitureModel {
    Cabinet,
    Sofa,
    Desk,
    Chair,
    Bed,
}
impl FurnitureModel {
    pub fn dimensions(self) -> [f64; 3] {
        #[derive(Deserialize)]
        struct Catalog {
            cabinet: [f64; 3],
            sofa: [f64; 3],
            desk: [f64; 3],
            chair: [f64; 3],
            bed: [f64; 3],
        }
        static CATALOG: std::sync::OnceLock<Catalog> = std::sync::OnceLock::new();
        let catalog = CATALOG.get_or_init(|| {
            serde_json::from_str(include_str!("../../../../assets/house/catalog.json"))
                .expect("authored furniture catalog must be valid")
        });
        match self {
            Self::Cabinet => catalog.cabinet,
            Self::Sofa => catalog.sofa,
            Self::Desk => catalog.desk,
            Self::Chair => catalog.chair,
            Self::Bed => catalog.bed,
        }
    }
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Furnishing {
    pub model: FurnitureModel,
    /// Quarter turns around +Y; native front is +Z.
    pub quarter_turns: u8,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
pub struct SolidProp {
    pub id: u32,
    pub furnishing: Option<Furnishing>,
    pub min: Point,
    pub max: Point,
    pub height: f64,
}
/// Openings are absent wall intervals, never a second doorway collision map.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
pub struct Geometry {
    pub rooms: Vec<RectRoom>,
    pub walls: Vec<Wall>,
    pub solids: Vec<SolidProp>,
}
impl Geometry {
    pub fn room_at(&self, p: Point) -> Option<u32> {
        self.rooms
            .iter()
            .find(|r| p.x >= r.min.x && p.x <= r.max.x && p.z >= r.min.z && p.z <= r.max.z)
            .map(|r| r.id)
    }
    /// A spawn must clear the same conservative obstacle footprint used by sweep.
    pub fn contains_body(&self, p: Point, radius: f64) -> bool {
        p.finite()
            && radius.is_finite()
            && radius >= 0.
            && self.room_at(p).is_some()
            && self
                .blocking_bounds(radius)
                .all(|(min, max)| segment_box(p, p, min, max).is_none())
    }
    pub fn line_of_sight(&self, a: Point, b: Point) -> bool {
        a.finite()
            && b.finite()
            && !self
                .blocking_bounds(0.)
                .any(|(min, max)| segment_box(a, b, min, max).is_some())
    }
    /// Continuous conservative circle sweep: each wall or solid is expanded
    /// by radius, including square end caps. Stops before first contact; no slide.
    pub fn sweep(&self, from: Point, to: Point, radius: f64) -> Point {
        if !from.finite() || !to.finite() || !radius.is_finite() || radius < 0. {
            return from;
        }
        let mut t: f64 = 1.;
        for (min, max) in self.blocking_bounds(radius) {
            if let Some(hit) = segment_box(from, to, min, max) {
                t = t.min(hit);
            }
        }
        if t < 1. {
            t = (t - 1e-9 / from.distance(to).max(1e-9)).max(0.);
        }
        Point {
            x: from.x + (to.x - from.x) * t,
            z: from.z + (to.z - from.z) * t,
        }
    }
    fn blocking_bounds(&self, radius: f64) -> impl Iterator<Item = (Point, Point)> + '_ {
        self.walls
            .iter()
            .map(move |w| expanded_bounds(w.a, w.b, radius))
            .chain(
                self.solids
                    .iter()
                    .map(move |p| expanded_bounds(p.min, p.max, radius)),
            )
    }
    pub(crate) fn validate(&self) -> Result<(), String> {
        if self.rooms.is_empty()
            || self.rooms.len() > 256
            || self.walls.len() > 4096
            || self.solids.len() > 256
        {
            return Err(
                "geometry requires 1..256 rooms and at most 4096 walls and 256 solids".into(),
            );
        }
        for (i, r) in self.rooms.iter().enumerate() {
            if !r.min.finite() || !r.max.finite() || r.min.x >= r.max.x || r.min.z >= r.max.z {
                return Err("room bounds must be finite and increasing".into());
            }
            for other in &self.rooms[..i] {
                if other.id == r.id
                    || (other.min.x < r.max.x
                        && other.max.x > r.min.x
                        && other.min.z < r.max.z
                        && other.max.z > r.min.z)
                {
                    return Err("rooms must have unique ids and nonoverlapping interiors".into());
                }
            }
        }
        if self.walls.iter().any(|w| {
            !w.a.finite() || !w.b.finite() || w.a == w.b || (w.a.x != w.b.x && w.a.z != w.b.z)
        }) {
            return Err("walls must be finite nonzero axis-aligned segments".into());
        }
        for (i, p) in self.solids.iter().enumerate() {
            if p.furnishing.is_some_and(|f| {
                let [width, height, depth] = f.model.dimensions();
                let (x, z) = if f.quarter_turns % 2 == 0 {
                    (width, depth)
                } else {
                    (depth, width)
                };
                f.quarter_turns > 3
                    || (p.max.x - p.min.x - x).abs() > 1e-9
                    || (p.max.z - p.min.z - z).abs() > 1e-9
                    || (p.height - height).abs() > 1e-9
            }) || !p.min.finite()
                || !p.max.finite()
                || p.min.x >= p.max.x
                || p.min.z >= p.max.z
                || !p.height.is_finite()
                || p.height <= 0.
                || !self.rooms.iter().any(|r| {
                    p.min.x >= r.min.x
                        && p.max.x <= r.max.x
                        && p.min.z >= r.min.z
                        && p.max.z <= r.max.z
                })
                || self
                    .walls
                    .iter()
                    .any(|w| segment_box(w.a, w.b, p.min, p.max).is_some())
                || self.solids[..i].iter().any(|q| {
                    q.id == p.id
                        || (p.min.x < q.max.x
                            && p.max.x > q.min.x
                            && p.min.z < q.max.z
                            && p.max.z > q.min.z)
                })
            {
                return Err("solids require unique IDs, positive finite bounds/height, native furnishing dimensions with quarter turns in 0..3, open floor in one room, and nonoverlapping footprints".into());
            }
        }
        Ok(())
    }
}
fn segment_box(a: Point, b: Point, min: Point, max: Point) -> Option<f64> {
    let mut near: f64 = 0.;
    let mut far: f64 = 1.;
    for (start, end, lo, hi) in [
        (a.x, b.x, min.x.min(max.x), min.x.max(max.x)),
        (a.z, b.z, min.z.min(max.z), min.z.max(max.z)),
    ] {
        let delta = end - start;
        if delta == 0. {
            if start < lo || start > hi {
                return None;
            }
        } else {
            let t0 = (lo - start) / delta;
            let t1 = (hi - start) / delta;
            near = near.max(t0.min(t1));
            far = far.min(t0.max(t1));
            if near > far {
                return None;
            }
        }
    }
    Some(near)
}

fn expanded_bounds(a: Point, b: Point, radius: f64) -> (Point, Point) {
    (
        Point {
            x: a.x.min(b.x) - radius,
            z: a.z.min(b.z) - radius,
        },
        Point {
            x: a.x.max(b.x) + radius,
            z: a.z.max(b.z) + radius,
        },
    )
}
