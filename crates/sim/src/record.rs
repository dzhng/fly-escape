//! Fixed-width replay records. Numeric precision and absent terminal samples are
//! preserved; the layout exported with attempt metadata owns every wire offset.
use crate::{attempt::*, body::*, environment::*, GroupActivity, MotorOutput, StepOutput};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
mod motion;
pub use motion::sample_motion;

#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ChunkHeader {
    pub schema_version: u32,
    pub attempt_id: String,
    pub sequence: u32,
    pub start_tick: u32,
    pub tick_count: u32,
    pub fly_count: u32,
    pub result: Option<AttemptResult>,
}

pub const RECORD_SCHEMA_VERSION: u32 = 5;
pub const MAX_CHUNK_TICKS: u32 = 10;
pub const ARCHIVE_CAP_BYTES: u64 = 128 * 1024 * 1024;
// Landing, starting/ending feeding and termination emit at most six events.
// Eight slots keep the archive bound conservative; larger output is an error.
pub const MAX_EVENTS_PER_FLY_TICK: usize = 8;
pub const NO_SUPPORT: u32 = u32::MAX;
const STATE_STRIDE: usize = 5;
const VALUE_FIELDS: [&str; 44] = [
    "inputX",
    "inputZ",
    "inputHeading",
    "x",
    "z",
    "heading",
    "reserve",
    "thrust",
    "turn",
    "flightThrust",
    "flightTurn",
    "leftAttractiveOdor",
    "leftRepellentOdor",
    "leftBrightness",
    "leftShade",
    "leftExitCue",
    "rightAttractiveOdor",
    "rightRepellentOdor",
    "rightBrightness",
    "rightShade",
    "rightExitCue",
    "windX",
    "windZ",
    "height",
    "rotationX",
    "rotationY",
    "rotationZ",
    "rotationW",
    "visionBrightness0",
    "visionBrightness1",
    "visionBrightness2",
    "visionBrightness3",
    "visionBrightness4",
    "visionBrightness5",
    "visionBrightness6",
    "visionBrightness7",
    "visionBlocked0",
    "visionBlocked1",
    "visionBlocked2",
    "visionBlocked3",
    "visionBlocked4",
    "visionBlocked5",
    "visionBlocked6",
    "visionBlocked7",
];

#[derive(Clone, Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RecordLayout {
    schema_version: u32,
    no_support: u32,
    value_fields: Vec<String>,
    motion_value_fields: Vec<String>,
    motion_state_fields: Vec<String>,
    motion_sample_fields: Vec<String>,
    max_motion_points: u32,
    state_fields: Vec<String>,
    event_fields: Vec<String>,
    group_ids: Vec<String>,
    group_fields: Vec<String>,
    modes: Vec<BodyMode>,
    outcomes: Vec<Option<TerminalOutcome>>,
    feeding_ends: Vec<FeedingEnd>,
    event_kinds: Vec<String>,
    sensory_present_mask: u32,
    neural_present_mask: u32,
    max_chunk_ticks: u32,
    max_events_per_fly_tick: u32,
}
impl RecordLayout {
    pub fn new(group_ids: Vec<String>) -> Result<Self, String> {
        if group_ids.len() > 16
            || group_ids
                .iter()
                .enumerate()
                .any(|(i, g)| g.is_empty() || g.len() > 256 || group_ids[..i].contains(g))
        {
            return Err(
                "record requires at most 16 unique, nonempty group IDs of at most 256 bytes".into(),
            );
        }
        Ok(Self {
            schema_version: RECORD_SCHEMA_VERSION,
            no_support: NO_SUPPORT,
            value_fields: VALUE_FIELDS.map(String::from).to_vec(),
            motion_value_fields: motion::VALUE_FIELDS.map(String::from).to_vec(),
            motion_state_fields: motion::STATE_FIELDS.map(String::from).to_vec(),
            motion_sample_fields: motion::SAMPLE_FIELDS.map(String::from).to_vec(),
            max_motion_points: MAX_MOTION_POINTS as u32,
            state_fields: ["mode", "outcome", "presence", "spikeCount", "support"]
                .map(String::from)
                .to_vec(),
            event_fields: ["tick", "flyId", "kind", "arg0", "arg1"]
                .map(String::from)
                .to_vec(),
            group_ids,
            group_fields: ["meanVoltage", "spikeFraction"].map(String::from).to_vec(),
            modes: vec![
                BodyMode::Walking,
                BodyMode::Flying,
                BodyMode::Feeding,
                BodyMode::Landing,
            ],
            outcomes: vec![
                None,
                Some(TerminalOutcome::Escaped),
                Some(TerminalOutcome::Starved),
                Some(TerminalOutcome::Zapped),
                Some(TerminalOutcome::TimedOut),
                Some(TerminalOutcome::Caught),
            ],
            feeding_ends: vec![
                FeedingEnd::ContactLost,
                FeedingEnd::Satiated,
                FeedingEnd::BoutLimit,
                FeedingEnd::Terminal,
            ],
            event_kinds: ["modeChanged", "feedingStarted", "feedingEnded", "terminal"]
                .map(String::from)
                .to_vec(),
            sensory_present_mask: 1,
            neural_present_mask: 2,
            max_chunk_ticks: MAX_CHUNK_TICKS,
            max_events_per_fly_tick: MAX_EVENTS_PER_FLY_TICK as u32,
        })
    }
    pub fn value_stride(&self) -> usize {
        VALUE_FIELDS.len() + self.group_ids.len() * 2
    }
    /// Reserves fixed records plus bounded motion storage, capped at the archive quota.
    /// The producer and consumer enforce cumulative bytes; a variable-motion overflow
    /// is explicit, never history truncation. Includes worst-case events and a 1 KiB envelope allowance per chunk,
    /// even if the producer sends one tick per chunk, plus 16 KiB record-layout/result metadata. Graph metadata is shared
    /// with the graph and accounted separately in total runtime memory.
    pub fn archive_bytes(&self, fly_count: u32, ticks: u32) -> Result<u64, String> {
        if !(1..=100).contains(&fly_count)
            || !(1..=6000).contains(&ticks)
            || self.group_ids.len() > 16
        {
            return Err(
                "record horizon requires 1..100 flies, 1..6000 ticks and at most 16 groups".into(),
            );
        }
        let bytes = u64::from(ticks)
            * (u64::from(fly_count)
                * (self.value_stride() as u64 * 8
                    + STATE_STRIDE as u64 * 4
                    + MAX_EVENTS_PER_FLY_TICK as u64 * 20)
                + 4
                + 1024)
            + 16384;
        if bytes > ARCHIVE_CAP_BYTES {
            return Err(format!(
                "record archive requires {bytes} bytes, exceeding {ARCHIVE_CAP_BYTES}"
            ));
        }
        let motion = u64::from(ticks)
            * u64::from(fly_count)
            * (MAX_MOTION_POINTS as u64 * motion::POINT_BYTES + 4)
            + u64::from(ticks) * 4;
        Ok((bytes + motion).min(ARCHIVE_CAP_BYTES))
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct PackedChunk {
    pub schema_version: u32,
    pub attempt_id: String,
    pub sequence: u32,
    pub start_tick: u32,
    pub tick_count: u32,
    pub fly_count: u32,
    pub motion_offsets: Vec<u32>,
    pub motion_values: Vec<f64>,
    pub motion_states: Vec<u32>,
    pub values: Vec<f64>,
    pub states: Vec<u32>,
    pub events: Vec<u32>,
    pub tick_neural_steps: Vec<u32>,
    pub result: Option<AttemptResult>,
}
impl PackedChunk {
    pub fn encode(
        attempt_id: &str,
        sequence: u32,
        layout: &RecordLayout,
        frames: &[AttemptFrame],
    ) -> Result<Self, String> {
        let first = frames.first().ok_or("empty frame chunk")?;
        let count = frames.len();
        if attempt_id.is_empty()
            || attempt_id.len() > 256
            || count > MAX_CHUNK_TICKS as usize
            || first.tick == 0
            || first
                .tick
                .checked_add(count as u32 - 1)
                .is_none_or(|t| t > 6000)
        {
            return Err("invalid chunk identity or tick range".into());
        }
        layout.archive_bytes(first.flies.len() as u32, first.tick + count as u32 - 1)?;
        let mut chunk = Self {
            schema_version: RECORD_SCHEMA_VERSION,
            attempt_id: attempt_id.into(),
            sequence,
            start_tick: first.tick,
            tick_count: count as u32,
            fly_count: first.flies.len() as u32,
            motion_offsets: vec![0],
            motion_values: vec![],
            motion_states: vec![],
            values: Vec::with_capacity(count * first.flies.len() * layout.value_stride()),
            states: Vec::with_capacity(count * first.flies.len() * STATE_STRIDE),
            events: vec![],
            tick_neural_steps: Vec::with_capacity(count),
            result: None,
        };
        for (offset, frame) in frames.iter().enumerate() {
            if frame.tick != first.tick + offset as u32
                || frame.flies.len() != first.flies.len()
                || (frame.result.is_some() && offset + 1 != count)
            {
                return Err("noncontiguous frames or result before final tick".into());
            }
            chunk.tick_neural_steps.push(frame.neural_steps);
            for (id, fly) in frame.flies.iter().enumerate() {
                if fly.id != id as u32 || fly.events.len() > MAX_EVENTS_PER_FLY_TICK {
                    return Err("invalid fly ordering or event budget".into());
                }
                motion::encode(
                    &fly.motion,
                    &mut chunk.motion_values,
                    &mut chunk.motion_states,
                )?;
                chunk
                    .motion_offsets
                    .push((chunk.motion_values.len() / motion::VALUE_FIELDS.len()) as u32);
                let p = fly.input_pose;
                let b = &fly.body;
                let end = fly.motion.last().ok_or("missing motion endpoint")?;
                if end.pose != b.pose
                    || end.height != b.height
                    || end.rotation != b.rotation
                    || end.support != b.support
                {
                    return Err("motion endpoint differs from recorded body".into());
                }
                validate_support(b.support, b.rotation, b.mode)?;
                chunk.values.extend([
                    p.position.x,
                    p.position.z,
                    p.heading,
                    b.pose.position.x,
                    b.pose.position.z,
                    b.pose.heading,
                    b.reserve,
                ]);
                let motor = fly
                    .neural
                    .as_ref()
                    .map(|n| n.motor.clone())
                    .unwrap_or(MotorOutput {
                        thrust: 0.,
                        turn: 0.,
                        flight_thrust: 0.,
                        flight_turn: 0.,
                    });
                chunk.values.extend([
                    motor.thrust,
                    motor.turn,
                    motor.flight_thrust,
                    motor.flight_turn,
                ]);
                let sense = fly.sensory.unwrap_or(SensorySample {
                    vision: VisionSample::default(),
                    left: FieldSample::default(),
                    right: FieldSample::default(),
                    wind: Point { x: 0., z: 0. },
                });
                for side in [sense.left, sense.right] {
                    chunk.values.extend([
                        side.attractive_odor,
                        side.repellent_odor,
                        side.brightness,
                        side.shade,
                        side.exit_cue,
                    ]);
                }
                chunk.values.extend([sense.wind.x, sense.wind.z, b.height]);
                chunk.values.extend(b.rotation);
                chunk.values.extend(sense.vision.brightness);
                chunk.values.extend(sense.vision.blocked);
                if let Some(neural) = &fly.neural {
                    if neural
                        .groups
                        .iter()
                        .map(|g| &g.id)
                        .ne(layout.group_ids.iter())
                    {
                        return Err("neural groups differ from record metadata order".into());
                    }
                    for group in &neural.groups {
                        chunk
                            .values
                            .extend([group.mean_voltage, group.spike_fraction]);
                    }
                } else {
                    chunk
                        .values
                        .resize(chunk.values.len() + layout.group_ids.len() * 2, 0.);
                }
                chunk.states.extend([
                    code(&layout.modes, &b.mode)?,
                    code(&layout.outcomes, &b.outcome)?,
                    u32::from(fly.sensory.is_some()) | (u32::from(fly.neural.is_some()) * 2),
                    fly.neural.as_ref().map_or(0, |n| n.spike_count),
                    b.support.unwrap_or(NO_SUPPORT),
                ]);
                for event in &fly.events {
                    if event.tick != frame.tick {
                        return Err("event timestamp differs from its frame".into());
                    }
                    let (kind, a, b) = match event.kind {
                        BodyEventKind::ModeChanged { from, to } => {
                            (0, code(&layout.modes, &from)?, code(&layout.modes, &to)?)
                        }
                        BodyEventKind::FeedingStarted => (1, 0, 0),
                        BodyEventKind::FeedingEnded { reason } => {
                            (2, code(&layout.feeding_ends, &reason)?, 0)
                        }
                        BodyEventKind::Terminal { outcome } => {
                            (3, code(&layout.outcomes, &Some(outcome))?, 0)
                        }
                    };
                    chunk.events.extend([event.tick, id as u32, kind, a, b]);
                }
            }
            chunk.result = frame.result.clone();
        }
        if chunk.values.iter().any(|v| !v.is_finite()) {
            return Err("record contains nonfinite values".into());
        }
        if chunk.result.as_ref().is_some_and(|r| {
            r.attempt_id != attempt_id || r.completed_tick != first.tick + count as u32 - 1
        }) {
            return Err("result identity or timestamp mismatch".into());
        }
        Ok(chunk)
    }
    /// Native consumer oracle for the identical metadata-driven browser decoder.
    pub fn decode(&self, layout: &RecordLayout) -> Result<Vec<AttemptFrame>, String> {
        if self.schema_version != RECORD_SCHEMA_VERSION
            || self.tick_count == 0
            || self.tick_count > MAX_CHUNK_TICKS
            || self.start_tick == 0
            || self
                .start_tick
                .checked_add(self.tick_count - 1)
                .is_none_or(|t| t > 6000)
        {
            return Err("invalid chunk schema or range".into());
        }
        layout.archive_bytes(self.fly_count, self.start_tick + self.tick_count - 1)?;
        let records = self.tick_count as usize * self.fly_count as usize;
        if self.values.len() != records * layout.value_stride()
            || self.states.len() != records * STATE_STRIDE
            || self.tick_neural_steps.len() != self.tick_count as usize
            || !self.events.len().is_multiple_of(5)
            || self.events.len() > records * MAX_EVENTS_PER_FLY_TICK * 5
            || self.values.iter().any(|v| !v.is_finite())
        {
            return Err("invalid numeric buffer lengths or values".into());
        }
        motion::validate_offsets(
            &self.motion_offsets,
            &self.motion_values,
            &self.motion_states,
            records,
        )?;
        let mut frames = Vec::with_capacity(self.tick_count as usize);
        for tick in 0..self.tick_count as usize {
            let mut flies = Vec::with_capacity(self.fly_count as usize);
            for id in 0..self.fly_count as usize {
                let index = tick * self.fly_count as usize + id;
                let v = &self.values
                    [index * layout.value_stride()..(index + 1) * layout.value_stride()];
                let s = &self.states[index * STATE_STRIDE..(index + 1) * STATE_STRIDE];
                if s[2] > 3 {
                    return Err("invalid presence flags".into());
                }
                let support = (s[4] != NO_SUPPORT).then_some(s[4]);
                let rotation = [v[24], v[25], v[26], v[27]];
                validate_support(support, rotation, at(&layout.modes, s[0])?)?;
                let field = |i| FieldSample {
                    attractive_odor: v[i],
                    repellent_odor: v[i + 1],
                    brightness: v[i + 2],
                    shade: v[i + 3],
                    exit_cue: v[i + 4],
                };
                flies.push(FlyFrame {
                    id: id as u32,
                    input_pose: pose(v, 0),
                    body: BodyState {
                        support,
                        rotation,
                        height: v[23],
                        pose: pose(v, 3),
                        reserve: v[6],
                        mode: at(&layout.modes, s[0])?,
                        outcome: at(&layout.outcomes, s[1])?,
                    },
                    sensory: (s[2] & 1 != 0).then(|| SensorySample {
                        vision: VisionSample {
                            brightness: std::array::from_fn(|i| v[28 + i]),
                            blocked: std::array::from_fn(|i| v[36 + i]),
                        },
                        left: field(11),
                        right: field(16),
                        wind: Point { x: v[21], z: v[22] },
                    }),
                    neural: (s[2] & 2 != 0).then(|| StepOutput {
                        motor: MotorOutput {
                            thrust: v[7],
                            turn: v[8],
                            flight_thrust: v[9],
                            flight_turn: v[10],
                        },
                        spike_count: s[3],
                        groups: layout
                            .group_ids
                            .iter()
                            .enumerate()
                            .map(|(g, id)| GroupActivity {
                                id: id.clone(),
                                mean_voltage: v[VALUE_FIELDS.len() + g * 2],
                                spike_fraction: v[VALUE_FIELDS.len() + 1 + g * 2],
                            })
                            .collect(),
                    }),
                    motion: motion::decode(
                        &self.motion_values[self.motion_offsets[index] as usize
                            * motion::VALUE_FIELDS.len()
                            ..self.motion_offsets[index + 1] as usize * motion::VALUE_FIELDS.len()],
                        &self.motion_states[self.motion_offsets[index] as usize
                            * motion::STATE_FIELDS.len()
                            ..self.motion_offsets[index + 1] as usize * motion::STATE_FIELDS.len()],
                    )?,
                    events: vec![],
                });
            }
            frames.push(AttemptFrame {
                tick: self.start_tick + tick as u32,
                neural_steps: self.tick_neural_steps[tick],
                flies,
                result: None,
            });
        }
        for fly in frames.iter().flat_map(|frame| &frame.flies) {
            let end = fly.motion.last().ok_or("missing motion endpoint")?;
            if end.pose != fly.body.pose
                || end.height != fly.body.height
                || end.rotation != fly.body.rotation
                || end.support != fly.body.support
            {
                return Err("motion endpoint differs from recorded body".into());
            }
        }
        for e in self.events.chunks_exact(5) {
            let tick = e[0]
                .checked_sub(self.start_tick)
                .ok_or("event before chunk")? as usize;
            let fly = frames
                .get_mut(tick)
                .and_then(|f| f.flies.get_mut(e[1] as usize))
                .ok_or("event outside chunk")?;
            if fly.events.len() >= MAX_EVENTS_PER_FLY_TICK {
                return Err("event budget exceeded".into());
            }
            let kind = match e[2] {
                0 => BodyEventKind::ModeChanged {
                    from: at(&layout.modes, e[3])?,
                    to: at(&layout.modes, e[4])?,
                },
                1 if e[3] == 0 && e[4] == 0 => BodyEventKind::FeedingStarted,
                2 if e[4] == 0 => BodyEventKind::FeedingEnded {
                    reason: at(&layout.feeding_ends, e[3])?,
                },
                3 if e[4] == 0 => BodyEventKind::Terminal {
                    outcome: at(&layout.outcomes, e[3])?.ok_or("terminal event without outcome")?,
                },
                _ => return Err("invalid event code".into()),
            };
            fly.events.push(BodyEvent { tick: e[0], kind });
        }
        if self.attempt_id.is_empty()
            || self.attempt_id.len() > 256
            || self.result.as_ref().is_some_and(|r| {
                r.attempt_id != self.attempt_id
                    || r.completed_tick != self.start_tick + self.tick_count - 1
            })
        {
            return Err("invalid attempt/result identity".into());
        }
        frames.last_mut().unwrap().result = self.result.clone();
        Ok(frames)
    }
}
fn code<T: PartialEq>(values: &[T], value: &T) -> Result<u32, String> {
    values
        .iter()
        .position(|v| v == value)
        .map(|i| i as u32)
        .ok_or("value missing from record codes".into())
}
fn at<T: Copy>(values: &[T], index: u32) -> Result<T, String> {
    values
        .get(index as usize)
        .copied()
        .ok_or("unknown record code".into())
}
fn pose(v: &[f64], i: usize) -> BodyPose {
    BodyPose {
        position: Point {
            x: v[i],
            z: v[i + 1],
        },
        heading: v[i + 2],
    }
}

fn validate_support(
    support: Option<u32>,
    rotation: [f64; 4],
    mode: BodyMode,
) -> Result<(), String> {
    if support == Some(NO_SUPPORT)
        || (support.is_some() && matches!(mode, BodyMode::Flying | BodyMode::Landing))
        || rotation.iter().any(|v| !v.is_finite())
        || (rotation.iter().map(|v| v * v).sum::<f64>() - 1.).abs() > 1e-8
    {
        return Err("invalid recorded support or rotation".into());
    }
    Ok(())
}
