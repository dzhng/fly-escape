import * as THREE from "three";

/** The world projection and every navigation distance have one owner. Inputs
 * move the target on the floor; yaw and elevation never rotate. */
export class WorldCamera {
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  private readonly backward = new THREE.Vector3(1, 1.8, 1).normalize();
  private readonly right = new THREE.Vector3(1, 0, -1).normalize();
  private readonly groundUp = new THREE.Vector3(-1, 0, -1).normalize();
  private readonly target = new THREE.Vector3();
  private width = 1;
  private height = 1;
  private distance = 1;
  private fitDistance = 1;
  private closeDistance = 1;
  private followed = false;
  private overviewMode = true;
  constructor(
    private readonly bounds: THREE.Box3,
    private subjectHeight: number,
  ) {
    this.target.copy(bounds.getCenter(new THREE.Vector3()));
  }
  setSubjectHeight(height: number) {
    this.subjectHeight = height;
    this.resize(this.width, this.height);
  }
  resize(width: number, height: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.camera.aspect = this.width / this.height;
    const vertical = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const fit = this.requiredFit(this.target);
    const priorClose = this.closeDistance;
    this.fitDistance = fit;
    this.closeDistance = Math.min(fit, (this.height * this.subjectHeight) / (2 * vertical * 50));
    this.distance = this.overviewMode
      ? fit
      : this.followed
        ? (this.distance * this.closeDistance) / priorClose
        : Math.min(this.distance, fit);
    this.distance = THREE.MathUtils.clamp(this.distance, this.closeDistance / 2, fit);
    this.apply();
  }
  overview() {
    this.overviewMode = true;
    this.followed = false;
    this.target.copy(this.bounds.getCenter(new THREE.Vector3()));
    this.distance = this.fitDistance;
    this.apply();
  }
  follow(position: THREE.Vector3) {
    this.overviewMode = false;
    this.followed = true;
    this.target.copy(position);
    this.distance = this.closeDistance;
    this.apply();
  }
  track(position: THREE.Vector3) {
    if (!this.followed) return;
    this.target.copy(position);
    this.apply();
  }
  zoom(wheelDelta: number) {
    this.overviewMode = false;
    this.distance = THREE.MathUtils.clamp(
      this.distance * Math.exp(wheelDelta * 0.0015),
      this.closeDistance / 2,
      this.fitDistance,
    );
    this.apply();
  }
  zoomClose() {
    this.overviewMode = false;
    this.distance = this.closeDistance / 2;
    this.apply();
  }
  pan(screenX: number, screenY: number) {
    if (screenX === 0 && screenY === 0) return;
    this.overviewMode = false;
    this.followed = false;
    const units =
      (2 * this.distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) / this.height;
    this.target.addScaledVector(this.right, screenX * units);
    this.target.addScaledVector(this.groundUp, (-screenY * units) / this.backward.y);
    this.target.x = THREE.MathUtils.clamp(this.target.x, this.bounds.min.x, this.bounds.max.x);
    this.target.z = THREE.MathUtils.clamp(this.target.z, this.bounds.min.z, this.bounds.max.z);
    this.apply();
  }
  displayScale(nativeSpan: number): number {
    const unitsPerPixel = 2 * this.distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) / this.height;
    return Math.max(1, 24 * unitsPerPixel / nativeSpan);
  }
  project(position: THREE.Vector3) {
    const p = position.clone().project(this.camera);
    return {
      x: ((p.x + 1) * this.width) / 2,
      y: ((1 - p.y) * this.height) / 2,
      visible: p.z >= -1 && p.z <= 1 && Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1,
    };
  }
  get state() {
    return {
      near: this.camera.near,
      far: this.camera.far,
      fov: this.camera.fov,
      following: this.followed,
      distance: this.distance,
      minDistance: this.closeDistance / 2,
      maxDistance: this.fitDistance,
      closeDistance: this.closeDistance,
      target: this.target.toArray(),
      width: this.width,
      height: this.height,
    };
  }
  private requiredFit(target: THREE.Vector3) {
    const vertical = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const horizontal = vertical * this.camera.aspect;
    const up = new THREE.Vector3().crossVectors(this.backward, this.right);
    let fit = 0;
    for (const x of [this.bounds.min.x, this.bounds.max.x])
      for (const y of [this.bounds.min.y, this.bounds.max.y])
        for (const z of [this.bounds.min.z, this.bounds.max.z]) {
          const corner = new THREE.Vector3(x, y, z).sub(target);
          fit = Math.max(
            fit,
            corner.dot(this.backward) +
              Math.max(
                Math.abs(corner.dot(this.right)) / (horizontal * 0.92),
                Math.abs(corner.dot(up)) / (vertical * 0.92),
              ),
          );
        }
    return fit;
  }
  private apply() {
    const atMinimumZoom = this.distance === this.fitDistance;
    this.fitDistance = this.requiredFit(this.target);
    this.distance = atMinimumZoom ? this.fitDistance : Math.min(this.distance, this.fitDistance);
    this.camera.near = Math.min(0.1, this.distance / 20);
    this.camera.position.copy(this.backward).multiplyScalar(this.distance).add(this.target);
    this.camera.far = this.fitDistance + this.bounds.getSize(new THREE.Vector3()).length() * 3;
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }
}
