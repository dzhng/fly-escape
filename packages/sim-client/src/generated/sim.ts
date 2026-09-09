// Generated from crates/sim; do not edit.

export type SetupFixture = { level: LevelDef, tuning: AttemptTuning, catalog: Array<ToolDef>, };
export type StartAttempt = { attemptId: string, rootSeed: string, flyCount: number, level: LevelDef, tuning: AttemptTuning, placements: Array<Placement>, };
export type AttemptInfo = { spec: AttemptSpec, level: LevelDef, resolvedSetup: ResolvedSetup, initialBodies: Array<BodyState>, initialSensoryPoints: Array<[Point, Point]>, groups: Array<Group>, groupLinks: Array<GroupLink>, recordLayout: RecordLayout, archiveBytes: number, graphBytes: number, brainStateBytes: number, retinalConfig?: RetinalConfig | null, };
export type AttemptStep = { tick: number, neuralSteps: number, bufferedTicks: number, complete: boolean, };
export type EyeProfile = { profileHash: string, layoutHash: string, rigHash: string, colorModelHash: string, width: number, height: number, sampleCount: number, };
export type RetinalConfig = { clientGeneration: number, sceneId: string, mapHash: string, profile: EyeProfile, };
export type EyePose = { flyId: number, position: [number, number, number], rotation: [number, number, number, number], };
export type VisionRequest = { attemptId: string, clientGeneration: number, tick: number, profileHash: string, sceneId: string,
/**
 * Ascending active fly IDs also define the RGB byte order.
 */
poses: Array<EyePose>, };
export type RetinaBatch = { request: VisionRequest,
/**
 * Fly order, then L/R eye, sample, and linear R/G/B bytes.
 */
rgb: Uint8Array, };
export type ChunkHeader = { schemaVersion: number, attemptId: string, sequence: number, startTick: number, tickCount: number, flyCount: number, mapHash: string | null, profileHash: string | null, sceneId: string | null, result: AttemptResult | null, };
export type SpawnDef = { "kind": "fixed", states: Array<SpawnState>, } | { "kind": "cluster", min: Point, max: Point, flyingCount: number, };
export type SpawnState = { pose: BodyPose, mode: SpawnMode, };
export type SpawnMode = "walking" | "flying";
export type BodyPose = { position: Point, heading: number, };
export type BodyMode = "walking" | "flying" | "landing" | "feeding";
export type TerminalOutcome = "escaped" | "starved" | "zapped" | "caught" | "timedOut";
export type BodyState = { pose: BodyPose,
/**
 * Native support-pivot height in metres, owned by physical movement.
 */
height: number,
/**
 * Core orientation; local +Y points away from the support.
 */
rotation: [number, number, number, number],
/**
 * Food support identity; None is floor for grounded modes, air otherwise.
 */
support: number | null, mode: BodyMode,
/**
 * Remaining energy under the reserve model; timed rounds model none and hold zero.
 */
reserve: number, outcome: TerminalOutcome | null, };
export type ReserveModel = { initial: number, capacity: number, idleCost: number, walkingCost: number, flyingCost: number, feedingRate: number, maxBoutSeconds: number, };
export type LifeModel = { "kind": "timed" } | { "kind": "reserve" } & ReserveModel;
export type BodyConfig = { life: LifeModel, bodyRadius: number, walkSpeed: number, flightSpeed: number, turnGain: number, takeoffThreshold: number,
/**
 * Emitted spike fraction, averaged across the two landing groups.
 */
landingThreshold: number,
/**
 * Minimum ground time after neural landing; independent of neural cadence.
 */
landingDwellSeconds: number,
/**
 * Emitted proboscis spike fraction; a qualifying pulse starts a latched bout.
 */
proboscisThreshold: number, };
export type ContactRegion = { center: Point, radius: number, };
export type ContactHazardKind = "zapper" | "web";
export type ContactHazard = { surfaceId: number, kind: ContactHazardKind, };
export type FoodDef = { position: Point, heading: number, shape: FoodShape, };
export type FoodShape = { "type": "apple" } | { "type": "banana" } | { "type": "patch", radius: number, };
export type NativeObjectShape = "apple" | "banana" | "wornShoes" | "dirtyDishes" | "laundry" | "sleepingCat" | "fan" | "vinegar" | "bugZapper" | "spiderWeb";
export type ContactSurface = { id: number, vertices: Array<[number, number, number]>, triangles: Array<[number, number, number]>, };
export type SurfaceHit = { surfaceId: number, fraction: number, point: [number, number, number], normal: [number, number, number], };
export type SupportSample = { surfaceId: number, root: [number, number, number], rotation: [number, number, number, number], point: [number, number, number], normal: [number, number, number], };
export type ExitOpening = { a: Point, b: Point, outward: Point, };
export type ExitSuction = {
/**
 * World units from the exit midpoint at which the pull reaches zero.
 */
reach: number,
/**
 * World units per second at the midpoint, falling linearly to zero at reach.
 */
speed: number,
/**
 * World units per second held everywhere else in the exit room, so authored
 * objects only have to lead a body into that room. Zero, the default, is the
 * doorway-only pull levels had before the setting existed.
 */
roomSpeed?: number, };
export type BodyContacts = { food: boolean, contactHazard: ContactHazardKind | null, };
export type FeedingEnd = "contactLost" | "satiated" | "boutLimit" | "terminal";
export type BodyEventKind = { "type": "modeChanged", from: BodyMode, to: BodyMode, } | { "type": "feedingStarted" } | { "type": "feedingEnded", reason: FeedingEnd, } | { "type": "terminal", outcome: TerminalOutcome, };
export type BodyEvent = { tick: number, kind: BodyEventKind, };
export type OutcomeSummary = { escaped: number, starved: number, zapped: number, caught: number, timedOut: number, score: number, };
export type LevelDef = { id: string, geometry: Geometry, spawn: SpawnDef, exit: ExitOpening, exitCue: ExitCue | null,
/**
 * Optional physical help through the doorway; absent levels get none and
 * keep the identity they had before the setting existed.
 */
exitSuction?: ExitSuction | null, food: Array<FoodDef>, fixedObjects: Array<Placement>, zappers: Array<ContactRegion>, sources: Array<Source>, fieldConfig: FieldConfig, bodyConfig: BodyConfig, durationTicks: number, starThresholds: [number, number, number], placementRules: PlacementRules, };
export type ToolKind = "fruit" | "banana" | "crumbs" | "vinegar" | "lamp" | "shade" | "fan" | "bugZapper" | "spiderWeb" | "wornShoes" | "dirtyDishes" | "laundry" | "sleepingCat";
export type ToolEffect = { "type": "none" } | { "type": "source", kind: SourceKind, radius: number, rate: number, } | { "type": "fan", reach: number, halfWidth: number, speed: number, };
export type ToolDef = { kind: ToolKind, footprintRadius: number, effect: ToolEffect, contact: NativeObjectShape | null, edible: boolean, contactHazard: ContactHazardKind | null, };
export type ToolStock = { kind: ToolKind, count: number, };
export type PlacementRules = {
/**
 * Map-owned fan direction in canonical radians; placement edits cannot override it.
 */
fanHeading: number, inventory: Array<ToolStock>,
/**
 * Solid prop interiors or authored reserved floor, in addition to spawn bodies and exit.
 */
reserved: Array<ContactRegion>, };
export type Placement = { id: number, kind: ToolKind, position: Point, heading: number, };
export type PlacementEdit = { "type": "place", placement: Placement, } | { "type": "move", id: number, position: Point, heading: number, } | { "type": "remove", id: number, };
export type PlacementState = { placements: Array<Placement>, remaining: Array<ToolStock>, food: Array<ContactSurface>, objects: Array<ContactSurface>, contactHazards: Array<ContactHazard>, };
export type ResolvedSetup = { fixedPlacements: Array<Placement>, state: PlacementState, sources: Array<Source>, fieldConfig: FieldConfig, };
export type CueInput = { pathway: CuePathway, gain: number, };
export type AttemptTuning = { cues: Array<CueInput>, tasteGain: number,
/**
 * Experimental ablation, fixed for the complete attempt and included in its identity.
 */
silencedNeurons: Array<number>, };
export type AttemptSpec = { schemaVersion: number, attemptId: string, graphHash: string, graphManifestHash: string, simulationBuildId: string, tuningHash: string, placements: Array<Placement>, levelHash: string, levelId: string,
/**
 * Decimal u64 wire value; JavaScript numbers cannot represent every seed.
 */
rootSeed: string, flyCount: number, durationTicks: number, };
export type FlyFrame = { id: number, inputPose: BodyPose, sensory: SensorySample | null, neural: StepOutput | null, body: BodyState, events: Array<BodyEvent>, };
export type AttemptResult = { attemptId: string, completedTick: number, outcomes: OutcomeSummary, stars: number, };
export type AttemptFrame = { tick: number, neuralSteps: number, flies: Array<FlyFrame>, result: AttemptResult | null,
/**
 * Exact pre-neural observations, including terminal-transition ticks.
 */
retina?: RetinaBatch | null, };
export type LifecycleScenario = "mealThenStarvation" | "proboscisSilenced" | "openExit" | "blockedExit";
export type LifecycleInfo = { scenario: LifecycleScenario, spec: AttemptSpec, level: LevelDef, food: Array<ContactSurface>, initialGrid: FieldGrid, initialBodies: Array<BodyState>, };
export type LifecycleEvent = { flyId: number, event: BodyEvent, };
export type RecordLayout = { schemaVersion: number, retinalConfig: RetinalConfig | null, retinalPresentMask: number, noSupport: number, valueFields: Array<string>, motionValueFields: Array<string>, motionStateFields: Array<string>, motionSampleFields: Array<string>, maxMotionPoints: number, stateFields: Array<string>, eventFields: Array<string>, groupIds: Array<string>, groupFields: Array<string>, modes: Array<BodyMode>, outcomes: Array<TerminalOutcome | null>, feedingEnds: Array<FeedingEnd>, eventKinds: Array<string>, sensoryPresentMask: number, neuralPresentMask: number, maxChunkTicks: number, maxEventsPerFlyTick: number, };
export type PackedChunk = { schemaVersion: number, attemptId: string, sequence: number, startTick: number, tickCount: number, flyCount: number, retinaRgb: Array<number>, motionOffsets: Array<number>, motionValues: Array<number>, motionStates: Array<number>, values: Array<number>, states: Array<number>, events: Array<number>, tickNeuralSteps: Array<number>, mapHash: string | null, profileHash: string | null, sceneId: string | null, result: AttemptResult | null, };
export type FieldScenario = "excitatoryOdor" | "inhibitoryOdor" | "lamp" | "shade" | "wind" | "exit";
export type FieldLabInfo = { brain: BrainInfo, scenario: FieldScenario, grids: [FieldGrid, FieldGrid], };
export type FieldLabFrame = { tick: number, flies: [BrainFrame, BrainFrame], grids: [FieldGrid, FieldGrid], };
export type Point = { x: number, z: number, };
export type RectRoom = { id: number, min: Point, max: Point, };
export type Wall = { a: Point, b: Point, };
export type Geometry = { rooms: Array<RectRoom>, walls: Array<Wall>, solids: Array<SolidProp>, };
export type SolidProp = { id: number, furnishing: Furnishing | null, min: Point, max: Point, height: number, };
export type FurnitureModel = "cabinet" | "sofa" | "desk" | "chair" | "bed" | "kitchen";
export type Furnishing = { model: FurnitureModel,
/**
 * Quarter turns around +Y; native front is +Z.
 */
quarterTurns: number, };
export type HouseProbe = { solid: SolidProp, from: Point, requested: Point, stopped: Point, radius: number, lineOfSight: boolean, };
export type FieldConfig = { cellSize: number,
/**
 * World units squared per game second.
 */
diffusion: number,
/**
 * Fractional loss per game second.
 */
decay: number, baselineBrightness: number, antennaOffset: number, antennaForward: number,
/**
 * Uniform ambient velocity, combined with local fans for advection and body physics.
 */
wind: Point, fans: Array<FanField>, };
export type FanField = { position: Point, heading: number, reach: number, halfWidth: number, speed: number, };
export type SourceKind = "attractiveOdor" | "repellentOdor" | "lamp" | "shade";
export type Source = { position: Point, radius: number,
/**
 * Each odor channel: total cue mass per second. Lamp/shade: peak brightness contribution.
 */
rate: number, kind: SourceKind, };
export type ExitCue = { position: Point, roomId: number, radius: number, strength: number, };
export type FieldSample = { attractiveOdor: number, repellentOdor: number, brightness: number, shade: number, exitCue: number, };
export type SensorySample = { vision: VisionSample, left: FieldSample, right: FieldSample, wind: Point, };
export type VisionSample = { brightness: [number, number, number, number, number, number, number, number], blocked: [number, number, number, number, number, number, number, number], };
export type FieldGrid = { origin: Point, max: Point, cellSize: number, width: number, height: number, cells: Array<FieldSample | null>,
/**
 * Uniform ambient vector for diagnostic labels; local samples use wind_cells.
 */
wind: Point, windCells: Array<Point>, };
export type CuePathway = "excitatoryOdor" | "inhibitoryOdor" | "vision" | "none";
export type Group = { id: string, label: string, indices: Array<number>, };
export type GroupLink = { source: string, target: string, edgeCount: number, positiveWeight: number, negativeWeight: number, };
export type MotorOutput = { thrust: number, turn: number, flightThrust: number, flightTurn: number, };
export type GroupActivity = { id: string, meanVoltage: number, spikeFraction: number, };
export type StepOutput = { motor: MotorOutput, groups: Array<GroupActivity>, spikeCount: number, };
export type Pose = { x: number, y: number, z: number, heading: number, };
export type BrainFrame = { tick: number, pose: Pose, neural: StepOutput, sensory: SensorySample, sensoryPose: Pose, sensoryPoints: [Point, Point], };
export type BrainInfo = { neuronCount: number, edgeCount: number, graphHash: string, graphBytes: number, geometry: Geometry, initialSensoryPoints: [Point, Point], initialPose: Pose, groups: Array<Group>, groupLinks: Array<GroupLink>, prngId: string, };
