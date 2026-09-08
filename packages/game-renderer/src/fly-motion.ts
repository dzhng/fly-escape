import * as THREE from "three";
import type { RecordedMotion } from "@fly-escape/sim-client";

export type FlyAnimation = { clip: "Walk" | "Fly" | "Land" | "Feed"; seconds: number };

/** Clip phase follows the recorded physical mode; presentation does not move the body. */
export function flyAnimation(motion: RecordedMotion, tickSeconds: number): FlyAnimation {
  const seconds = (motion.cursorTick - motion.startedTick) * tickSeconds;
  if (motion.mode === "flying") return { clip: "Fly", seconds: seconds * 2.5 };
  if (motion.mode === "landing") return { clip: "Land", seconds };
  if (motion.mode === "feeding") return { clip: "Feed", seconds };
  return { clip: "Walk", seconds };
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

/** Orientation-only interpolation; it does not establish a collision-safe curved position path. */
export function interpolateRotation(a: readonly [number, number, number, number], b: readonly [number, number, number, number], fraction: number): [number, number, number, number] {
  return new THREE.Quaternion().fromArray(a).slerp(new THREE.Quaternion().fromArray(b), fraction).toArray();
}
