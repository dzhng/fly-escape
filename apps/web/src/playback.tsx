import React, { useEffect, useRef, useState } from "react";
import { WorldView, type FlyPose } from "@fly-escape/game-renderer";
import {
  AttemptClient,
  FrameArchive,
  PlaybackClock,
  type AttemptInfo,
  type AttemptFrame,
} from "@fly-escape/sim-client";
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
  upper?: AttemptFrame;
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
    run.lower = tick > 0 ? run.archive.frame(tick) : undefined;
    run.upper = undefined;
  }
  if (!run.upper && tick + 1 <= run.archive.computedTick) run.upper = run.archive.frame(tick + 1);
  const fraction = run.clock.cursorTick - tick;
  return run.info.level.spawnPoses.slice(0, run.info.spec.flyCount).map((initial, id) => {
    const a = run.lower?.flies[id].body;
    const b = run.upper?.flies[id].body ?? a;
    const from = a?.pose ?? initial,
      to = b?.pose ?? from;
    const angle = Math.atan2(
      Math.sin(to.heading - from.heading),
      Math.cos(to.heading - from.heading),
    );
    return {
      x: from.position.x + (to.position.x - from.position.x) * fraction,
      z: from.position.z + (to.position.z - from.position.z) * fraction,
      heading: from.heading + angle * fraction,
      y: a?.mode === "flying" ? 0.6 : 0.1,
    };
  });
}

export function PlaybackLab() {
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
    cards.current.get(id)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };
  const [requested, setRequested] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let raf = 0,
      lastFrameAt: number | null = null,
      lastPublished = -Infinity,
      lastSampleTick = -1,
      lastState = "",
      lastSpeed = 0;
    let requestedAt = performance.now();
    const fail = (message: string) => {
      if (run.current) {
        run.current.failed = true;
        run.current.clock.pause();
      }
      setError(message);
      setRequested(false);
      setDisplay((previous) => ({
        ...previous,
        state: "error",
        report: JSON.stringify({ ...JSON.parse(previous.report), error: message }, null, 2),
      }));
    };
    const observer = new AttemptClient((reply) => {
      if (reply.type === "ready") {
        const archive = new FrameArchive(
          reply.info.spec,
          reply.info.recordLayout,
          reply.info.archiveBytes,
        );
        const clock = new PlaybackClock(reply.info.spec.durationTicks);
        clock.play();
        clock.setHidden(document.hidden);
        run.current = {
          info: reply.info,
          failed: false,
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
        scene.current.setContactRegions(
          reply.info.level.food,
          reply.info.level.zappers,
          reply.info.level.exit,
        );
        scene.current.setPoses(sample(run.current));
        scene.current.enableSelection(selectFly);
        scene.current.selectFly(0);
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
      setRequested(true);
      setSelected(0);
      lastFrameAt = null;
      requestedAt = performance.now();
      observer.startLab(crypto.randomUUID(), "42", FLY_COUNT, DURATION_TICKS);
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
      if (current && !current.failed) {
        try {
          const rate = productionRate(current);
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
          scene.current?.setPoses(sample(current));
          if (!document.hidden) {
            if (lastFrameAt !== null) current.frameIntervals.add(now - lastFrameAt);
            lastFrameAt = now;
            scene.current?.render();
            if (interactionAt.current !== null) {
              current.interactions.add(performance.now() - interactionAt.current);
              interactionAt.current = null;
            }
          }
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
      observer.dispose();
      run.current?.archive.clear();
      scene.current?.dispose();
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
    report.renderer = { ...report.renderer, gpu: scene.current?.estimateGpuMemory() };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "playback-performance.json";
    link.click();
    URL.revokeObjectURL(url);
  };
  const fly = display.frame?.flies[selected];
  const counts = { escaped: 0, starved: 0, zapped: 0, timedOut: 0 };
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
      data-fly-count={info?.spec.flyCount ?? 0}
    >
      <header>
        <div>
          <span className="eyebrow">Fly escape · playback lab</span>
          <h1>Twenty lives, one shared clock.</h1>
        </div>
        <a href="/lab/lifecycle">Lifecycle lab</a>
      </header>
      <section className="workspace">
        <div className="world playback-world">
          <div className="canvas" ref={container} />
          <div className="world-note">
            20 independent brains · shared environment
            <span>Seed 42 · 600 game seconds · fixed placeholder models</span>
          </div>
          <div className="playback-counters" aria-label="Outcomes at playback time">
            <b data-testid="active-count">{FLY_COUNT - terminalCount} active</b>
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
                  ? "Needs attention"
                  : display.state === "loading"
                    ? "Loading the connectome…"
                    : display.state === "buffering"
                      ? "Buffering — building enough lead"
                      : display.state === "ended"
                        ? "Playback complete"
                        : display.state === "hidden"
                          ? "Hidden tab — playback frozen"
                          : requested
                            ? `Playing at ${display.speed}×`
                            : "Paused"}
              </strong>
              <span>
                {(display.cursor * TICK_SECONDS).toFixed(1)} / 600.0 s ·{" "}
                {(display.computed * TICK_SECONDS).toFixed(1)} s computed
              </span>
            </div>
            <input
              aria-label="Playback time"
              data-testid="playback-seek"
              type="range"
              min={0}
              max={DURATION_TICKS}
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
              disabled={display.computed === 0 || !!error}
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
            <button disabled={!info || !!error} onClick={() => { interactionAt.current = performance.now(); scene.current?.overview(); }}>Overview</button>
            <button onClick={() => restart.current()}>New attempt</button>
            <button disabled={!info} onClick={save}>
              Download report
            </button>
          </div>
        </div>
        <aside aria-label="Selected fly playback data">
          <span className="eyebrow">Recorded neural activity</span>
          <h2>Read any fly’s record</h2>
          <p className="intro">
            Each fly has its own neural state. Group voltage and firing are recorded during
            production and read back at the shared playback time.
          </p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="fly-roster" aria-label="Fly roster">
            {Array.from({ length: FLY_COUNT }, (_, id) => {
              const body = display.frame?.flies[id].body;
              return <button key={id} ref={element => { if (element) cards.current.set(id, element); else cards.current.delete(id); }}
                className="fly-card" data-testid={`fly-card-${id}`} data-fly-id={id}
                aria-label={`Select fly ${id + 1}`} aria-pressed={selected === id}
                disabled={!info || !!error} onClick={() => selectFly(id)}>
                <strong>Fly {String(id + 1).padStart(2, "0")}</strong>
                <span>{body?.outcome ?? body?.mode ?? "Initial state"}</span>
                <small>Reserve {(body?.reserve ?? info?.level.initialReserve ?? 0).toFixed(2)}</small>
              </button>;
            })}
          </div>
          <div
            className="sensor-card"
            data-testid="selected-fly"
            data-fly-id={selected}
            data-sample-tick={display.frame?.tick ?? 0}
          >
            <h3>{fly?.body.outcome ?? fly?.body.mode ?? "Initial state"}</h3>
            <p>
              Reserve{" "}
              <output data-testid="selected-reserve">
                {(fly?.body.reserve ?? info?.level.initialReserve ?? 0).toFixed(3)}
              </output>
            </p>
            <p>
              Sample tick <output data-testid="selected-tick">{display.frame?.tick ?? 0}</output> ·{" "}
              {(display.cursor * TICK_SECONDS).toFixed(1)} s cursor
            </p>
            <p>
              {fly?.neural
                ? `${fly.neural.spikeCount} neurons fired this tick`
                : fly?.body.outcome
                  ? "Terminal fly — no new neural measurement"
                  : "Waiting for the first recorded measurement"}
            </p>
          </div>
          <div className="group-heading">
            <span>Neural group</span>
            <span>Voltage</span>
            <span>Firing</span>
          </div>
          <div className="groups">
            {info?.groups.map((group) => {
              const activity = fly?.neural?.groups.find((g) => g.id === group.id);
              return (
                <div className="group" key={group.id}>
                  <span>{group.label}</span>
                  <output>{activity?.meanVoltage.toFixed(3) ?? "—"}</output>
                  <output>
                    {activity ? `${(activity.spikeFraction * 100).toFixed(1)}%` : "—"}
                  </output>
                </div>
              );
            })}
          </div>
          <NeuralExplanations />
          <details>
            <summary>Playback and camera controls</summary>
            <p>
              Pause stops the shared playback cursor. Scrub within computed time or replay the
              stored record. A speed increase may need more buffering. A hidden tab freezes playback
              and stops new production credits.
            </p>
          </details>
          <details>
            <summary>Performance report</summary>
            <p>
              Active-work production: {display.rate.toFixed(2)} game seconds per wall second, before
              the clock’s safety discount. Model placeholders and GPU memory remain separate
              measurement work.
            </p>
            <pre data-testid="playback-report">{display.report}</pre>
          </details>
        </aside>
      </section>
    </main>
  );
}
