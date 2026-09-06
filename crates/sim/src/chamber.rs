//! A small neural observation fixture. It has no escape target or scored outcomes.
use crate::{Brain, Graph, Group, GroupLink, StepOutput, PRNG_ID};
use serde::Serialize;
use std::sync::Arc;
use ts_rs::TS;

pub const CHAMBER_SIZE: f64 = 12.0;

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
}

#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct BrainInfo {
    pub neuron_count: u32,
    pub edge_count: u32,
    pub graph_hash: String,
    pub graph_bytes: u32,
    pub chamber_size: f64,
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
}

impl Chamber {
    pub fn new(graph: Arc<Graph>, seed: u64) -> Self {
        Self {
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
            chamber_size: CHAMBER_SIZE,
            initial_pose: self.pose.clone(),
            groups: self.graph.manifest.groups.clone(),
            group_links: self.graph.manifest.group_links.clone(),
            prng_id: PRNG_ID.into(),
        }
    }

    pub fn step(&mut self) -> BrainFrame {
        let neural = self.brain.step();
        self.tick += 1;
        self.pose.heading =
            (self.pose.heading + neural.motor.turn * 0.1).rem_euclid(std::f64::consts::TAU);
        let distance = neural.motor.thrust * 0.12;
        // Contact stops penetration; it does not choose a new direction for the brain.
        self.pose.x = (self.pose.x + self.pose.heading.cos() * distance)
            .clamp(-CHAMBER_SIZE / 2.0 + 0.5, CHAMBER_SIZE / 2.0 - 0.5);
        self.pose.z = (self.pose.z + self.pose.heading.sin() * distance)
            .clamp(-CHAMBER_SIZE / 2.0 + 0.5, CHAMBER_SIZE / 2.0 - 0.5);
        BrainFrame {
            tick: self.tick,
            pose: self.pose.clone(),
            neural,
        }
    }
}
