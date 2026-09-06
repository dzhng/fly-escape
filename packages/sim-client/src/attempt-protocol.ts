import type { AttemptInfo, AttemptResult, StartAttempt } from "./generated/sim";
import type { TransferChunk } from "./record";
export type AttemptCommand =
  | {
      type: "startLab";
      attemptId: string;
      rootSeed: string;
      flyCount: number;
      durationTicks: number;
    }
  | { type: "start"; input: StartAttempt }
  | { type: "grantCredits"; attemptId: string; count: number }
  | { type: "cancel"; attemptId: string };
export type AttemptRequest = AttemptCommand & { generation: number };
export type AttemptReply =
  | { type: "ready"; attemptId: string; info: AttemptInfo; loadMs: number; wasmBytes: number }
  | {
      type: "frames";
      attemptId: string;
      chunk: TransferChunk;
      metrics: { activeNeuralSteps: number; productionMs: number; wasmBytes: number };
    }
  | { type: "complete"; attemptId: string; result: AttemptResult }
  | { type: "error"; attemptId: string; message: string };

/** Transport generation is independent of persisted attempt identity. */
export type AttemptEnvelope = { generation: number; reply: AttemptReply };
