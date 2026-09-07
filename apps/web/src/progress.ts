import type { Placement, AttemptResult } from "@fly-escape/sim-client";
const KEY = "fly-escape-progress";
export type Progress = {
  bestStars: Record<string, number>;
  setups: Record<string, Placement[]>;
};
export const emptyProgress = (): Progress => ({
  bestStars: {},
  setups: {},
});
export function loadProgress(): Progress {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!stored || typeof stored !== "object") return emptyProgress();
    const bestStars = Object.fromEntries(
      Object.entries(stored.bestStars ?? {}).filter(
        ([, n]) => Number.isInteger(n) && Number(n) >= 0 && Number(n) <= 3,
      ),
    );
    const setups = Object.fromEntries(
      Object.entries(stored.setups ?? {}).filter(
        ([, placements]) => Array.isArray(placements) && placements.length <= 64,
      ),
    );
    return {
      bestStars,
      setups,
    } as Progress;
  } catch {
    return emptyProgress();
  }
}
export function saveProgress(progress: Progress): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}
export function awardResult(progress: Progress, levelId: string, result: AttemptResult): Progress {
  return {
    ...progress,
    bestStars: {
      ...progress.bestStars,
      [levelId]: Math.max(progress.bestStars[levelId] ?? 0, result.stars),
    },
  };
}
