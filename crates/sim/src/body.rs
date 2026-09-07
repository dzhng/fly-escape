//! Neural body decoding, bounded vertical movement and finite-life outcomes. Gains/thresholds are modeled
//! approximations pending actual-graph feasibility probes, not biological units.
use crate::{
    environment::{Geometry, Point},
    surface::{support_rotation, ContactHull, ContactScene, ContactSurface},
    StepOutput,
};
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use ts_rs::TS;
mod motion;
pub use motion::{MotionPoint, MotionTrace, MAX_MOTION_POINTS};
#[derive(Debug)]
pub struct BodyStep {
    pub events: Vec<BodyEvent>,
    pub motion: MotionTrace,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct BodyPose {
    pub position: Point,
    pub heading: f64,
}
/// Neural locomotion gains are shared by body transitions and observation labs.
pub struct Locomotion {
    pub thrust: f64,
    pub turn: f64,
    pub speed: f64,
    pub turn_gain: f64,
}
pub fn desired_pose(pose: BodyPose, motion: Locomotion, wind: Point, dt: f64) -> BodyPose {
    let heading = (pose.heading + motion.turn.clamp(-2., 2.) * motion.turn_gain * dt)
        .rem_euclid(std::f64::consts::TAU);
    let velocity = motion.thrust.clamp(0., 2.) * motion.speed;
    BodyPose {
        position: Point {
            x: pose.position.x + (heading.cos() * velocity + wind.x) * dt,
            z: pose.position.z + (heading.sin() * velocity + wind.z) * dt,
        },
        heading,
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum BodyMode {
    Walking,
    Flying,
    Landing,
    Feeding,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum TerminalOutcome {
    Escaped,
    Starved,
    Zapped,
    TimedOut,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct BodyState {
    pub pose: BodyPose,
    /// Native support-pivot height in metres, owned by physical movement.
    pub height: f64,
    /// Core orientation; local +Y points away from the support.
    pub rotation: [f64; 4],
    /// Food support identity; None is floor for grounded modes, air otherwise.
    pub support: Option<u32>,
    pub mode: BodyMode,
    pub reserve: f64,
    pub outcome: Option<TerminalOutcome>,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct BodyConfig {
    pub reserve_capacity: f64,
    pub idle_cost: f64,
    pub walking_cost: f64,
    pub flying_cost: f64,
    pub feeding_rate: f64,
    pub max_bout_seconds: f64,
    pub body_radius: f64,
    pub walk_speed: f64,
    pub flight_speed: f64,
    pub turn_gain: f64,
    pub takeoff_threshold: f64,
    /// Emitted spike fraction, averaged across the two landing groups.
    pub landing_threshold: f64,
    /// Minimum ground time after neural landing; independent of neural cadence.
    pub landing_dwell_seconds: f64,
    /// Emitted proboscis spike fraction; a qualifying pulse starts a latched bout.
    pub proboscis_threshold: f64,
}
impl Default for BodyConfig {
    fn default() -> Self {
        Self {
            reserve_capacity: 20.,
            idle_cost: 0.2,
            walking_cost: 0.4,
            flying_cost: 0.8,
            feeding_rate: 3.,
            max_bout_seconds: 3.,
            body_radius: 0.002632,
            walk_speed: 1.,
            flight_speed: 2.,
            turn_gain: 1.,
            takeoff_threshold: 0.2,
            landing_threshold: 0.2,
            proboscis_threshold: 0.2,
            landing_dwell_seconds: 1.,
        }
    }
}
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ContactRegion {
    pub center: Point,
    pub radius: f64,
}
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ExitOpening {
    pub a: Point,
    pub b: Point,
    pub outward: Point,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct BodyContacts {
    pub food: bool,
    pub zapper: bool,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum FeedingEnd {
    ContactLost,
    Satiated,
    BoutLimit,
    Terminal,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum BodyEventKind {
    ModeChanged { from: BodyMode, to: BodyMode },
    FeedingStarted,
    FeedingEnded { reason: FeedingEnd },
    Terminal { outcome: TerminalOutcome },
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct BodyEvent {
    pub tick: u32,
    pub kind: BodyEventKind,
}

/// Prepared immutable world shared by all bodies for the lifetime of an attempt.
pub struct BodyWorld {
    geometry: Geometry,
    food: ContactScene,
    hull: &'static ContactHull,
    zappers: Vec<ContactRegion>,
    exit: ExitOpening,
    duration_ticks: u32,
}
impl BodyWorld {
    pub fn new(
        geometry: &Geometry,
        food: &[ContactSurface],
        zappers: &[ContactRegion],
        exit: ExitOpening,
        duration_ticks: u32,
    ) -> Result<Self, String> {
        Self::validate(geometry, zappers, exit, duration_ticks)?;
        Ok(Self {
            geometry: geometry.clone(),
            food: ContactScene::new(food)?,
            hull: native_hull()?,
            zappers: zappers.to_vec(),
            exit,
            duration_ticks,
        })
    }
    pub fn validate(
        geometry: &Geometry,
        zappers: &[ContactRegion],
        exit: ExitOpening,
        duration_ticks: u32,
    ) -> Result<(), String> {
        geometry.validate()?;
        if zappers.len() > 256 || duration_ticks == 0 || duration_ticks > 6000 {
            return Err(
                "body world limit: at most 256 zapper regions and duration 1..6000 ticks".into(),
            );
        }
        if zappers.iter().any(|r| {
            !r.center.x.is_finite()
                || !r.center.z.is_finite()
                || !r.radius.is_finite()
                || r.radius <= 0.
                || !geometry.contains_body(r.center, 0.)
        }) {
            return Err("contact regions require finite floor positions and positive radii".into());
        }
        let dx = exit.b.x - exit.a.x;
        let dz = exit.b.z - exit.a.z;
        let length = dx.hypot(dz);
        let norm = exit.outward.x.hypot(exit.outward.z);
        if ![
            exit.a.x,
            exit.a.z,
            exit.b.x,
            exit.b.z,
            exit.outward.x,
            exit.outward.z,
            length,
        ]
        .iter()
        .all(|v| v.is_finite())
            || length == 0.
            || (dx != 0. && dz != 0.)
            || (norm - 1.).abs() > 1e-9
            || (dx * exit.outward.x + dz * exit.outward.z).abs() > 1e-9
        {
            return Err(
                "exit requires a finite axis-aligned segment and perpendicular unit outward normal"
                    .into(),
            );
        }
        let mid = Point {
            x: (exit.a.x + exit.b.x) / 2.,
            z: (exit.a.z + exit.b.z) / 2.,
        };
        let probe = (length * 1e-6).min(1e-5);
        let inside = Point {
            x: mid.x - exit.outward.x * probe,
            z: mid.z - exit.outward.z * probe,
        };
        let outside = Point {
            x: mid.x + exit.outward.x * probe,
            z: mid.z + exit.outward.z * probe,
        };
        if geometry.room_at(inside).is_none() || geometry.room_at(outside).is_some() {
            return Err("exit outward normal must cross an exterior floor boundary".into());
        }
        Ok(())
    }
    fn food_at(&self, state: &BodyState) -> Result<bool, String> {
        Ok(self
            .food
            .touching_hull(
                self.hull,
                [state.pose.position.x, state.height, state.pose.position.z],
                state.rotation,
            )?
            .is_some())
    }
}

fn native_hull() -> Result<&'static ContactHull, String> {
    #[derive(Deserialize)]
    struct BakedHull {
        vertices: Vec<[f64; 3]>,
    }
    static HULL: OnceLock<Result<ContactHull, String>> = OnceLock::new();
    HULL.get_or_init(|| {
        let baked: BakedHull =
            serde_json::from_str(include_str!("../../../assets/fly/contact-hull.json"))
                .map_err(|error| format!("invalid native contact hull: {error}"))?;
        ContactHull::new(&baked.vertices)
    })
    .as_ref()
    .map_err(Clone::clone)
}

const CRUISE_HEIGHT: f64 = 0.6;
const VERTICAL_SPEED: f64 = 0.75;

pub struct Body {
    state: BodyState,
    config: BodyConfig,
    bout_seconds: f64,
    feeding_ready: bool,
    last_tick: Option<u32>,
    ground_dwell_remaining: f64,
}
impl Body {
    pub fn new(pose: BodyPose, reserve: f64, config: BodyConfig) -> Result<Self, String> {
        let values = [
            config.reserve_capacity,
            config.idle_cost,
            config.walking_cost,
            config.flying_cost,
            config.feeding_rate,
            config.max_bout_seconds,
            config.body_radius,
            config.walk_speed,
            config.flight_speed,
            config.turn_gain,
            config.takeoff_threshold,
            config.landing_threshold,
            config.proboscis_threshold,
            config.landing_dwell_seconds,
        ];
        if values.iter().any(|v| !v.is_finite() || *v < 0.)
            || config.reserve_capacity == 0.
            || config.max_bout_seconds == 0.
            || config.idle_cost == 0.
            || config.walking_cost == 0.
            || config.flying_cost == 0.
            || config.proboscis_threshold == 0.
            || config.takeoff_threshold == 0.
            || config.landing_threshold == 0.
            || !reserve.is_finite()
            || reserve < 0.
            || reserve > config.reserve_capacity
            || !pose.position.x.is_finite()
            || !pose.position.z.is_finite()
            || !pose.heading.is_finite()
        {
            return Err("invalid body config, pose or initial reserve; costs and motor thresholds must be positive".into());
        }
        Ok(Self {
            state: BodyState {
                pose,
                height: 0.,
                rotation: support_rotation(pose.heading, [0., 1., 0.])?,
                support: None,
                mode: BodyMode::Walking,
                reserve,
                outcome: None,
            },
            config,
            bout_seconds: 0.,
            feeding_ready: true,
            last_tick: None,
            ground_dwell_remaining: 0.,
        })
    }
    pub fn new_in_mode(
        pose: BodyPose,
        reserve: f64,
        config: BodyConfig,
        mode: BodyMode,
    ) -> Result<Self, String> {
        if !matches!(mode, BodyMode::Walking | BodyMode::Flying) {
            return Err("initial body mode must be walking or flying".into());
        }
        let mut body = Self::new(pose, reserve, config)?;
        body.state.mode = mode;
        if mode == BodyMode::Flying {
            body.state.height = CRUISE_HEIGHT;
        }
        Ok(body)
    }
    pub fn state(&self) -> &BodyState {
        &self.state
    }
    pub fn contacts(&self, world: &BodyWorld) -> Result<BodyContacts, String> {
        Ok(BodyContacts {
            food: matches!(self.state.mode, BodyMode::Walking | BodyMode::Feeding)
                && world.food_at(&self.state)?,
            zapper: world
                .zappers
                .iter()
                .any(|r| contact(self.state.pose.position, *r, self.config.body_radius)),
        })
    }
    fn mode(&mut self, to: BodyMode, tick: u32, events: &mut Vec<BodyEvent>) {
        let from = self.state.mode;
        if from != to {
            self.state.mode = to;
            events.push(BodyEvent {
                tick,
                kind: BodyEventKind::ModeChanged { from, to },
            });
        }
    }
    fn end_feeding(&mut self, reason: FeedingEnd, tick: u32, events: &mut Vec<BodyEvent>) {
        if self.state.mode == BodyMode::Feeding {
            self.feeding_ready = false;
            events.push(BodyEvent {
                tick,
                kind: BodyEventKind::FeedingEnded { reason },
            });
            self.mode(BodyMode::Walking, tick, events);
        }
    }
    fn terminal(&mut self, outcome: TerminalOutcome, tick: u32, events: &mut Vec<BodyEvent>) {
        self.end_feeding(FeedingEnd::Terminal, tick, events);
        self.state.outcome = Some(outcome);
        if outcome == TerminalOutcome::Starved {
            self.state.reserve = 0.;
        }
        events.push(BodyEvent {
            tick,
            kind: BodyEventKind::Terminal { outcome },
        });
    }
    /// One authoritative body step after its neural update. Ticks are strictly
    /// increasing and start at 1; dt is game seconds, bounded to one second.
    /// A terminal body is a no-op; the attempt owner also stops its brain.
    pub fn step(
        &mut self,
        neural: &StepOutput,
        world: &BodyWorld,
        wind: Point,
        dt: f64,
        tick: u32,
    ) -> Result<BodyStep, String> {
        if self.state.outcome.is_some() {
            return Ok(BodyStep {
                events: vec![],
                motion: MotionTrace::stationary(&self.state),
            });
        }
        if tick == 0
            || self.last_tick.is_some_and(|last| tick <= last)
            || !dt.is_finite()
            || dt <= 0.
            || dt > 1.
            || !wind.x.is_finite()
            || !wind.z.is_finite()
            || [
                neural.motor.thrust,
                neural.motor.turn,
                neural.motor.flight_thrust,
                neural.motor.flight_turn,
            ]
            .iter()
            .any(|v| !v.is_finite())
            || neural.groups.len() > 16
            || neural.groups.iter().any(|g| {
                !g.mean_voltage.is_finite()
                    || !g.spike_fraction.is_finite()
                    || !(0. ..=1.).contains(&g.spike_fraction)
            })
        {
            return Err("body step requires increasing positive ticks, dt in (0,1], finite wind/readouts and at most 16 groups".into());
        }
        self.last_tick = Some(tick);
        let mut events = vec![];
        if self.state.reserve <= 0. {
            self.terminal(TerminalOutcome::Starved, tick, &mut events);
            return Ok(BodyStep {
                events,
                motion: MotionTrace::stationary(&self.state),
            });
        }
        let contacts = self.contacts(world)?;
        if contacts.zapper {
            self.terminal(TerminalOutcome::Zapped, tick, &mut events);
            return Ok(BodyStep {
                events,
                motion: MotionTrace::stationary(&self.state),
            });
        }
        // Avoid an extra dwell tick from decimal dt roundoff at the boundary.
        self.ground_dwell_remaining = if self.ground_dwell_remaining <= dt + 1e-12 {
            0.
        } else {
            self.ground_dwell_remaining - dt
        };
        let proboscis = spike_fraction(neural, "proboscis");
        let wants_food = proboscis > self.config.proboscis_threshold;
        let on_food = contacts.food;
        if self.state.mode != BodyMode::Feeding && !wants_food {
            self.feeding_ready = true;
        }
        if self.state.mode == BodyMode::Feeding && !on_food {
            self.end_feeding(FeedingEnd::ContactLost, tick, &mut events);
        }
        let landing =
            (spike_fraction(neural, "landingL") + spike_fraction(neural, "landingR")) / 2.;
        if self.state.mode == BodyMode::Flying && landing > self.config.landing_threshold {
            self.mode(BodyMode::Landing, tick, &mut events);
        } else if self.state.mode == BodyMode::Walking
            && self.ground_dwell_remaining == 0.
            && neural.motor.flight_thrust > self.config.takeoff_threshold
            && landing <= self.config.landing_threshold
        {
            self.mode(BodyMode::Flying, tick, &mut events);
        }
        if self.state.mode == BodyMode::Walking
            && on_food
            && wants_food
            && self.feeding_ready
            && self.state.reserve < self.config.reserve_capacity
        {
            self.bout_seconds = 0.;
            self.mode(BodyMode::Feeding, tick, &mut events);
            events.push(BodyEvent {
                tick,
                kind: BodyEventKind::FeedingStarted,
            });
        }
        let (thrust, turn, speed, cost) = match self.state.mode {
            BodyMode::Flying | BodyMode::Landing => (
                neural.motor.flight_thrust,
                neural.motor.flight_turn,
                self.config.flight_speed,
                self.config.flying_cost,
            ),
            BodyMode::Walking => (
                neural.motor.thrust,
                neural.motor.turn,
                self.config.walk_speed,
                if neural.motor.thrust > 0. {
                    self.config.walking_cost
                } else {
                    self.config.idle_cost
                },
            ),
            BodyMode::Feeding => (0., 0., 0., self.config.idle_cost),
        };
        let desired = desired_pose(
            self.state.pose,
            Locomotion {
                thrust,
                turn,
                speed,
                turn_gain: self.config.turn_gain,
            },
            wind,
            dt,
        );
        let mut trace = motion::advance(world, &self.state, desired, dt, self.config.body_radius)?;
        // A bout can end within a tick; it never restarts merely by touching food again.
        let mut feed_fraction = 0.;
        let mut feed_stops = false;
        let mut feed_end = FeedingEnd::ContactLost;
        if self.state.mode == BodyMode::Feeding {
            feed_fraction = 1.;
            let contact_at = |fraction: f64, trace: &mut MotionTrace| -> Result<bool, String> {
                trace.queries += 1;
                if trace.queries > 512 {
                    return Err("numerical motion unresolved: contact timeline query budget".into());
                }
                let p = trace.at(fraction)?;
                if !p.grounded {
                    return Ok(false);
                }
                let mut state = self.state.clone();
                p.apply(&mut state);
                world.food_at(&state)
            };
            let fractions: Vec<_> = trace.points.iter().map(|p| p.fraction).collect();
            for pair in fractions.windows(2) {
                if !contact_at(pair[1], &mut trace)? {
                    let (mut lo, mut hi) = (pair[0], pair[1]);
                    for _ in 0..12 {
                        let middle = (lo + hi) * 0.5;
                        if contact_at(middle, &mut trace)? {
                            lo = middle
                        } else {
                            hi = middle
                        }
                    }
                    feed_fraction = lo;
                    feed_stops = true;
                    break;
                }
            }
            let bout = (self.config.max_bout_seconds - self.bout_seconds).max(0.) / dt;
            if bout <= feed_fraction {
                feed_fraction = bout;
                feed_stops = true;
                feed_end = FeedingEnd::BoutLimit;
            }
            let net = self.config.feeding_rate - cost;
            if net > 0. {
                let full =
                    ((self.config.reserve_capacity - self.state.reserve) / (net * dt)).max(0.);
                if full <= feed_fraction {
                    feed_fraction = full;
                    feed_stops = true;
                    feed_end = FeedingEnd::Satiated;
                }
            }
        }
        let feed_seconds = feed_fraction * dt;
        let mut terminal: Option<(f64, TerminalOutcome)> = None;
        for pair in trace.points.windows(2) {
            let from = pair[0].pose.position;
            let to = pair[1].pose.position;
            let time = |t: f64| pair[0].fraction + (pair[1].fraction - pair[0].fraction) * t;
            if let Some(t) = exit_crossing(from, to, world.exit, self.config.body_radius) {
                let t = time(t);
                if terminal.is_none_or(|(prior, _)| t < prior) {
                    terminal = Some((t, TerminalOutcome::Escaped));
                }
            }
            for region in &world.zappers {
                if let Some(t) = circle_crossing(from, to, *region, self.config.body_radius) {
                    let t = time(t);
                    if terminal.is_none_or(|(prior, _)| t <= prior) {
                        terminal = Some((t, TerminalOutcome::Zapped));
                    }
                }
            }
        }
        // Integrate the feeding prefix and subsequent loss separately.
        let feeding_loss = (cost - self.config.feeding_rate) * feed_seconds;
        let after_feed = self.state.reserve - feeding_loss;
        let starved = if feeding_loss > 0. && self.state.reserve <= feeding_loss {
            Some(self.state.reserve / ((cost - self.config.feeding_rate) * dt))
        } else if cost > 0. && after_feed <= cost * (dt - feed_seconds) {
            Some(feed_fraction + after_feed / (cost * dt))
        } else {
            None
        };
        if let Some(t) = starved {
            if terminal.is_none_or(|(prior, _)| t <= prior) {
                terminal = Some((t, TerminalOutcome::Starved));
            }
        }
        let fraction = terminal.map_or(1., |(t, _)| t);
        let reached = trace.at(fraction)?;
        reached.apply(&mut self.state);
        let actual_feed = dt * fraction.min(feed_fraction);
        self.state.reserve = (self.state.reserve + self.config.feeding_rate * actual_feed
            - cost * dt * fraction)
            .clamp(0., self.config.reserve_capacity);
        if self.state.mode == BodyMode::Feeding {
            self.bout_seconds += actual_feed;
            if fraction >= feed_fraction && feed_stops {
                self.end_feeding(feed_end, tick, &mut events);
            }
        }

        if self.state.mode == BodyMode::Landing && reached.grounded {
            self.mode(BodyMode::Walking, tick, &mut events);
            self.ground_dwell_remaining = self.config.landing_dwell_seconds;
        } else if matches!(self.state.mode, BodyMode::Walking | BodyMode::Feeding)
            && !reached.grounded
        {
            self.end_feeding(FeedingEnd::ContactLost, tick, &mut events);
            self.mode(BodyMode::Landing, tick, &mut events);
        }
        if let Some((_, outcome)) = terminal {
            self.terminal(outcome, tick, &mut events);
        } else if self.state.reserve <= 0. {
            self.terminal(TerminalOutcome::Starved, tick, &mut events);
        } else if tick >= world.duration_ticks {
            self.terminal(TerminalOutcome::TimedOut, tick, &mut events);
        }
        Ok(BodyStep {
            events,
            motion: trace.finish(fraction)?,
        })
    }
}
fn spike_fraction(neural: &StepOutput, id: &str) -> f64 {
    neural
        .groups
        .iter()
        .find(|g| g.id == id)
        .map_or(0., |g| g.spike_fraction)
}
fn contact(p: Point, r: ContactRegion, radius: f64) -> bool {
    (p.x - r.center.x).hypot(p.z - r.center.z) <= r.radius + radius
}
fn circle_crossing(a: Point, b: Point, region: ContactRegion, radius: f64) -> Option<f64> {
    if contact(a, region, radius) {
        return Some(0.);
    }
    let dx = b.x - a.x;
    let dz = b.z - a.z;
    let ox = a.x - region.center.x;
    let oz = a.z - region.center.z;
    let aa = dx * dx + dz * dz;
    if aa == 0. {
        return None;
    }
    let bb = 2. * (ox * dx + oz * dz);
    let cc = ox * ox + oz * oz - (region.radius + radius).powi(2);
    let discriminant = bb * bb - 4. * aa * cc;
    if discriminant < 0. {
        return None;
    }
    let t = (-bb - discriminant.sqrt()) / (2. * aa);
    (0. ..=1.).contains(&t).then_some(t)
}
fn exit_crossing(a: Point, b: Point, exit: ExitOpening, radius: f64) -> Option<f64> {
    let signed = |p: Point| (p.x - exit.a.x) * exit.outward.x + (p.z - exit.a.z) * exit.outward.z;
    let before = signed(a);
    let after = signed(b);
    if before >= 0. || after < 0. || after <= before {
        return None;
    }
    let t = -before / (after - before);
    let p = Point {
        x: a.x + (b.x - a.x) * t,
        z: a.z + (b.z - a.z) * t,
    };
    let dx = exit.b.x - exit.a.x;
    let dz = exit.b.z - exit.a.z;
    let length = dx.hypot(dz);
    let along = ((p.x - exit.a.x) * dx + (p.z - exit.a.z) * dz) / length;
    (along > radius && along < length - radius).then_some(t)
}
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct OutcomeSummary {
    pub escaped: u32,
    pub starved: u32,
    pub zapped: u32,
    pub timed_out: u32,
    pub score: u32,
}
pub fn summarize_outcomes(states: &[BodyState]) -> OutcomeSummary {
    let mut summary = OutcomeSummary::default();
    for state in states {
        match state.outcome {
            Some(TerminalOutcome::Escaped) => {
                summary.escaped += 1;
                summary.score += 1;
            }
            Some(TerminalOutcome::Starved) => summary.starved += 1,
            Some(TerminalOutcome::Zapped) => summary.zapped += 1,
            Some(TerminalOutcome::TimedOut) => summary.timed_out += 1,
            None => {}
        }
    }
    summary
}

#[cfg(test)]
mod motion_consumer;
