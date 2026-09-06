import * as THREE from "three";
import type { RecordedPose } from "@fly-escape/sim-client";
import { flyHeight } from "./fly-motion";

export type TrailPoint = { x: number; y: number; z: number; tick: number; breakBefore?: boolean };
/** Ten warm-up ticks cover the longest presentation transition before the visible tail. */
export function recordedTrails(
  histories: readonly (readonly RecordedPose[])[],
  cursorTick: number,
  heads: readonly { x: number; y: number; z: number }[],
  tickSeconds: number,
): TrailPoint[][] {
  return histories.map((history, id) => {
    let previous: RecordedPose | undefined;
    const points: TrailPoint[] = [];
    for (const pose of history) {
      if (pose.tick > cursorTick) break;
      const breakBefore =
        previous !== undefined &&
        (Math.abs(pose.inputX - previous.x) > 1e-6 || Math.abs(pose.inputZ - previous.z) > 1e-6);
      points.push({
        x: pose.x,
        z: pose.z,
        y: flyHeight(pose.motion, tickSeconds),
        tick: pose.tick,
        breakBefore,
      });
      previous = pose;
      if (pose.terminal) break;
    }
    if (previous && !previous.terminal && cursorTick > previous.tick) {
      points.push({ ...heads[id], tick: cursorTick });
    }
    return points;
  });
}

const SEGMENTS = 30;
const LENGTH = 2;
const WIDTH = 0.025;

/** A bounded mesh, rebuilt from recorded points rather than accumulated frame deltas. */
export class FlyTrails {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private readonly positions: THREE.BufferAttribute;
  private readonly colors: THREE.BufferAttribute;
  constructor(private readonly flyCount: number) {
    const geometry = new THREE.BufferGeometry();
    this.positions = new THREE.BufferAttribute(
      new Float32Array(flyCount * SEGMENTS * 6 * 3),
      3,
    ).setUsage(THREE.DynamicDrawUsage);
    this.colors = new THREE.BufferAttribute(
      new Float32Array(flyCount * SEGMENTS * 6 * 4),
      4,
    ).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("position", this.positions);
    geometry.setAttribute("color", this.colors);
    geometry.setDrawRange(0, 0);
    this.mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: "white",
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.mesh.frustumCulled = false;
  }

  sample(paths: readonly (readonly TrailPoint[])[], cursorTick: number): void {
    if (paths.length !== this.flyCount) throw new Error("Trail population does not match scene");
    let vertex = 0;
    for (const path of paths) {
      let length = 0,
        segments = 0;
      for (let i = path.length - 1; i > 0 && segments < SEGMENTS && length < LENGTH; i--) {
        const b = path[i],
          a = path[i - 1];
        if (b.tick > cursorTick || a.tick > cursorTick) continue;
        if (b.breakBefore || b.tick <= cursorTick - SEGMENTS) break;
        const dx = b.x - a.x,
          dz = b.z - a.z;
        const distance = Math.hypot(dx, dz);
        if (distance < 1e-7) continue;
        const fraction = Math.min(
          1,
          (LENGTH - length) / distance,
          (b.tick - Math.max(a.tick, cursorTick - SEGMENTS)) / (b.tick - a.tick),
        );
        if (!(fraction > 0)) continue;
        const start = {
          x: b.x - dx * fraction,
          z: b.z - dz * fraction,
          y: b.y + (a.y - b.y) * fraction,
          tick: b.tick + (a.tick - b.tick) * fraction,
        };
        const nx = ((-dz / distance) * WIDTH) / 2,
          nz = ((dx / distance) * WIDTH) / 2;
        const add = (p: TrailPoint, side: number) => {
          this.positions.setXYZ(vertex, p.x + nx * side, p.y + 0.012, p.z + nz * side);
          const age = Math.max(0, (cursorTick - p.tick) / SEGMENTS);
          this.colors.setXYZW(vertex++, 1, 1, 1, 0.8 * (1 - Math.min(1, age)) ** 2);
        };
        add(start, -1);
        add(start, 1);
        add(b, -1);
        add(b, -1);
        add(start, 1);
        add(b, 1);
        length += distance * fraction;
        segments++;
      }
    }
    this.mesh.geometry.setDrawRange(0, vertex);
    this.positions.needsUpdate = this.colors.needsUpdate = true;
  }
}
