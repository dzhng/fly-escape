//! Deterministic, f64 connectome dynamics. One immutable graph is shared by brains.
mod graph;
mod lif;
pub use graph::*;
pub use lif::*;

pub mod chamber;
