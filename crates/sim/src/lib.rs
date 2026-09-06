//! Deterministic, f64 connectome dynamics. One immutable graph is shared by brains.
mod graph;
mod lif;
pub use graph::*;
pub use lif::*;

pub mod chamber;

pub mod body;
pub mod environment;
pub mod field_lab;
pub mod sensory;

pub mod attempt;

pub mod lifecycle_lab;
pub mod record;

pub mod swarm_lab;
