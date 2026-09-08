import * as THREE from "three";
import type { ContactSurface } from "@fly-escape/sim-client";

type Triangle = { points: THREE.Vector3[]; edges: THREE.Vector3[]; normal: THREE.Vector3; bounds: THREE.Box3 };

/** Display-sized bodies must clear the same triangles as the native simulation.
 * This changes presentation height only; recorded positions remain authoritative. */
export class SurfaceClearance {
  private surfaces: { bounds: THREE.Box3; triangles: Triangle[] }[] = [];

  setSurfaces(surfaces: readonly ContactSurface[]): void {
    this.surfaces = surfaces.map(surface => {
      const vertices = surface.vertices.map(p => new THREE.Vector3(...p));
      const triangles = surface.triangles.map(indices => {
        const points = indices.map(i => vertices[i]);
        const edges = points.map((p, i) => points[(i + 1) % 3].clone().sub(p).normalize());
        return { points, edges, normal: edges[0].clone().cross(edges[1]).normalize(),
          bounds: new THREE.Box3().setFromPoints(points) };
      });
      return { bounds: new THREE.Box3().setFromPoints(vertices), triangles };
    });
  }

  height(position: THREE.Vector3, rotation: THREE.Quaternion, scale: THREE.Vector3, bounds: THREE.Box3): number {
    // Sweep the oriented display box vertically from above. SAT gives the exact
    // interval in which it overlaps each triangle; its upper end is first contact.
    const center = bounds.getCenter(new THREE.Vector3()).multiply(scale).applyQuaternion(rotation);
    center.x += position.x;
    center.z += position.z;
    const half = bounds.getSize(new THREE.Vector3()).multiply(scale).multiplyScalar(0.5);
    const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)]
      .map(axis => axis.applyQuaternion(rotation));
    const radius = (axis: THREE.Vector3) => Math.abs(axis.dot(axes[0])) * half.x
      + Math.abs(axis.dot(axes[1])) * half.y + Math.abs(axis.dot(axes[2])) * half.z;
    const extents = new THREE.Vector3(
      radius(new THREE.Vector3(1, 0, 0)), radius(new THREE.Vector3(0, 1, 0)), radius(new THREE.Vector3(0, 0, 1)),
    );
    let height = Math.max(position.y, extents.y - center.y);
    const overlaps = (box: THREE.Box3) => box.max.x >= center.x - extents.x && box.min.x <= center.x + extents.x
      && box.max.z >= center.z - extents.z && box.min.z <= center.z + extents.z;
    const cross = new THREE.Vector3();
    for (const surface of this.surfaces) {
      if (!overlaps(surface.bounds) || surface.bounds.max.y < height + center.y - extents.y) continue;
      for (const triangle of surface.triangles) {
        if (!overlaps(triangle.bounds) || triangle.bounds.max.y < height + center.y - extents.y) continue;
        let lower = -Infinity, upper = Infinity;
        const intersect = (axis: THREE.Vector3): boolean => {
          if (axis.lengthSq() < 1e-24) return true;
          axis.normalize();
          const c = axis.dot(center), r = radius(axis);
          const a = axis.dot(triangle.points[0]), b = axis.dot(triangle.points[1]), d = axis.dot(triangle.points[2]);
          const min = Math.min(a, b, d) - c - r, max = Math.max(a, b, d) - c + r;
          if (Math.abs(axis.y) < 1e-12) return min <= 1e-12 && max >= -1e-12;
          const p = min / axis.y, q = max / axis.y;
          lower = Math.max(lower, Math.min(p, q));
          upper = Math.min(upper, Math.max(p, q));
          return lower <= upper + 1e-12;
        };
        if (!axes.every(intersect) || !intersect(triangle.normal)) continue;
        let hit = true;
        for (const axis of axes) for (const edge of triangle.edges) {
          if (hit && !intersect(cross.crossVectors(axis, edge))) hit = false;
        }
        if (hit && Number.isFinite(upper)) height = Math.max(height, upper);
      }
    }
    return height;
  }
}
