import * as THREE from "three";
import { exitEmitter, type ExitOpening } from "@fly-escape/sim-client";
import { disposeObjectResources } from "./resources";

/** Metres the floor pool reaches into the room. */
const SPILL_DEPTH = 2.4;
/** Metres the pool continues past the threshold, so neither end lands on the opening. */
const SPILL_LIP = 0.35;
/** Metres the pool widens past each jamb at its innermost edge. */
const SPILL_FLARE = 0.9;
/** Height of the opening in the pool's v axis, between the lip (1) and the deepest reach (0). */
export const APERTURE_V = SPILL_DEPTH / (SPILL_DEPTH + SPILL_LIP);
/** Metres the haze plane bleeds onto each jamb. */
const HAZE_BLEED = 0.22;
/**
 * Metres of wall the haze plane covers. Deliberately far below the 2.5 m wall: the
 * glare has to keep reading as light when the exit wall is cut away to its base,
 * and a tall pane of it would read as a rectangle standing in the gap.
 */
const HAZE_HEIGHT = 1.25;
/** Metres the haze sits inside the wall centreline, clear of the 0.06 m wall half-depth. */
const HAZE_INSET = 0.09;
/** Alpha field resolution; both gradients are far smoother than this. */
const FIELD_SIZE = 64;

const POOL_COLOR = "#ffb03a";
const HAZE_COLOR = "#ffd16a";
const LAMP_COLOR = "#ffc158";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
/** Hermite ease behind every feathered edge, so no part of the effect ends on a hard line. */
const ease = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

/**
 * Pool cast on the floor. `u` runs across the opening; `v` runs from the deepest reach
 * of the spill (0) out through the opening (`APERTURE_V`) to the outer lip (1).
 * `coreHalf` is the opening's half-width as a fraction of the pool's width.
 */
export function poolAlpha(coreHalf: number, u: number, v: number): number {
  const inward = clamp01((APERTURE_V - v) / APERTURE_V);
  const beyond = clamp01((v - APERTURE_V) / (1 - APERTURE_V));
  const reach = v > APERTURE_V ? 1 - ease(beyond) : (1 - inward) ** 1.6;
  // Light fans out as it travels, so the far end is never a parallel-sided slab.
  const spread = coreHalf + (0.5 - coreHalf) * Math.max(inward, beyond * 0.5);
  return reach * (1 - ease((Math.abs(u - 0.5) - spread * 0.35) / (spread * 0.65)));
}

/**
 * Glare hanging in the opening. `u` runs across the opening, `v` from the floor to
 * `HAZE_HEIGHT`. `coreHalf` is the opening's half-width as a fraction of the plane's width.
 */
export function hazeAlpha(coreHalf: number, u: number, v: number): number {
  const across = 1 - ease((Math.abs(u - 0.5) - coreHalf * 0.55) / (0.5 - coreHalf * 0.55));
  // Densest just above the threshold and spent well before the top edge.
  return across * ease(v / 0.08) * (1 - ease((v - 0.16) / 0.64));
}

/** White field whose alpha carries the shape; the material supplies the warmth. */
function alphaField(shape: (u: number, v: number) => number): THREE.DataTexture {
  const data = new Uint8Array(FIELD_SIZE * FIELD_SIZE * 4).fill(255);
  for (let row = 0; row < FIELD_SIZE; row++) {
    for (let column = 0; column < FIELD_SIZE; column++) {
      const alpha = shape((column + 0.5) / FIELD_SIZE, (row + 0.5) / FIELD_SIZE);
      data[(row * FIELD_SIZE + column) * 4 + 3] = Math.round(255 * clamp01(alpha));
    }
  }
  const texture = new THREE.DataTexture(data, FIELD_SIZE, FIELD_SIZE);
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Additive and depth-tested but never depth-writing: light lies over the room, it is not in it. */
function lightMaterial(color: string, map: THREE.DataTexture, opacity: number) {
  return new THREE.MeshBasicMaterial({
    color,
    map,
    opacity,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

/**
 * Daylight spilling inward through the level's exit. Its emitter shares authored
 * position and parameters with the core light source; the decorative pool and haze
 * feed no sensor. Owns every resource it adds to the scene.
 */
export class ExitGlow {
  readonly root = new THREE.Group();
  private readonly opening: ExitOpening;

  constructor(exit: ExitOpening) {
    this.opening = { a: { ...exit.a }, b: { ...exit.b }, outward: { ...exit.outward } };
    const length = Math.hypot(exit.b.x - exit.a.x, exit.b.z - exit.a.z);
    const normal = Math.hypot(exit.outward.x, exit.outward.z);
    if (!(length > 0) || !(normal > 0)) throw new Error("Exit glow requires a sized, oriented opening");
    // Local +Z is the direction the light travels; a and b give only the centre and width.
    this.root.rotation.y = Math.atan2(-exit.outward.x / normal, -exit.outward.z / normal);
    this.root.position.set((exit.a.x + exit.b.x) / 2, 0, (exit.a.z + exit.b.z) / 2);

    const poolWidth = length + 2 * SPILL_FLARE;
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(poolWidth, SPILL_DEPTH + SPILL_LIP),
      lightMaterial(POOL_COLOR, alphaField((u, v) => poolAlpha(length / 2 / poolWidth, u, v)), 0.85),
    );
    // Laid flat, the plane's v = 0 edge falls at the deepest reach and v = 1 at the outer lip.
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0, 0.02, (SPILL_DEPTH - SPILL_LIP) / 2);

    const hazeWidth = length + 2 * HAZE_BLEED;
    const haze = new THREE.Mesh(
      new THREE.PlaneGeometry(hazeWidth, HAZE_HEIGHT),
      lightMaterial(HAZE_COLOR, alphaField((u, v) => hazeAlpha(length / 2 / hazeWidth, u, v)), 0.5),
    );
    haze.position.set(0, HAZE_HEIGHT / 2, HAZE_INSET);

    // The one local light: warms the real floor, jambs and furnishings the spill falls on.
    const emitter = exitEmitter(exit);
    const lamp = new THREE.PointLight(LAMP_COLOR, emitter.intensity, emitter.source.radius, 1.6);
    this.root.updateMatrixWorld(true);
    lamp.position.copy(this.root.worldToLocal(new THREE.Vector3(...emitter.position)));
    this.root.add(pool, haze, lamp);
  }

  /** The opening is fixed per level; setup edits reuse the glow instead of rebuilding its fields. */
  matches(exit: ExitOpening): boolean {
    const own = this.opening;
    return own.a.x === exit.a.x && own.a.z === exit.a.z
      && own.b.x === exit.b.x && own.b.z === exit.b.z
      && own.outward.x === exit.outward.x && own.outward.z === exit.outward.z;
  }

  dispose(): void {
    this.root.removeFromParent();
    disposeObjectResources(this.root);
  }
}
