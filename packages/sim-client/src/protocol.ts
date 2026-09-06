import type { BrainFrame, BrainInfo } from './generated/sim';
export type { BrainFrame, BrainInfo } from './generated/sim';
export type Request =
  | { type: 'start'; generation: number; seed: number }
  | { type: 'step'; generation: number }
  | { type: 'inject'; generation: number; left: number; right: number };
export type Reply =
  | { type: 'ready'; generation: number; info: BrainInfo; loadMs: number; wasmBytes: number }
  | { type: 'frame'; generation: number; frame: BrainFrame; stepMs: number; wasmBytes: number }
  | { type: 'error'; generation: number; message: string };
