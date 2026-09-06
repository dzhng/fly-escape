import React, { useEffect, useRef, useState } from "react";
import { WorldView } from "@fly-escape/game-renderer";
import {
  BrainClient,
  type LifecycleScenario,
  type LifecycleInfo,
  type AttemptFrame,
  type LifecycleEvent,
} from "@fly-escape/sim-client";
import { NeuralExplanations } from "./neural-explanations";

const scenarios: [LifecycleScenario, string][] = [
  ["mealThenStarvation", "A meal, then finite life"],
  ["proboscisSilenced", "Eating neurons silenced"],
  ["openExit", "Open exit crossing"],
  ["blockedExit", "The same exit, blocked"],
];

export function LifecycleLab() {
  const container = useRef<HTMLDivElement>(null);
  const eventList = useRef<HTMLOListElement>(null);
  const view = useRef<WorldView | undefined>(undefined);
  const client = useRef<BrainClient | undefined>(undefined);
  const [scenario, setScenario] = useState<LifecycleScenario>("mealThenStarvation");
  const [info, setInfo] = useState<LifecycleInfo>();
  const [frame, setFrame] = useState<AttemptFrame>();
  const [events, setEvents] = useState<LifecycleEvent[]>([]);
  const [running, setRunning] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      view.current?.render();
      raf = requestAnimationFrame(draw);
    };
    draw();
    const brain = new BrainClient((reply) => {
      if (reply.type === "lifecycleReady") {
        setInfo(reply.info);
        view.current?.dispose();
        try {
          const scene = new WorldView(container.current!, reply.info.level.geometry);
          view.current = scene;
          const pose = reply.info.level.spawnPoses[0];
          scene.setPose({ x: pose.position.x, y: 0.1, z: pose.position.z, heading: pose.heading });
          scene.setContactRegions(
            reply.info.level.food,
            reply.info.level.zappers,
            reply.info.level.exit,
          );
        } catch (e) {
          setError(String(e));
        }
      } else if (reply.type === "lifecycleFrame") {
        setFrame(reply.frame);
        setEvents((previous) => [
          ...previous,
          ...reply.frame.flies.flatMap((fly) =>
            fly.events.map((event) => ({ flyId: fly.id, event })),
          ),
        ]);
        const body = reply.frame.flies[0].body;
        view.current?.setPose({
          x: body.pose.position.x,
          z: body.pose.position.z,
          y: body.mode === "flying" ? 0.6 : 0.1,
          heading: body.pose.heading,
        });
      } else if (reply.type === "error") setError(reply.message);
    });
    client.current = brain;
    brain.startLifecycle(6, "mealThenStarvation");
    return () => {
      brain.dispose();
      cancelAnimationFrame(raf);
      view.current?.dispose();
    };
  }, []);
  useEffect(() => {
    if (!running || error || frame?.result) return;
    const timer = setInterval(() => client.current?.step(), 100);
    return () => clearInterval(timer);
  }, [running, error, frame?.result]);
  useEffect(() => {
    if (eventList.current) eventList.current.scrollTop = eventList.current.scrollHeight;
  }, [events.length]);
  const reset = (next: LifecycleScenario) => {
    setScenario(next);
    setInfo(undefined);
    setFrame(undefined);
    setEvents([]);
    setError("");
    client.current?.startLifecycle(6, next);
  };
  const body = frame?.flies[0].body;
  const exitProbe = scenario === "openExit" || scenario === "blockedExit";
  const save = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ info, frame, events }, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "lifecycle-sample.json";
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <main>
      <header>
        <div>
          <div className="eyebrow">Fly escape · lifecycle lab</div>
          <h1>A meal buys more time.</h1>
        </div>
        <a href="/lab/fields">Sensory lab</a>
      </header>
      <section className="workspace">
        <div className="world">
          <div className="canvas" ref={container} />
          <div className="world-note">
            {scenario === "blockedExit"
              ? "Solid wall closes the exit"
              : exitProbe
                ? "Gold: exit opening"
                : "Green: food area · C: measured body center"}
          </div>
          <div className="controls">
            <button onClick={() => setRunning(!running)} disabled={!!frame?.result}>
              {frame?.result ? "Complete" : running ? "Pause" : "Resume"}
            </button>
            <button onClick={() => client.current?.step()} disabled={!info || !!frame?.result}>
              One tick
            </button>
            <button onClick={() => reset(scenario)}>Reset probe</button>
            <button onClick={save} disabled={!frame}>
              Save sample
            </button>
            <output data-testid="lifecycle-tick">Tick {frame?.tick ?? 0}</output>
          </div>
        </div>
        <aside>
          <div className="eyebrow">Recorded body state</div>
          <h2>Follow one life</h2>
          <label className="scenario-label">
            Probe
            <select
              aria-label="Probe"
              value={scenario}
              onChange={(e) => reset(e.target.value as LifecycleScenario)}
            >
              {scenarios.map(([id, name]) => (
                <option value={id} key={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <p className="intro">
            {exitProbe
              ? "These two probes differ only in the exit wall. Wind carries the fly across the opening or against the wall."
              : scenario === "proboscisSilenced"
                ? "The same neural graph runs with its proboscis motor neurons held inactive. Compare its activity and lifespan with the meal probe."
                : "Proboscis motor neurons carry signals toward the fly’s mouthpart muscles. Their spikes are brief electrical signals."}
          </p>
          {error && <p role="alert">{error}</p>}
          {!info && !error && <p>Loading the neural graph…</p>}
          <section className="sensor-card">
            <h3>{body?.outcome ?? body?.mode ?? "Waiting"}</h3>
            <label>
              Remaining reserve{" "}
              <output data-testid="reserve">
                {(body?.reserve ?? info?.level.initialReserve ?? 0).toFixed(2)}
              </output>
            </label>
            <progress
              aria-label="Remaining reserve"
              value={body?.reserve ?? info?.level.initialReserve ?? 0}
              max={info?.level.bodyConfig.reserveCapacity ?? 1}
            />
            <p>{((frame?.tick ?? 0) / 10).toFixed(1)} game seconds</p>
            {frame?.result && (
              <p data-testid="lifecycle-result">
                Escaped: {frame.result.outcomes.escaped} · Stars: {frame.result.stars}
              </p>
            )}
          </section>
          <p className="intro">
            Diagnostic seed {info?.spec.rootSeed ?? "6"}.{" "}
            {exitProbe
              ? "This tests physical crossing, not neural navigation."
              : "Selected to show a meal and its silenced comparison; not a claim that every fly finds food."}
          </p>
          <h3>Recorded events</h3>
          <ol
            ref={eventList}
            className="lifecycle-events"
            aria-label="Recorded events"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Home" || event.key === "End") {
                event.preventDefault();
                event.currentTarget.scrollTop =
                  event.key === "Home" ? 0 : event.currentTarget.scrollHeight;
              }
            }}
          >
            {events.map(({ event }, i) => (
              <li key={i}>
                <time>{(event.tick / 10).toFixed(1)} s</time>{" "}
                {event.kind.type === "modeChanged"
                  ? `${event.kind.from} → ${event.kind.to}`
                  : event.kind.type === "terminal"
                    ? event.kind.outcome
                    : event.kind.type === "feedingEnded"
                      ? `Feeding ended: ${event.kind.reason.replace(/([A-Z])/g, " $1").toLowerCase()}`
                      : "Feeding started"}
              </li>
            ))}
          </ol>
          <NeuralExplanations />
        </aside>
      </section>
    </main>
  );
}
