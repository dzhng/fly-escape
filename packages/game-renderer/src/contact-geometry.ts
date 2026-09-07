import * as THREE from "three";

/** Exact coordinate identity shared by the contact bake and runtime asset check. */
export function contactGeometry(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const vertices: number[][] = [];
  const vertexIds = new Map<string, number>();
  const triangles: number[][] = [];
  const point = new THREE.Vector3();
  root.traverse(object => {
    if (object instanceof THREE.Camera || object instanceof THREE.Light)
      throw new Error('Contact assets cannot include cameras or lights.');
    if (!(object instanceof THREE.Mesh)) return;
    if (object instanceof THREE.SkinnedMesh || Object.keys(object.geometry.morphAttributes).length)
      throw new Error('Contact assets cannot deform.');
    if (object.matrixWorld.determinant() <= 0)
      throw new Error('Apply reflected or singular object transforms before exporting contact geometry.');
    const positions = object.geometry.getAttribute('position');
    const meshVertices: number[] = [];
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
      if (!point.toArray().every(v => Number.isFinite(v) && Math.abs(v) <= 1e6))
        throw new Error('Contact vertices must be bounded finite metres.');
      // Shading/material seams can duplicate positions without opening the physical skin.
      // Only exact transformed coordinates share identity; no tolerance or geometry repair.
      const key = point.toArray().join(',');
      let id = vertexIds.get(key);
      if (id === undefined) {
        id = vertices.length;
        vertexIds.set(key, id);
        vertices.push(point.toArray());
      }
      meshVertices.push(id);
    }
    const index = object.geometry.index;
    const count = index?.count ?? positions.count;
    if (count % 3) throw new Error('Contact mesh must contain complete triangles.');
    for (let i = 0; i < count; i += 3) {
      const face = [0, 1, 2].map(j => {
        const source = index ? index.getX(i + j) : i + j;
        if (!Number.isInteger(source) || source < 0 || source >= positions.count)
          throw new Error('Contact triangle index is outside its mesh.');
        return meshVertices[source];
      });
      const [a, b, c] = face.map(i => new THREE.Vector3().fromArray(vertices[i]));
      if (b.sub(a).cross(c.sub(a)).lengthSq() <= Number.EPSILON / 1e12)
        throw new Error('Contact triangle has numerically unresolvable area.');
      triangles.push(face);
    }
  });
  if (!vertices.length || vertices.length > 262144 || !triangles.length || triangles.length > 524288)
    throw new Error('Contact mesh exceeds the core vertex/triangle bounds.');
  return { vertices, triangles };
}
