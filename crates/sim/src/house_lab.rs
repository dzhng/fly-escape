//! Bounded diagnostic poses for the shared house fixture; never neural steering.
use crate::{body::BodyConfig, environment::*};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct HouseProbe {
    pub solid: SolidProp,
    pub from: Point,
    pub requested: Point,
    pub stopped: Point,
    pub radius: f64,
    pub line_of_sight: bool,
}
pub fn probe(progress: f64, detour: bool) -> Result<HouseProbe, String> {
    if !progress.is_finite() || !(0. ..=1.).contains(&progress) {
        return Err("house probe progress must be 0..1".into());
    }
    let geometry: Geometry =
        serde_json::from_str(include_str!("../../../assets/house/five-rooms.json"))
            .map_err(|e| e.to_string())?;
    geometry.validate()?;
    let solid = geometry
        .solids
        .first()
        .ok_or("house fixture requires a solid")?
        .clone();
    let radius = BodyConfig::default().body_radius;
    let z = if detour {
        solid.min.z - radius * 3.
    } else {
        (solid.min.z + solid.max.z) / 2.
    };
    let from = Point {
        x: solid.min.x - radius * 4.,
        z,
    };
    let requested = Point {
        x: from.x + (solid.max.x + radius * 3. - from.x) * progress,
        z,
    };
    Ok(HouseProbe {
        solid,
        from,
        requested,
        stopped: geometry.sweep(from, requested, radius),
        radius,
        line_of_sight: geometry.line_of_sight(from, requested),
    })
}
