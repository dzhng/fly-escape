//! Neural body decoding, bounded vertical movement and terminal outcomes. The life
//! model chooses between a timed round and a finite energy reserve. Gains/thresholds are modeled
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
    Caught,
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
    /// Remaining energy under the reserve model; timed rounds model none and hold zero.
    pub reserve: f64,
    pub outcome: Option<TerminalOutcome>,
}
/// Finite-life energy: what each mode spends per game second, what feeding returns
/// and how much a body starts and can hold.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReserveModel {
    pub initial: f64,
    pub capacity: f64,
    pub idle_cost: f64,
    pub walking_cost: f64,
    pub flying_cost: f64,
    pub feeding_rate: f64,
    pub max_bout_seconds: f64,
}
impl Default for ReserveModel {
    fn default() -> Self {
        Self {
            initial: 20.,
            capacity: 20.,
            idle_cost: 0.2,
            walking_cost: 0.4,
            flying_cost: 0.8,
            feeding_rate: 3.,
            max_bout_seconds: 3.,
        }
    }
}
/// The single owner of what limits a life, besides hazards and the exit. Campaign
/// rounds are timed: nothing is spent or gained, no feeding bout ever starts, and
/// food acts only through the support it offers, its taste and the walking it imposes.
/// The reserve model is the finite-life diagnostic, where modes drain a reserve that
/// feeding replenishes.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum LifeModel {
    Timed,
    Reserve(ReserveModel),
}
impl LifeModel {
    /// The energy model, present only when a life is limited by one.
    pub fn reserve(self) -> Option<ReserveModel> {
        match self {
            Self::Timed => None,
            Self::Reserve(model) => Some(model),
        }
    }
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct BodyConfig {
    pub life: LifeModel,
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
            life: LifeModel::Reserve(ReserveModel::default()),
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
impl ExitOpening {
    /// Centre of the opening: the doorway an escaping body has to cross.
    fn midpoint(self) -> Point {
        Point {
            x: (self.a.x + self.b.x) / 2.,
            z: (self.a.z + self.b.z) / 2.,
        }
    }
}
/// Authored physical help toward the doorway: a reverse fan whose pull
/// converges on a point just outside the exit. It is ordinary wind on the swept
/// body, so contact and escape adjudication are unchanged, and it is absent
/// unless a level authors it.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ExitSuction {
    /// World units from the exit midpoint at which the pull reaches zero.
    pub reach: f64,
    /// World units per second at the midpoint, falling linearly to zero at reach.
    pub speed: f64,
    /// World units per second held everywhere else in the exit room, so authored
    /// objects only have to lead a body into that room. Zero, the default, is the
    /// doorway-only pull levels had before the setting existed.
    #[serde(default, skip_serializing_if = "is_zero")]
    pub room_speed: f64,
}
impl ExitSuction {
    pub(crate) fn validate(self) -> Result<(), String> {
        if !self.reach.is_finite()
            || self.reach <= 0.
            || self.reach > 2.
            || !self.speed.is_finite()
            || self.speed < 0.
            || self.speed > 2.
            || !self.room_speed.is_finite()
            || self.room_speed < 0.
            || self.room_speed > 2.
        {
            return Err(
                "exit suction requires reach in (0,2] world units and speeds in [0,2] per second"
                    .into(),
            );
        }
        Ok(())
    }
}
/// Serde omits an unset room pull, so a doorway-only level keeps its prior JSON.
fn is_zero(value: &f64) -> bool {
    *value == 0.
}
/// How far outside the wall plane the pull converges. Small enough to stay a
/// doorway step, large enough that a body at the plane is carried through it
/// rather than along it.
const EXIT_SUCTION_TARGET_OFFSET: f64 = 0.25;
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct BodyContacts {
    pub food: bool,
    pub contact_hazard: Option<ContactHazardKind>,
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

/// Contact roles refer to exact native surfaces, independently of visual appearance.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum ContactHazardKind {
    Zapper,
    Web,
}
impl ContactHazardKind {
    fn outcome(self) -> TerminalOutcome {
        match self {
            Self::Zapper => TerminalOutcome::Zapped,
            Self::Web => TerminalOutcome::Caught,
        }
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ContactHazard {
    pub surface_id: u32,
    pub kind: ContactHazardKind,
}

/// Prepared immutable world shared by all bodies for the lifetime of an attempt.
pub struct BodyWorld {
    geometry: Geometry,
    surfaces: ContactScene,
    edible_ids: std::collections::BTreeSet<u32>,
    object_ids: std::collections::BTreeSet<u32>,
    contact_hazards: std::collections::BTreeMap<u32, ContactHazardKind>,
    hull: &'static ContactHull,
    zappers: Vec<ContactRegion>,
    exit: ExitOpening,
    exit_suction: Option<ExitSuction>,
    duration_ticks: u32,
}
impl BodyWorld {
    pub fn new(
        geometry: &Geometry,
        food: &[ContactSurface],
        objects: &[ContactSurface],
        zappers: &[ContactRegion],
        exit: ExitOpening,
        duration_ticks: u32,
    ) -> Result<Self, String> {
        Self::validate(geometry, zappers, exit, duration_ticks)?;
        Ok(Self {
            geometry: geometry.clone(),
            surfaces: ContactScene::new(&food.iter().chain(objects).cloned().collect::<Vec<_>>())?,
            edible_ids: food.iter().map(|surface| surface.id).collect(),
            object_ids: objects.iter().map(|surface| surface.id).collect(),
            contact_hazards: Default::default(),
            hull: native_hull()?,
            zappers: zappers.to_vec(),
            exit,
            exit_suction: None,
            duration_ticks,
        })
    }
    pub fn with_contact_hazards(mut self, hazards: &[ContactHazard]) -> Result<Self, String> {
        if hazards.len() > 256 {
            return Err("at most 256 contact hazards are supported".into());
        }
        let mut roles = std::collections::BTreeMap::new();
        for hazard in hazards {
            if !self.object_ids.contains(&hazard.surface_id)
                || self.edible_ids.contains(&hazard.surface_id)
            {
                return Err(
                    "contact hazard must reference an existing nonedible object surface".into(),
                );
            }
            if roles.insert(hazard.surface_id, hazard.kind).is_some() {
                return Err("duplicate contact hazard surface ID".into());
            }
        }
        self.contact_hazards = roles;
        Ok(self)
    }
    pub fn with_exit_suction(mut self, suction: Option<ExitSuction>) -> Result<Self, String> {
        if let Some(suction) = suction {
            suction.validate()?;
        }
        self.exit_suction = suction;
        Ok(self)
    }
    /// Convergent pull toward a point just outside the exit, for a body in the
    /// exit room that can see the opening: the authored room speed everywhere in
    /// that room, rising to the near-door falloff within reach. Zero outside the
    /// room, so nothing steers a body across the house, and zero without sight of
    /// the opening, so nothing pulls through a wall or an obstacle.
    fn exit_suction_velocity(&self, position: Point) -> Point {
        let Some(suction) = self.exit_suction else {
            return Point::default();
        };
        let mid = self.exit.midpoint();
        let inside = Point {
            x: mid.x - self.exit.outward.x * 1e-5,
            z: mid.z - self.exit.outward.z * 1e-5,
        };
        if self.geometry.room_at(position) != self.geometry.room_at(inside)
            || !self.geometry.line_of_sight(position, mid)
        {
            return Point::default();
        }
        let distance = position.distance(mid);
        let near_door = if distance < suction.reach {
            suction.speed * (1. - distance / suction.reach)
        } else {
            0.
        };
        let speed = near_door.max(suction.room_speed);
        let dx = mid.x + self.exit.outward.x * EXIT_SUCTION_TARGET_OFFSET - position.x;
        let dz = mid.z + self.exit.outward.z * EXIT_SUCTION_TARGET_OFFSET - position.z;
        let length = dx.hypot(dz);
        if speed == 0. || length == 0. {
            return Point::default();
        }
        Point {
            x: speed * dx / length,
            z: speed * dz / length,
        }
    }
    fn contact_hazard_at(&self, state: &BodyState) -> Result<Option<ContactHazardKind>, String> {
        if let Some(kind) = state.support.and_then(|id| self.contact_hazards.get(&id)) {
            return Ok(Some(*kind));
        }
        Ok(self
            .surfaces
            .touching_hull(
                self.hull,
                [state.pose.position.x, state.height, state.pose.position.z],
                state.rotation,
                |id| self.contact_hazards.contains_key(&id),
            )?
            .and_then(|id| self.contact_hazards.get(&id).copied()))
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
        let mid = exit.midpoint();
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
            .surfaces
            .touching_hull(
                self.hull,
                [state.pose.position.x, state.height, state.pose.position.z],
                state.rotation,
                |id| self.edible_ids.contains(&id),
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
    pub fn new(pose: BodyPose, config: BodyConfig) -> Result<Self, String> {
        let reserve = config.life.reserve();
        let mut values = vec![
            config.body_radius,
            config.walk_speed,
            config.flight_speed,
            config.turn_gain,
            config.takeoff_threshold,
            config.landing_threshold,
            config.proboscis_threshold,
            config.landing_dwell_seconds,
        ];
        if let Some(model) = reserve {
            values.extend([
                model.initial,
                model.capacity,
                model.idle_cost,
                model.walking_cost,
                model.flying_cost,
                model.feeding_rate,
                model.max_bout_seconds,
            ]);
        }
        if values.iter().any(|v| !v.is_finite() || *v < 0.)
            || config.proboscis_threshold == 0.
            || config.takeoff_threshold == 0.
            || config.landing_threshold == 0.
            || reserve.is_some_and(|model| {
                model.capacity == 0.
                    || model.max_bout_seconds == 0.
                    || model.idle_cost == 0.
                    || model.walking_cost == 0.
                    || model.flying_cost == 0.
                    || model.initial > model.capacity
            })
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
                reserve: reserve.map_or(0., |model| model.initial),
                outcome: None,
            },
            config,
            bout_seconds: 0.,
            feeding_ready: true,
            last_tick: None,
            ground_dwell_remaining: 0.,
        })
    }
    pub fn new_in_mode(pose: BodyPose, config: BodyConfig, mode: BodyMode) -> Result<Self, String> {
        if !matches!(mode, BodyMode::Walking | BodyMode::Flying) {
            return Err("initial body mode must be walking or flying".into());
        }
        let mut body = Self::new(pose, config)?;
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
        let native = world.contact_hazard_at(&self.state)?;
        let diagnostic = world
            .zappers
            .iter()
            .any(|r| contact(self.state.pose.position, *r, self.config.body_radius));
        Ok(BodyContacts {
            contact_hazard: if diagnostic {
                Some(ContactHazardKind::Zapper)
            } else {
                native
            },
            food: matches!(self.state.mode, BodyMode::Walking | BodyMode::Feeding)
                && world.food_at(&self.state)?,
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
        // The reserve model is the only source of energy transitions; a timed round
        // neither spends nor gains, so no bout starts and nothing starves.
        let reserve = self.config.life.reserve();
        if reserve.is_some() && self.state.reserve <= 0. {
            self.terminal(TerminalOutcome::Starved, tick, &mut events);
            return Ok(BodyStep {
                events,
                motion: MotionTrace::stationary(&self.state),
            });
        }
        let contacts = self.contacts(world)?;
        if let Some(kind) = contacts.contact_hazard {
            self.terminal(kind.outcome(), tick, &mut events);
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
        // Only a body that can feed decodes the proboscis readout.
        let wants_food = reserve.is_some()
            && spike_fraction(neural, "proboscis") > self.config.proboscis_threshold;
        if reserve.is_some() {
            if self.state.mode != BodyMode::Feeding && !wants_food {
                self.feeding_ready = true;
            }
            if self.state.mode == BodyMode::Feeding && !contacts.food {
                self.end_feeding(FeedingEnd::ContactLost, tick, &mut events);
            }
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
        if let Some(model) = reserve {
            if self.state.mode == BodyMode::Walking
                && contacts.food
                && wants_food
                && self.feeding_ready
                && self.state.reserve < model.capacity
            {
                self.bout_seconds = 0.;
                self.mode(BodyMode::Feeding, tick, &mut events);
                events.push(BodyEvent {
                    tick,
                    kind: BodyEventKind::FeedingStarted,
                });
            }
        }
        let (thrust, turn, speed) = match self.state.mode {
            BodyMode::Flying | BodyMode::Landing => (
                neural.motor.flight_thrust,
                neural.motor.flight_turn,
                self.config.flight_speed,
            ),
            BodyMode::Walking => (
                neural.motor.thrust,
                neural.motor.turn,
                self.config.walk_speed,
            ),
            BodyMode::Feeding => (0., 0., 0.),
        };
        let cost = reserve.map_or(0., |model| match self.state.mode {
            BodyMode::Flying | BodyMode::Landing => model.flying_cost,
            BodyMode::Walking if neural.motor.thrust > 0. => model.walking_cost,
            BodyMode::Walking | BodyMode::Feeding => model.idle_cost,
        });
        // Authored doorway help joins the air the body already moves through, so
        // the swept step, contact and escape adjudication stay the same.
        let suction = world.exit_suction_velocity(self.state.pose.position);
        let desired = desired_pose(
            self.state.pose,
            Locomotion {
                thrust,
                turn,
                speed,
                turn_gain: self.config.turn_gain,
            },
            Point {
                x: wind.x + suction.x,
                z: wind.z + suction.z,
            },
            dt,
        );
        let mut trace = motion::advance(world, &self.state, desired, dt, self.config.body_radius)?;
        // A bout can end within a tick; it never restarts merely by touching food again.
        let mut feed_fraction = 0.;
        let mut feed_stops = false;
        let mut feed_end = FeedingEnd::ContactLost;
        if let (Some(model), BodyMode::Feeding) = (reserve, self.state.mode) {
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
            let bout = (model.max_bout_seconds - self.bout_seconds).max(0.) / dt;
            if bout <= feed_fraction {
                feed_fraction = bout;
                feed_stops = true;
                feed_end = FeedingEnd::BoutLimit;
            }
            let net = model.feeding_rate - cost;
            if net > 0. {
                let full = ((model.capacity - self.state.reserve) / (net * dt)).max(0.);
                if full <= feed_fraction {
                    feed_fraction = full;
                    feed_stops = true;
                    feed_end = FeedingEnd::Satiated;
                }
            }
        }
        trace.coalesce_free();
        let feed_seconds = feed_fraction * dt;
        let mut terminal = trace.contact_hazard.map(|(t, kind)| (t, kind.outcome()));
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
        let starved = reserve.and_then(|model| {
            let feeding_loss = (cost - model.feeding_rate) * feed_seconds;
            let after_feed = self.state.reserve - feeding_loss;
            if feeding_loss > 0. && self.state.reserve <= feeding_loss {
                Some(self.state.reserve / ((cost - model.feeding_rate) * dt))
            } else if cost > 0. && after_feed <= cost * (dt - feed_seconds) {
                Some(feed_fraction + after_feed / (cost * dt))
            } else {
                None
            }
        });
        if let Some(t) = starved {
            if terminal.is_none_or(|(prior, _)| t <= prior) {
                terminal = Some((t, TerminalOutcome::Starved));
            }
        }
        let fraction = terminal.map_or(1., |(t, _)| t);
        let reached = trace.at(fraction)?;
        reached.apply(&mut self.state);
        let actual_feed = dt * fraction.min(feed_fraction);
        if let Some(model) = reserve {
            self.state.reserve = (self.state.reserve + model.feeding_rate * actual_feed
                - cost * dt * fraction)
                .clamp(0., model.capacity);
        }
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
        } else if reserve.is_some() && self.state.reserve <= 0. {
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
    pub caught: u32,
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
            Some(TerminalOutcome::Caught) => summary.caught += 1,
            Some(TerminalOutcome::TimedOut) => summary.timed_out += 1,
            None => {}
        }
    }
    summary
}

#[cfg(test)]
mod motion_consumer;

#[cfg(test)]
mod contact_hazards;
