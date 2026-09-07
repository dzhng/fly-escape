//! Fixed-orientation support prefixes. This component never acquires or transfers support.
use super::*;
use parry3d_f64::bounding_volume::Aabb;

#[derive(Debug, Clone, Copy)]
pub struct FixedSupportRequest {
    pub surface_id: u32,
    pub start_root: [f64; 3],
    pub displacement: [f64; 2],
    pub heading: f64,
    pub up: [f64; 3],
}
/// Caller-selected experiment limits, not campaign or per-fly constants.
#[derive(Debug, Clone, Copy)]
pub struct SupportPathBudget {
    pub work: usize,
    pub items: usize,
}
#[derive(Debug, Default, Clone, Copy)]
pub struct SupportPathWork {
    pub operations: usize,
    pub peak_items: usize,
    pub triangles: usize,
    pub planes: usize,
    pub span_pairs: usize,
    pub collision_triangle_bound: usize,
}
#[derive(Debug, Clone, PartialEq)]
pub enum SupportPathStop {
    End,
    Gap,
    Discontinuity,
    OtherSurface(u32),
}
#[derive(Debug, Clone)]
pub struct SupportPathSegment {
    pub from_fraction: f64,
    pub to_fraction: f64,
    pub from_root: [f64; 3],
    pub to_root: [f64; 3],
    pub triangle_id: u32,
}
#[derive(Debug, Clone)]
pub struct SupportPath {
    pub surface_id: u32,
    pub rotation: [f64; 4],
    pub segments: Vec<SupportPathSegment>,
    pub stop: SupportPathStop,
    pub work: SupportPathWork,
}
#[derive(Debug)]
pub enum SupportPathError {
    Invalid(String),
    Exhausted(SupportPathWork),
}
impl From<String> for SupportPathError {
    fn from(value: String) -> Self {
        Self::Invalid(value)
    }
}
struct Meter {
    budget: SupportPathBudget,
    work: SupportPathWork,
}
impl Meter {
    fn charge(&mut self, count: usize) -> Result<(), SupportPathError> {
        if count > self.budget.work.saturating_sub(self.work.operations) {
            return Err(SupportPathError::Exhausted(self.work));
        }
        self.work.operations += count;
        Ok(())
    }
    fn storage(&mut self, items: usize) -> Result<(), SupportPathError> {
        if items > self.budget.items {
            return Err(SupportPathError::Exhausted(self.work));
        }
        self.work.peak_items = self.work.peak_items.max(items);
        Ok(())
    }
}
#[derive(Clone, Copy)]
struct Span {
    lo: f64,
    hi: f64,
    intercept: f64,
    slope: f64,
    triangle: u32,
}
impl Span {
    fn covers(self, lo: f64, hi: f64) -> bool {
        self.lo <= lo && self.hi >= hi
    }
    fn height(self, t: f64) -> f64 {
        self.intercept + self.slope * t
    }
}

impl ContactScene {
    pub fn fixed_support_path(
        &self,
        hull: &ContactHull,
        request: FixedSupportRequest,
        budget: SupportPathBudget,
    ) -> Result<SupportPath, SupportPathError> {
        let invalid = |s: &str| SupportPathError::Invalid(s.into());
        let boundary = hull
            .boundary
            .as_ref()
            .ok_or_else(|| invalid("support paths require prepared boundary incidence"))?;
        if !bounded(request.start_root)
            || !bounded([request.displacement[0], 0., request.displacement[1]])
        {
            return Err(invalid("support path requires bounded coordinates"));
        }
        let rotation = support_rotation(request.heading, request.up)?;
        let q = Rotation::from_array(rotation);
        let entry = self
            .meshes
            .iter()
            .find(|entry| entry.id == request.surface_id)
            .ok_or_else(|| invalid("support surface is absent from this scene"))?;
        let mut meter = Meter {
            budget,
            work: SupportPathWork::default(),
        };
        meter.charge(boundary.vertices.len() + boundary.planes.len())?;
        meter.storage(boundary.vertices.len() + boundary.planes.len())?;
        // Validate ownership without moving the caller's supplied root. The kernel
        // already defines the permitted positional precision for a support query.
        meter.charge(entry.mesh.indices().len())?;
        let initial = self.support_at(
            hull,
            request.surface_id,
            [request.start_root[0], request.start_root[2]],
            request.heading,
            request.up,
        )?;
        if initial.is_none_or(|sample| {
            (sample.root[1] - request.start_root[1]).abs() * QUERY_UNITS > PLANE_TOLERANCE
        }) {
            return Err(invalid("start root does not match the supported branch"));
        }
        let body: Vec<_> = boundary
            .vertices
            .iter()
            .map(|p| q * Vector::from_array(*p))
            .collect();
        let normals: Vec<_> = boundary
            .planes
            .iter()
            .map(|p| q * Vector::from_array(p.normal))
            .collect();
        let base_items = body.len() + normals.len();
        let start = Vector::from_array(request.start_root) * QUERY_UNITS;
        // A separating cast may deliberately ignore initial penetration. A prefix
        // cannot use that departure behavior to accept an already-overlapping start.
        for other in self
            .meshes
            .iter()
            .filter(|entry| entry.id != request.surface_id)
        {
            let count = other.mesh.indices().len();
            meter.charge(count)?;
            meter.work.collision_triangle_bound += count;
            let contact = parry3d_f64::query::contact(
                &Pose {
                    translation: start,
                    rotation: q,
                },
                &hull.shape,
                &Pose::IDENTITY,
                &other.mesh,
                0.,
            )
            .map_err(|_| invalid("unsupported contact shape pair"))?;
            let inside = other.closed
                && other.mesh.contains_local_point(
                    start + body.iter().copied().sum::<Vector>() / body.len() as f64,
                );
            if inside || contact.is_some_and(|contact| contact.dist < -PLANE_TOLERANCE) {
                return Ok(SupportPath {
                    surface_id: request.surface_id,
                    rotation,
                    segments: Vec::new(),
                    stop: SupportPathStop::OtherSurface(other.id),
                    work: meter.work,
                });
            }
        }
        let planar = Vector::new(start.x, 0., start.z);
        let delta = Vector::new(request.displacement[0], 0., request.displacement[1]) * QUERY_UNITS;
        let body_min = body.iter().copied().reduce(Vector::min).unwrap();
        let body_max = body.iter().copied().reduce(Vector::max).unwrap();
        let bounds = entry.mesh.local_aabb();
        let lower = bounds.mins.y - body_max.y;
        let upper = bounds.maxs.y - body_min.y;
        let end = planar + delta;
        let swept = Aabb::new(
            Vector::new(
                planar.x.min(end.x) + body_min.x,
                bounds.mins.y,
                planar.z.min(end.z) + body_min.z,
            ),
            Vector::new(
                planar.x.max(end.x) + body_max.x,
                bounds.maxs.y,
                planar.z.max(end.z) + body_max.z,
            ),
        );
        let mut spans = Vec::new();
        for triangle_id in entry.mesh.bvh().intersect_aabb(&swept) {
            meter.charge(1)?;
            meter.work.triangles += 1;
            let triangle = entry.mesh.triangle(triangle_id);
            let vertices = [triangle.a, triangle.b, triangle.c];
            let normal = triangle.normal().expect("validated triangle");
            meter.storage(base_items + spans.len() + 4)?;
            let mut polygon = vec![(0., lower), (1., lower), (1., upper), (0., upper)];
            for direction in [normal, -normal] {
                meter.charge(body.len())?;
                let offset = vertices
                    .iter()
                    .map(|v| direction.dot(*v))
                    .fold(f64::NEG_INFINITY, f64::max)
                    - body
                        .iter()
                        .map(|v| direction.dot(*v))
                        .fold(f64::INFINITY, f64::min);
                clip(
                    &mut polygon,
                    direction,
                    offset,
                    planar,
                    delta,
                    base_items + spans.len(),
                    &mut meter,
                )?;
            }
            for (plane, n) in boundary.planes.iter().zip(&normals) {
                let direction = -*n;
                let offset = vertices
                    .iter()
                    .map(|v| direction.dot(*v))
                    .fold(f64::NEG_INFINITY, f64::max)
                    + plane.offset;
                clip(
                    &mut polygon,
                    direction,
                    offset,
                    planar,
                    delta,
                    base_items + spans.len(),
                    &mut meter,
                )?;
            }
            for edge in &boundary.edges {
                let n1 = normals[edge.planes[0]];
                let n2 = normals[edge.planes[1]];
                let cross = n1.cross(n2);
                if cross.length_squared() == 0. {
                    return Err(invalid(
                        "support edge orientation is numerically unresolved",
                    ));
                }
                let direction = cross.normalize();
                for j in 0..3 {
                    meter.charge(1)?;
                    let a = vertices[j];
                    let line = vertices[(j + 1) % 3] - a;
                    let axis = direction.cross(line);
                    if axis.length_squared() == 0. {
                        continue;
                    }
                    for n in [axis.normalize(), -axis.normalize()] {
                        meter.charge(1)?;
                        if n1.cross(-n).dot(direction) < 0.
                            || (-n).cross(n2).dot(direction) < 0.
                            || n.dot(vertices[(j + 2) % 3] - a) > 0.
                        {
                            continue;
                        }
                        let offset = n.dot(a - body[edge.vertices[0]]);
                        clip(
                            &mut polygon,
                            n,
                            offset,
                            planar,
                            delta,
                            base_items + spans.len(),
                            &mut meter,
                        )?;
                    }
                }
            }
            for i in 0..polygon.len() {
                meter.charge(1)?;
                let a = polygon[i];
                let b = polygon[(i + 1) % polygon.len()];
                if a.0 > b.0 {
                    let slope = (b.1 - a.1) / (b.0 - a.0);
                    if !slope.is_finite() || !(a.1 - slope * a.0).is_finite() {
                        return Err(invalid("support span is numerically unresolved"));
                    }
                    meter.storage(base_items + polygon.len() + spans.len() + 1)?;
                    spans.push(Span {
                        lo: b.0,
                        hi: a.0,
                        intercept: a.1 - slope * a.0,
                        slope,
                        triangle: triangle_id,
                    });
                }
            }
        }
        // Pair work and knot storage are charged before doing/allocating either.
        meter.storage(base_items + spans.len() + 2)?;
        let mut knots = vec![0., 1.];
        for span in &spans {
            meter.storage(base_items + spans.len() + knots.len() + 2)?;
            knots.extend([span.lo, span.hi]);
        }
        for (i, a) in spans.iter().enumerate() {
            for b in &spans[i + 1..] {
                meter.charge(1)?;
                meter.work.span_pairs += 1;
                if a.slope != b.slope {
                    let t = (b.intercept - a.intercept) / (a.slope - b.slope);
                    if t > a.lo.max(b.lo) && t < a.hi.min(b.hi) {
                        meter.storage(base_items + spans.len() + knots.len() + 1)?;
                        knots.push(t);
                    }
                }
            }
        }
        meter.charge(
            knots
                .len()
                .saturating_mul(knots.len().max(1).ilog2() as usize + 1),
        )?;
        knots.sort_unstable_by(f64::total_cmp);
        knots.dedup();
        let mut segments: Vec<SupportPathSegment> = Vec::new();
        let mut last_span = None;
        let mut stop = SupportPathStop::End;
        let mut previous = start;
        for window in knots.windows(2) {
            let (lo, hi) = (window[0], window[1]);
            if hi <= lo {
                continue;
            }
            let mid = lo + (hi - lo) * 0.5;
            let mut chosen: Option<(usize, Span)> = None;
            for (span_id, span) in spans.iter().enumerate() {
                meter.charge(1)?;
                if span.covers(lo, hi)
                    && chosen.is_none_or(|(_, old)| {
                        span.height(mid) > old.height(mid)
                            || (span.height(mid) == old.height(mid)
                                && if mid == hi {
                                    span.slope < old.slope
                                } else {
                                    span.slope > old.slope
                                })
                    })
                {
                    chosen = Some((span_id, *span));
                }
            }
            let Some((span_id, span)) = chosen else {
                stop = SupportPathStop::Gap;
                break;
            };
            let from = planar + delta * lo + Vector::Y * span.height(lo);
            if (from.y - previous.y).abs() > PLANE_TOLERANCE {
                stop = SupportPathStop::Discontinuity;
                break;
            }
            let target = planar + delta * hi + Vector::Y * span.height(hi);
            if !bounded((target / QUERY_UNITS).to_array()) {
                return Err(invalid("support path leaves the bounded world"));
            }
            let pose = Pose {
                translation: previous,
                rotation: q,
            };
            let velocity = target - previous;
            let mut blocker = None;
            for other in self
                .meshes
                .iter()
                .filter(|entry| entry.id != request.surface_id)
            {
                // Existing cast BVH work is bounded by this mesh's entire triangle count.
                let count = other.mesh.indices().len();
                meter.charge(count)?;
                meter.work.collision_triangle_bound += count;
                if let Some(hit) = cast_on(hull, pose, velocity, std::iter::once(other))? {
                    select(&mut blocker, hit);
                }
            }
            let (fraction, destination) = if let Some(hit) = blocker {
                stop = SupportPathStop::OtherSurface(hit.surface_id);
                (
                    lo + (hi - lo) * hit.fraction,
                    previous + velocity * hit.fraction,
                )
            } else {
                (hi, target)
            };
            if fraction > lo {
                meter.storage(base_items + spans.len() + knots.len() + segments.len() + 1)?;
                // The initial segment may start off the exact affine line by
                // permitted query roundoff; it still needs the positional check.
                if let Some(last) = segments.last_mut().filter(|s| {
                    s.triangle_id == span.triangle
                        && s.to_fraction == lo
                        && ((last_span == Some(span_id) && s.from_fraction > 0.)
                            || same_slope(s, previous, destination, fraction - lo))
                }) {
                    last.to_fraction = fraction;
                    last.to_root = (destination / QUERY_UNITS).to_array();
                } else {
                    segments.push(SupportPathSegment {
                        from_fraction: lo,
                        to_fraction: fraction,
                        from_root: segments.last().map_or(request.start_root, |s| s.to_root),
                        to_root: (destination / QUERY_UNITS).to_array(),
                        triangle_id: span.triangle,
                    });
                }
            }
            last_span = Some(span_id);
            previous = destination;
            if blocker.is_some() {
                break;
            }
        }
        if stop == SupportPathStop::End {
            meter.charge(entry.mesh.indices().len())?;
            let endpoint = self.support_at(
                hull,
                request.surface_id,
                [previous.x / QUERY_UNITS, previous.z / QUERY_UNITS],
                request.heading,
                request.up,
            )?;
            if endpoint.is_none_or(|sample| {
                (sample.root[1] * QUERY_UNITS - previous.y).abs() > PLANE_TOLERANCE
            }) {
                stop = SupportPathStop::Discontinuity;
            }
        }
        Ok(SupportPath {
            surface_id: request.surface_id,
            rotation,
            segments,
            stop,
            work: meter.work,
        })
    }
}
fn same_slope(segment: &SupportPathSegment, from: Vector, to: Vector, fraction: f64) -> bool {
    let beginning = Vector::from_array(segment.from_root) * QUERY_UNITS;
    let duration = segment.to_fraction - segment.from_fraction;
    if duration <= 0. || fraction <= 0. {
        return false;
    }
    let merged_join = beginning + (to - beginning) * (duration / (duration + fraction));
    (merged_join - from).length()
        <= 32. * f64::EPSILON * (to - beginning).length().max((from - beginning).length())
}
fn clip(
    polygon: &mut Vec<(f64, f64)>,
    normal: Vector,
    offset: f64,
    start: Vector,
    delta: Vector,
    persistent_items: usize,
    meter: &mut Meter,
) -> Result<(), SupportPathError> {
    meter.charge(1)?;
    meter.work.planes += 1;
    if polygon.is_empty() {
        return Ok(());
    }
    // A halfspace adds at most one vertex to a convex polygon. Both buffers count.
    meter.storage(persistent_items + polygon.len() * 2 + 1)?;
    let mut next = Vec::with_capacity(polygon.len() + 1);
    let value =
        |p: (f64, f64)| normal.dot(start) + normal.dot(delta) * p.0 + normal.y * p.1 - offset;
    for i in 0..polygon.len() {
        meter.charge(1)?;
        let a = polygon[i];
        let b = polygon[(i + 1) % polygon.len()];
        let da = value(a);
        let db = value(b);
        if da <= 0. {
            next.push(a);
        }
        if (da <= 0.) != (db <= 0.) {
            let t = da / (da - db);
            next.push((a.0 + (b.0 - a.0) * t, a.1 + (b.1 - a.1) * t));
        }
    }
    *polygon = next;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn adjacent_float_knots_do_not_bridge_an_uncovered_interval() {
        let lo = 0.5_f64;
        let hi = f64::from_bits(lo.to_bits() + 1);
        assert_eq!(lo + (hi - lo) * 0.5, lo);
        let left = Span {
            lo: 0.,
            hi: lo,
            intercept: 0.,
            slope: 0.,
            triangle: 0,
        };
        let right = Span {
            lo: hi,
            hi: 1.,
            ..left
        };
        assert!(!left.covers(lo, hi));
        assert!(!right.covers(lo, hi));
        assert!(Span { lo, hi, ..left }.covers(lo, hi));
    }

    #[test]
    fn merging_tiny_intervals_cannot_cut_a_steep_join() {
        let segment = SupportPathSegment {
            from_fraction: 0.,
            to_fraction: 1e-15,
            from_root: [0.; 3],
            to_root: [0.001, 0.001, 0.],
            triangle_id: 1,
        };
        assert!(!same_slope(
            &segment,
            Vector::new(1., 1., 0.),
            Vector::new(2., 0., 0.),
            1e-15
        ));
        assert!(same_slope(
            &segment,
            Vector::new(1., 1., 0.),
            Vector::new(2., 2., 0.),
            1e-15
        ));
    }
}
