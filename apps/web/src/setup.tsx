import { objectThumbnails } from "../../../assets/tools/thumbnails";
import type { RoomDetail, RoomFloor } from "@fly-escape/game-renderer";
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
import { type Progress, awardResult } from "./progress";
import "./setup.css";
import { frameBesidePanel } from "./world-framing";

const FLY_COUNT = 16;

type Intent = { edit: PlacementEdit; placement?: Placement; commit: boolean };
const names: Record<ToolKind, string> = {
  fruit: "Apple",
  banana: "Banana",
  crumbs: "Scent crumbs",
  vinegar: "Vinegar",
  lamp: "Lamp",
  shade: "Shade",
  fan: "Fan",
  wornShoes: "Worn shoes",
  dirtyDishes: "Dirty dishes",
  laundry: "Damp laundry",
  sleepingCat: "Sleeping cat",
  bugZapper: "Bug zapper",
  spiderWeb: "Spider web",
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
    roomFloors?: readonly RoomFloor[];
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
  const [intent, setIntent] = useState<Intent>();
  const intentRef = useRef<Intent | undefined>(undefined);
  intentRef.current = intent;
  const checked = useRef<Intent | undefined>(undefined);
  const [checking, setChecking] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [valid, setValid] = useState<boolean | null>(null);
  const [error, setError] = useState("");
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
          if (!live) return;
          resolved = await client.setup({
            type: "resolve",
            level: content.level,
            placements: [],
          });
        }
        if (live) {
          setSetup(resolved.state);

        }
      } catch (error) {
        if (live) setError(String(error));
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
    const view = new WorldView(container.current, content.level.geometry, FLY_COUNT, content.roomFloors);
    world.current = view;
    const stopFraming = frameBesidePanel(view, container.current, container.current.closest(".setup-game")!.querySelector("aside")!);
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
      stopFraming();
      view.dispose();
      world.current = undefined;
    };
  }, [content, input]);
  useEffect(() => {
    if (!setup) return;
    world.current?.setContactGeometry(setup.food.slice(0, content.level.food.length), content.level.zappers, content.level.exit, false);
  }, [content, setup, input]);
  useEffect(() => {
    if (!setup) return;
    world.current?.setPlacements(
      setup.placements,
      content.catalog,
      intent?.placement ? { placement: intent.placement, valid } : undefined,
      content.level.fixedObjects,
    );
  }, [content, setup, intent, valid, input]);
  useEffect(() => {
    if (!intent || checked.current === intent || checking || clearing || !setup || input) return;
    checked.current = intent;
    setChecking(true);
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
        if (intent.commit) setError("");
        if (intent.commit) {
          setSetup(state);
          setIntent(undefined);
          setSelected(undefined);
          setTool(undefined);
          setProgress((p) => ({
            ...p,
            setups: { ...p.setups, [content.level.id]: state.placements },
          }));
        }
      })
      .catch((error) => {
        if (intentRef.current !== intent) return;
        setValid(false);
        if (intent.commit) console.debug("[Fly escape] placement rejected", error);
        if (intent.commit) setIntent(undefined);
      })
      .finally(() => setChecking(false));
  }, [intent, checking, clearing, content, setup, input]);
  useEffect(() => {
    if (!clearing || checking) return;
    setChecking(true);
    void client.setup({ type: "resolve", level: content.level, placements: [] })
      .then((resolved) => {
        setSetup(resolved.state);
        setProgress((p) => ({ ...p, setups: { ...p.setups, [content.level.id]: [] } }));
        setSelected(undefined);
        setError("");
      })
      .catch((error) => setError(String(error)))
      .finally(() => { setClearing(false); setChecking(false); });
  }, [clearing, checking, client, content, setProgress]);
  const pointerDown = useRef<{ x: number; y: number } | undefined>(undefined);
  const propose = (event: { clientX: number; clientY: number }, commit: boolean) => {
    if (intentRef.current?.commit || clearing) return;
    if (!setup) return;
    const position = world.current?.floorPoint(event.clientX, event.clientY);
    if (!position) return;
    const existing = setup.placements.find((p) => p.id === selected);
    const kind = existing?.kind ?? tool;
    if (!kind) return;
    const heading = kind === "fan" ? content.level.placementRules.fanHeading : (existing?.heading ?? 0);
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
  if (input)
    return (
      <AttemptPlayback
        input={input}
        client={client}
        catalog={content.catalog}
        roomDetails={content.roomDetails}
        roomFloors={content.roomFloors}
        onReturn={() => {
          client.cancel();
          setInput(undefined);
          setIntent(undefined);
          setError("");
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
      {(worldState !== "ready" || error) && (
        <p className="setup-error" role={error || worldState !== "loading" ? "alert" : "status"}>
          {error || (worldState === "loading" ? "Loading the house…" : worldState)}
        </p>
      )}
      <section className="setup-layout">
        <div className="setup-world">
          <div
            ref={container}
            className="setup-canvas"
            data-placement-valid={intent?.placement ? (valid === null ? "pending" : String(valid)) : undefined}
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
        </div>
        <aside aria-label="Objects">
          <h2 className="objects-title">Help the flies escape</h2>
          <p className="objects-instructions">Choose an object, then click an open spot in the house. Release the flies and get as many outside as you can before time runs out.</p>
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
                  disabled={stock.count === 0 || clearing || !!intent?.commit}
                  onClick={() => {
                    setTool(tool === stock.kind && selected === undefined ? undefined : stock.kind);
                    setValid(null);
                    setSelected(undefined);
                    setIntent(undefined);
                  }}
                >
                  <img src={objectThumbnails[stock.kind]} alt="" width={48} height={48} />
                  <span className="object-caption"><b>{names[stock.kind]}</b><span>{stock.count} left</span></span>
                </button>
              ))}
          </div>
          {!!setup?.placements.length && <h3>In your house</h3>}
          <div className="placed-tools">
            {setup?.placements.map((p) => (
              <div key={p.id}>
                <button
                  aria-pressed={selected === p.id}
                  disabled={clearing || !!intent?.commit}
                  onClick={() => {
                    setSelected(p.id);
                    setTool(p.kind);
                    setIntent(undefined);
                    setValid(null);
                  }}
                >
                  {names[p.kind]} #{p.id}
                </button>
                <button
                  disabled={clearing || !!intent?.commit}
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
          <button
            className="run-setup"
            disabled={!setup || worldState !== "ready" || clearing || !!intent?.commit}
            onClick={() => {
              if (!setup) return;
              setIntent(undefined);
              setInput({
                level: content.level,
                tuning: content.tuning,
                placements: structuredClone(setup.placements),
                flyCount: FLY_COUNT,
                attemptId: crypto.randomUUID(),
                rootSeed: crypto.getRandomValues(new BigUint64Array(1))[0].toString(),
              });
            }}
          >
            Release the flies
          </button>
          {!!setup?.placements.length && content.level.fixedObjects.length > 0 && (
            <details className="household-objects">
              <summary>Already in this house</summary>
              <ul>
                {content.level.fixedObjects.map((object) => (
                  <li key={object.id}>{names[object.kind]}</li>
                ))}
              </ul>
            </details>
          )}
          {!!setup?.placements.length && <button
            className="put-away"
            disabled={clearing || !!intent?.commit || !setup?.placements.length}
            onClick={() => {
              setClearing(true);
              setIntent(undefined);
            }}
          >
            Put objects away
          </button>}
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
