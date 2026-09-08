//! Bounded native composition of the shared field, neural and body owners.
//! Immutable authored content and placements resolve through the placement owner
//! before the shared field, neural and body state is allocated.
use crate::{
    body::*,
    environment::*,
    food::FoodDef,
    placement::{resolve_placements, Placement, PlacementRules, ResolvedSetup},
    record::RecordLayout,
    sensory::{cue_currents, motor_readout_indices, CuePathway},
    Brain, Graph, Group, GroupLink, LifParams, StepOutput,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{collections::BTreeMap, sync::Arc};
use ts_rs::TS;

#[derive(Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct StartAttempt {
    pub attempt_id: String,
    pub root_seed: String,
    pub fly_count: u32,
    pub level: LevelDef,
    pub tuning: AttemptTuning,
    pub placements: Vec<Placement>,
}
#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct AttemptInfo {
    pub spec: AttemptSpec,
    pub level: LevelDef,
    pub resolved_setup: ResolvedSetup,
    pub initial_bodies: Vec<BodyState>,
    pub initial_sensory_points: Vec<[Point; 2]>,
    pub groups: Vec<Group>,
    pub group_links: Vec<GroupLink>,
    pub record_layout: RecordLayout,
    pub archive_bytes: u32,
    pub graph_bytes: u32,
    pub brain_state_bytes: u32,
}
#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct AttemptStep {
    pub tick: u32,
    pub neural_steps: u32,
    pub buffered_ticks: u32,
    pub complete: bool,
}

pub const GAME_TICK_SECONDS: f64 = 0.1;
pub const SIMULATION_BUILD_ID: &str = env!("SIM_BUILD_ID");
#[derive(Clone, Debug, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct LevelDef {
    pub id: String,
    pub geometry: Geometry,
    pub spawn: crate::spawn::SpawnDef,
    pub exit: ExitOpening,
    pub exit_cue: Option<ExitCue>,
    /// Optional physical help through the doorway; absent levels get none and
    /// keep the identity they had before the setting existed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional = nullable)]
    pub exit_suction: Option<ExitSuction>,
    pub food: Vec<FoodDef>,
    pub fixed_objects: Vec<Placement>,
    pub zappers: Vec<ContactRegion>,
    pub sources: Vec<Source>,
    pub field_config: FieldConfig,
    pub body_config: BodyConfig,
    pub duration_ticks: u32,
    pub star_thresholds: [u32; 3],
    pub placement_rules: PlacementRules,
}
#[derive(Clone, Debug, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CueInput {
    pub pathway: CuePathway,
    pub gain: f64,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct AttemptTuning {
    pub cues: Vec<CueInput>,
    pub taste_gain: f64,
    /// Experimental ablation, fixed for the complete attempt and included in its identity.
    #[serde(default)]
    pub silenced_neurons: Vec<u32>,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct AttemptSpec {
    pub schema_version: u32,
    pub attempt_id: String,
    pub graph_hash: String,
    pub graph_manifest_hash: String,
    pub simulation_build_id: String,
    pub tuning_hash: String,
    pub placements: Vec<Placement>,
    pub level_hash: String,
    pub level_id: String,
    /// Decimal u64 wire value; JavaScript numbers cannot represent every seed.
    pub root_seed: String,
    pub fly_count: u32,
    pub duration_ticks: u32,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct FlyFrame {
    pub id: u32,
    pub input_pose: BodyPose,
    pub sensory: Option<SensorySample>,
    pub neural: Option<StepOutput>,
    pub body: BodyState,
    pub events: Vec<BodyEvent>,
    #[serde(skip)]
    #[ts(skip)]
    pub motion: Vec<MotionPoint>,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct AttemptResult {
    pub attempt_id: String,
    pub completed_tick: u32,
    pub outcomes: OutcomeSummary,
    pub stars: u32,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct AttemptFrame {
    pub tick: u32,
    pub neural_steps: u32,
    pub flies: Vec<FlyFrame>,
    pub result: Option<AttemptResult>,
}
struct Fly {
    brain: Brain,
    body: Body,
}
pub struct Attempt {
    graph: Arc<Graph>,
    level: LevelDef,
    tuning: AttemptTuning,
    spec: AttemptSpec,
    fields: FieldSet,
    world: BodyWorld,
    flies: Vec<Fly>,
    taste_indices: Vec<u32>,
    setup: ResolvedSetup,
    tick: u32,
    neural_steps: u32,
    result: Option<AttemptResult>,
    failure: Option<String>,
    initial_bodies: Vec<BodyState>,
}
impl Attempt {
    /// Describe content without allocating neural state. Constructor compares all
    /// identities again before accepting the immutable content and root seed.
    pub fn describe(
        graph: &Graph,
        level: &LevelDef,
        tuning: &AttemptTuning,
        attempt_id: &str,
        root_seed: u64,
        fly_count: u32,
        placements: &[Placement],
    ) -> Result<AttemptSpec, String> {
        validate_description(level, tuning, attempt_id, fly_count)?;
        crate::spawn::resolve(level, root_seed, fly_count)?;
        let resolved = resolve_placements(level, placements)?;
        if tuning.silenced_neurons.len() > graph.neuron_count()
            || tuning
                .silenced_neurons
                .iter()
                .any(|&i| i as usize >= graph.neuron_count())
        {
            return Err("silenced neuron index out of graph bounds".into());
        }
        Ok(AttemptSpec {
            schema_version: 1,
            attempt_id: attempt_id.into(),
            graph_hash: graph.manifest.graph_hash.clone(),
            graph_manifest_hash: canonical_hash(&graph.manifest)?,
            simulation_build_id: SIMULATION_BUILD_ID.into(),
            tuning_hash: canonical_hash(&(tuning, LifParams::default()))?,
            placements: resolved.state.placements,
            level_hash: canonical_hash(level)?,
            level_id: level.id.clone(),
            root_seed: root_seed.to_string(),
            fly_count,
            duration_ticks: level.duration_ticks,
        })
    }
    pub fn new(
        graph: Arc<Graph>,
        level: LevelDef,
        tuning: AttemptTuning,
        spec: AttemptSpec,
    ) -> Result<Self, String> {
        let seed = spec
            .root_seed
            .parse::<u64>()
            .map_err(|_| "root seed must be a canonical decimal u64")?;
        let expected = Self::describe(
            &graph,
            &level,
            &tuning,
            &spec.attempt_id,
            seed,
            spec.fly_count,
            &spec.placements,
        )?;
        if spec != expected {
            return Err("attempt identity mismatch: graph, build, tuning, resolved level, seed or horizon differs".into());
        }
        let resolved = resolve_placements(&level, &spec.placements)?;
        let world = BodyWorld::new(
            &level.geometry,
            &resolved.state.food,
            &resolved.state.objects,
            &level.zappers,
            level.exit,
            level.duration_ticks,
        )?
        .with_contact_hazards(&resolved.state.contact_hazards)?
        .with_exit_suction(level.exit_suction)?;
        let fields = FieldSet::new(
            level.geometry.clone(),
            resolved.field_config.clone(),
            resolved.sources.clone(),
            level.exit_cue.clone(),
        )?;
        let motor_readouts = motor_readout_indices(&graph);
        let taste_indices = if tuning.taste_gain > 0. {
            let group = graph
                .manifest
                .groups
                .iter()
                .find(|g| g.id == "taste")
                .ok_or("taste gain requires an annotated taste group")?;
            let indices: Vec<_> = group
                .indices
                .iter()
                .copied()
                .filter(|i| !motor_readouts.contains(i))
                .collect();
            if indices.is_empty() {
                return Err("taste group has no neurons outside motor readouts".into());
            }
            indices
        } else {
            vec![]
        };
        let initial_bodies = crate::spawn::resolve(&level, seed, spec.fly_count)?;
        for cue in &tuning.cues {
            let probe = fields.sample(
                initial_bodies[0].pose.position,
                initial_bodies[0].pose.heading,
                0,
            );
            let currents = cue_currents(&graph, &probe, cue.pathway, cue.gain)?;
            if cue.gain > 0. && currents.is_empty() {
                return Err("cue group has no neurons outside motor readouts".into());
            }
        }
        let flies = initial_bodies
            .iter()
            .enumerate()
            .map(|(id, initial)| {
                let mut brain = Brain::new(graph.clone(), Brain::seed_for_fly(seed, id as u32));
                brain.set_silenced_neurons(&tuning.silenced_neurons)?;
                Ok(Fly {
                    brain,
                    body: Body::new_in_mode(initial.pose, level.body_config.clone(), initial.mode)?,
                })
            })
            .collect::<Result<_, String>>()?;
        Ok(Self {
            graph,
            level,
            tuning,
            spec,
            fields,
            world,
            flies,
            taste_indices,
            setup: resolved,
            tick: 0,
            neural_steps: 0,
            result: None,
            failure: None,
            initial_bodies,
        })
    }
    /// Allocated numeric neural state for every fly, including fixed ablation masks.
    pub fn brain_state_bytes(&self) -> usize {
        self.flies
            .iter()
            .map(|fly| fly.brain.state_storage_bytes())
            .sum()
    }
    pub fn initial_bodies(&self) -> Vec<BodyState> {
        self.initial_bodies.clone()
    }
    pub fn initial_sensory_points(&self) -> Vec<[Point; 2]> {
        self.initial_bodies
            .iter()
            .map(|body| {
                self.fields
                    .sample_points(body.pose.position, body.pose.heading)
            })
            .collect()
    }
    pub fn spec(&self) -> &AttemptSpec {
        &self.spec
    }
    pub fn level(&self) -> &LevelDef {
        &self.level
    }
    pub fn result(&self) -> Option<&AttemptResult> {
        self.result.as_ref()
    }
    pub fn resolved_setup(&self) -> &ResolvedSetup {
        &self.setup
    }
    pub fn field_grid(&self) -> FieldGrid {
        self.fields.export_grid()
    }
    /// No internal episode loop. A failed tick is fatal to this attempt; callers
    /// report the error rather than retrying partially advanced neural states.
    pub fn step(&mut self) -> Result<Option<AttemptFrame>, String> {
        if let Some(error) = &self.failure {
            return Err(error.clone());
        }
        if self.result.is_some() {
            return Ok(None);
        }
        match self.advance_tick() {
            Ok(frame) => Ok(Some(frame)),
            Err(error) => {
                self.failure = Some(error.clone());
                Err(error)
            }
        }
    }
    fn advance_tick(&mut self) -> Result<AttemptFrame, String> {
        self.fields.advance(GAME_TICK_SECONDS)?;
        self.tick += 1;
        let world = &self.world;
        let mut frames = Vec::with_capacity(self.flies.len());
        for (id, fly) in self.flies.iter_mut().enumerate() {
            let input_pose = fly.body.state().pose;
            let (sensory, neural, events, motion) = if fly.body.state().outcome.is_some() {
                (
                    None,
                    None,
                    vec![],
                    MotionTrace::stationary(fly.body.state()).points,
                )
            } else {
                let sample = self
                    .fields
                    .sample(input_pose.position, input_pose.heading, self.tick);
                let mut currents = BTreeMap::<u32, f64>::new();
                for cue in &self.tuning.cues {
                    for (index, value) in cue_currents(&self.graph, &sample, cue.pathway, cue.gain)?
                    {
                        *currents.entry(index).or_default() += value;
                    }
                }
                if fly.body.contacts(world)?.food {
                    for &index in &self.taste_indices {
                        *currents.entry(index).or_default() += self.tuning.taste_gain;
                    }
                }
                fly.brain
                    .set_external_current(&currents.into_iter().collect::<Vec<_>>())?;
                let output = fly.brain.step();
                self.neural_steps += 1;
                let step =
                    fly.body
                        .step(&output, world, sample.wind, GAME_TICK_SECONDS, self.tick)?;
                (Some(sample), Some(output), step.events, step.motion.points)
            };
            frames.push(FlyFrame {
                id: id as u32,
                input_pose,
                sensory,
                neural,
                body: fly.body.state().clone(),
                events,
                motion,
            });
        }
        if self
            .flies
            .iter()
            .all(|fly| fly.body.state().outcome.is_some())
            && (self.level.body_config.life != LifeModel::Timed
                || self.tick >= self.level.duration_ticks
                || self
                    .flies
                    .iter()
                    .all(|fly| fly.body.state().outcome == Some(TerminalOutcome::Escaped)))
        {
            let states: Vec<_> = self.flies.iter().map(|f| f.body.state().clone()).collect();
            let outcomes = summarize_outcomes(&states);
            let stars = self
                .level
                .star_thresholds
                .iter()
                .filter(|&&threshold| outcomes.escaped >= threshold)
                .count() as u32;
            self.result = Some(AttemptResult {
                attempt_id: self.spec.attempt_id.clone(),
                completed_tick: self.tick,
                outcomes,
                stars,
            });
        }
        Ok(AttemptFrame {
            tick: self.tick,
            neural_steps: self.neural_steps,
            flies: frames,
            result: self.result.clone(),
        })
    }
}
fn validate_description(
    level: &LevelDef,
    tuning: &AttemptTuning,
    attempt_id: &str,
    fly_count: u32,
) -> Result<(), String> {
    if attempt_id.is_empty()
        || attempt_id.len() > 256
        || level.id.is_empty()
        || level.id.len() > 256
    {
        return Err("attempt and level IDs require 1..256 bytes".into());
    }
    crate::spawn::validate(level, fly_count)?;
    if tuning.cues.len() > 3
        || tuning.cues.iter().enumerate().any(|(i, c)| {
            matches!(c.pathway, CuePathway::None)
                || tuning.cues[..i]
                    .iter()
                    .any(|prior| prior.pathway == c.pathway)
        })
    {
        return Err(
            "attempt accepts each odor/vision pathway at most once; omit disabled pathways".into(),
        );
    }
    if !tuning.taste_gain.is_finite()
        || !(0. ..=3.).contains(&tuning.taste_gain)
        || tuning
            .cues
            .iter()
            .any(|c| !c.gain.is_finite() || !(0. ..=3.).contains(&c.gain))
    {
        return Err("attempt sensory gains must be between zero and three".into());
    }
    if level.star_thresholds[0] == 0
        || level.star_thresholds[2] > 100
        || !level.star_thresholds.windows(2).all(|v| v[0] < v[1])
    {
        return Err("star thresholds require three increasing escaped counts in 1..100".into());
    }
    BodyWorld::validate(
        &level.geometry,
        &level.zappers,
        level.exit,
        level.duration_ticks,
    )?;
    if let Some(suction) = level.exit_suction {
        suction.validate()?;
    }
    Ok(())
}
fn canonical_hash(value: &impl Serialize) -> Result<String, String> {
    let canonical = sorted_objects(
        serde_json::to_value(value).map_err(|e| format!("serialize attempt identity: {e}"))?,
    );
    let bytes =
        serde_json::to_vec(&canonical).map_err(|e| format!("encode attempt identity: {e}"))?;
    Ok(format!("{:x}", Sha256::digest(bytes)))
}

fn sorted_objects(value: serde_json::Value) -> serde_json::Value {
    match value {
        serde_json::Value::Object(values) => {
            let mut entries: Vec<_> = values.into_iter().collect();
            entries.sort_by(|a, b| a.0.cmp(&b.0));
            serde_json::Value::Object(
                entries
                    .into_iter()
                    .map(|(key, value)| (key, sorted_objects(value)))
                    .collect(),
            )
        }
        serde_json::Value::Array(values) => {
            serde_json::Value::Array(values.into_iter().map(sorted_objects).collect())
        }
        scalar => scalar,
    }
}
