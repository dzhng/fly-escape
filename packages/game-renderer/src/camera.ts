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
  private mounting = false;
  private grassCoverage?: { key: string; circle: { x: number; z: number; radius: number } };
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
    const fit = this.maximumDistance();
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
    this.mounting = false;
    this.backward.set(1, 1.8, 1).normalize();
    this.overviewMode = true;
    this.followed = false;
    this.target.copy(this.bounds.getCenter(new THREE.Vector3()));
    this.distance = this.fitDistance;
    this.apply();
  }
  follow(position: THREE.Vector3) {
    this.mounting = false;
    this.backward.set(1, 1.8, 1).normalize();
    this.overviewMode = false;
    this.followed = true;
    this.target.copy(position);
    this.distance = this.closeDistance;
    this.apply();
  }
  /** Named diagnostic views only; ordinary navigation restores the game elevation. */
  inspect(position: THREE.Vector3, distance: number, viewpoint: "rts" | "mounting" = "rts") {
    this.mounting = viewpoint === "mounting";
    this.backward.set(1, viewpoint === "mounting" ? 0.35 : 1.8, 1).normalize();
    this.overviewMode = false;
    this.followed = false;
    this.target.copy(position);
    this.distance = THREE.MathUtils.clamp(distance, this.closeDistance / 2, this.requiredFit(position));
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
  /** Conservative normal-RTS ground coverage across the existing target/zoom limits.
   * Grass is deliberately excluded from the bounds used to fit the house. */
  exteriorGroundCircle() {
    const backward = new THREE.Vector3(1, 1.8, 1).normalize();
    const up = new THREE.Vector3().crossVectors(backward, this.right);
    const vertical = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const center = this.bounds.getCenter(new THREE.Vector3());
    const targets = this.bounds.clone();
    // A tracked terminal/body centre can extend just beyond the room boundary.
    if (this.followed) targets.expandByPoint(this.target);
    const key = [...targets.min.toArray(), ...targets.max.toArray(), this.camera.aspect].join(",");
    if (this.grassCoverage?.key === key) return this.grassCoverage.circle;
    const distance = this.requiredFit(center, backward);
    let radius = 0;
    for (const nx of [-1, 1]) for (const ny of [-1, 1]) {
      const ray = backward.clone().negate().addScaledVector(this.right, nx * vertical * this.camera.aspect).addScaledVector(up, ny * vertical);
      for (const x of [targets.min.x, targets.max.x])
        for (const y of [targets.min.y, targets.max.y])
          for (const z of [targets.min.z, targets.max.z])
            for (const d of [0, distance]) {
              const height = y + d * backward.y;
              radius = Math.max(radius, Math.hypot(x + d * backward.x - height * ray.x / ray.y - center.x,
                z + d * backward.z - height * ray.z / ray.y - center.z));
            }
    }
    const circle = { x: center.x, z: center.z, radius };
    this.grassCoverage = { key, circle };
    return circle;
  }

  project(position: { x: number; y: number; z: number }) {
    const p = new THREE.Vector3(position.x, position.y, position.z).project(this.camera);
    return {
      x: ((p.x + 1) * this.width) / 2,
      y: ((1 - p.y) * this.height) / 2,
      visible: p.z >= -1 && p.z <= 1 && Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1,
    };
  }
  /** Move a presentation vertex by CSS pixels while preserving its camera depth. */
  offset(position: { x: number; y: number; z: number }, x: number, y: number): THREE.Vector3 {
    const p = new THREE.Vector3(position.x, position.y, position.z).project(this.camera);
    p.x += 2 * x / this.width;
    p.y -= 2 * y / this.height;
    return p.unproject(this.camera);
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
  private requiredFit(target: THREE.Vector3, backward = this.backward) {
    const vertical = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const horizontal = vertical * this.camera.aspect;
    const up = new THREE.Vector3().crossVectors(backward, this.right);
    let fit = 0;
    for (const x of [this.bounds.min.x, this.bounds.max.x])
      for (const y of [this.bounds.min.y, this.bounds.max.y])
        for (const z of [this.bounds.min.z, this.bounds.max.z]) {
          const corner = new THREE.Vector3(x, y, z).sub(target);
          fit = Math.max(
            fit,
            corner.dot(backward) +
              Math.max(
                Math.abs(corner.dot(this.right)) / (horizontal * 0.92),
                Math.abs(corner.dot(up)) / (vertical * 0.92),
              ),
          );
        }
    return fit;
  }
  private maximumDistance() {
    return this.requiredFit(this.mounting ? this.target : this.bounds.getCenter(new THREE.Vector3()));
  }
  private apply() {
    const atMinimumZoom = this.distance === this.fitDistance;
    this.fitDistance = this.maximumDistance();
    this.distance = atMinimumZoom ? this.fitDistance : Math.min(this.distance, this.fitDistance);
    this.camera.near = Math.min(0.1, this.distance / 20);
    this.camera.position.copy(this.backward).multiplyScalar(this.distance).add(this.target);
    this.camera.far = this.fitDistance + this.bounds.getSize(new THREE.Vector3()).length() * 3;
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }
}
