use sim::attempt::*;
use sim::body::*;
use sim::chamber::{BrainFrame, BrainInfo, Pose};
use sim::environment::*;
use sim::field_lab::{FieldLabFrame, FieldLabInfo, FieldScenario};
use sim::lifecycle_lab::*;
use sim::placement::*;
use sim::record::*;
use sim::sensory::CuePathway;
use sim::{Group, GroupActivity, GroupLink, MotorOutput, StepOutput};
use ts_rs::TS;
fn main() {
    println!("// Generated from crates/sim; do not edit.\n");
    for declaration in [
        sim::setup_fixture::SetupFixture::decl(),
        StartAttempt::decl(),
        AttemptInfo::decl(),
        AttemptStep::decl(),
        ChunkHeader::decl(),
        sim::spawn::SpawnDef::decl(),
        sim::spawn::SpawnState::decl(),
        sim::spawn::SpawnMode::decl(),
        BodyPose::decl(),
        BodyMode::decl(),
        TerminalOutcome::decl(),
        BodyState::decl(),
        BodyConfig::decl(),
        ContactRegion::decl(),
        sim::food::FoodDef::decl(),
        sim::food::FoodShape::decl(),
        sim::native_object::NativeObjectShape::decl(),
        sim::surface::ContactSurface::decl(),
        sim::surface::SurfaceHit::decl(),
        sim::surface::SupportSample::decl(),
        ExitOpening::decl(),
        BodyContacts::decl(),
        FeedingEnd::decl(),
        BodyEventKind::decl(),
        BodyEvent::decl(),
        OutcomeSummary::decl(),
        LevelDef::decl(),
        ToolKind::decl(),
        ToolEffect::decl(),
        ToolDef::decl(),
        ToolStock::decl(),
        PlacementRules::decl(),
        Placement::decl(),
        PlacementEdit::decl(),
        PlacementState::decl(),
        ResolvedSetup::decl(),
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
        SolidProp::decl(),
        FurnitureModel::decl(),
        Furnishing::decl(),
        sim::house_lab::HouseProbe::decl(),
        FieldConfig::decl(),
        FanField::decl(),
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
