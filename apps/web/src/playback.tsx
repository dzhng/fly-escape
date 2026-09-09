import { PlaybackControls } from "./playback-controls";
import { frameBesidePanel } from "./world-framing";
import { StarCelebration, WatchedStars } from "./star-celebration";
import { Stars } from "./stars";
import { DepartureTail } from "./departure-tail";
import type { PreviewUpdate } from "./fly-preview";
import type { RoomDetail, RoomFloor, WorldLightingAuthoring } from "@fly-escape/game-renderer";
import { loadWorldAssets } from "./world-assets";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  WorldView,
  defaultWorldLighting,
  flyAnimation,
  departingFly,
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
  type PlaybackMode,
  type ToolDef,
} from "@fly-escape/sim-client";
import { SciencePanel } from "./science-panel";
import { NeuralExplanations } from "./neural-explanations";
import "./playback.css";

const LAB_FLY_COUNT = 20;
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
  watchedStars: WatchedStars;
  motionSampler?: MotionSampler;
  archive: FrameArchive;
  clock: PlaybackClock;
  departureTail: DepartureTail;
  requestedAt: number;
  readyAt: number;
  assetsReadyAt: number | null;
  firstChunkAt: number | null;
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
  mode: PlaybackMode;
  /** Game seconds per wall second fast mode uses for this horizon. */
  fastMultiplier: number;
  frame?: AttemptFrame;
  rate: number;
  report: string;
};
const initialDisplay: Display = {
  cursor: 0,
  computed: 0,
  state: "loading",
  mode: "realTime",
  fastMultiplier: 1,
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
    run.lower = run.archive.frame(tick, { retina: false });
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
  return poses.map((pose, id) => {
    const outcome = run.lower?.flies[id].body.outcome;
    const rendered: FlyPose = {
      x: pose.x, z: pose.z, heading: pose.heading, y: pose.height,
      rotation: pose.rotation,
      bodyMode: motions[id].mode,
      animation: flyAnimation(motions[id], TICK_SECONDS),
      outcome: outcome === "zapped" || outcome === "escaped" ? outcome : undefined,
    };
    return outcome === "escaped"
      ? departingFly(rendered, (run.clock.cursorTick - motions[id].cursorTick) * TICK_SECONDS + run.departureTail.seconds, run.info.level.exit.outward)
      : rendered;
  });
}

export function PlaybackLab() {
  return <AttemptPlayback />;
}
export function AttemptPlayback({
  input,
  client,
  world,
  catalog = [],
  roomDetails,
  roomFloors,
  lighting,
  onReturn,
  onStars,
}: {
  input?: StartAttempt;
  client?: AttemptClient;
  world?: WorldView;
  catalog?: ToolDef[];
  roomDetails?: readonly RoomDetail[];
  roomFloors?: readonly RoomFloor[];
  lighting?: WorldLightingAuthoring;
  onReturn?: () => void;
  onStars?: (stars: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const seekInput = useRef<HTMLInputElement>(null);
  const scene = useRef<WorldView | undefined>(undefined);
  const run = useRef<Run | undefined>(undefined);
  const restart = useRef<() => void>(() => {});
  const interactionAt = useRef<number | null>(null);
  const [celebration, setCelebration] = useState<number>();
  const finishCelebration = useCallback(() => setCelebration(undefined), []);
  const [info, setInfo] = useState<AttemptInfo>();
  useEffect(() => {
    if (!input || !info || !scene.current || !container.current) return;
    return frameBesidePanel(scene.current, container.current, container.current.closest(".playback-lab")!.querySelector("aside")!);
  }, [input, info]);
  const [display, setDisplay] = useState(initialDisplay);
  const [selected, setSelected] = useState<number | null>(null);
  const cards = useRef(new Map<number, HTMLButtonElement>());
  const selectFly = (id: number | null) => {
    interactionAt.current = performance.now();
    setSelected(id);
    scene.current?.selectFly(id);
    if (id !== null) cards.current.get(id)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };
  const previewUpdate = useRef<PreviewUpdate | null>(null);
  const [requested, setRequested] = useState(true);
  const requestedRef = useRef(requested);
  requestedRef.current = requested;
  const [error, setError] = useState("");
  const [recordError, setRecordError] = useState(false);
  const [worldReady, setWorldReady] = useState(!!world);
  const [returnTarget, setReturnTarget] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    let raf = 0,
      lastFrameAt: number | null = null,
      lastPublished = -Infinity,
      lastSampleTick = -1,
      lastState = "",
      lastMode = "";
    let requestedAt = performance.now();
    let lastDiagnosticAt = -Infinity;
    let renderFailed = false;
    let sampledPoses: FlyPose[] = [];
    const fail = (message: string, recordFailure = false) => {
      console.error("[Fly escape] attempt failed", { message, spec: run.current?.info.spec });
      if (run.current) {
        run.current.failed = true;
        run.current.clock.pause();
      }
      setError(message);
      setRecordError(recordFailure);
      setRequested(false);
      setDisplay((previous) => ({
        ...previous,
        state: "error",
        computed: run.current?.archive.computedTick ?? 0,
        frame: previous.frame ?? (run.current?.archive.computedTick ? run.current.archive.frame(Math.floor(run.current.clock.cursorTick), { retina: false }) : undefined),
        report: JSON.stringify({ ...JSON.parse(previous.report), state: "error", error: message }, null, 2),
      }));
    };
    const observer = client ?? new AttemptClient(() => {});
    observer.setReceiver((reply) => {
      if (reply.type === "ready") {
        console.info("[Fly escape] attempt ready", reply.info.spec);
        lastDiagnosticAt = -Infinity;
        setCelebration(undefined);
        const archive = new FrameArchive(
          reply.info.spec,
          reply.info.recordLayout,
          reply.info.archiveBytes,
          reply.info.initialBodies,
        );
        const clock = new PlaybackClock(
          reply.info.spec.durationTicks,
          TICK_SECONDS,
          "realTime",
        );
        if (requestedRef.current) clock.play();
        clock.setHidden(document.hidden);
        run.current = {
          info: reply.info,
          failed: false,
          assetsReady: false,
          watchedStars: new WatchedStars(),
          archive,
          clock,
          requestedAt,
          readyAt: performance.now(),
          assetsReadyAt: null,
          firstChunkAt: null,
          firstPlayAt: null,
          productionMs: 0,
          activeNeuralSteps: 0,
          departureTail: new DepartureTail(),
          rateWindow: [],
          wasmBytes: reply.wasmBytes,
          underruns: 0,
          previousState: "buffering",
          cachedTick: -1,
          frameIntervals: new TimingSamples(),
          interactions: new TimingSamples(),
        };
        if (!world) scene.current?.dispose();
        scene.current = world ?? new WorldView(
          container.current!,
          reply.info.level.geometry,
          reply.info.spec.flyCount,
          roomFloors,
          lighting,
        );
        scene.current.attach(container.current!);
        scene.current.setContactGeometry(
          reply.info.resolvedSetup.state.food.slice(0, reply.info.level.food.length),
          reply.info.level.zappers,
          reply.info.level.exit,
          false,
        );
        scene.current.setSupportSurfaces([
          ...reply.info.resolvedSetup.state.food, ...reply.info.resolvedSetup.state.objects,
        ]);
        scene.current.setPlacements(reply.info.spec.placements, catalog, undefined, reply.info.resolvedSetup.fixedPlacements);
        scene.current.setPoses(sample(run.current));
        scene.current.enableSelection(selectFly);
        scene.current.selectFly(null);
        const target = scene.current;
        setWorldReady(false);
        void Promise.all([
          world ? Promise.resolve() : loadWorldAssets(target, () => scene.current === target, roomDetails),
          loadMotionSampler(),
        ]).then(([, sampler]) => {
          if (scene.current === target && run.current) {
            run.current.motionSampler = sampler;
            run.current.assetsReady = true;
            run.current.assetsReadyAt = performance.now();
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
        current.firstChunkAt ??= performance.now();
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
      } else if (reply.type === "error") {
        fail(reply.message, !!reply.recordError);
      }
    });
    restart.current = () => {
      run.current?.archive.clear();
      run.current = undefined;
      sampledPoses = [];
      if (!world) scene.current?.dispose();
      scene.current = world;
      if (world) {
        world.attach(container.current!);
        world.resetAttempt();
        world.enableCamera();
        world.render();
      }
      setInfo(undefined);
      setDisplay(initialDisplay);
      if (seekInput.current) seekInput.current.value = "0";

      lastPublished = -Infinity;
      lastSampleTick = -1;
      lastState = "";
      lastMode = "";
      setError("");
      setRecordError(false);
      renderFailed = false;
      setRequested(true);
      setSelected(null);
      lastFrameAt = null;
      requestedAt = performance.now();
      if (input) observer.start(input, input.tuning.cues.some(cue => cue.pathway === "vision")
        ? { roomDetails: roomDetails ?? [], roomFloors: roomFloors ?? [], lighting: lighting ?? defaultWorldLighting }
        : undefined);
      else observer.startLab(crypto.randomUUID(), "42", LAB_FLY_COUNT, DURATION_TICKS);
    };
    const visibility = () => {
      observer.setHidden(document.hidden);
      if (run.current) {
        run.current.clock.setHidden(document.hidden);
        run.current.departureTail.suspend();
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
            current.departureTail.update(now, current.clock, current.archive.complete ? current.archive.computedTick : undefined);
            const poses = sample(current);
            sampledPoses = poses;
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
              if (input && current.lower) {
                const earned = current.watchedStars.observe(
                  current.lower.flies.filter(fly => fly.body.outcome === "escaped").length,
                  current.info.level.starThresholds,
                  current.assetsReady && !current.failed &&
                    (current.clock.state === "playing" || current.clock.state === "ended"),
                );
                if (earned !== undefined) {
                  setCelebration(earned);
                  onStars?.(earned);
                }
              }
              if (scene.current) previewUpdate.current?.(sampledPoses, scene.current.cameraRotation);
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
              current.clock.mode !== lastMode
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
                mode: current.clock.mode,
                speed: current.clock.speed,
                fastMultiplier: current.clock.fastMultiplier,
                complete: current.archive.complete,
                initialWaitMs:
                  current.firstPlayAt === null ? null : current.firstPlayAt - current.requestedAt,
                warmWaitMs:
                  current.firstPlayAt === null ? null : current.firstPlayAt - current.readyAt,
                startup: {
                  attemptReadyMs: current.readyAt - current.requestedAt,
                  firstChunkMs: current.firstChunkAt === null ? null : current.firstChunkAt - current.requestedAt,
                  assetsReadyMs: current.assetsReadyAt === null ? null : current.assetsReadyAt - current.requestedAt,
                  firstPlaybackMs: current.firstPlayAt === null ? null : current.firstPlayAt - current.requestedAt,
                },
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
                mode: current.clock.mode,
                fastMultiplier: current.clock.fastMultiplier,
                frame: current.lower,
                rate,
                report: JSON.stringify(report, null, 2),
              });
              lastSampleTick = sampleTick;
              lastState = current.clock.state;
              lastMode = current.clock.mode;
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
      if (!world) scene.current?.dispose();
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
  const timedRound = input?.level.bodyConfig.life.kind === "timed";
  const secondsLeft = Math.ceil(Math.max(0,
    ((input?.level.durationTicks ?? DURATION_TICKS) - display.cursor) * TICK_SECONDS));
  const recordUnavailable = !!error && !run.current?.archive.computedTick;
  return (
    <main
      className={`playback-lab${input ? " campaign-playback" : ""}`}
      data-testid="playback-lab"
      data-attempt-id={info?.spec.attemptId ?? ""}
      data-cursor-tick={display.cursor}
      data-computed-tick={display.computed}
      data-playback-state={error ? "error" : display.state}
      data-world-state={error ? "error" : worldReady ? "ready" : "loading"}
      data-world-assets-ready={worldReady}
      data-fly-count={info?.spec.flyCount ?? 0}
    >
      {!input && <header>
        <div>
          <span className="eyebrow">
            {input ? "Fly escape · attempt" : "Fly escape · playback lab"}
          </span>
          <h1>{input ? (error ? "Flight interrupted" : "Off they go!") : "Twenty lives, one shared clock."}</h1>
        </div>
        {!input && <a href="/lab/lifecycle">Lifecycle lab</a>}
      </header>}
      <section className="workspace">
        <div className={`world playback-world${input ? " game-world" : ""}`}>
          <div className="canvas" ref={container} />
          {celebration !== undefined && <StarCelebration key={celebration} stars={celebration} onFinish={finishCelebration} />}
          {!input && (
            <div className="world-note">
              20 independent brains · shared environment
              <span>Seed 42 · {DURATION_TICKS * TICK_SECONDS} game seconds</span>
            </div>
          )}
          <div className="controls playback-controls">
            <div className="playback-status" role="status" data-testid="playback-status">
              <strong>
                {error
                  ? (input ? "Flight interrupted" : "Needs attention")
                  : !worldReady && info
                    ? "Loading world assets…"
                    : display.state === "loading"
                      ? (input ? "Waking up tiny brains…" : "Loading the connectome…")
                      : display.state === "buffering"
                        ? (input ? "One moment…" : "Buffering — building enough lead")
                        : display.state === "ended"
                          ? (input ? "Every fly has a story." : "Playback complete")
                          : display.state === "hidden"
                            ? "Paused while you were away"
                            : requested
                              ? display.mode === "fast"
                                ? "Playing fast"
                                : "Playing in real time"
                              : "Paused"}
              </strong>
              {!error && <span data-testid="round-time">
                {timedRound
                  ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")} left`
                  : <>
                      {(display.cursor * TICK_SECONDS).toFixed(1)} /{" "}
                      {((input?.level.durationTicks ?? DURATION_TICKS) * TICK_SECONDS).toFixed(1)} s
                      {!input && <> · {(display.computed * TICK_SECONDS).toFixed(1)} s computed</>}
                    </>}
              </span>}
            </div>
            {!error && <input
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
            />}
            <PlaybackControls
              inactive={!!error}
              ready={worldReady && !!info && !error}
              fastReady={worldReady && !!run.current?.archive.complete && !error}
              replayReady={worldReady && display.computed > 0 && !error && (!input || !!run.current?.archive.complete)}
              requested={requested}
              mode={display.mode}
              returnToSetup={!!onReturn}
              returnTarget={returnTarget}
              returnLabel={onReturn ? (error ? "Back to setup" : run.current?.archive.complete ? "Retry — edit setup" : "Cancel attempt") : error ? "Start a new attempt" : "New attempt"}
              onPause={() => { setRequested(false); control(current => current.clock.pause()); }}
              onResume={() => { setRequested(true); control(current => current.clock.play()); }}
              onPlay={() => { setRequested(true); control(current => { current.clock.setMode("realTime"); current.clock.play(); }); }}
              onFast={() => { setRequested(true); control(current => { current.clock.setMode("fast"); current.clock.play(); }); }}
              onReplay={() => {
                setRequested(true);
                control(current => {
                  current.clock.seek(0, current.archive.computedTick);
                  current.clock.setMode("realTime");
                  current.clock.play();
                });
              }}
              onReturn={onReturn ?? (() => restart.current())}
            />
            {!input && <button disabled={!info} onClick={save}>Download report</button>}
          </div>
        </div>
        <aside aria-label="All fly neural activity">
          {!input && <>
          <span className="eyebrow">Inside a tiny brain</span>
          <h2>What are they sensing?</h2>
          <p className="intro">
            Neurons combine incoming signals and send brief electrical pulses called spikes.
            These charts show each fly’s neural activity.
          </p>
          </>}
          {input && display.state === "ended" && run.current?.archive.result && (
            <p role="status" data-testid="attempt-result">
              <Stars count={run.current.archive.result.stars} />{" "}
              {run.current.archive.result.outcomes.escaped} escaped
            </p>
          )}
          {error && (
            <div role="alert" className="error recording-error">
              <p>{input && !recordError ? "This flight was interrupted. You can try again from setup." : error}</p>
              <div ref={setReturnTarget} />
            </div>
          )}
          {recordUnavailable ? <p className="record-unavailable" role="status"><strong>Recording unavailable</strong><br />No recorded frames are available.</p> : <div className="playback-counters" aria-label="Outcomes at playback time">
            <b data-testid="active-count">{error ? `${info?.spec.flyCount ?? 0} recorded flies` : `${(info?.spec.flyCount ?? input?.flyCount ?? LAB_FLY_COUNT) - terminalCount} active`}</b>
            {Object.entries(counts).filter(([name]) => !timedRound || name !== "starved").map(([name, count]) => (
              <span key={name} data-testid={`outcome-${name}`}>
                {count} {name === "timedOut" ? "dead" : name}
              </span>
            ))}
          </div>}
          {error && !recordUnavailable && <p className="record-paused">Fly states recorded at {((display.frame?.tick ?? 0) * TICK_SECONDS).toFixed(1)}{"\u00a0"}s.</p>}
          {info && !recordUnavailable && (
            <SciencePanel previews={previewUpdate}
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
          {!recordUnavailable && <NeuralExplanations />}
          <details>
            <summary>{error ? "Camera controls" : "Playback and camera controls"}</summary>
            <p>
              {error ? `${recordUnavailable ? "" : "Click a recorded fly or its card to inspect it. "}Drag to move the camera and scroll to get closer.` : "Click a fly or its card to follow it. Left- or right-click the scene to clear the selection. Drag to move the camera. Scroll to get closer, or move to the edge to explore the house. Pause and rewind to take a closer look at what its neurons did."}
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
