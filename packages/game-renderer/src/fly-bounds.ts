import * as THREE from "three";

type Part = { bounds: THREE.Box3; transform: () => THREE.Matrix4 };

/** Bone influence boxes enclose the blended vertices without CPU skinning every
 * vertex each frame. Bounds are in the fly root's space, before display scaling. */
export class FlyBounds {
  private readonly parts: Part[] = [];
  private readonly result = new THREE.Box3();
  private readonly inverse = new THREE.Matrix4();
  private readonly matrix = new THREE.Matrix4();
  private readonly box = new THREE.Box3();
  private dirty = true;

  constructor(private readonly root: THREE.Object3D) {
    root.updateMatrixWorld(true);
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object instanceof THREE.SkinnedMesh) {
        const boxes = object.skeleton.bones.map(() => new THREE.Box3());
        const position = object.geometry.getAttribute("position");
        const indices = object.geometry.getAttribute("skinIndex");
        const weights = object.geometry.getAttribute("skinWeight");
        const point = new THREE.Vector3();
        for (let i = 0; i < position.count; i++) for (let j = 0; j < 4; j++) {
          if (weights.getComponent(i, j) <= 0) continue;
          const bone = indices.getComponent(i, j);
          point.fromBufferAttribute(position, i).applyMatrix4(object.bindMatrix)
            .applyMatrix4(object.skeleton.boneInverses[bone]);
          boxes[bone].expandByPoint(point);
        }
        boxes.forEach((bounds, i) => {
          if (!bounds.isEmpty()) this.parts.push({ bounds, transform: () => this.matrix
            .multiplyMatrices(object.matrixWorld, object.bindMatrixInverse)
            .multiply(object.skeleton.bones[i].matrixWorld) });
        });
      } else {
        object.geometry.computeBoundingBox();
        this.parts.push({ bounds: object.geometry.boundingBox!.clone(), transform: () => object.matrixWorld });
      }
    });
  }

  invalidate(): void { this.dirty = true; }

  get local(): THREE.Box3 {
    if (!this.dirty) return this.result;
    this.root.updateMatrixWorld(true);
    this.inverse.copy(this.root.matrixWorld).invert();
    this.result.makeEmpty();
    for (const part of this.parts) {
      this.matrix.copy(part.transform()).premultiply(this.inverse);
      this.result.union(this.box.copy(part.bounds).applyMatrix4(this.matrix));
    }
    this.dirty = false;
    return this.result;
  }
}
