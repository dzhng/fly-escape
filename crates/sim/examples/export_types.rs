use sim::{Group, GroupActivity, GroupLink, MotorOutput, StepOutput};
use ts_rs::TS;
fn main() {
    println!("// Generated from crates/sim; do not edit.\n");
    for declaration in [
        Group::decl(),
        GroupLink::decl(),
        MotorOutput::decl(),
        GroupActivity::decl(),
        StepOutput::decl(),
    ] {
        println!("export {declaration}");
    }
}
