import * as THREE from "three";
import type { RecordedMotion } from "@fly-escape/sim-client";

export type FlyAnimation = { clip: "Walk" | "Fly" | "Land" | "Feed"; seconds: number };

const LAND_SECONDS = 0.8;

/** The recorded mode owns clip phase; animation never changes simulation. */
export function flyAnimation(motion: RecordedMotion, tickSeconds: number): FlyAnimation {
  const seconds = (motion.cursorTick - motion.startedTick) * tickSeconds;
  if (motion.mode === "flying") return { clip: "Fly", seconds };
  if (motion.mode === "feeding") return { clip: "Feed", seconds };
  if (motion.previousMode === "flying" && seconds < LAND_SECONDS) return { clip: "Land", seconds };
  return { clip: "Walk", seconds: motion.previousMode === "flying" ? seconds - LAND_SECONDS : seconds };
}

/** Display-only height sampled from the same cursor as the authored clips.
 * Feeding contact stays grounded; takeoff follows the recorded mode immediately. */
export function flyHeight(motion: RecordedMotion, tickSeconds: number): number {
  if (motion.mode === "flying") return 0.6;
  if (motion.mode === "feeding" || motion.previousMode !== "flying") return 0;
  const phase = Math.min(1, Math.max(0, (motion.cursorTick - motion.startedTick) * tickSeconds / LAND_SECONDS));
  return 0.6 * (1 - phase * phase * (3 - 2 * phase));
}

/** Absolute sampling restores bindings when clips change; pause and backwards seeks
 * cannot accumulate mixer time or leave another clip's bones behind. */
export class FlyMotion {
  private readonly mixer: THREE.AnimationMixer;
  private last?: FlyAnimation;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  constructor(root: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.mixer = new THREE.AnimationMixer(root);
    for (const clip of clips) this.actions.set(clip.name, this.mixer.clipAction(clip));
  }
  sample(sample: FlyAnimation | undefined): void {
    if (this.last?.clip === sample?.clip && this.last?.seconds === sample?.seconds) return;
    if (this.last?.clip !== sample?.clip) this.mixer.stopAllAction();
    this.last = sample && { ...sample };
    if (!sample) return;
    const action = this.actions.get(sample.clip);
    if (!action) return; // Static replacement models remain useful in the workbench.
    const duration = action.getClip().duration;
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    action.paused = true;
    action.time =
      duration === 0
        ? 0
        : sample.clip === "Land"
          ? Math.min(duration, Math.max(0, sample.seconds))
          : ((sample.seconds % duration) + duration) % duration;
    this.mixer.update(0);
  }
  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
  }
}
