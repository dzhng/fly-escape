import { loadFoodAssets } from "./food-assets";
import React, { useEffect, useRef, useState } from "react";
import {
  AttemptClient,
  type SetupFixture,
  type Placement,
  type PlacementEdit,
  type PlacementState,
  type ResolvedSetup,
  type StartAttempt,
  type ToolKind,
} from "@fly-escape/sim-client";
import { WorldView, loadFlyModel } from "@fly-escape/game-renderer";
import { loadHouseAssets } from "./house-assets";
import { AttemptPlayback } from "./playback";
import { loadProgress, saveProgress, awardResult, emptyProgress } from "./progress";
import "./setup.css";
import flyModelUrl from "../../../assets/fly/fly.glb?url";

type Intent = { edit: PlacementEdit; placement?: Placement; commit: boolean };
const names: Record<ToolKind, string> = {
  fruit: "Fruit",
  crumbs: "Scent crumbs",
  vinegar: "Vinegar",
  lamp: "Lamp",
  shade: "Shade",
  fan: "Fan",
};
const descriptions: Record<ToolKind, string> = {
  fruit: "Attractive odor and an edible landing surface",
  crumbs: "Attractive odor, without food",
  vinegar: "Repellent odor",
  lamp: "A local bright cue",
  shade: "A local shaded cue",
  fan: "A directional local wind",
};
export function SetupGame() {
  const [client] = useState(() => new AttemptClient(() => {}));
  const [fixture, setFixture] = useState<SetupFixture>();
  const [setup, setSetup] = useState<PlacementState>();
  const [progress, setProgress] = useState(loadProgress);
  const [input, setInput] = useState<StartAttempt>();
  const [tool, setTool] = useState<ToolKind>("fruit");
  const [selected, setSelected] = useState<number>();
  const [heading, setHeading] = useState(0);
  const [intent, setIntent] = useState<Intent>();
  const intentRef = useRef<Intent | undefined>(undefined);
  intentRef.current = intent;
  const checked = useRef<Intent | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [valid, setValid] = useState<boolean | null>(null);
  const [message, setMessage] = useState("Loading placement tools…");
  const [houseState, setHouseState] = useState("loading");
  const [storageFailed, setStorageFailed] = useState(false);
  const world = useRef<WorldView | undefined>(undefined);
  const container = useRef<HTMLDivElement>(null);
  const awarded = useRef<string | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const f: SetupFixture = await client.setup({ type: "fixture" });
        let resolved: ResolvedSetup;
        try {
          resolved = await client.setup({
            type: "resolve",
            level: f.level,
            placements: progress.setups[f.level.id] ?? [],
          });
        } catch {
          resolved = await client.setup({
            type: "resolve",
            level: f.level,
            placements: [],
          });
        }
        if (live) {
          setFixture(f);
          setSetup(resolved.state);
          setMessage("Choose a tool, then click open floor.");
        }
      } catch (error) {
        if (live) setMessage(String(error));
      }
    })();
    return () => {
      live = false;
      client.dispose();
    };
  }, []);
  useEffect(() => {
    setStorageFailed(!saveProgress(progress));
  }, [progress]);
  useEffect(() => {
    if (!fixture || input || !container.current) return;
    const view = new WorldView(container.current, fixture.level.geometry, 20);
    world.current = view;
    view.setPoses(
      fixture.level.spawnPoses.map((p) => ({
        x: p.position.x,
        z: p.position.z,
        heading: p.heading,
        y: 0,
      })),
    );
    view.setContactRegions([], [], fixture.level.exit);
    view.overview();
    view.enableCamera();
    let live = true;
    setHouseState("loading");
    void loadHouseAssets(view, () => live)
      .then(() => {
        if (live) setHouseState("ready");
      })
      .catch((error) => {
        if (live) setHouseState(String(error));
      });
    void loadFoodAssets(view, () => live).catch(error => { if (live) setMessage(String(error)); });
    void fetch(flyModelUrl)
      .then((response) => {
        if (!response.ok) throw new Error("Fly model could not load");
        return response.arrayBuffer();
      })
      .then(loadFlyModel)
      .then((model) => {
        if (live) view.setFlyModel(model);
        else model.dispose();
      })
      .catch((error) => {
        if (live) setMessage(String(error));
      });
    let raf = 0;
    const draw = () => {
      view.render();
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      live = false;
      cancelAnimationFrame(raf);
      view.dispose();
      world.current = undefined;
    };
  }, [fixture, input]);
  useEffect(() => {
    if (!fixture || !setup) return;
    world.current?.setPlacements(
      progress.preferences.showTools ? setup.placements : [],
      fixture.catalog,
      intent?.placement ? { placement: intent.placement, valid } : undefined,
    );
  }, [fixture, setup, intent, valid, input, progress.preferences.showTools]);
  useEffect(() => {
    if (!intent || checked.current === intent || busy || !fixture || !setup || input) return;
    checked.current = intent;
    setBusy(true);
    void client
      .setup({
        type: "edit",
        level: fixture.level,
        placements: setup.placements,
        edit: intent.edit,
      })
      .then((state: PlacementState) => {
        if (intentRef.current !== intent) return;
        setValid(true);
        setMessage(intent.commit ? "Setup updated." : "Valid placement — click to place.");
        if (intent.commit) {
          setSetup(state);
          setIntent(undefined);
          setSelected(undefined);
          setProgress((p) => ({
            ...p,
            setups: { ...p.setups, [fixture.level.id]: state.placements },
          }));
        }
      })
      .catch((error) => {
        if (intentRef.current !== intent) return;
        setValid(false);
        setMessage(String(error).replace(/^Error: /, ""));
        if (intent.commit) setIntent(undefined);
      })
      .finally(() => setBusy(false));
  }, [intent, busy, fixture, setup, input]);
  const pointerDown = useRef<{ x: number; y: number } | undefined>(undefined);
  const propose = (event: { clientX: number; clientY: number }, commit: boolean) => {
    if (intentRef.current?.commit) return;
    if (!setup || !fixture) return;
    const position = world.current?.floorPoint(event.clientX, event.clientY);
    if (!position) return;
    const existing = setup.placements.find((p) => p.id === selected);
    const placement: Placement = {
      id: existing?.id ?? Math.max(0, ...setup.placements.map((p) => p.id)) + 1,
      kind: existing?.kind ?? tool,
      position,
      heading,
    };
    setValid(null);
    setIntent({
      placement,
      commit,
      edit: existing
        ? { type: "move", id: existing.id, position, heading }
        : { type: "place", placement },
    });
  };
  const rotate = () => {
    const next = (heading + Math.PI / 2) % (2 * Math.PI);
    setHeading(next);
    const placement = setup?.placements.find((p) => p.id === selected);
    if (placement)
      setIntent({
        commit: true,
        edit: {
          type: "move",
          id: placement.id,
          position: placement.position,
          heading: next,
        },
      });
    else if (intent?.placement) {
      const p = { ...intent.placement, heading: next };
      setIntent({
        placement: p,
        commit: false,
        edit: { type: "place", placement: p },
      });
      setValid(null);
    }
  };
  if (input && fixture)
    return (
      <AttemptPlayback
        input={input}
        client={client}
        catalog={fixture.catalog}
        onReturn={() => {
          client.cancel();
          setInput(undefined);
          setIntent(undefined);
          setMessage("Your setup is ready to edit. The next Run uses a fresh seed.");
        }}
        onResult={(result) => {
          if (awarded.current === input.attemptId) return;
          awarded.current = input.attemptId;
          setProgress((p) => awardResult(p, fixture.level.id, result));
        }}
      />
    );
  return (
    <main className="setup-game" data-testid="setup-game" data-house-state={houseState}>
      <header>
        <div>
          <span className="eyebrow">Fly escape · setup fixture</span>
          <h1>Give twenty flies a way out.</h1>
        </div>
        <span>Best: {fixture ? (progress.bestStars[fixture.level.id] ?? 0) : 0} / 3 stars</span>
      </header>
      {houseState !== "ready" && (
        <p role={houseState === "loading" ? "status" : "alert"}>
          {houseState === "loading" ? "Loading house…" : houseState}
        </p>
      )}
      <section className="setup-layout">
        <div className="setup-world">
          <div
            ref={container}
            className="setup-canvas"
            onPointerMove={(e) => {
              if (!e.buttons) propose(e, false);
            }}
            onPointerDown={(e) => {
              pointerDown.current = { x: e.clientX, y: e.clientY };
            }}
            onClick={(e) => {
              const down = pointerDown.current;
              if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) propose(e, true);
            }}
            onPointerLeave={() => {
              if (!intent?.commit) setIntent(undefined);
            }}
          />
          <div className="setup-note">
            Five rooms · 20 flies · 60 game seconds
            <span>Integration fixture — campaign difficulty is still being authored.</span>
          </div>
          <div
            className={`placement-feedback ${valid === false ? "invalid" : ""}`}
            role="status"
            data-testid="placement-feedback"
          >
            {busy ? "Checking floor…" : message}
          </div>
        </div>
        <aside>
          <h2>Shape the environment</h2>
          <p>
            Choose a tool and click open floor. Select a placed tool below to move it. Drag the view
            to pan; scroll to zoom.
          </p>
          <div className="tool-palette">
            {setup?.remaining.map((stock) => (
              <button
                key={stock.kind}
                aria-pressed={tool === stock.kind && selected === undefined}
                disabled={stock.count === 0 || !!intent?.commit}
                title={descriptions[stock.kind]}
                onClick={() => {
                  setTool(stock.kind);
                  setSelected(undefined);
                  setIntent(undefined);
                }}
              >
                <b>{names[stock.kind]}</b>
                <span>{stock.count} left</span>
              </button>
            ))}
          </div>
          <p>{descriptions[tool]}</p>
          <button
            onClick={rotate}
            disabled={
              busy ||
              !!intent?.commit ||
              (setup?.placements.find((p) => p.id === selected)?.kind ?? tool) !== "fan"
            }
          >
            Rotate fan 90°
          </button>
          <h3>Placed tools</h3>
          <div className="placed-tools">
            {setup?.placements.map((p) => (
              <div key={p.id}>
                <button
                  aria-pressed={selected === p.id}
                  disabled={!!intent?.commit}
                  onClick={() => {
                    setSelected(p.id);
                    setTool(p.kind);
                    setHeading(p.heading);
                    setIntent(undefined);
                    setMessage("Click open floor to move this tool.");
                  }}
                >
                  {names[p.kind]} #{p.id}
                </button>
                <button
                  disabled={busy || !!intent?.commit}
                  aria-label={`Remove ${names[p.kind]} ${p.id}`}
                  onClick={() =>
                    setIntent({
                      commit: true,
                      edit: { type: "remove", id: p.id },
                    })
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <label>
            <input
              type="checkbox"
              checked={progress.preferences.showTools}
              onChange={(e) =>
                setProgress((p) => ({
                  ...p,
                  preferences: { showTools: e.target.checked },
                }))
              }
            />{" "}
            Show placed tools
          </label>
          <button
            className="run-setup"
            disabled={!fixture || !setup || houseState !== "ready" || busy || !!intent?.commit}
            onClick={() => {
              if (!fixture || !setup) return;
              setIntent(undefined);
              setInput({
                level: fixture.level,
                tuning: fixture.tuning,
                placements: structuredClone(setup.placements),
                flyCount: 20,
                attemptId: crypto.randomUUID(),
                rootSeed: crypto.getRandomValues(new BigUint64Array(1))[0].toString(),
              });
            }}
          >
            Run · release flies
          </button>
          <button
            disabled={!fixture || busy || !!intent?.commit}
            onClick={() => {
              if (!fixture) return;
              setBusy(true);
              setIntent(undefined);
              void client
                .setup({
                  type: "resolve",
                  level: fixture.level,
                  placements: [],
                })
                .then((resolved) => {
                  setSetup(resolved.state);
                  setProgress(emptyProgress());
                  setSelected(undefined);
                  setMessage("Saved progress and setup reset.");
                })
                .catch((error) => setMessage(String(error)))
                .finally(() => setBusy(false));
            }}
          >
            Reset progress and setup
          </button>
          {storageFailed && (
            <p role="status">
              Storage is unavailable. This session remains playable; changes may not survive reload.
            </p>
          )}
        </aside>
      </section>
    </main>
  );
}
