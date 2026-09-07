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
  | {
      type: "ready";
      attemptId: string;
      info: AttemptInfo;
      loadMs: number;
      wasmBytes: number;
    }
  | {
      type: "frames";
      attemptId: string;
      chunk: TransferChunk;
      metrics: {
        activeNeuralSteps: number;
        productionMs: number;
        wasmBytes: number;
      };
    }
  | { type: "complete"; attemptId: string; result: AttemptResult }
  | { type: "error"; attemptId: string; message: string };

/** Transport generation is independent of persisted attempt identity. */
export type AttemptEnvelope = { generation: number; reply: AttemptReply };

export type SetupCommand =
  | { type: "fixture" }
  | { type: "catalog" }
  | {
      type: "resolve";
      level: import("./generated/sim").LevelDef;
      placements: import("./generated/sim").Placement[];
    }
  | {
      type: "edit";
      level: import("./generated/sim").LevelDef;
      placements: import("./generated/sim").Placement[];
      edit: import("./generated/sim").PlacementEdit;
    };
export type SetupRequest = {
  type: "setup";
  requestId: number;
  command: SetupCommand;
};
export type SetupReply = { type: "setup"; requestId: number } & (
  | {
      value:
        | import("./generated/sim").ToolDef[]
        | import("./generated/sim").SetupFixture
        | import("./generated/sim").ResolvedSetup
        | import("./generated/sim").PlacementState;
    }
  | { error: string }
);
