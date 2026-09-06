import type {
  BrainFrame,
  BrainInfo,
  FieldScenario,
  FieldLabInfo,
  FieldLabFrame,
} from "./generated/sim";
export type {
  BrainFrame,
  BrainInfo,
  FieldScenario,
  FieldLabInfo,
  FieldLabFrame,
} from "./generated/sim";
export type Request =
  | { type: "start"; generation: number; seed: number }
  | { type: "startFields"; generation: number; seed: number; scenario: FieldScenario }
  | { type: "step"; generation: number }
  | { type: "inject"; generation: number; left: number; right: number };
export type Reply =
  | {
      type: "fieldsReady";
      generation: number;
      info: FieldLabInfo;
      loadMs: number;
      wasmBytes: number;
    }
  | {
      type: "fieldsFrame";
      generation: number;
      frame: FieldLabFrame;
      stepMs: number;
      wasmBytes: number;
    }
  | { type: "ready"; generation: number; info: BrainInfo; loadMs: number; wasmBytes: number }
  | { type: "frame"; generation: number; frame: BrainFrame; stepMs: number; wasmBytes: number }
  | { type: "error"; generation: number; message: string };
