//! Body-owned constrained motion. Queries provide candidates; this owner decides
//! whether a fly acquired support and which part of the requested motion is reachable.
use super::*;
use parry3d_f64::math::{Rotation, Vector};

pub const MAX_MOTION_POINTS: usize = 129;
const SURFACE_STEP: f64 = 0.001;
const MOTION_ERROR: f64 = 3e-6;
const MAX_QUERIES: usize = 512;
const MAX_STEP_SECONDS: f64 = 0.02;
const TILT_SPEED: f64 = 4.;
const CONTACT_PRECISION: f64 = 1e-8;

#[derive(Debug, Clone, PartialEq)]
pub struct MotionPoint {
    pub fraction: f64,
    pub pose: BodyPose,
    pub height: f64,
    pub rotation: [f64; 4],
    pub support: Option<u32>,
    pub grounded: bool,
}
impl MotionPoint {
    fn root(&self) -> [f64; 3] {
        [self.pose.position.x, self.height, self.pose.position.z]
    }
    pub fn apply(&self, state: &mut BodyState) {
        state.pose = self.pose;
        state.height = self.height;
        state.rotation = self.rotation;
        state.support = self.support;
    }
}
#[derive(Debug)]
pub struct MotionTrace {
    pub queries: usize,
    pub points: Vec<MotionPoint>,
}
impl MotionTrace {
    pub fn stationary(state: &BodyState) -> Self {
        let point = MotionPoint {
            fraction: 0.,
            pose: state.pose,
            height: state.height,
            rotation: state.rotation,
            support: state.support,
            grounded: matches!(state.mode, BodyMode::Walking | BodyMode::Feeding),
        };
        let mut end = point.clone();
        end.fraction = 1.;
        Self {
            points: vec![point, end],
            queries: 0,
        }
    }
    /// Remove only stationary-orientation free-space joins whose whole original
    /// polyline agrees with one timed line to floating-point roundoff.
    pub(super) fn coalesce_free(&mut self) {
        let original = std::mem::take(&mut self.points);
        if original.len() < 3 {
            self.points = original;
            return;
        }
        let mut from = 0;
        self.points.push(original[0].clone());
        while from + 1 < original.len() {
            let mut to = from + 1;
            for candidate in from + 2..original.len() {
                let a = &original[from];
                let b = &original[candidate];
                if original[from..=candidate].iter().any(|p| {
                    p.support.is_some()
                        || p.grounded != a.grounded
                        || p.rotation != a.rotation
                        || p.pose.heading != a.pose.heading
                }) {
                    break;
                }
                let magnitude = original[from..=candidate]
                    .iter()
                    .flat_map(|p| p.root())
                    .map(f64::abs)
                    .fold(1., f64::max);
                let allowance = (64. * f64::EPSILON * magnitude).min(MOTION_ERROR / 1024.);
                if original[from + 1..candidate].iter().any(|p| {
                    let t = (p.fraction - a.fraction) / (b.fraction - a.fraction);
                    let line = mix(a, b, t);
                    (Vector::from_array(p.root()) - Vector::from_array(line.root())).length()
                        > allowance
                }) {
                    break;
                }
                to = candidate;
            }
            self.points.push(original[to].clone());
            from = to;
        }
    }
    pub fn finish(mut self, fraction: f64) -> Result<Self, String> {
        let mut end = self.at(fraction)?;
        self.points.retain(|p| p.fraction < fraction);
        self.points.push(end.clone());
        if fraction < 1. {
            end.fraction = 1.;
            self.points.push(end);
        }
        Ok(self)
    }
    pub fn end(&self) -> &MotionPoint {
        self.points.last().expect("motion starts with a pose")
    }
    pub fn at(&self, fraction: f64) -> Result<MotionPoint, String> {
        if !fraction.is_finite() || !(0. ..=1.).contains(&fraction) {
            return Err("motion fraction must be within the tick".into());
        }
        if fraction >= 1. {
            return Ok(self.end().clone());
        }
        let pair = self
            .points
            .windows(2)
            .find(|p| p[1].fraction >= fraction)
            .ok_or("motion fraction outside trace")?;
        let t =
            ((fraction - pair[0].fraction) / (pair[1].fraction - pair[0].fraction)).clamp(0., 1.);
        let mut point = mix(&pair[0], &pair[1], t);
        if t >= 1. {
            point.support = pair[1].support;
            point.grounded = pair[1].grounded;
        }
        Ok(point)
    }
}

pub(super) fn up(rotation: [f64; 4]) -> [f64; 3] {
    (Rotation::from_array(rotation) * Vector::Y)
        .normalize()
        .to_array()
}
fn angle(from: f64, to: f64, t: f64) -> f64 {
    (from + (to - from).sin().atan2((to - from).cos()) * t).rem_euclid(std::f64::consts::TAU)
}
fn toward(from: [f64; 3], to: [f64; 3], seconds: f64) -> [f64; 3] {
    let a = Vector::from_array(from);
    let b = Vector::from_array(to);
    let change = Rotation::from_rotation_arc(a, b);
    let radians = change.angle_between(Rotation::IDENTITY);
    if radians <= TILT_SPEED * seconds {
        return to;
    }
    (Rotation::IDENTITY.slerp(change, TILT_SPEED * seconds / radians) * a)
        .normalize()
        .to_array()
}

pub(super) fn advance(
    world: &BodyWorld,
    state: &BodyState,
    desired: BodyPose,
    dt: f64,
    radius: f64,
) -> Result<MotionTrace, String> {
    let mut velocity = Point {
        x: (desired.position.x - state.pose.position.x) / dt,
        z: (desired.position.z - state.pose.position.z) / dt,
    };
    let mut origin = state.pose.position;
    let mut origin_time = 0.;
    let grounded = matches!(state.mode, BodyMode::Walking | BodyMode::Feeding);
    let mut point = MotionPoint {
        fraction: 0.,
        pose: state.pose,
        height: state.height,
        rotation: state.rotation,
        support: if grounded { state.support } else { None },
        grounded,
    };
    let mut trace = MotionTrace {
        points: vec![point.clone()],
        queries: 0,
    };
    let mut work = Work::default();
    let mut elapsed = 0.;
    let mut iterations = 0;
    let mut descending = state.mode == BodyMode::Landing;
    while elapsed < dt - 1e-12 {
        iterations += 1;
        if iterations >= MAX_MOTION_POINTS {
            return Err("supported movement exceeds its bounded substep budget".into());
        }
        let speed = velocity.x.hypot(velocity.z);
        let step =
            (dt - elapsed)
                .min(MAX_STEP_SECONDS)
                .min(if point.support.is_some() && speed > 0. {
                    SURFACE_STEP / speed
                } else {
                    dt
                });
        // Split at wall impact before projecting velocity, so replay preserves
        // the approach time and the bend rather than cutting across the corner.
        let requested = Point {
            x: origin.x + velocity.x * (elapsed + step - origin_time),
            z: origin.z + velocity.z * (elapsed + step - origin_time),
        };
        let (contact_fraction, blocked) =
            world
                .geometry
                .motion_contact(point.pose.position, requested, radius);
        let step = step * contact_fraction;
        if step == 0. {
            origin = point.pose.position;
            origin_time = elapsed;
            if blocked[0] {
                velocity.x = 0.;
            }
            if blocked[1] {
                velocity.z = 0.;
            }
            continue;
        }
        let fraction = ((elapsed + step) / dt).min(1.);
        let heading = angle(state.pose.heading, desired.heading, fraction);
        let target = Point {
            x: origin.x + velocity.x * (elapsed + step - origin_time),
            z: origin.z + velocity.z * (elapsed + step - origin_time),
        };
        let current_up = up(point.rotation);
        let previous_support = point.support;
        if let Some(id) = point.support {
            work.query()?;
            let candidate = world.surfaces.support_at(
                world.hull,
                id,
                [target.x, target.z],
                heading,
                current_up,
            )?;
            if let Some(candidate) = candidate.filter(|s| s.normal[1] > 0.) {
                let next_up = toward(current_up, candidate.normal, step);
                work.query()?;
                let sample = world
                    .surfaces
                    .support_at(world.hull, id, [target.x, target.z], heading, next_up)?
                    .ok_or("support disappeared while changing orientation")?;
                let endpoint = MotionPoint {
                    fraction,
                    pose: BodyPose {
                        position: Point {
                            x: sample.root[0],
                            z: sample.root[2],
                        },
                        heading,
                    },
                    height: sample.root[1],
                    rotation: sample.rotation,
                    support: Some(id),
                    grounded: true,
                };
                supported_knots(world, &point, endpoint, &mut trace.points, &mut work)?;
                point = trace.end().clone();
                elapsed += step;
                origin = point.pose.position;
                origin_time = elapsed;
                if blocked[0] {
                    velocity.x = 0.;
                }
                if blocked[1] {
                    velocity.z = 0.;
                }
                continue;
            }
            // Test a constrained horizontal departure before beginning descent.
            // The supported endpoint is absent, but the old pose still touches its surface.
            point.support = None;
            point.grounded = false;
            if let Some(last) = trace.points.last_mut() {
                last.support = None;
                last.grounded = false;
            }
            let from = point.clone();
            let mut departure = point.clone();
            departure.pose.position = target;
            departure.pose.heading = heading;
            departure.rotation = support_rotation(heading, current_up)?;
            departure.fraction = fraction;
            let rotation_angle = Rotation::from_array(from.rotation)
                .angle_between(Rotation::from_array(departure.rotation));
            let count = (((target.x - point.pose.position.x)
                .hypot(target.z - point.pose.position.z)
                / 0.00005)
                .max(rotation_angle / 0.01))
            .ceil()
            .max(1.) as usize;
            for i in 1..=count {
                let t = i as f64 / count as f64;
                let mut next = mix(&from, &departure, t);
                work.query()?;
                if world
                    .surfaces
                    .penetration(world.hull, next.root(), next.rotation)?
                    > CONTACT_PRECISION
                {
                    return Err(
                        "numerical departure unresolved: planar request enters blocking contact"
                            .into(),
                    );
                }
                work.segments += 1;
                if work.segments > 128 {
                    return Err("numerical motion unresolved: segment budget".into());
                }
                next.support = None;
                next.grounded = false;
                append_point(&mut trace.points, next.clone())?;
                point = next;
            }
            work.query()?;
            if world
                .surfaces
                .touching_hull(world.hull, point.root(), point.rotation, |_| true)?
                .is_some()
            {
                return Err("numerical departure unresolved: unilateral contact remains".into());
            }
            elapsed += step;
            if blocked.iter().any(|v| *v) {
                origin = point.pose.position;
                origin_time = elapsed;
            }
            if blocked[0] {
                velocity.x = 0.;
            }
            if blocked[1] {
                velocity.z = 0.;
            }
            descending = true;
            continue;
        }
        let next_up = if point.grounded {
            toward(current_up, [0., 1., 0.], step)
        } else {
            current_up
        };
        let rotation = support_rotation(heading, next_up)?;
        let floor = world.hull.floor_height(heading, next_up)?;
        let height = if point.grounded {
            floor
        } else if descending {
            point.height - VERTICAL_SPEED * step
        } else {
            (point.height + VERTICAL_SPEED * step).min(CRUISE_HEIGHT)
        };
        let delta = [
            target.x - point.pose.position.x,
            height - point.height,
            target.z - point.pose.position.z,
        ];
        work.query()?;
        let surface_hit = world
            .surfaces
            .cast(world.hull, point.root(), heading, next_up, delta)?;
        let floor_fraction = if !point.grounded && height <= floor + 1e-12 && height < point.height
        {
            Some(((point.height - floor) / (point.height - height)).clamp(0., 1.))
        } else {
            None
        };
        let surface_first = surface_hit.filter(|hit| {
            floor_fraction.is_none_or(|f| {
                hit.fraction < f
                    && (point.height + delta[1] * hit.fraction - floor).abs() > CONTACT_PRECISION
            })
        });
        if let Some(hit) = surface_first {
            let used = step * hit.fraction;
            point.pose.position = Point {
                x: point.pose.position.x + delta[0] * hit.fraction,
                z: point.pose.position.z + delta[2] * hit.fraction,
            };
            point.pose.heading = heading;
            point.height += delta[1] * hit.fraction;
            point.rotation = rotation;
            elapsed += used;
            point.fraction = elapsed / dt;
            if descending && hit.normal[1] > 0. {
                if used <= 1e-12 && previous_support == Some(hit.surface_id) {
                    return Err("support loss immediately reacquires the same surface without advancing time".into());
                }
                work.query()?;
                let sample = world
                    .surfaces
                    .support_at(
                        world.hull,
                        hit.surface_id,
                        [point.pose.position.x, point.pose.position.z],
                        heading,
                        next_up,
                    )?
                    .ok_or("landing contact has no supporting root")?;
                if (sample.root[1] - point.height).abs() > CONTACT_PRECISION {
                    return Err("landing would jump to a different support root".into());
                }
                point.support = Some(hit.surface_id);
                point.grounded = true;
                if point.fraction > trace.end().fraction {
                    append_point(&mut trace.points, point.clone())?;
                }
                continue;
            }
            // Preserve impact time before the stationary remainder, so terminal
            // crossings cannot be delayed by stretching the approach over the tick.
            if point.fraction > trace.end().fraction {
                append_point(&mut trace.points, point.clone())?;
            }
            if point.fraction < 1. {
                point.fraction = 1.;
                append_point(&mut trace.points, point)?;
            }
            trace.queries = work.queries;
            return Ok(trace);
        }
        if let Some(f) = floor_fraction {
            point.pose.position = Point {
                x: point.pose.position.x + delta[0] * f,
                z: point.pose.position.z + delta[2] * f,
            };
            point.pose.heading = heading;
            point.height = floor;
            point.rotation = rotation;
            point.support = None;
            point.grounded = true;
            elapsed += step * f;
            point.fraction = elapsed / dt;
            if point.fraction > trace.end().fraction {
                append_point(&mut trace.points, point.clone())?;
            }
            continue;
        }
        point = MotionPoint {
            fraction,
            pose: BodyPose {
                position: target,
                heading,
            },
            height,
            rotation,
            support: None,
            grounded: point.grounded,
        };
        elapsed += step;
        if blocked.iter().any(|v| *v) {
            origin = point.pose.position;
            origin_time = elapsed;
        }
        if blocked[0] {
            velocity.x = 0.;
        }
        if blocked[1] {
            velocity.z = 0.;
        }
        append_point(&mut trace.points, point.clone())?;
    }
    if trace.end().fraction < 1. {
        point.fraction = 1.;
        append_point(&mut trace.points, point)?;
    }
    trace.queries = work.queries;
    Ok(trace)
}

fn append_point(points: &mut Vec<MotionPoint>, point: MotionPoint) -> Result<(), String> {
    // Reserve space for an event split and a stationary terminal tail.
    if points.len() >= MAX_MOTION_POINTS - 2 {
        return Err("numerical motion unresolved: total knot budget".into());
    }
    points.push(point);
    Ok(())
}

#[derive(Default)]
struct Work {
    queries: usize,
    segments: usize,
}
impl Work {
    fn query(&mut self) -> Result<(), String> {
        self.queries += 1;
        if self.queries > MAX_QUERIES {
            Err("numerical motion unresolved: query budget".into())
        } else {
            Ok(())
        }
    }
}
fn mix(a: &MotionPoint, b: &MotionPoint, t: f64) -> MotionPoint {
    if t <= 0. {
        return a.clone();
    }
    if t >= 1. {
        return b.clone();
    }
    let q = Rotation::from_array(a.rotation).slerp(Rotation::from_array(b.rotation), t);
    let u = q * Vector::Y;
    let f = q * Vector::Z;
    let h = f - u * (f.y / u.y);
    MotionPoint {
        fraction: a.fraction + (b.fraction - a.fraction) * t,
        pose: BodyPose {
            position: Point {
                x: a.pose.position.x + (b.pose.position.x - a.pose.position.x) * t,
                z: a.pose.position.z + (b.pose.position.z - a.pose.position.z) * t,
            },
            heading: h.z.atan2(h.x).rem_euclid(std::f64::consts::TAU),
        },
        height: a.height + (b.height - a.height) * t,
        rotation: q.to_array(),
        support: a.support,
        grounded: a.grounded,
    }
}
fn supported_knots(
    world: &BodyWorld,
    start: &MotionPoint,
    end: MotionPoint,
    out: &mut Vec<MotionPoint>,
    work: &mut Work,
) -> Result<(), String> {
    let selected = start.support.unwrap();
    let neighbors = world.surfaces.has_other_surface(selected);
    if neighbors {
        work.query()?;
        if world
            .surfaces
            .neighbor_penetration(world.hull, end.root(), end.rotation, selected)?
            > MOTION_ERROR
        {
            return Err(
                "numerical support unresolved: endpoint blocked by neighboring surface".into(),
            );
        }
    }
    let mut stack = vec![(start.clone(), end, 0usize)];
    while let Some((a, b, depth)) = stack.pop() {
        let distance =
            (b.pose.position.x - a.pose.position.x).hypot(b.pose.position.z - a.pose.position.z);
        let angle =
            Rotation::from_array(a.rotation).angle_between(Rotation::from_array(b.rotation));
        let count = (distance / 0.0005).max(angle / 0.05).ceil().max(2.) as usize;
        let mut split = None;
        for i in 1..count {
            let p = mix(&a, &b, i as f64 / count as f64);
            work.query()
                .map_err(|e| format!("{e} span {:?} -> {:?}", a.root(), b.root()))?;
            let sample = world
                .surfaces
                .support_at(
                    world.hull,
                    a.support.unwrap(),
                    [p.pose.position.x, p.pose.position.z],
                    p.pose.heading,
                    up(p.rotation),
                )?
                .ok_or("numerical motion unresolved: interior support gap")?;
            let error = (sample.root[1] - p.height).abs();
            let penetration = if neighbors {
                work.query()?;
                world
                    .surfaces
                    .neighbor_penetration(world.hull, p.root(), p.rotation, selected)?
            } else {
                0.
            };
            if error > MOTION_ERROR * 0.5 || penetration > MOTION_ERROR * 0.5 {
                let mut middle = mix(&a, &b, 0.5);
                let center = if i * 2 == count {
                    sample
                } else {
                    work.query()?;
                    world
                        .surfaces
                        .support_at(
                            world.hull,
                            a.support.unwrap(),
                            [middle.pose.position.x, middle.pose.position.z],
                            middle.pose.heading,
                            up(middle.rotation),
                        )?
                        .ok_or("numerical motion unresolved: interior support gap")?
                };
                middle.height = center.root[1];
                middle.rotation = center.rotation;
                if neighbors {
                    work.query()?;
                    if world.surfaces.neighbor_penetration(
                        world.hull,
                        middle.root(),
                        middle.rotation,
                        selected,
                    )? > MOTION_ERROR
                    {
                        return Err(
                            "numerical support unresolved: midpoint blocked by neighboring surface"
                                .into(),
                        );
                    }
                }
                split = Some(middle);
                break;
            }
        }
        if let Some(p) = split {
            if depth >= 16 {
                return Err("numerical motion unresolved: refinement budget".into());
            }
            stack.push((p.clone(), b, depth + 1));
            stack.push((a, p, depth + 1));
        } else {
            work.segments += 1;
            if work.segments > 128 {
                return Err("numerical motion unresolved: segment budget".into());
            }
            append_point(out, b)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod coalescing_tests {
    use super::*;
    fn point(t: f64, x: f64) -> MotionPoint {
        MotionPoint {
            fraction: t,
            pose: BodyPose {
                position: Point { x, z: 0. },
                heading: 0.,
            },
            height: 0.,
            rotation: support_rotation(0., [0., 1., 0.]).unwrap(),
            support: None,
            grounded: true,
        }
    }
    #[test]
    fn straight_knots_coalesce_without_moving_any_intermediate_pose() {
        let points: Vec<_> = (0..=5)
            .map(|i| {
                let t = i as f64 / 5.;
                point(t, 2. + 0.05 * t)
            })
            .collect();
        let original = MotionTrace {
            queries: 5,
            points: points.clone(),
        };
        let mut retained = MotionTrace { queries: 5, points };
        retained.coalesce_free();
        assert_eq!(retained.points.len(), 2);
        for i in 0..=1000 {
            let t = i as f64 / 1000.;
            let a = original.at(t).unwrap();
            let b = retained.at(t).unwrap();
            assert!((a.pose.position.x - b.pose.position.x).abs() < 1e-12);
            assert_eq!(a.support, b.support);
            assert_eq!(a.grounded, b.grounded);
        }
    }
    #[test]
    fn collision_hold_and_support_boundaries_survive_coalescing() {
        let mut trace = MotionTrace {
            queries: 0,
            points: vec![point(0., 0.), point(0.4, 0.4), point(1., 0.4)],
        };
        trace.coalesce_free();
        assert_eq!(trace.points.len(), 3);
        assert_eq!(trace.at(0.7).unwrap().pose.position.x, 0.4);
        let mut middle = point(0.5, 0.5);
        middle.support = Some(7);
        let mut trace = MotionTrace {
            queries: 0,
            points: vec![point(0., 0.), middle, point(1., 1.)],
        };
        trace.coalesce_free();
        assert_eq!(trace.points.len(), 3);
        assert_eq!(trace.at(0.5).unwrap().support, Some(7));
    }
}
