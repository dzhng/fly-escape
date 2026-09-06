//! Planar body decoding and finite-life outcomes. Gains/thresholds are modeled
//! approximations pending actual-graph feasibility probes, not biological units.
use crate::{
    environment::{Geometry, Point},
    StepOutput,
};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct BodyPose {
    pub position: Point,
    pub heading: f64,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum BodyMode {
    Walking,
    Flying,
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
            body_radius: 0.08,
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

/// Immutable scene inputs. Region contact is measured from the body position;
/// callers use contacts() for taste injection before advancing the brain.
pub struct BodyWorld<'a> {
    geometry: &'a Geometry,
    food: &'a [ContactRegion],
    zappers: &'a [ContactRegion],
    exit: ExitOpening,
    duration_ticks: u32,
}
impl<'a> BodyWorld<'a> {
    pub fn new(
        geometry: &'a Geometry,
        food: &'a [ContactRegion],
        zappers: &'a [ContactRegion],
        exit: ExitOpening,
        duration_ticks: u32,
    ) -> Result<Self, String> {
        geometry.validate()?;
        if food.len() > 256 || zappers.len() > 256 || duration_ticks == 0 || duration_ticks > 6000 {
            return Err(
                "body world limit: at most 256 food/zapper regions and duration 1..6000 ticks"
                    .into(),
            );
        }
        if food.iter().chain(zappers).any(|r| {
            !r.center.x.is_finite()
                || !r.center.z.is_finite()
                || !r.radius.is_finite()
                || r.radius <= 0.
                || geometry.room_at(r.center).is_none()
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
        Ok(Self {
            geometry,
            food,
            zappers,
            exit,
            duration_ticks,
        })
    }
}

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
    pub fn state(&self) -> &BodyState {
        &self.state
    }
    pub fn contacts(&self, world: &BodyWorld) -> BodyContacts {
        BodyContacts {
            food: self.state.mode != BodyMode::Flying
                && world
                    .food
                    .iter()
                    .any(|r| contact(self.state.pose.position, *r, self.config.body_radius)),
            zapper: world
                .zappers
                .iter()
                .any(|r| contact(self.state.pose.position, *r, self.config.body_radius)),
        }
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
    ) -> Result<Vec<BodyEvent>, String> {
        if self.state.outcome.is_some() {
            return Ok(vec![]);
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
            return Ok(events);
        }
        if self.contacts(world).zapper {
            self.terminal(TerminalOutcome::Zapped, tick, &mut events);
            return Ok(events);
        }
        // Avoid an extra dwell tick from decimal dt roundoff at the boundary.
        self.ground_dwell_remaining = if self.ground_dwell_remaining <= dt + 1e-12 {
            0.
        } else {
            self.ground_dwell_remaining - dt
        };
        let proboscis = spike_fraction(neural, "proboscis");
        let wants_food = proboscis > self.config.proboscis_threshold;
        let on_food = self.contacts(world).food;
        if self.state.mode != BodyMode::Feeding && !wants_food {
            self.feeding_ready = true;
        }
        if self.state.mode == BodyMode::Feeding && !on_food {
            self.end_feeding(FeedingEnd::ContactLost, tick, &mut events);
        }
        let landing =
            (spike_fraction(neural, "landingL") + spike_fraction(neural, "landingR")) / 2.;
        if self.state.mode == BodyMode::Flying && landing > self.config.landing_threshold {
            self.mode(BodyMode::Walking, tick, &mut events);
            self.ground_dwell_remaining = self.config.landing_dwell_seconds;
        } else if self.state.mode == BodyMode::Walking
            && self.ground_dwell_remaining == 0.
            && neural.motor.flight_thrust > self.config.takeoff_threshold
            && landing <= self.config.landing_threshold
        {
            self.mode(BodyMode::Flying, tick, &mut events);
        }
        if self.state.mode == BodyMode::Walking
            && self.contacts(world).food
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
            BodyMode::Flying => (
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
        let from = self.state.pose.position;
        let heading = (self.state.pose.heading + turn.clamp(-2., 2.) * self.config.turn_gain * dt)
            .rem_euclid(std::f64::consts::TAU);
        let velocity = thrust.clamp(0., 2.) * speed;
        let desired = Point {
            x: from.x + (heading.cos() * velocity + wind.x) * dt,
            z: from.z + (heading.sin() * velocity + wind.z) * dt,
        };
        let to = world.geometry.sweep(from, desired, self.config.body_radius);
        let food_after = self.state.mode == BodyMode::Feeding
            && world
                .food
                .iter()
                .any(|r| contact(to, *r, self.config.body_radius));
        let feed_seconds = if food_after {
            dt.min((self.config.max_bout_seconds - self.bout_seconds).max(0.))
        } else {
            0.
        };
        let replenishment = self.config.feeding_rate * feed_seconds;
        let mut terminal: Option<(f64, TerminalOutcome)> = None;
        if let Some(t) = exit_crossing(from, to, world.exit, self.config.body_radius) {
            terminal = Some((t, TerminalOutcome::Escaped));
        }
        for region in world.zappers {
            if let Some(t) = circle_crossing(from, to, *region, self.config.body_radius) {
                if terminal.is_none_or(|(prior, _)| t <= prior) {
                    terminal = Some((t, TerminalOutcome::Zapped));
                }
            }
        }
        // Net energy loss can pre-empt a later crossing even during a meal.
        let energy_loss = cost * dt - replenishment;
        if energy_loss > 0. && self.state.reserve <= energy_loss {
            let t = self.state.reserve / energy_loss;
            if terminal.is_none_or(|(prior, _)| t <= prior) {
                terminal = Some((t, TerminalOutcome::Starved));
            }
        }
        let fraction = terminal.map_or(1., |(t, _)| t);
        self.state.pose = BodyPose {
            position: Point {
                x: from.x + (to.x - from.x) * fraction,
                z: from.z + (to.z - from.z) * fraction,
            },
            heading,
        };
        self.state.reserve = (self.state.reserve + (replenishment - cost * dt) * fraction)
            .clamp(0., self.config.reserve_capacity);
        if self.state.mode == BodyMode::Feeding {
            self.bout_seconds += feed_seconds * fraction;
            if !food_after {
                self.end_feeding(FeedingEnd::ContactLost, tick, &mut events);
            } else if self.state.reserve >= self.config.reserve_capacity {
                self.end_feeding(FeedingEnd::Satiated, tick, &mut events);
            } else if self.bout_seconds >= self.config.max_bout_seconds {
                self.end_feeding(FeedingEnd::BoutLimit, tick, &mut events);
            }
        }
        if let Some((_, outcome)) = terminal {
            self.terminal(outcome, tick, &mut events);
        } else if self.state.reserve <= 0. {
            self.terminal(TerminalOutcome::Starved, tick, &mut events);
        } else if tick >= world.duration_ticks {
            self.terminal(TerminalOutcome::TimedOut, tick, &mut events);
        }
        Ok(events)
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
