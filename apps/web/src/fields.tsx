import { NeuralExplanations } from "./neural-explanations";
import React, { useEffect, useRef, useState } from "react";
import { ChamberView, FIELD_OVERLAY_HALF_VALUES, FIELD_COLORS } from "@fly-escape/game-renderer";
import {
  BrainClient,
  type FieldScenario,
  type FieldLabInfo,
  type FieldLabFrame,
} from "@fly-escape/sim-client";

const scenarios: [FieldScenario, string][] = [
  ["inhibitoryOdor", "Inhibitory smell pathway"],
  ["excitatoryOdor", "Excitatory smell pathway"],
  ["lamp", "Light"],
  ["shade", "Shade"],
  ["wind", "Wind and odor"],
  ["exit", "Local exit cue"],
];
const channelFor = (scenario: FieldScenario) =>
  scenario === "lamp" || scenario === "shade"
    ? "brightness"
    : scenario === "exit"
      ? "exitCue"
      : "odor";

export function FieldsLab() {
  const containers = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const views = useRef<ChamberView[]>([]);
  const client = useRef<BrainClient | undefined>(undefined);
  const antennaOffset = useRef(0);
  const scenarioRef = useRef<FieldScenario>("inhibitoryOdor");
  const [scenario, setScenario] = useState<FieldScenario>("inhibitoryOdor");
  const [info, setInfo] = useState<FieldLabInfo>();
  const [frame, setFrame] = useState<FieldLabFrame>();
  const [running, setRunning] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      views.current.forEach((v) => v.render());
      raf = requestAnimationFrame(draw);
    };
    draw();
    const brain = new BrainClient((reply) => {
      if (reply.type === "fieldsReady") {
        setInfo(reply.info);
        antennaOffset.current = reply.info.brain.antennaOffset;
        try {
          views.current.forEach((v) => v.dispose());
          views.current = containers.map((container, i) => {
            const view = new ChamberView(container.current!, reply.info.brain.geometry);
            view.setPose(reply.info.brain.initialPose);
            view.setSensoryMarkers(reply.info.brain.initialPose, reply.info.brain.antennaOffset);
            view.setWind(reply.info.brain.initialPose, reply.info.grids[i].wind);
            view.setFieldGrid(reply.info.grids[i], channelFor(reply.info.scenario));
            return view;
          });
        } catch (e) {
          setError(String(e));
        }
      } else if (reply.type === "fieldsFrame") {
        setFrame(reply.frame);
        views.current.forEach((v, i) => {
          v.setPose(reply.frame.flies[i].pose);
          v.setSensoryMarkers(reply.frame.flies[i].sensoryPose, antennaOffset.current);
          v.setWind(reply.frame.flies[i].pose, reply.frame.flies[i].sensory.wind);
          v.setFieldGrid(reply.frame.grids[i], channelFor(scenarioRef.current));
        });
      } else if (reply.type === "error") setError(reply.message);
    });
    client.current = brain;
    brain.startFields(42, scenarioRef.current);
    return () => {
      brain.dispose();
      cancelAnimationFrame(raf);
      views.current.forEach((v) => v.dispose());
    };
  }, []);
  useEffect(() => {
    if (!running || error) return;
    const timer = setInterval(() => client.current?.step(), 100);
    return () => clearInterval(timer);
  }, [running, error]);
  const reset = (next: FieldScenario) => {
    scenarioRef.current = next;
    setScenario(next);
    setInfo(undefined);
    setFrame(undefined);
    setError("");
    client.current?.startFields(42, next);
  };
  const save = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ seed: 42, info, frame }, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "fields-sample.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <main>
      <header>
        <div>
          <span className="eyebrow">FLY ESCAPE · SENSORY LAB</span>
          <h1>What reaches the fly?</h1>
        </div>
        <a href="/lab/brain">Neural lab</a>
      </header>
      <section className="workspace">
        <div className="field-worlds">
          {containers.map((container, i) => (
            <div className="world" key={i}>
              <div ref={container} className="canvas" />
              <div className="world-note">
                {i === 0 ? "Source on initial left" : "Mirrored source on initial right"}
                <span>Same brain seed · same room geometry</span>
                {scenario === "wind" && (
                  <span>
                    Arrow = wind direction · x {info?.grids[i].wind.x.toFixed(1) ?? "—"}, z{" "}
                    {info?.grids[i].wind.z.toFixed(1) ?? "—"} units/s
                  </span>
                )}
              </div>
            </div>
          ))}
          <div className="field-controls">
            <button disabled={!info || !!error} onClick={() => setRunning(!running)}>
              {running ? "Pause" : "Resume"}
            </button>
            <button disabled={!info || running || !!error} onClick={() => client.current?.step()}>
              One tick
            </button>
            <button onClick={() => reset(scenario)}>Reset pair</button>
            <button disabled={!frame} onClick={save}>
              Save sample
            </button>
            <b data-testid="field-tick">Tick {frame?.tick ?? 0}</b>
          </div>
        </div>
        <aside aria-label="Sensory comparison">
          <span className="eyebrow">ONE FIELD OWNER</span>
          <h2>Follow the signal</h2>
          <p className="intro">
            Sensory input changes a neuron’s electrical state. Connected neurons receive its spikes,
            and the response spreads through the circuit. Compare the two sides without assuming
            what behavior a pathway produces.
          </p>
          <label className="scenario-label">
            Cue{" "}
            <select
              aria-label="Cue"
              value={scenario}
              onChange={(e) => reset(e.target.value as FieldScenario)}
            >
              {scenarios.map(([id, label]) => (
                <option value={id} key={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <p className="field-legend">
            Overlay:{" "}
            <b>{channelFor(scenario) === "exitCue" ? "local exit signal" : channelFor(scenario)}</b>
            <span
              className="legend-ramp"
              style={{
                background: `linear-gradient(to right,#e7ece6,rgb(${FIELD_COLORS[channelFor(scenario)].join(",")}))`,
              }}
            />
            Clear = zero. Color grows with the measured value;{" "}
            {FIELD_OVERLAY_HALF_VALUES[channelFor(scenario)]} cue unit gives half intensity. The
            scale stays fixed.
          </p>
          {frame?.flies.map((fly, i) => (
            <section className="sensor-card" key={i}>
              <h3>{i === 0 ? "Left-source chamber" : "Right-source chamber"}</h3>
              <div className="sensor-row">
                <span>Input at tick start</span>
                <b>Left</b>
                <b>Right</b>
              </div>
              {(["odor", "brightness", "exitCue"] as const).map((key) => (
                <div className="sensor-row" key={key}>
                  <span>
                    {key === "exitCue"
                      ? "Local exit"
                      : key === "brightness"
                        ? "Light reaching fly"
                        : "Odor"}
                  </span>
                  <output>{fly.sensory.left[key].toFixed(3)}</output>
                  <output>{fly.sensory.right[key].toFixed(3)}</output>
                </div>
              ))}
              {(() => {
                const prefix =
                  scenario === "lamp" || scenario === "shade"
                    ? "vision"
                    : scenario === "inhibitoryOdor" || scenario === "exit"
                      ? "odorInh"
                      : "odorExc";
                const activity = ["L", "R"].map((side) =>
                  fly.neural.groups.find((g) => g.id === prefix + side),
                );
                return (
                  <>
                    <div className="sensor-row">
                      <span>Neuron voltage</span>
                      {activity.map((g, j) => (
                        <output key={j}>{g?.meanVoltage.toFixed(3) ?? "—"}</output>
                      ))}
                    </div>
                    <div className="sensor-row">
                      <span>Firing this tick</span>
                      {activity.map((g, j) => (
                        <output key={j}>{((g?.spikeFraction ?? 0) * 100).toFixed(0)}%</output>
                      ))}
                    </div>
                  </>
                );
              })()}
              <p>
                Sampled at x {fly.sensoryPose.x.toFixed(2)}, z {fly.sensoryPose.z.toFixed(2)}
                <br />
                Neural turn <output>{fly.neural.motor.turn.toFixed(4)}</output>
                <br />
                <small>Positive turns right; negative turns left.</small>
              </p>
            </section>
          ))}
          <NeuralExplanations />
        </aside>
      </section>
    </main>
  );
}
