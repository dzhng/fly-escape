import type { RoomDetail } from "@fly-escape/game-renderer";
import { loadWorldAssets } from "./world-assets";
import React, { useEffect, useRef, useState } from "react";
import {
  WorldView,
  flyAnimation,
  recordedTrails,
  type FlyPose,
} from "@fly-escape/game-renderer";
import {
  AttemptClient,
  FrameArchive,
  PlaybackClock,
  loadMotionSampler,
  type MotionSampler,
  type AttemptInfo,
  type AttemptFrame,
  type RecordedPose,
  type StartAttempt,
  type AttemptResult,
  type ToolDef,
} from "@fly-escape/sim-client";
import { SciencePanel } from "./science-panel";
import { NeuralExplanations } from "./neural-explanations";
import "./playback.css";

const FLY_COUNT = 20;
const DURATION_TICKS = 6000;
const TICK_SECONDS = 0.1;
class TimingSamples {
  private bins = new Uint32Array(1001);
  private count = 0;
  private max = 0;
  add(ms: number) {
    this.bins[Math.min(1000, Math.ceil(ms))]++;
    this.count++;
    this.max = Math.max(this.max, ms);
  }
  report() {
    let seen = 0,
      p95 = 0;
    for (; p95 < this.bins.length - 1; p95++) {
      seen += this.bins[p95];
      if (seen >= this.count * 0.95) break;
    }
    return {
      count: this.count,
      p95Ms: this.count ? p95 : null,
      p95Capped: this.count > 0 && p95 === this.bins.length - 1,
      maxMs: this.max,
      histogramResolutionMs: 1,
    };
  }
}
type Run = {
  info: AttemptInfo;
  failed: boolean;
  assetsReady: boolean;
  motionSampler?: MotionSampler;
  archive: FrameArchive;
  clock: PlaybackClock;
  requestedAt: number;
  readyAt: number;
  firstPlayAt: number | null;
  productionMs: number;
  activeNeuralSteps: number;
  rateWindow: { steps: number; ms: number }[];
  wasmBytes: number;
  underruns: number;
  previousState: string;
  cachedTick: number;
  lower?: AttemptFrame;
  trailHistory?: RecordedPose[][];
  frameIntervals: TimingSamples;
  interactions: TimingSamples;
};
type Display = {
  cursor: number;
  computed: number;
  state: string;
  speed: 1 | 2;
  frame?: AttemptFrame;
  rate: number;
  report: string;
};
const initialDisplay: Display = {
  cursor: 0,
  computed: 0,
  state: "loading",
  speed: 1,
  rate: 0,
  report: "{}",
};
function productionRate(run: Run) {
  const recentSteps = run.rateWindow.reduce((n, sample) => n + sample.steps, 0);
  const recentMs = run.rateWindow.reduce((n, sample) => n + sample.ms, 0);
  const rate = (steps: number, ms: number) =>
    ms > 0 ? (steps * TICK_SECONDS * 1000) / (run.info.spec.flyCount * ms) : 0;
  return Math.min(rate(run.activeNeuralSteps, run.productionMs), rate(recentSteps, recentMs));
}
function sample(run: Run): FlyPose[] {
  const tick = Math.floor(run.clock.cursorTick);
  if (tick !== run.cachedTick) {
    run.cachedTick = tick;
    run.lower = run.archive.frame(tick);
    run.trailHistory = run.archive.poseHistory(tick);
  }
  const motions = run.archive.motion(run.clock.cursorTick);
  // Initial poses are available while the independent WASM initialization runs.
  const poses = run.motionSampler
    ? run.archive.sampleMotion(run.clock.cursorTick, run.motionSampler)
    : run.info.initialBodies.map(body => ({
        x: body.pose.position.x, z: body.pose.position.z, heading: body.pose.heading,
        height: body.height, rotation: body.rotation,
      }));
  return poses.map((pose, id) => ({
    x: pose.x, z: pose.z, heading: pose.heading, y: pose.height,
    rotation: pose.rotation,
    animation: flyAnimation(motions[id], TICK_SECONDS),
  }));
}

export function PlaybackLab() {
  return <AttemptPlayback />;
}
export function AttemptPlayback({
  input,
  client,
  catalog = [],
  roomDetails,
  onReturn,
  onResult,
}: {
  input?: StartAttempt;
  client?: AttemptClient;
  catalog?: ToolDef[];
  roomDetails?: readonly RoomDetail[];
  onReturn?: () => void;
  onResult?: (result: AttemptResult) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const seekInput = useRef<HTMLInputElement>(null);
  const scene = useRef<WorldView | undefined>(undefined);
  const run = useRef<Run | undefined>(undefined);
  const restart = useRef<() => void>(() => {});
  const interactionAt = useRef<number | null>(null);
  const [info, setInfo] = useState<AttemptInfo>();
  const [display, setDisplay] = useState(initialDisplay);
  const [selected, setSelected] = useState(0);
  const cards = useRef(new Map<number, HTMLButtonElement>());
  const selectFly = (id: number) => {
    interactionAt.current = performance.now();
    setSelected(id);
    scene.current?.selectFly(id);
    cards.current
      .get(id)
      ?.closest("article")
      ?.scrollIntoView({ block: "start", inline: "nearest" });
  };
  const [requested, setRequested] = useState(true);
  const [error, setError] = useState("");
  const [worldReady, setWorldReady] = useState(false);

  useEffect(() => {
    let raf = 0,
      lastFrameAt: number | null = null,
      lastPublished = -Infinity,
      lastSampleTick = -1,
      lastState = "",
      lastSpeed = 0;
    let requestedAt = performance.now();
    let lastDiagnosticAt = -Infinity;
    let renderFailed = false;
    const fail = (message: string) => {
      console.error("[Fly escape] attempt failed", { message, spec: run.current?.info.spec });
      if (run.current) {
        run.current.failed = true;
        run.current.clock.pause();
      }
      setError(message);
      setRequested(false);
      setDisplay((previous) => ({
        ...previous,
        state: "error",
        report: JSON.stringify({ ...JSON.parse(previous.report), state: "error", error: message }, null, 2),
      }));
    };
    const observer = client ?? new AttemptClient(() => {});
    observer.setReceiver((reply) => {
      if (reply.type === "ready") {
        console.info("[Fly escape] attempt ready", reply.info.spec);
        lastDiagnosticAt = -Infinity;
        const archive = new FrameArchive(
          reply.info.spec,
          reply.info.recordLayout,
          reply.info.archiveBytes,
          reply.info.initialBodies,
        );
        const clock = new PlaybackClock(reply.info.spec.durationTicks);
        clock.play();
        clock.setHidden(document.hidden);
        run.current = {
          info: reply.info,
          failed: false,
          assetsReady: false,
          archive,
          clock,
          requestedAt,
          readyAt: performance.now(),
          firstPlayAt: null,
          productionMs: 0,
          activeNeuralSteps: 0,
          rateWindow: [],
          wasmBytes: reply.wasmBytes,
          underruns: 0,
          previousState: "buffering",
          cachedTick: -1,
          frameIntervals: new TimingSamples(),
          interactions: new TimingSamples(),
        };
        scene.current?.dispose();
        scene.current = new WorldView(
          container.current!,
          reply.info.level.geometry,
          reply.info.spec.flyCount,
        );
        scene.current.setContactGeometry(
          reply.info.resolvedSetup.state.food.slice(0, reply.info.level.food.length),
          reply.info.level.zappers,
          reply.info.level.exit,
          false,
        );
        scene.current.setPlacements(reply.info.spec.placements, catalog, undefined, reply.info.level.fixedObjects);
        scene.current.setPoses(sample(run.current));
        scene.current.enableSelection(selectFly);
        scene.current.selectFly(0);
        const target = scene.current;
        setWorldReady(false);
        void Promise.all([
          loadWorldAssets(target, () => scene.current === target, roomDetails),
          loadMotionSampler(),
        ]).then(([, sampler]) => {
          if (scene.current === target && run.current) {
            run.current.motionSampler = sampler;
            run.current.assetsReady = true;
            setWorldReady(true);
          }
        })
          .catch((cause) => {
            if (scene.current !== target) return;
            observer.cancel();
            fail(String(cause));
          });
        setInfo(reply.info);
      } else if (reply.type === "frames") {
        const current = run.current;
        if (!current) throw new Error("Frames arrived before attempt metadata");
        current.archive.append(reply.chunk); // This takes ownership and detaches the message buffers.
        current.wasmBytes = reply.metrics.wasmBytes;
        if (reply.metrics.activeNeuralSteps > 0) {
          current.activeNeuralSteps += reply.metrics.activeNeuralSteps;
          current.productionMs += reply.metrics.productionMs;
          current.rateWindow.push({
            steps: reply.metrics.activeNeuralSteps,
            ms: reply.metrics.productionMs,
          });
          if (current.rateWindow.length > 20) current.rateWindow.shift();
        }
      } else if (reply.type === "complete") {
        onResult?.(reply.result);
      } else if (reply.type === "error") {
        fail(reply.message);
      }
    });
    restart.current = () => {
      run.current?.archive.clear();
      run.current = undefined;
      scene.current?.dispose();
      scene.current = undefined;
      setInfo(undefined);
      setDisplay(initialDisplay);
      if (seekInput.current) seekInput.current.value = "0";

      lastPublished = -Infinity;
      lastSampleTick = -1;
      lastState = "";
      lastSpeed = 0;
      setError("");
      renderFailed = false;
      setRequested(true);
      setSelected(0);
      lastFrameAt = null;
      requestedAt = performance.now();
      if (input) observer.start(input);
      else observer.startLab(crypto.randomUUID(), "42", FLY_COUNT, DURATION_TICKS);
    };
    const visibility = () => {
      observer.setHidden(document.hidden);
      if (run.current) {
        run.current.clock.setHidden(document.hidden);
        run.current.previousState = run.current.clock.state;
      }
      lastFrameAt = null;
    };
    document.addEventListener("visibilitychange", visibility);
    visibility();
    restart.current();
    const draw = (now: number) => {
      const current = run.current;
      if (current) {
        try {
          const rate = productionRate(current);
          if (!current.failed) {
            if (current.assetsReady)
              current.clock.update(now, {
                computedTick: current.archive.computedTick,
                complete: current.archive.complete,
                productionRate: rate,
              });
            // Preserve native keyboard increments between React publications.
            if (seekInput.current) seekInput.current.value = String(current.clock.cursorTick);
            if (current.clock.state === "playing" && current.firstPlayAt === null)
              current.firstPlayAt = now;
            if (current.previousState === "playing" && current.clock.state === "buffering")
              current.underruns++;
            current.previousState = current.clock.state;
            const poses = sample(current);
            scene.current?.setPoses(poses);
            scene.current?.setTrails(
              recordedTrails(
                current.trailHistory ?? [],
                current.clock.cursorTick,
                poses,
              ),
              current.clock.cursorTick,
            );
          }
          // Resizing clears the canvas even when simulation has stopped.
          if (!document.hidden && !renderFailed) {
            if (!current.failed && lastFrameAt !== null) current.frameIntervals.add(now - lastFrameAt);
            lastFrameAt = now;
            try {
              scene.current?.render(current.clock.cursorTick * TICK_SECONDS);
            } catch (cause) {
              renderFailed = true;
              throw cause;
            }
            if (interactionAt.current !== null) {
              current.interactions.add(performance.now() - interactionAt.current);
              interactionAt.current = null;
            }
          }
          if (!current.failed) {
            const progressDue = now - lastPublished >= 100;
            const sampleTick = current.lower?.tick ?? 0;
            if (
              progressDue ||
              sampleTick !== lastSampleTick ||
              current.clock.state !== lastState ||
              current.clock.speed !== lastSpeed
            ) {
              const heap =
                (
                  performance as Performance & {
                    memory?: { usedJSHeapSize: number };
                  }
                ).memory?.usedJSHeapSize ?? null;
              const report = {
                spec: current.info.spec,
                initialBodies: current.info.initialBodies,
                userAgent: navigator.userAgent,
                viewport: [innerWidth, innerHeight],
                devicePixelRatio,
                cursorTick: current.clock.cursorTick,
                sampleTick: current.lower?.tick ?? 0,
                computedTick: current.archive.computedTick,
                state: current.clock.state,
                speed: current.clock.speed,
                complete: current.archive.complete,
                initialWaitMs:
                  current.firstPlayAt === null ? null : current.firstPlayAt - current.requestedAt,
                warmWaitMs:
                  current.firstPlayAt === null ? null : current.firstPlayAt - current.readyAt,
                productionMs: current.productionMs,
                activeNeuralSteps: current.activeNeuralSteps,
                activeEquivalentProductionRate: rate,
                underruns: current.underruns,
                frameIntervals: current.frameIntervals.report(),
                interactions: {
                  ...current.interactions.report(),
                  measurement:
                    "control callback to synchronous scene render completion; excludes browser paint",
                },
                memory: {
                  wasmBytes: current.wasmBytes,
                  archiveOwnedChunkBytes: current.archive.ownedBytes,
                  archiveBoundBytes: current.info.archiveBytes,
                  graphBytes: current.info.graphBytes,
                  brainStateBytes: current.info.brainStateBytes,
                  observedJSHeapBytes: heap,
                  note: "WASM includes graph and brain state; do not add those again. Download report includes an on-demand GPU memory estimate.",
                },
                renderer: scene.current?.statistics,
                camera: scene.current?.cameraState,
                result: current.archive.result,
              };
              // Keep diagnostics available without a frame-by-frame console stream.
              const ended = current.clock.state === "ended" && lastState !== "ended";
              if (ended || (now-lastDiagnosticAt >= 1000 && current.clock.state !== lastState)
                || (current.clock.state === "playing" && now-lastDiagnosticAt >= 10000)) {
                console.info("[Fly escape] playback", ended ? {
                  ...report, renderer: { ...report.renderer, gpu: scene.current?.estimateGpuMemory() },
                } : report);
                lastDiagnosticAt = now;
              }
              lastPublished = now;
              setDisplay({
                cursor: current.clock.cursorTick,
                computed: current.archive.computedTick,
                state: current.clock.state,
                speed: current.clock.speed,
                frame: current.lower,
                rate,
                report: JSON.stringify(report, null, 2),
              });
              lastSampleTick = sampleTick;
              lastState = current.clock.state;
              lastSpeed = current.clock.speed;
            }
          }
        } catch (cause) {
          observer.cancel();
          fail(String(cause));
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", visibility);
      if (client) {
        observer.cancel();
        observer.setReceiver(() => {});
      } else observer.dispose();
      run.current?.archive.clear();
      scene.current?.dispose();
      scene.current = undefined;
    };
  }, []);

  const control = (action: (current: Run) => void) => {
    if (!run.current) return;
    interactionAt.current = performance.now();
    action(run.current);
    run.current.previousState = run.current.clock.state;
  };
  const save = () => {
    const report = JSON.parse(display.report);
    report.renderer = {
      ...report.renderer,
      gpu: scene.current?.estimateGpuMemory(),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "playback-performance.json";
    link.click();
    URL.revokeObjectURL(url);
  };
  const counts = { escaped: 0, starved: 0, zapped: 0, caught: 0, timedOut: 0 };
  for (const frameFly of display.frame?.flies ?? [])
    if (frameFly.body.outcome) counts[frameFly.body.outcome]++;
  const terminalCount = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <main
      className="playback-lab"
      data-testid="playback-lab"
      data-attempt-id={info?.spec.attemptId ?? ""}
      data-cursor-tick={display.cursor}
      data-computed-tick={display.computed}
      data-playback-state={error ? "error" : display.state}
      data-world-state={error ? "error" : worldReady ? "ready" : "loading"}
      data-fly-count={info?.spec.flyCount ?? 0}
    >
      <header>
        <div>
          <span className="eyebrow">
            {input ? "Fly escape · attempt" : "Fly escape · playback lab"}
          </span>
          <h1>{input ? (error ? "Flight interrupted" : "Off they go!") : "Twenty lives, one shared clock."}</h1>
        </div>
        {!input && <a href="/lab/lifecycle">Lifecycle lab</a>}
      </header>
      <section className="workspace">
        <div className={`world playback-world${input ? " game-world" : ""}`}>
          <div className="canvas" ref={container} />
          {!input && (
            <div className="world-note">
              20 independent brains · shared environment
              <span>Seed 42 · {DURATION_TICKS * TICK_SECONDS} game seconds</span>
            </div>
          )}
          <div className="playback-counters" aria-label="Outcomes at playback time">
            <b data-testid="active-count">{FLY_COUNT - terminalCount} {error ? "paused" : "active"}</b>
            {Object.entries(counts).map(([name, count]) => (
              <span key={name} data-testid={`outcome-${name}`}>
                {count} {name === "timedOut" ? "timed out" : name}
              </span>
            ))}
          </div>
          <div className="controls playback-controls">
            <div className="playback-status" role="status" data-testid="playback-status">
              <strong>
                {error
                  ? (input ? "Flight interrupted" : "Needs attention")
                  : !worldReady && info
                    ? "Loading world assets…"
                    : display.state === "loading"
                      ? (input ? "Waking up twenty tiny brains…" : "Loading the connectome…")
                      : display.state === "buffering"
                        ? (input ? "One moment…" : "Buffering — building enough lead")
                        : display.state === "ended"
                          ? (input ? "Every fly has a story." : "Playback complete")
                          : display.state === "hidden"
                            ? "Paused while you were away"
                            : requested
                              ? `Playing at ${display.speed}×`
                              : "Paused"}
              </strong>
              <span>
                {(display.cursor * TICK_SECONDS).toFixed(1)} /{" "}
                {((input?.level.durationTicks ?? DURATION_TICKS) * TICK_SECONDS).toFixed(1)} s
                {!input && <> · {(display.computed * TICK_SECONDS).toFixed(1)} s computed</>}
              </span>
            </div>
            <input
              aria-label="Playback time"
              data-testid="playback-seek"
              type="range"
              min={0}
              max={input?.level.durationTicks ?? DURATION_TICKS}
              step={0.1}
              ref={seekInput}
              defaultValue={0}
              disabled={!info || !!error}
              onChange={(event) =>
                control((current) =>
                  current.clock.seek(
                    Math.min(Number(event.target.value), current.archive.computedTick),
                    current.archive.computedTick,
                  ),
                )
              }
            />
            <button
              disabled={!info || !!error}
              onClick={() => {
                setRequested(!requested);
                control((current) => (requested ? current.clock.pause() : current.clock.play()));
              }}
            >
              {requested ? "Pause" : "Play"}
            </button>
            {([1, 2] as const).map((speed) => (
              <button
                key={speed}
                aria-pressed={display.speed === speed}
                disabled={!info || !!error}
                onClick={() => control((current) => current.clock.setSpeed(speed))}
              >
                {speed}×
              </button>
            ))}
            <button
              disabled={
                display.computed === 0 || !!error || (!!input && !run.current?.archive.complete)
              }
              onClick={() => {
                setRequested(true);
                control((current) => {
                  current.clock.seek(0, current.archive.computedTick);
                  current.clock.play();
                });
              }}
            >
              Replay
            </button>
            {onReturn ? (
              <button onClick={onReturn}>
                {error ? "Back to setup" : run.current?.archive.complete ? "Retry — edit setup" : "Cancel attempt"}
              </button>
            ) : (
              <button onClick={() => restart.current()}>New attempt</button>
            )}
            {!input && <button disabled={!info} onClick={save}>Download report</button>}
          </div>
        </div>
        <aside aria-label="All fly neural activity">
          <span className="eyebrow">Inside a tiny brain</span>
          <h2>What are they sensing?</h2>
          <p className="intro">
            Neurons combine incoming signals and send brief electrical pulses called spikes.
            These charts show each fly’s neural activity.
          </p>
          {input && display.state === "ended" && run.current?.archive.result && (
            <p role="status" data-testid="attempt-result">
              {run.current.archive.result.stars} stars ·{" "}
              {run.current.archive.result.outcomes.escaped} escaped
            </p>
          )}
          {error && (
            <p role="alert" className="error">
              {input ? "This flight was interrupted. You can try again from setup." : error}
            </p>
          )}
          {info && (
            <SciencePanel
              key={info.spec.attemptId}
              info={info}
              frame={display.frame}
              archive={run.current?.archive}
              selected={selected}
              selectFly={selectFly}
              register={(id, element) => {
                if (element) cards.current.set(id, element);
                else cards.current.delete(id);
              }}
            />
          )}
          <NeuralExplanations />
          <details>
            <summary>Playback and camera controls</summary>
            <p>
              Click a fly or its card to follow it. Scroll to get closer, or move to the edge
              to explore the house. Pause and rewind to take a closer look at what its neurons did.
            </p>
          </details>
          <details hidden={!!input}>
            <summary>Performance report</summary>
            <p>
              Active-work production: {display.rate.toFixed(2)} game seconds per wall second, before
              the clock’s safety discount. Detailed GPU estimates are collected when downloading a
              report; browser/driver overhead remains outside these estimates.
            </p>
            <pre data-testid="playback-report">{display.report}</pre>
          </details>
        </aside>
      </section>
    </main>
  );
}
