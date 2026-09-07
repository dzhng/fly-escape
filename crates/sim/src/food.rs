//! Edible geometry is baked from the visible asset, then placed in native metres.
use crate::native_object::NativeObjectShape;
use crate::{environment::Point, surface::ContactSurface};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum FoodShape {
    Apple,
    Banana,
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
impl FoodShape {
    fn native(&self) -> Option<NativeObjectShape> {
        match self {
            Self::Apple => Some(NativeObjectShape::Apple),
            Self::Banana => Some(NativeObjectShape::Banana),
            Self::Patch { .. } => None,
        }
    }
    pub fn footprint_radius(&self) -> f64 {
        match self {
            Self::Patch { radius } => *radius,
            _ => self.native().unwrap().footprint_radius(),
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
        if let Some(shape) = self.shape.native() {
            let mut surfaces = shape.placed_surfaces(self.position, self.heading, id)?;
            if surfaces.len() != 1 {
                return Err("food must have one connected contact boundary".into());
            }
            return Ok(surfaces.remove(0));
        }
        let surface = match self.shape {
            FoodShape::Apple | FoodShape::Banana => unreachable!(),
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
        crate::native_object::place_surface(surface, self.position, self.heading, id)
    }
}
