use sim::attempt::*;
use sim::body::*;
use sim::chamber::{BrainFrame, BrainInfo, Pose};
use sim::environment::*;
use sim::field_lab::{FieldLabFrame, FieldLabInfo, FieldScenario};
use sim::lifecycle_lab::*;
use sim::record::*;
use sim::sensory::CuePathway;
use sim::{Group, GroupActivity, GroupLink, MotorOutput, StepOutput};
use ts_rs::TS;
fn main() {
    println!("// Generated from crates/sim; do not edit.\n");
    for declaration in [
        StartAttempt::decl(),
        AttemptInfo::decl(),
        AttemptStep::decl(),
        ChunkHeader::decl(),
        BodyPose::decl(),
        BodyMode::decl(),
        TerminalOutcome::decl(),
        BodyState::decl(),
        BodyConfig::decl(),
        ContactRegion::decl(),
        ExitOpening::decl(),
        BodyContacts::decl(),
        FeedingEnd::decl(),
        BodyEventKind::decl(),
        BodyEvent::decl(),
        OutcomeSummary::decl(),
        LevelDef::decl(),
        CueInput::decl(),
        AttemptTuning::decl(),
        AttemptSpec::decl(),
        FlyFrame::decl(),
        AttemptResult::decl(),
        AttemptFrame::decl(),
        LifecycleScenario::decl(),
        LifecycleInfo::decl(),
        LifecycleEvent::decl(),
        RecordLayout::decl(),
        PackedChunk::decl(),
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
