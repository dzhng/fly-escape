import type { RoomDetail } from "@fly-escape/game-renderer";
import { loadWorldAssets } from "./world-assets";
import React, { useEffect, useRef, useState } from "react";
import {
  AttemptClient,
  type LevelDef,
  type AttemptTuning,
  type ToolDef,
  type Placement,
  type PlacementEdit,
  type PlacementState,
  type ResolvedSetup,
  type StartAttempt,
  type ToolKind,
} from "@fly-escape/sim-client";
import { WorldView } from "@fly-escape/game-renderer";
import { AttemptPlayback } from "./playback";
import { type Progress, awardResult, emptyProgress } from "./progress";
import "./setup.css";

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
export function SetupGame({
  content,
  progress,
  setProgress,
  storageFailed,
  onAttemptChange,
}: {
  content: {
    roomDetails?: readonly RoomDetail[];
    level: LevelDef;
    tuning: AttemptTuning;
    catalog: ToolDef[];
    title: string;
    description: string;
  };
  progress: Progress;
  setProgress: React.Dispatch<React.SetStateAction<Progress>>;
  storageFailed: boolean;
  onAttemptChange?: (active: boolean) => void;
}) {
  const [client] = useState(() => new AttemptClient(() => {}));
  const [setup, setSetup] = useState<PlacementState>();
  const [input, setInput] = useState<StartAttempt>();
  const [tool, setTool] = useState<ToolKind | undefined>(
    content.level.placementRules.inventory.find((stock) => stock.count > 0)?.kind,
  );
  const [selected, setSelected] = useState<number>();
  const [heading, setHeading] = useState(0);
  const [intent, setIntent] = useState<Intent>();
  const intentRef = useRef<Intent | undefined>(undefined);
  intentRef.current = intent;
  const checked = useRef<Intent | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [valid, setValid] = useState<boolean | null>(null);
  const [message, setMessage] = useState("Loading placement tools…");
  const [worldState, setWorldState] = useState("loading");
  const world = useRef<WorldView | undefined>(undefined);
  const container = useRef<HTMLDivElement>(null);
  const awarded = useRef<string | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        let resolved: ResolvedSetup;
        try {
          resolved = await client.setup({
            type: "resolve",
            level: content.level,
            placements: progress.setups[content.level.id] ?? [],
          });
        } catch {
          resolved = await client.setup({
            type: "resolve",
            level: content.level,
            placements: [],
          });
        }
        if (live) {
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
    onAttemptChange?.(!!input);
    return () => onAttemptChange?.(false);
  }, [input, onAttemptChange]);
  useEffect(() => {
    if (input || !container.current) return;
    const view = new WorldView(container.current, content.level.geometry, 20);
    world.current = view;
    const spawn = content.level.spawn;
    if (spawn.kind === "cluster") view.setSpawnArea(spawn.min, spawn.max);
    view.setContactGeometry([], [], content.level.exit);
    view.overview();
    view.enableCamera();
    let live = true;
    setWorldState("loading");
    void loadWorldAssets(view, () => live, content.roomDetails)
      .then(() => {
        if (live) setWorldState("ready");
      })
      .catch((error) => {
        if (live) setWorldState(String(error));
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
  }, [content, input]);
  useEffect(() => {
    if (!setup) return;
    world.current?.setContactGeometry(setup.food.slice(0, content.level.food.length), content.level.zappers, content.level.exit, false);
    world.current?.setPlacements(
      progress.preferences.showTools ? setup.placements : [],
      content.catalog,
      intent?.placement ? { placement: intent.placement, valid } : undefined,
    );
  }, [content, setup, intent, valid, input, progress.preferences.showTools]);
  useEffect(() => {
    if (!intent || checked.current === intent || busy || !setup || input) return;
    checked.current = intent;
    setBusy(true);
    void client
      .setup({
        type: "edit",
        level: content.level,
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
            setups: { ...p.setups, [content.level.id]: state.placements },
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
  }, [intent, busy, content, setup, input]);
  const pointerDown = useRef<{ x: number; y: number } | undefined>(undefined);
  const propose = (event: { clientX: number; clientY: number }, commit: boolean) => {
    if (intentRef.current?.commit) return;
    if (!setup) return;
    const position = world.current?.floorPoint(event.clientX, event.clientY);
    if (!position) return;
    const existing = setup.placements.find((p) => p.id === selected);
    const kind = existing?.kind ?? tool;
    if (!kind) return;
    const placement: Placement = {
      id: existing?.id ?? Math.max(0, ...setup.placements.map((p) => p.id)) + 1,
      kind,
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
  if (input)
    return (
      <AttemptPlayback
        input={input}
        client={client}
        catalog={content.catalog}
        roomDetails={content.roomDetails}
        onReturn={() => {
          client.cancel();
          setInput(undefined);
          setIntent(undefined);
          setMessage("Your setup is ready to edit. The next Run uses a fresh seed.");
        }}
        onResult={(result) => {
          if (awarded.current === input.attemptId) return;
          awarded.current = input.attemptId;
          setProgress((p) => awardResult(p, content.level.id, result));
        }}
      />
    );
  return (
    <main className="setup-game" data-testid="setup-game" data-world-state={worldState}>
      <header>
        <div>
          <span className="eyebrow">Fly escape</span>
          <h1>{content.title}</h1>
        </div>
        <span>Best: {progress.bestStars[content.level.id] ?? 0} / 3 stars</span>
      </header>
      {worldState !== "ready" && (
        <p role={worldState === "loading" ? "status" : "alert"}>
          {worldState === "loading" ? "Loading world assets…" : worldState}
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
            {content.level.geometry.rooms.length} rooms · 20 flies ·{" "}
            {content.level.durationTicks / 10} game seconds
            <span>{content.description}</span>
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
            {setup?.remaining
              .filter((stock) =>
                content.level.placementRules.inventory.some(
                  (original) => original.kind === stock.kind && original.count > 0,
                ),
              )
              .map((stock) => (
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
          <p>{tool ? descriptions[tool] : "This level has no placement tools."}</p>
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
            disabled={!setup || worldState !== "ready" || busy || !!intent?.commit}
            onClick={() => {
              if (!setup) return;
              setIntent(undefined);
              setInput({
                level: content.level,
                tuning: content.tuning,
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
            disabled={busy || !!intent?.commit}
            onClick={() => {
              setBusy(true);
              setIntent(undefined);
              void client
                .setup({
                  type: "resolve",
                  level: content.level,
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
