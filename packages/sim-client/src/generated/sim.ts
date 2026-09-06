// Generated from crates/sim; do not edit.

export type Group = { id: string, label: string, indices: Array<number>, };
export type GroupLink = { source: string, target: string, edgeCount: number, positiveWeight: number, negativeWeight: number, };
export type MotorOutput = { thrust: number, turn: number, flightThrust: number, flightTurn: number, };
export type GroupActivity = { id: string, meanVoltage: number, spikeFraction: number, };
export type StepOutput = { motor: MotorOutput, groups: Array<GroupActivity>, spikeCount: number, };
export type Pose = { x: number, y: number, z: number, heading: number, };
export type BrainFrame = { tick: number, pose: Pose, neural: StepOutput, };
export type BrainInfo = { neuronCount: number, edgeCount: number, graphHash: string, graphBytes: number, chamberSize: number, initialPose: Pose, groups: Array<Group>, groupLinks: Array<GroupLink>, prngId: string, };
