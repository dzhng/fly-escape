//! A small neural observation fixture. It has no escape target or scored outcomes.
use crate::environment::*;
use crate::sensory::{cue_currents, CuePathway};
use crate::{Brain, Graph, Group, GroupLink, StepOutput, PRNG_ID};
use serde::Serialize;
use std::sync::Arc;
use ts_rs::TS;

pub fn chamber_geometry() -> Geometry {
    let p = |x, z| Point { x, z };
    Geometry {
        rooms: vec![RectRoom {
            id: 0,
            min: p(-6., -6.),
            max: p(6., 6.),
        }],
        walls: vec![
            Wall {
                a: p(-6., -6.),
                b: p(6., -6.),
            },
            Wall {
                a: p(6., -6.),
                b: p(6., 6.),
            },
            Wall {
                a: p(6., 6.),
                b: p(-6., 6.),
            },
            Wall {
                a: p(-6., 6.),
                b: p(-6., -6.),
            },
        ],
    }
}

#[derive(Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Pose {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub heading: f64,
}

#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct BrainFrame {
    pub tick: u32,
    pub pose: Pose,
    pub neural: StepOutput,
    pub sensory: SensorySample,
    pub sensory_pose: Pose,
}

#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct BrainInfo {
    pub neuron_count: u32,
    pub edge_count: u32,
    pub graph_hash: String,
    pub graph_bytes: u32,
    pub geometry: Geometry,
    pub antenna_offset: f64,
    pub initial_pose: Pose,
    pub groups: Vec<Group>,
    pub group_links: Vec<GroupLink>,
    pub prng_id: String,
}

pub struct Chamber {
    graph: Arc<Graph>,
    pub brain: Brain,
    tick: u32,
    pose: Pose,
    pub fields: FieldSet,
    cue: Option<(CuePathway, f64)>,
}

impl Chamber {
    pub fn new(graph: Arc<Graph>, seed: u64) -> Result<Self, String> {
        let fields = FieldSet::new(chamber_geometry(), FieldConfig::default(), vec![], None)?;
        Ok(Self::with_fields(graph, seed, fields, None))
    }

    pub fn with_fields(
        graph: Arc<Graph>,
        seed: u64,
        fields: FieldSet,
        cue: Option<(CuePathway, f64)>,
    ) -> Self {
        Self {
            fields,
            cue,
            brain: Brain::new(graph.clone(), seed),
            graph,
            tick: 0,
            pose: Pose {
                x: -2.0,
                y: 0.2,
                z: 0.0,
                heading: 0.0,
            },
        }
    }

    pub fn info(&self) -> BrainInfo {
        BrainInfo {
            neuron_count: self.graph.neuron_count() as u32,
            edge_count: self.graph.edge_count() as u32,
            graph_hash: self.graph.manifest.graph_hash.clone(),
            graph_bytes: self.graph.storage_bytes() as u32,
            geometry: self.fields.geometry().clone(),
            antenna_offset: self.fields.antenna_offset(),
            initial_pose: self.pose.clone(),
            groups: self.graph.manifest.groups.clone(),
            group_links: self.graph.manifest.group_links.clone(),
            prng_id: PRNG_ID.into(),
        }
    }

    pub fn inject_odor(&mut self, left: f64, right: f64) -> Result<(), String> {
        self.brain
            .set_external_current(&crate::sensory::group_currents(
                &self.graph,
                ["odorExcL", "odorExcR"],
                [left, right],
            )?)
    }

    pub fn step(&mut self) -> Result<BrainFrame, String> {
        self.fields.advance(0.1)?;
        let sensory_pose = self.pose.clone();
        let sensory = self.fields.sample(
            Point {
                x: self.pose.x,
                z: self.pose.z,
            },
            self.pose.heading,
            self.tick,
        );
        if let Some((pathway, gain)) = self.cue {
            self.brain.set_external_current(&cue_currents(
                &self.graph,
                &sensory,
                pathway,
                gain,
            )?)?;
        }
        let neural = self.brain.step();
        self.tick += 1;
        self.pose.heading =
            (self.pose.heading + neural.motor.turn * 0.8).rem_euclid(std::f64::consts::TAU);
        let distance = neural.motor.thrust * 0.012;
        let from = Point {
            x: self.pose.x,
            z: self.pose.z,
        };
        let next = self.fields.geometry().sweep(
            from,
            Point {
                x: from.x + self.pose.heading.cos() * distance + sensory.wind.x * 0.1,
                z: from.z + self.pose.heading.sin() * distance + sensory.wind.z * 0.1,
            },
            0.5,
        );
        self.pose.x = next.x;
        self.pose.z = next.z;
        Ok(BrainFrame {
            tick: self.tick,
            pose: self.pose.clone(),
            neural,
            sensory,
            sensory_pose,
        })
    }
}
