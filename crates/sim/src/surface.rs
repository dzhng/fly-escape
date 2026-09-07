//! Immutable contact geometry. Public coordinates are metres; query normalization
//! avoids the measured millimetre-body departure failure in metre-scale GJK casts.
use parry3d_f64::{
    bounding_volume::BoundingVolume,
    math::{Matrix, Pose, Rotation, Vector},
    query::{cast_shapes, PointQuery, Ray, RayCast, ShapeCastOptions, ShapeCastStatus},
    shape::{ConvexPolyhedron, Shape, SupportMap, TriMesh, TriMeshFlags},
};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use ts_rs::TS;

mod boundary;
mod path;
pub use boundary::{validate_boundary, ContactBoundary, ContactEdge, ContactPlane};
pub use path::{
    FixedSupportRequest, SupportPath, SupportPathBudget, SupportPathError, SupportPathSegment,
    SupportPathStop, SupportPathWork,
};

const QUERY_UNITS: f64 = 1000.;
// Same 10nm positional precision as the native cast regressions; no geometry offset.
const PLANE_TOLERANCE: f64 = 1e-8 * QUERY_UNITS;
const MAX_COORDINATE: f64 = 1e6;
const MAX_SCENE_VERTICES: usize = 262_144;
const MAX_SCENE_TRIANGLES: usize = 524_288;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ContactSurface {
    pub id: u32,
    pub vertices: Vec<[f64; 3]>,
    pub triangles: Vec<[u32; 3]>,
}
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SurfaceHit {
    pub surface_id: u32,
    pub fraction: f64,
    pub point: [f64; 3],
    pub normal: [f64; 3],
}

/// A geometric support candidate, not permission to move or land there.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SupportSample {
    pub surface_id: u32,
    pub root: [f64; 3],
    pub rotation: [f64; 4],
    pub point: [f64; 3],
    pub normal: [f64; 3],
}

pub struct ContactHull {
    shape: ConvexPolyhedron,
    boundary: Option<ContactBoundary>,
}
impl ContactHull {
    /// Prepared plane incidence, in metres; point-only hulls cannot construct paths.
    pub fn from_boundary(mut boundary: ContactBoundary) -> Result<Self, String> {
        if !(4..=4096).contains(&boundary.vertices.len())
            || boundary.planes.len() > 4096
            || boundary.edges.len() > 12288
        {
            return Err("contact boundary exceeds its geometry budget".into());
        }
        validate_boundary(&boundary.vertices, &boundary.planes, &boundary.edges)?;
        let mut hull = Self::new(&boundary.vertices)?;
        for point in &mut boundary.vertices {
            for coordinate in point {
                *coordinate *= QUERY_UNITS;
            }
        }
        for plane in &mut boundary.planes {
            plane.offset *= QUERY_UNITS;
        }
        hull.boundary = Some(boundary);
        Ok(hull)
    }

    /// Points are relative to the native model's support pivot, not its bounds centre.
    pub fn new(points: &[[f64; 3]]) -> Result<Self, String> {
        if !(4..=4096).contains(&points.len()) || points.iter().any(|p| !bounded(*p)) {
            return Err("contact hull requires 4..4096 bounded finite vertices".into());
        }
        let points: Vec<_> = points
            .iter()
            .map(|p| Vector::from_array(*p) * QUERY_UNITS)
            .collect();
        ConvexPolyhedron::from_convex_hull(&points)
            .filter(|hull| {
                let volume = hull.mass_properties(1.).mass();
                volume.is_finite() && volume > 0.
            })
            .map(|shape| Self {
                shape,
                boundary: None,
            })
            .ok_or_else(|| "contact hull must enclose a nonzero volume".into())
    }
}

struct ContactMesh {
    id: u32,
    mesh: TriMesh,
    closed: bool,
}
pub struct ContactScene {
    meshes: Vec<ContactMesh>,
}
impl ContactScene {
    pub fn new(surfaces: &[ContactSurface]) -> Result<Self, String> {
        if surfaces.len() > 256
            || surfaces.iter().map(|s| s.vertices.len()).sum::<usize>() > MAX_SCENE_VERTICES
            || surfaces.iter().map(|s| s.triangles.len()).sum::<usize>() > MAX_SCENE_TRIANGLES
        {
            return Err("contact scene exceeds its surface or mesh budget".into());
        }
        let mut ids = BTreeSet::new();
        let mut meshes = Vec::with_capacity(surfaces.len());
        for surface in surfaces {
            if !ids.insert(surface.id)
                || surface.vertices.is_empty()
                || surface.triangles.is_empty()
                || surface.vertices.iter().any(|p| !bounded(*p))
            {
                return Err(
                    "contact surfaces require unique IDs and nonempty bounded finite geometry"
                        .into(),
                );
            }
            let vertices: Vec<_> = surface
                .vertices
                .iter()
                .map(|p| Vector::from_array(*p) * QUERY_UNITS)
                .collect();
            for face in &surface.triangles {
                if face.iter().any(|i| *i as usize >= vertices.len()) {
                    return Err("contact triangle index is outside its vertex array".into());
                }
                let [a, b, c] = face.map(|i| vertices[i as usize]);
                if (b - a).cross(c - a).length_squared() <= f64::EPSILON {
                    return Err("contact triangles must have numerically resolvable area".into());
                }
            }
            let mut edges = BTreeMap::<_, (Vec<usize>, i32)>::new();
            let mut volume = 0.;
            for (face_id, triangle) in surface.triangles.iter().enumerate() {
                let [a, b, c] = triangle.map(|i| vertices[i as usize]);
                volume += (a - vertices[0]).dot((b - vertices[0]).cross(c - vertices[0]));
                for j in 0..3 {
                    let (a, b) = (triangle[j], triangle[(j + 1) % 3]);
                    let entry = edges.entry((a.min(b), a.max(b))).or_default();
                    entry.0.push(face_id);
                    entry.1 += if a < b { 1 } else { -1 };
                }
            }
            if edges.values().any(|pair| pair.0.len() > 2) {
                return Err("contact surfaces require manifold edges".into());
            }
            // Components use shared edges, so a dangling open fin cannot hide a
            // closed food boundary merely by sharing one vertex with it.
            let mut seen = vec![false; surface.triangles.len()];
            let mut components = 0;
            let mut has_closed_component = false;
            for seed in 0..surface.triangles.len() {
                if seen[seed] {
                    continue;
                }
                components += 1;
                let mut pending = vec![seed];
                seen[seed] = true;
                let mut component_closed = true;
                while let Some(face) = pending.pop() {
                    let t = surface.triangles[face];
                    for j in 0..3 {
                        let (a, b) = (t[j], t[(j + 1) % 3]);
                        let adjacent = &edges[&(a.min(b), a.max(b))].0;
                        component_closed &= adjacent.len() == 2;
                        for &neighbor in adjacent {
                            if !seen[neighbor] {
                                seen[neighbor] = true;
                                pending.push(neighbor);
                            }
                        }
                    }
                }
                has_closed_component |= component_closed;
            }
            if has_closed_component && components != 1 {
                return Err("closed contact surfaces require one connected food boundary".into());
            }
            let closed = edges.values().all(|pair| pair.0.len() == 2);
            if closed && edges.values().any(|pair| pair.1 != 0) {
                return Err("closed contact surfaces require consistent winding".into());
            }
            if closed && volume <= 0. {
                return Err("closed contact surfaces require outward nonzero volume".into());
            }
            let mesh = TriMesh::with_flags(
                vertices,
                surface.triangles.clone(),
                TriMeshFlags::ORIENTED | TriMeshFlags::FIX_INTERNAL_EDGES,
            )
            .map_err(|e| format!("invalid contact mesh: {e}"))?;
            meshes.push(ContactMesh {
                id: surface.id,
                mesh,
                closed,
            });
        }
        meshes.sort_by_key(|entry| entry.id);
        Ok(Self { meshes })
    }

    /// Surface-distance contact, including open patches; an interior point is not a surface.
    pub fn touching(&self, position: [f64; 3], radius: f64) -> Result<Option<u32>, String> {
        if !bounded(position) || !radius.is_finite() || !(0. ..=MAX_COORDINATE).contains(&radius) {
            return Err("contact requires a bounded position and nonnegative finite radius".into());
        }
        let position = Vector::from_array(position) * QUERY_UNITS;
        Ok(self.meshes.iter().find_map(|entry| {
            (entry.mesh.distance_to_local_point(position, false) <= radius * QUERY_UNITS)
                .then_some(entry.id)
        }))
    }

    /// Constrain a requested translation; this query never chooses a destination.
    pub fn cast(
        &self,
        hull: &ContactHull,
        position: [f64; 3],
        heading: f64,
        up: [f64; 3],
        displacement: [f64; 3],
    ) -> Result<Option<SurfaceHit>, String> {
        if !bounded(position) || !bounded(displacement) || !heading.is_finite() || !bounded(up) {
            return Err("contact cast requires bounded finite pose and displacement".into());
        }
        let pose = Pose {
            translation: Vector::from_array(position) * QUERY_UNITS,
            rotation: Rotation::from_array(support_rotation(heading, up)?),
        };
        let velocity = Vector::from_array(displacement) * QUERY_UNITS;
        cast_on(hull, pose, velocity, self.meshes.iter())
    }

    /// Find the upper supporting root at a requested planar position/orientation.
    /// The caller must still constrain acquisition and the path between samples.
    pub fn support_at(
        &self,
        hull: &ContactHull,
        surface_id: u32,
        position: [f64; 2],
        heading: f64,
        up: [f64; 3],
    ) -> Result<Option<SupportSample>, String> {
        if !bounded([position[0], 0., position[1]]) {
            return Err("support sampling requires a bounded finite planar position".into());
        }
        let rotation = support_rotation(heading, up)?;
        let index = self
            .meshes
            .binary_search_by_key(&surface_id, |entry| entry.id)
            .map_err(|_| "support surface is absent from this scene")?;
        let entry = &self.meshes[index];
        let orientation = Pose {
            translation: Vector::ZERO,
            rotation: Rotation::from_array(rotation),
        };
        let body_bounds = hull.shape.compute_aabb(&orientation);
        let surface_bounds = entry.mesh.local_aabb();
        let body_height = body_bounds.maxs.y - body_bounds.mins.y;
        let top = surface_bounds.maxs.y - body_bounds.mins.y + body_height;
        let bottom = surface_bounds.mins.y - body_bounds.maxs.y - body_height;
        let pose = Pose {
            translation: Vector::new(position[0] * QUERY_UNITS, top, position[1] * QUERY_UNITS),
            ..orientation
        };
        let velocity = Vector::new(0., bottom - top, 0.);
        let Some(hit) = cast_on(hull, pose, velocity, std::iter::once(entry))? else {
            return Ok(None);
        };
        let root = ((pose.translation + velocity * hit.fraction) / QUERY_UNITS).to_array();
        if !bounded(root) {
            return Err("support root is outside the bounded world".into());
        }
        Ok(Some(SupportSample {
            surface_id,
            root,
            rotation,
            point: hit.point,
            normal: hit.normal,
        }))
    }

    /// Locate a support point below a root; the body owner decides whether to land on it.
    pub fn below(&self, position: [f64; 3], distance: f64) -> Result<Option<SurfaceHit>, String> {
        if !bounded(position)
            || !distance.is_finite()
            || distance <= 0.
            || distance > MAX_COORDINATE
        {
            return Err(
                "support query requires a bounded finite position and positive distance".into(),
            );
        }
        let ray = Ray::new(
            Vector::from_array(position) * QUERY_UNITS,
            -Vector::Y * distance * QUERY_UNITS,
        );
        let mut first = None;
        for entry in &self.meshes {
            if let Some(hit) = entry.mesh.cast_local_ray_and_get_normal(&ray, 1., false) {
                select(
                    &mut first,
                    checked_hit(
                        entry.id,
                        hit.time_of_impact,
                        ray.point_at(hit.time_of_impact) / QUERY_UNITS,
                        hit.normal,
                    )?,
                );
            }
        }
        Ok(first)
    }
}
fn cast_on<'a>(
    hull: &ContactHull,
    pose: Pose,
    velocity: Vector,
    meshes: impl Iterator<Item = &'a ContactMesh>,
) -> Result<Option<SurfaceHit>, String> {
    let tangent_roundoff = 16. * f64::EPSILON * velocity.length();
    let end = Pose {
        translation: pose.translation + velocity,
        ..pose
    };
    let swept = hull
        .shape
        .compute_aabb(&pose)
        .merged(&hull.shape.compute_aabb(&end));
    let mut first = None;
    for entry in meshes {
        for triangle_id in entry.mesh.bvh().intersect_aabb(&swept) {
            let triangle = entry.mesh.triangle(triangle_id);
            let normal = triangle.normal().expect("validated nondegenerate triangle");
            let normal_velocity = normal.dot(velocity);
            // A separating face plane cannot block tangent/outward translation.
            // Test each triangle: another face in this same mesh may still block it.
            let separated = |direction: Vector| {
                direction.dot(hull.shape.support_point(&pose, -direction) - triangle.a)
                    >= -PLANE_TOLERANCE
            };
            if (normal_velocity >= -tangent_roundoff && separated(normal))
                || (normal_velocity <= tangent_roundoff && separated(-normal))
            {
                continue;
            }
            let hit = cast_shapes(
                &pose,
                velocity,
                &hull.shape,
                &Pose::IDENTITY,
                Vector::ZERO,
                &triangle,
                ShapeCastOptions {
                    max_time_of_impact: 1.,
                    stop_at_penetration: false,
                    ..Default::default()
                },
            )
            .map_err(|_| "unsupported contact shape pair")?;
            if let Some(hit) = hit {
                if !matches!(
                    hit.status,
                    ShapeCastStatus::Converged | ShapeCastStatus::PenetratingOrWithinTargetDist
                ) {
                    return Err(format!("contact query did not converge: {:?}", hit.status));
                }
                select(
                    &mut first,
                    checked_hit(
                        entry.id,
                        hit.time_of_impact,
                        hit.witness2 / QUERY_UNITS,
                        hit.normal2,
                    )?,
                );
            }
        }
    }
    Ok(first)
}
/// Native glTF orientation: +Y is the support normal and +Z follows the projected heading.
pub fn support_rotation(heading: f64, up: [f64; 3]) -> Result<[f64; 4], String> {
    if !heading.is_finite() || !bounded(up) {
        return Err("support orientation requires a finite heading and normal".into());
    }
    let up = Vector::from_array(up);
    if (up.length_squared() - 1.).abs() > 1e-6 || up.y <= 0. {
        return Err("support up must be a unit vector with positive height".into());
    }
    let up = up.normalize();
    let forward = Vector::new(heading.cos(), 0., heading.sin());
    let tangent = forward - up * forward.dot(up);
    if tangent.length_squared() <= f64::EPSILON {
        return Err("heading is parallel to the support normal".into());
    }
    let forward = tangent.normalize();
    let right = up.cross(forward);
    Ok(Rotation::from_mat3(&Matrix::from_cols(right, up, forward)).to_array())
}
fn bounded(p: [f64; 3]) -> bool {
    p.into_iter()
        .all(|v| v.is_finite() && v.abs() <= MAX_COORDINATE)
}
fn checked_hit(
    id: u32,
    fraction: f64,
    point: Vector,
    normal: Vector,
) -> Result<SurfaceHit, String> {
    if !fraction.is_finite()
        || !(0. ..=1.).contains(&fraction)
        || !bounded(point.to_array())
        || !normal.is_finite()
        || (normal.length_squared() - 1.).abs() > 1e-5
    {
        return Err("contact query returned invalid geometry".into());
    }
    Ok(SurfaceHit {
        surface_id: id,
        fraction,
        point: point.to_array(),
        normal: normal.normalize().to_array(),
    })
}
fn select(first: &mut Option<SurfaceHit>, hit: SurfaceHit) {
    if first.is_none_or(|prior| {
        hit.fraction
            .total_cmp(&prior.fraction)
            .then(hit.surface_id.cmp(&prior.surface_id))
            .is_lt()
    }) {
        *first = Some(hit);
    }
}
