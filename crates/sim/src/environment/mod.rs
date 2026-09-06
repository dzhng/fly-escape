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
/// Openings are absent wall intervals, never a second doorway collision map.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
pub struct Geometry {
    pub rooms: Vec<RectRoom>,
    pub walls: Vec<Wall>,
}
impl Geometry {
    pub fn room_at(&self, p: Point) -> Option<u32> {
        self.rooms
            .iter()
            .find(|r| p.x >= r.min.x && p.x <= r.max.x && p.z >= r.min.z && p.z <= r.max.z)
            .map(|r| r.id)
    }
    /// A spawn must clear the same conservative wall footprint used by sweep.
    pub fn contains_body(&self, p: Point, radius: f64) -> bool {
        p.finite()
            && radius.is_finite()
            && radius >= 0.
            && self.room_at(p).is_some()
            && self.walls.iter().all(|wall| {
                let (min, max) = wall_bounds(*wall, radius);
                segment_box(p, p, min, max).is_none()
            })
    }
    pub fn line_of_sight(&self, a: Point, b: Point) -> bool {
        a.finite()
            && b.finite()
            && !self
                .walls
                .iter()
                .any(|w| segment_box(a, b, w.a, w.b).is_some())
    }
    /// Continuous conservative circle sweep: each axis-aligned wall is expanded
    /// by radius, including square end caps. Stops before first contact; no slide.
    pub fn sweep(&self, from: Point, to: Point, radius: f64) -> Point {
        if !from.finite() || !to.finite() || !radius.is_finite() || radius < 0. {
            return from;
        }
        let mut t: f64 = 1.;
        for w in &self.walls {
            let (min, max) = wall_bounds(*w, radius);
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
    pub(crate) fn validate(&self) -> Result<(), String> {
        if self.rooms.is_empty() || self.rooms.len() > 256 || self.walls.len() > 4096 {
            return Err("geometry requires 1..256 rooms and at most 4096 walls".into());
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

fn wall_bounds(wall: Wall, radius: f64) -> (Point, Point) {
    (
        Point {
            x: wall.a.x.min(wall.b.x) - radius,
            z: wall.a.z.min(wall.b.z) - radius,
        },
        Point {
            x: wall.a.x.max(wall.b.x) + radius,
            z: wall.a.z.max(wall.b.z) + radius,
        },
    )
}
