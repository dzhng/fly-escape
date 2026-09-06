// Generated from crates/sim; do not edit.

export type FieldScenario = "excitatoryOdor" | "inhibitoryOdor" | "lamp" | "shade" | "wind" | "exit";
export type FieldLabInfo = { brain: BrainInfo, scenario: FieldScenario, grids: [FieldGrid, FieldGrid], };
export type FieldLabFrame = { tick: number, flies: [BrainFrame, BrainFrame], grids: [FieldGrid, FieldGrid], };
export type Point = { x: number, z: number, };
export type RectRoom = { id: number, min: Point, max: Point, };
export type Wall = { a: Point, b: Point, };
export type Geometry = { rooms: Array<RectRoom>, walls: Array<Wall>, };
export type FieldConfig = { cellSize: number,
/**
 * World units squared per game second.
 */
diffusion: number,
/**
 * Fractional loss per game second.
 */
decay: number, baselineBrightness: number, antennaOffset: number,
/**
 * World-space velocity used for odor advection and exported to body physics.
 */
wind: Point, };
export type SourceKind = "odor" | "lamp" | "shade";
export type Source = { position: Point, radius: number,
/**
 * Odor: total cue mass per second. Lamp/shade: peak brightness contribution.
 */
rate: number, kind: SourceKind, };
export type ExitCue = { position: Point, roomId: number, radius: number, strength: number, };
export type FieldSample = { odor: number, brightness: number, shade: number, exitCue: number, };
export type SensorySample = { left: FieldSample, right: FieldSample, wind: Point, };
export type FieldGrid = { origin: Point, max: Point, cellSize: number, width: number, height: number, cells: Array<FieldSample | null>, wind: Point, };
export type CuePathway = "excitatoryOdor" | "inhibitoryOdor" | "vision" | "none";
export type Group = { id: string, label: string, indices: Array<number>, };
export type GroupLink = { source: string, target: string, edgeCount: number, positiveWeight: number, negativeWeight: number, };
export type MotorOutput = { thrust: number, turn: number, flightThrust: number, flightTurn: number, };
export type GroupActivity = { id: string, meanVoltage: number, spikeFraction: number, };
export type StepOutput = { motor: MotorOutput, groups: Array<GroupActivity>, spikeCount: number, };
export type Pose = { x: number, y: number, z: number, heading: number, };
export type BrainFrame = { tick: number, pose: Pose, neural: StepOutput, sensory: SensorySample, sensoryPose: Pose, };
export type BrainInfo = { neuronCount: number, edgeCount: number, graphHash: string, graphBytes: number, geometry: Geometry, antennaOffset: number, initialPose: Pose, groups: Array<Group>, groupLinks: Array<GroupLink>, prngId: string, };
