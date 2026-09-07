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
    /// At least one angular request was declined; translation was still tested.
    pub rotation_blocked: bool,
    /// A declined request included a typed Failed nonlinear solve.
    pub rotation_unresolved: bool,
    pub contact_hazard: Option<(f64, ContactHazardKind)>,
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
            rotation_blocked: false,
            rotation_unresolved: false,
            contact_hazard: None,
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
        if self.contact_hazard.is_some_and(|(time, _)| time > fraction) {
            self.contact_hazard = None;
        }
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

/// A work-limited request consumes its tick at an independently verified start.
/// Validation shares the same query budget as the attempted movement.
pub(super) fn advance(
    world: &BodyWorld,
    state: &BodyState,
    desired: BodyPose,
    dt: f64,
    radius: f64,
) -> Result<MotionTrace, String> {
    let mut work = Work::default();
    validate_start(world, state, desired, dt, radius, &mut work)
        .map_err(|error| error.to_string())?;
    match advance_bounded(world, state, desired, dt, radius, &mut work) {
        Ok(trace) => Ok(trace),
        Err(
            MotionFailure::QueryLimit
            | MotionFailure::SegmentLimit
            | MotionFailure::KnotLimit
            | MotionFailure::SubstepLimit,
        ) => {
            let mut trace = MotionTrace::stationary(state);
            // Mode changes can initiate takeoff while retaining the old support
            // on BodyState until this motion owner applies its first point.
            if !trace.points[0].grounded {
                for point in &mut trace.points {
                    point.support = None;
                }
            }
            trace.queries = work.queries;
            Ok(trace)
        }
        Err(MotionFailure::Invalid(message)) => Err(message),
    }
}

fn validate_start(
    world: &BodyWorld,
    state: &BodyState,
    desired: BodyPose,
    dt: f64,
    radius: f64,
    work: &mut Work,
) -> Result<(), MotionFailure> {
    if !dt.is_finite()
        || dt <= 0.
        || dt > 1.
        || !desired.position.finite()
        || !desired.heading.is_finite()
        || !state.pose.heading.is_finite()
        || !state.height.is_finite()
        || !world.geometry.body_clear(state.pose.position, radius)
    {
        return Err(
            "motion requires a finite request and an unobstructed initial body pose".into(),
        );
    }
    let floor = world.hull.floor_height_at(state.rotation)?;
    if state.height < floor - MOTION_ERROR {
        return Err("initial body penetrates the floor".into());
    }
    work.query()?;
    if world.surfaces.penetration(
        world.hull,
        [state.pose.position.x, state.height, state.pose.position.z],
        state.rotation,
    )? > MOTION_ERROR
    {
        return Err("initial body penetrates native contact".into());
    }
    if let Some(id) = state.support {
        work.query()?;
        let sample = world
            .surfaces
            .support_at(
                world.hull,
                id,
                [state.pose.position.x, state.pose.position.z],
                state.pose.heading,
                up(state.rotation),
            )?
            .ok_or("initial support is absent at the body pose")?;
        if (sample.root[1] - state.height).abs() > MOTION_ERROR {
            return Err("initial support does not match body height".into());
        }
    } else if matches!(state.mode, BodyMode::Walking | BodyMode::Feeding)
        && (state.height - floor).abs() > MOTION_ERROR
    {
        return Err("grounded initial body has no supporting floor".into());
    }
    Ok(())
}

fn advance_bounded(
    world: &BodyWorld,
    state: &BodyState,
    desired: BodyPose,
    dt: f64,
    radius: f64,
    work: &mut Work,
) -> Result<MotionTrace, MotionFailure> {
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
        rotation_blocked: false,
        rotation_unresolved: false,
        contact_hazard: None,
        queries: 0,
    };
    let mut elapsed = 0.;
    let mut iterations = 0;
    let mut descending = state.mode == BodyMode::Landing;
    while elapsed < dt - 1e-12 {
        iterations += 1;
        if iterations >= MAX_MOTION_POINTS {
            return Err(MotionFailure::SubstepLimit);
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
        let mut heading = angle(state.pose.heading, desired.heading, fraction);
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
                let progress = supported_knots(world, &point, endpoint, &mut trace.points, work)?;
                point = trace.end().clone();
                if !matches!(progress, SupportedProgress::Complete) {
                    break;
                }
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
                    return Err(MotionFailure::SegmentLimit);
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
        let mut next_up = if point.grounded {
            toward(current_up, [0., 1., 0.], step)
        } else {
            current_up
        };
        let mut rotation = support_rotation(heading, next_up)?;
        let mut floor = world.hull.floor_height(heading, next_up)?;
        let mut height = if point.grounded {
            floor
        } else if descending {
            point.height - VERTICAL_SPEED * step
        } else {
            (point.height + VERTICAL_SPEED * step).min(CRUISE_HEIGHT)
        };
        let mut delta = [
            target.x - point.pose.position.x,
            height - point.height,
            target.z - point.pose.position.z,
        ];
        work.query()?;
        let mut clearance = world.surfaces.rotation_clearance(
            world.hull,
            point.root(),
            point.rotation,
            rotation,
            delta,
        )?;
        if clearance == crate::surface::RotationClearance::Clear {
            // Translation uses the requested orientation from its start, so that
            // turn at the retained root must also have a swept-clearance proof.
            work.query()?;
            clearance = world.surfaces.rotation_clearance(
                world.hull,
                point.root(),
                point.rotation,
                rotation,
                [0., 0., 0.],
            )?;
        }
        if clearance != crate::surface::RotationClearance::Clear {
            // No swept-clearance proof: reject angular motion, then still test
            // the requested translation using the last verified orientation.
            work.query()?;
            if world
                .surfaces
                .penetration(world.hull, point.root(), point.rotation)?
                > MOTION_ERROR
            {
                return Err("blocked angular motion has no verified nonpenetrating start".into());
            }
            trace.rotation_blocked = true;
            trace.rotation_unresolved |= clearance == crate::surface::RotationClearance::Unresolved;
            heading = point.pose.heading;
            next_up = current_up;
            rotation = point.rotation;
            floor = world.hull.floor_height(heading, next_up)?;
            if point.grounded {
                height = floor;
                delta[1] = floor - point.height;
            }
        }
        work.query()?;
        let surface_hit =
            world
                .surfaces
                .cast_at_rotation(world.hull, point.root(), rotation, delta)?;
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
            let impact = [
                point.pose.position.x + delta[0] * hit.fraction,
                point.height + delta[1] * hit.fraction,
                point.pose.position.z + delta[2] * hit.fraction,
            ];
            work.query()?;
            if world.surfaces.penetration(world.hull, impact, rotation)? > MOTION_ERROR {
                // A candidate impact is not permission to enter a neighboring
                // component. Retain the verified prefix when this root is blocked.
                work.query()?;
                if world
                    .surfaces
                    .penetration(world.hull, point.root(), point.rotation)?
                    > MOTION_ERROR
                {
                    return Err("blocked free motion has no verified nonpenetrating start".into());
                }
                point.fraction = 1.;
                append_point(&mut trace.points, point)?;
                trace.queries = work.queries;
                return Ok(trace);
            }
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
            if let Some(kind) = world.contact_hazards.get(&hit.surface_id) {
                trace.contact_hazard = Some((point.fraction, *kind));
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
                if point.fraction == trace.end().fraction {
                    *trace.points.last_mut().unwrap() = point.clone();
                }
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

fn append_point(points: &mut Vec<MotionPoint>, point: MotionPoint) -> Result<(), MotionFailure> {
    // Reserve space for an event split and a stationary terminal tail.
    if points.len() >= MAX_MOTION_POINTS - 2 {
        return Err(MotionFailure::KnotLimit);
    }
    points.push(point);
    Ok(())
}

#[derive(Debug)]
enum MotionFailure {
    QueryLimit,
    SegmentLimit,
    KnotLimit,
    SubstepLimit,
    Invalid(String),
}
impl From<String> for MotionFailure {
    fn from(message: String) -> Self {
        Self::Invalid(message)
    }
}
impl From<&str> for MotionFailure {
    fn from(message: &str) -> Self {
        Self::Invalid(message.into())
    }
}
impl std::fmt::Display for MotionFailure {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Invalid(message) => f.write_str(message),
            other => write!(f, "motion work exhausted: {other:?}"),
        }
    }
}

#[derive(Default)]
struct Work {
    queries: usize,
    segments: usize,
}
impl Work {
    fn query(&mut self) -> Result<(), MotionFailure> {
        if self.queries == MAX_QUERIES {
            return Err(MotionFailure::QueryLimit);
        }
        self.queries += 1;
        Ok(())
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
enum SupportedProgress {
    Complete,
    Blocked,
    Unresolved,
}

fn stop_supported(
    world: &BodyWorld,
    out: &[MotionPoint],
    work: &mut Work,
) -> Result<SupportedProgress, MotionFailure> {
    // A known collision can hold a verified prefix; an already invalid starting
    // pose cannot be reclassified as successful stationary motion.
    let last = out.last().unwrap();
    work.query()?;
    last.support
        .ok_or("blocked support trace lost its surface identity")?;
    if world
        .surfaces
        .penetration(world.hull, last.root(), last.rotation)?
        > MOTION_ERROR
    {
        return Err(
            "numerical support unresolved: retained pose penetrates contact surface".into(),
        );
    }
    Ok(SupportedProgress::Blocked)
}

fn supported_knots(
    world: &BodyWorld,
    start: &MotionPoint,
    end: MotionPoint,
    out: &mut Vec<MotionPoint>,
    work: &mut Work,
) -> Result<SupportedProgress, MotionFailure> {
    let selected = start.support.unwrap();
    let neighbors = world.surfaces.has_other_surface(selected);
    if neighbors {
        work.query()?;
        if world
            .surfaces
            .neighbor_penetration(world.hull, end.root(), end.rotation, selected)?
            > MOTION_ERROR
        {
            return stop_supported(world, out, work);
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
            work.query()?;
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
                        return stop_supported(world, out, work);
                    }
                }
                split = Some(middle);
                break;
            }
        }
        if let Some(p) = split {
            if depth >= 16 {
                // A verified prefix is useful here; query exhaustion during its
                // validation still falls back to the verified request start.
                stop_supported(world, out, work)?;
                return Ok(SupportedProgress::Unresolved);
            }
            stack.push((p.clone(), b, depth + 1));
            stack.push((a, p, depth + 1));
        } else {
            work.segments += 1;
            if work.segments > 128 {
                return Err(MotionFailure::SegmentLimit);
            }
            append_point(out, b)?;
        }
    }
    Ok(SupportedProgress::Complete)
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
    fn stopped_support_rejects_selected_surface_penetration_and_query_exhaustion() {
        let geometry = Geometry {
            rooms: vec![crate::environment::RectRoom {
                id: 1,
                min: Point { x: -1., z: -1. },
                max: Point { x: 1., z: 1. },
            }],
            walls: vec![],
            solids: vec![],
        };
        let apple: ContactSurface =
            serde_json::from_str(include_str!("../../../../assets/food/apple/contact.json"))
                .unwrap();
        let world = BodyWorld::new(
            &geometry,
            std::slice::from_ref(&apple),
            &[],
            &[],
            ExitOpening {
                a: Point { x: 1., z: 0. },
                b: Point { x: 1., z: 0.1 },
                outward: Point { x: 1., z: 0. },
            },
            100,
        )
        .unwrap();
        let mut retained = point(0.5, 0.);
        retained.height = 0.04;
        retained.support = Some(apple.id);
        assert!(world
            .surfaces
            .penetration(world.hull, retained.root(), retained.rotation)
            .unwrap_err()
            .contains("inside closed food"));
        assert!(
            matches!(stop_supported(&world, &[retained.clone()], &mut Work::default()), Err(MotionFailure::Invalid(message)) if message.contains("inside closed food"))
        );
        let mut work = Work {
            queries: MAX_QUERIES,
            segments: 0,
        };
        assert!(matches!(
            stop_supported(&world, &[retained], &mut work),
            Err(MotionFailure::QueryLimit)
        ));
    }
    #[test]
    fn recovery_requires_a_physically_valid_start_and_preserves_native_errors() {
        let geometry = Geometry {
            rooms: vec![crate::environment::RectRoom {
                id: 1,
                min: Point { x: -1., z: -1. },
                max: Point { x: 1., z: 1. },
            }],
            walls: vec![crate::environment::Wall {
                a: Point { x: 0.8, z: -1. },
                b: Point { x: 0.8, z: 1. },
            }],
            solids: vec![],
        };
        let apple: ContactSurface =
            serde_json::from_str(include_str!("../../../../assets/food/apple/contact.json"))
                .unwrap();
        let world = BodyWorld::new(
            &geometry,
            std::slice::from_ref(&apple),
            &[],
            &[],
            ExitOpening {
                a: Point { x: 1., z: 0. },
                b: Point { x: 1., z: 0.1 },
                outward: Point { x: 1., z: 0. },
            },
            100,
        )
        .unwrap();
        let valid = BodyState {
            pose: BodyPose {
                position: Point { x: 0.3, z: 0. },
                heading: 0.,
            },
            height: 0.,
            rotation: support_rotation(0., [0., 1., 0.]).unwrap(),
            support: None,
            mode: BodyMode::Walking,
            reserve: 10.,
            outcome: None,
        };
        assert!(advance(&world, &valid, valid.pose, 0.1, 0.002632).is_ok());
        let mut invalid = valid.clone();
        invalid.rotation = [0.; 4];
        assert!(advance(&world, &invalid, invalid.pose, 0.1, 0.002632)
            .unwrap_err()
            .contains("unit quaternion"));
        invalid = valid.clone();
        invalid.height = -0.01;
        assert!(advance(&world, &invalid, invalid.pose, 0.1, 0.002632)
            .unwrap_err()
            .contains("floor"));
        invalid = valid.clone();
        invalid.height = 0.1;
        assert!(advance(&world, &invalid, invalid.pose, 0.1, 0.002632)
            .unwrap_err()
            .contains("supporting floor"));
        invalid = valid.clone();
        invalid.support = Some(u32::MAX);
        assert!(advance(&world, &invalid, invalid.pose, 0.1, 0.002632).is_err());
        invalid = valid.clone();
        invalid.pose.position.x = 0.8;
        assert!(advance(&world, &invalid, invalid.pose, 0.1, 0.002632)
            .unwrap_err()
            .contains("unobstructed"));
        invalid = valid.clone();
        invalid.pose.position.x = f64::NAN;
        assert!(advance(&world, &invalid, invalid.pose, 0.1, 0.002632)
            .unwrap_err()
            .contains("finite"));
        invalid = valid;
        invalid.pose.position.x = 0.;
        invalid.height = 0.04;
        invalid.mode = BodyMode::Landing;
        assert!(advance(&world, &invalid, invalid.pose, 0.1, 0.002632)
            .unwrap_err()
            .contains("inside closed food"));
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
            rotation_blocked: false,
            rotation_unresolved: false,
            contact_hazard: None,
            queries: 5,
            points: points.clone(),
        };
        let mut retained = MotionTrace {
            rotation_blocked: false,
            rotation_unresolved: false,
            contact_hazard: None,
            queries: 5,
            points,
        };
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
            rotation_blocked: false,
            rotation_unresolved: false,
            contact_hazard: None,
            queries: 0,
            points: vec![point(0., 0.), point(0.4, 0.4), point(1., 0.4)],
        };
        trace.coalesce_free();
        assert_eq!(trace.points.len(), 3);
        assert_eq!(trace.at(0.7).unwrap().pose.position.x, 0.4);
        let mut middle = point(0.5, 0.5);
        middle.support = Some(7);
        let mut trace = MotionTrace {
            rotation_blocked: false,
            rotation_unresolved: false,
            contact_hazard: None,
            queries: 0,
            points: vec![point(0., 0.), middle, point(1., 1.)],
        };
        trace.coalesce_free();
        assert_eq!(trace.points.len(), 3);
        assert_eq!(trace.at(0.5).unwrap().support, Some(7));
    }
}
