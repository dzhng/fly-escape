import type { RoomDetail } from "@fly-escape/game-renderer";
import React, { useEffect, useMemo, useState } from "react";
import {
  AttemptClient,
  type LevelDef,
  type AttemptTuning,
  type ToolDef,
  type SetupFixture,
} from "@fly-escape/sim-client";
import { SetupGame } from "./setup";
import { loadProgress, saveProgress, type Progress } from "./progress";

export type CampaignLevel = {
  roomDetails?: readonly RoomDetail[];
  title: string;
  description: string;
  level: LevelDef;
  tuning: AttemptTuning;
};
export function unlockedLevelCount(levels: readonly CampaignLevel[], progress: Progress): number {
  let count = Math.min(1, levels.length);
  while (count < levels.length && (progress.bestStars[levels[count - 1].level.id] ?? 0) >= 1)
    count++;
  return count;
}
export function Campaign({ levels }: { levels: readonly CampaignLevel[] }) {
  const [progress, setProgress] = useState(loadProgress);
  const [storageFailed, setStorageFailed] = useState(false);
  const [selected, setSelected] = useState(0);
  const [active, setActive] = useState(false);
  const [catalog, setCatalog] = useState<ToolDef[]>();
  const [error, setError] = useState("");
  useEffect(() => {
    setStorageFailed(!saveProgress(progress));
  }, [progress]);
  useEffect(() => {
    if (!levels.length) return;
    const client = new AttemptClient(() => {});
    let live = true;
    void client
      .setup({ type: "catalog" })
      .then((value) => {
        client.dispose();
        if (live) setCatalog(value);
      })
      .catch((e) => {
        client.dispose();
        if (live) setError(String(e));
      });
    return () => {
      live = false;
      client.dispose();
    };
  }, [levels]);
  const count = unlockedLevelCount(levels, progress);
  const index = Math.min(selected, Math.max(0, count - 1));
  useEffect(() => {
    if (selected !== index) setSelected(index);
  }, [selected, index]);
  const current = levels[index];
  const content = useMemo(
    () => (current && catalog ? { ...current, catalog } : undefined),
    [current, catalog],
  );
  if (!current)
    return (
      <main>
        <h1>Fly escape</h1>
        <p>The campaign is not ready to play yet.</p>
      </main>
    );
  return (
    <div className="campaign-shell">
      <nav aria-label="Campaign levels" className="campaign-levels">
        {levels.map((entry, i) => (
          <button
            key={entry.level.id}
            disabled={active || i >= count}
            aria-current={i === index ? "step" : undefined}
            onClick={() => setSelected(i)}
          >
            {i + 1}. {entry.title} · {progress.bestStars[entry.level.id] ?? 0}/3 stars
            {i >= count ? " · Locked" : ""}
          </button>
        ))}
      </nav>
      {error ? (
        <p role="alert">{error}</p>
      ) : !content ? (
        <p role="status">Loading tools…</p>
      ) : (
        <SetupGame
          key={current.level.id}
          content={content}
          progress={progress}
          setProgress={setProgress}
          storageFailed={storageFailed}
          onAttemptChange={setActive}
        />
      )}
    </div>
  );
}

export function DiagnosticSetup() {
  const [fixture, setFixture] = useState<SetupFixture>();
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(loadProgress);
  const [storageFailed, setStorageFailed] = useState(false);
  useEffect(() => {
    setStorageFailed(!saveProgress(progress));
  }, [progress]);
  useEffect(() => {
    const client = new AttemptClient(() => {});
    let live = true;
    void client
      .setup({ type: "fixture" })
      .then((value) => {
        client.dispose();
        if (live) setFixture(value);
      })
      .catch((e) => {
        client.dispose();
        if (live) setError(String(e));
      });
    return () => {
      live = false;
      client.dispose();
    };
  }, []);
  const content = useMemo(
    () =>
      fixture
        ? {
            ...fixture,
            title: "Give twenty flies a way out.",
            description: "Integration fixture — campaign difficulty is still being authored.",
          }
        : undefined,
    [fixture],
  );
  return error ? (
    <p role="alert">{error}</p>
  ) : content ? (
    <SetupGame
      content={content}
      progress={progress}
      setProgress={setProgress}
      storageFailed={storageFailed}
    />
  ) : (
    <p role="status">Loading diagnostic setup…</p>
  );
}
