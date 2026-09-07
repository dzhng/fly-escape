//! One native mesh owner for edible and non-edible household contact.
use crate::{environment::Point, surface::ContactSurface};
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use ts_rs::TS;

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum NativeObjectShape {
    Apple,
    Banana,
    WornShoes,
    DirtyDishes,
    Laundry,
    SleepingCat,
}
impl NativeObjectShape {
    fn native(self) -> &'static (Vec<ContactSurface>, f64) {
        static APPLE: OnceLock<(Vec<ContactSurface>, f64)> = OnceLock::new();
        static BANANA: OnceLock<(Vec<ContactSurface>, f64)> = OnceLock::new();
        static SHOES: OnceLock<(Vec<ContactSurface>, f64)> = OnceLock::new();
        static DISHES: OnceLock<(Vec<ContactSurface>, f64)> = OnceLock::new();
        static LAUNDRY: OnceLock<(Vec<ContactSurface>, f64)> = OnceLock::new();
        static CAT: OnceLock<(Vec<ContactSurface>, f64)> = OnceLock::new();
        let (asset, source) = match self {
            Self::Apple => (
                &APPLE,
                include_str!("../../../assets/food/apple/contact.json"),
            ),
            Self::Banana => (
                &BANANA,
                include_str!("../../../assets/food/banana/contact.json"),
            ),
            Self::WornShoes => (
                &SHOES,
                include_str!("../../../assets/household/worn-shoes/contact.json"),
            ),
            Self::DirtyDishes => (
                &DISHES,
                include_str!("../../../assets/household/dirty-dishes/contact.json"),
            ),
            Self::Laundry => (
                &LAUNDRY,
                include_str!("../../../assets/household/crumpled-laundry/contact.json"),
            ),
            Self::SleepingCat => (
                &CAT,
                include_str!("../../../assets/household/sleeping-cat/contact.json"),
            ),
        };
        asset.get_or_init(|| {
            let surface: ContactSurface = serde_json::from_str(source)
                .expect("native objects must pass contact export validation");
            let radius = surface
                .vertices
                .iter()
                .map(|p| p[0].hypot(p[2]))
                .fold(0., f64::max);
            (components(surface), radius)
        })
    }
    pub fn footprint_radius(self) -> f64 {
        self.native().1
    }
    pub fn placed_surfaces(
        self,
        position: Point,
        heading: f64,
        first_id: u32,
    ) -> Result<Vec<ContactSurface>, String> {
        self.native()
            .0
            .iter()
            .enumerate()
            .map(|(offset, surface)| {
                let id = first_id
                    .checked_add(offset as u32)
                    .ok_or("surface ID overflow")?;
                place_surface(surface.clone(), position, heading, id)
            })
            .collect()
    }
}

pub(crate) fn place_surface(
    mut surface: ContactSurface,
    position: Point,
    heading: f64,
    id: u32,
) -> Result<ContactSurface, String> {
    if !position.finite() || !heading.is_finite() {
        return Err("native contact requires a finite pose".into());
    }
    surface.id = id;
    let (sin, cos) = heading.sin_cos();
    for p in &mut surface.vertices {
        let [x, y, z] = *p;
        *p = [
            position.x + x * cos - z * sin,
            y,
            position.z + x * sin + z * cos,
        ];
    }
    Ok(surface)
}

// Exact shared-edge connectivity preserves the validator's single-boundary contract.
// Component order follows the first authored triangle, so IDs remain deterministic.
fn components(surface: ContactSurface) -> Vec<ContactSurface> {
    use std::collections::BTreeMap;
    let mut edges = BTreeMap::<(u32, u32), Vec<usize>>::new();
    for (face, triangle) in surface.triangles.iter().enumerate() {
        for j in 0..3 {
            let (a, b) = (triangle[j], triangle[(j + 1) % 3]);
            edges.entry((a.min(b), a.max(b))).or_default().push(face);
        }
    }
    let mut seen = vec![false; surface.triangles.len()];
    let mut parts = vec![];
    for seed in 0..surface.triangles.len() {
        if seen[seed] {
            continue;
        }
        let mut pending = vec![seed];
        let mut faces = vec![];
        seen[seed] = true;
        while let Some(face) = pending.pop() {
            faces.push(face);
            let t = surface.triangles[face];
            for j in 0..3 {
                let (a, b) = (t[j], t[(j + 1) % 3]);
                for &neighbor in &edges[&(a.min(b), a.max(b))] {
                    if !seen[neighbor] {
                        seen[neighbor] = true;
                        pending.push(neighbor);
                    }
                }
            }
        }
        faces.sort_unstable();
        let mut ids = BTreeMap::new();
        let mut vertices = vec![];
        let triangles = faces
            .into_iter()
            .map(|face| {
                surface.triangles[face].map(|old| {
                    *ids.entry(old).or_insert_with(|| {
                        let id = vertices.len() as u32;
                        vertices.push(surface.vertices[old as usize]);
                        id
                    })
                })
            })
            .collect();
        parts.push(ContactSurface {
            id: parts.len() as u32,
            vertices,
            triangles,
        });
    }
    // Existing single-boundary assets retain vertex/triangle order and their BVH inputs.
    if parts.len() == 1 {
        vec![surface]
    } else {
        parts
    }
}
