//! Edible geometry is baked from the visible asset, then placed in native metres.
use crate::{environment::Point, surface::ContactSurface};
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use ts_rs::TS;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum FoodShape {
    Apple,
    /// Controlled floor-food probes use this same triangle contact path.
    Patch {
        radius: f64,
    },
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct FoodDef {
    pub position: Point,
    pub heading: f64,
    pub shape: FoodShape,
}
fn apple() -> &'static ContactSurface {
    static APPLE: OnceLock<ContactSurface> = OnceLock::new();
    APPLE.get_or_init(|| {
        serde_json::from_str(include_str!("../../../assets/food/apple/contact.json"))
            .expect("authored apple must pass contact export validation")
    })
}
impl FoodShape {
    pub fn footprint_radius(&self) -> f64 {
        match self {
            Self::Apple => {
                static RADIUS: OnceLock<f64> = OnceLock::new();
                *RADIUS.get_or_init(|| {
                    apple()
                        .vertices
                        .iter()
                        .map(|p| p[0].hypot(p[2]))
                        .fold(0., f64::max)
                })
            }
            Self::Patch { radius } => *radius,
        }
    }
}
impl FoodDef {
    pub fn surface(&self, id: u32) -> Result<ContactSurface, String> {
        let radius = self.shape.footprint_radius();
        if !self.position.finite()
            || !self.heading.is_finite()
            || !radius.is_finite()
            || radius <= 0.
            || radius > 1e6
        {
            return Err("food requires a finite pose and positive bounded dimensions".into());
        }
        let mut surface = match self.shape {
            FoodShape::Apple => apple().clone(),
            FoodShape::Patch { radius } => {
                const SEGMENTS: u32 = 128;
                let mut vertices = vec![[0.; 3]];
                for i in 0..SEGMENTS {
                    let angle = std::f64::consts::TAU * f64::from(i) / f64::from(SEGMENTS);
                    vertices.push([radius * angle.cos(), 0., radius * angle.sin()]);
                }
                ContactSurface {
                    id,
                    vertices,
                    triangles: (0..SEGMENTS)
                        .map(|i| [0, 1 + (i + 1) % SEGMENTS, 1 + i])
                        .collect(),
                }
            }
        };
        surface.id = id;
        let (sin, cos) = self.heading.sin_cos();
        for p in &mut surface.vertices {
            let [x, y, z] = *p;
            *p = [
                self.position.x + x * cos - z * sin,
                y,
                self.position.z + x * sin + z * cos,
            ];
        }
        Ok(surface)
    }
}
