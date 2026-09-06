import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ChamberView } from "@fly-escape/game-renderer";
import { BrainClient, type BrainFrame, type BrainInfo } from "@fly-escape/sim-client";
import "./style.css";
import { FieldsLab } from "./fields";
import { NeuralExplanations } from "./neural-explanations";

function BrainLab() {
  const container = useRef<HTMLDivElement>(null);
  const view = useRef<ChamberView | undefined>(undefined);
  const client = useRef<BrainClient | undefined>(undefined);
  const [info, setInfo] = useState<BrainInfo>();
  const [frame, setFrame] = useState<BrainFrame>();
  const [error, setError] = useState("");
  const [seed, setSeed] = useState(42);
  const [activeSeed, setActiveSeed] = useState(42);
  const [running, setRunning] = useState(true);
  const [loadMs, setLoadMs] = useState(0);
  const [stepMs, setStepMs] = useState(0);
  const [wasmBytes, setWasmBytes] = useState(0);
  const [injection, setInjection] = useState({ left: 0, right: 0 });
  const history = useRef<number[]>([]);
  const [historyCopy, setHistoryCopy] = useState<number[]>([]);

  useEffect(() => {
    let animation = 0;
    const render = () => {
      view.current?.render();
      animation = requestAnimationFrame(render);
    };
    render();
    const brain = new BrainClient((reply) => {
      if (reply.type === "ready") {
        try {
          view.current?.dispose();
          view.current = new ChamberView(container.current!, reply.info.geometry);
          view.current.setPose(reply.info.initialPose);
          setInfo(reply.info);
          setLoadMs(reply.loadMs);
          setWasmBytes(reply.wasmBytes);
        } catch (e) {
          setError(`3D view unavailable: ${String(e)}`);
        }
      } else if (reply.type === "error") setError(reply.message);
      else if (reply.type === "frame") {
        setFrame(reply.frame);
        setStepMs(reply.stepMs);
        setWasmBytes(reply.wasmBytes);
        view.current?.setPose(reply.frame.pose);
        const value = reply.frame.neural.groups.find((g) => g.id === "turnL")?.meanVoltage ?? 0;
        history.current = [...history.current.slice(-119), value];
        setHistoryCopy(history.current);
      }
    });
    client.current = brain;
    brain.start(42);
    return () => {
      brain.dispose();
      cancelAnimationFrame(animation);
      view.current?.dispose();
    };
  }, []);
  useEffect(() => {
    if (!running || error) return;
    const timer = setInterval(() => client.current?.step(), 100);
    return () => clearInterval(timer);
  }, [running, error]);
  const reset = () => {
    setActiveSeed(seed);
    setInfo(undefined);
    setFrame(undefined);
    setError("");
    setInjection({ left: 0, right: 0 });
    history.current = [];
    setHistoryCopy([]);
    client.current?.start(seed);
  };
  const inject = (side: "left" | "right", value: number) => {
    const next = { ...injection, [side]: value };
    setInjection(next);
    client.current?.inject(next.left, next.right);
  };
  const sample = () => {
    const url = URL.createObjectURL(
      new Blob(
        [JSON.stringify({ seed: activeSeed, info, frame, loadMs, stepMs, wasmBytes }, null, 2)],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "brain-sample.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <main>
      <header>
        <div>
          <span className="eyebrow">FLY ESCAPE · NEURAL LAB</span>
          <h1>A fly’s neural wiring, in motion.</h1>
        </div>
        <span className="badge">
          {error
            ? "Needs attention"
            : !info
              ? "Loading connectome…"
              : running
                ? "Observing"
                : "Paused"}
        </span>
      </header>
      <section className="workspace">
        <div className="world">
          <div ref={container} className="canvas" />
          <div className="world-note">
            3D observation chamber <span>One fly · fixed neural input · no goal steering</span>
          </div>
          <div className="controls">
            <button disabled={!info || !!error} onClick={() => setRunning(!running)}>
              {running ? "Pause" : "Resume"}
            </button>
            <button disabled={!info || running || !!error} onClick={() => client.current?.step()}>
              One tick
            </button>
            <label>
              Seed{" "}
              <input
                aria-label="Seed"
                type="number"
                min="0"
                max="4294967295"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value) >>> 0)}
              />
            </label>
            <button onClick={reset}>Reset brain</button>
            <button disabled={!frame} onClick={sample}>
              Save sample
            </button>
          </div>
        </div>
        <aside aria-label="Fly neural data">
          <span className="eyebrow">FLY 01 · MEASURED ACTIVITY</span>
          <h2>Inside the fly</h2>
          <p className="intro">
            Neurons receive signals, combine them and sometimes fire. Follow their electrical
            activity as it spreads through the connectome.
          </p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="facts">
            <div>
              <strong>{info?.neuronCount.toLocaleString() ?? "—"}</strong>
              <span>mapped neurons</span>
            </div>
            <div>
              <strong>{info?.edgeCount.toLocaleString() ?? "—"}</strong>
              <span>signed connections</span>
            </div>
          </div>
          <div className="clock">
            <b data-testid="tick">Tick {frame?.tick ?? 0}</b>
            <span>{((frame?.tick ?? 0) * 0.1).toFixed(1)} game seconds</span>
          </div>
          <div className="group-heading">
            <span>Neural group</span>
            <span>Voltage</span>
            <span>Firing</span>
          </div>
          <div className="groups">
            {info?.groups.map((group) => {
              const activity = frame?.neural.groups.find((g) => g.id === group.id);
              return (
                <div className="group" key={group.id}>
                  <span>{group.label}</span>
                  <output>{activity?.meanVoltage.toFixed(3) ?? "—"}</output>
                  <output>{((activity?.spikeFraction ?? 0) * 100).toFixed(0)}%</output>
                </div>
              );
            })}
          </div>
          <div className="trace">
            <div>Left turning group · average electrical state</div>
            <svg
              viewBox="0 0 300 50"
              role="img"
              aria-label="Recorded average electrical state of left turning neurons"
            >
              <line x1="0" y1="25" x2="300" y2="25" />
              <polyline
                points={historyCopy
                  .map((v, i) => `${3 + (i * 294) / 119},${25 - v * 11}`)
                  .join(" ")}
              />
              {historyCopy.length > 0 && (
                <circle
                  cx={3 + ((historyCopy.length - 1) * 294) / 119}
                  cy={25 - historyCopy[historyCopy.length - 1] * 11}
                  r="2.4"
                />
              )}
            </svg>
            <div className="trace-scale">−2 to +2 model voltage · up to 12 game seconds</div>
          </div>
          <NeuralExplanations />
          <details>
            <summary>Input probe</summary>
            <p>
              Apply a constant modeled current to the left or right smell pathway. This tests brain
              responses; it does not command a turn.
            </p>
            {(["left", "right"] as const).map((side) => (
              <label className="injection" key={side}>
                {side} smell: {injection[side].toFixed(1)}
                <input
                  aria-label={`${side} smell current`}
                  type="range"
                  min="0"
                  max="3"
                  step=".1"
                  value={injection[side]}
                  disabled={!info}
                  onChange={(e) => inject(side, Number(e.target.value))}
                />
              </label>
            ))}
          </details>
          <footer>
            Load {loadMs.toFixed(0)} ms · last neural tick {stepMs.toFixed(2)} ms
            <br />
            Simulation runs in a Web Worker. Rendering stays on the main thread.
          </footer>
        </aside>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  location.pathname === "/lab/fields" ? <FieldsLab /> : <BrainLab />,
);
