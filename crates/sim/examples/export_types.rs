use sim::chamber::{BrainFrame, BrainInfo, Pose};
use sim::environment::*;
use sim::field_lab::{FieldLabFrame, FieldLabInfo, FieldScenario};
use sim::sensory::CuePathway;
use sim::{Group, GroupActivity, GroupLink, MotorOutput, StepOutput};
use ts_rs::TS;
fn main() {
    println!("// Generated from crates/sim; do not edit.\n");
    for declaration in [
        FieldScenario::decl(),
        FieldLabInfo::decl(),
        FieldLabFrame::decl(),
        Point::decl(),
        RectRoom::decl(),
        Wall::decl(),
        Geometry::decl(),
        FieldConfig::decl(),
        SourceKind::decl(),
        Source::decl(),
        ExitCue::decl(),
        FieldSample::decl(),
        SensorySample::decl(),
        FieldGrid::decl(),
        CuePathway::decl(),
        Group::decl(),
        GroupLink::decl(),
        MotorOutput::decl(),
        GroupActivity::decl(),
        StepOutput::decl(),
        Pose::decl(),
        BrainFrame::decl(),
        BrainInfo::decl(),
    ] {
        println!(
            "export {}",
            declaration
                .lines()
                .map(str::trim_end)
                .collect::<Vec<_>>()
                .join("\n")
        );
    }
}
