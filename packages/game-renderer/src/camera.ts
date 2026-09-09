import * as THREE from "three";

const DEFAULT_YAW = Math.PI / 4;
const DEFAULT_ELEVATION = Math.atan2(1.8, Math.SQRT2);
const MOUNTING_ELEVATION = Math.atan2(0.35, Math.SQRT2);
/** Any lower and the top of the frustum clears the horizon, so the meadow stops
 * short of the frame; any higher and the ground-plane pan divisor degenerates. */
const MIN_ELEVATION = THREE.MathUtils.degToRad(30);
const MAX_ELEVATION = THREE.MathUtils.degToRad(80);
const RADIANS_PER_PIXEL = 0.005;
/** Ground coverage is reused across this much orbit so grass never rebuilds mid-drag. */
const COVERAGE_ELEVATION_STEP = THREE.MathUtils.degToRad(15);
/** Screen span a fly keeps while the world enlargement that buys it stays affordable. */
const READABLE_PIXELS = 48;
/** Enlargement ceiling, as a share of the shortest room span. Without a ceiling the
 * widest views walk knee-high flies through the house; with it the farthest zoom
 * shrinks flies below the readable size instead of inflating the world. */
const MAX_ENLARGED_ROOM_FRACTION = 0.03;

interface Basis {
  backward: THREE.Vector3;
  right: THREE.Vector3;
  up: THREE.Vector3;
}

/** Camera-relative axes for an orbit angle: `backward` points from the target to
 * the camera, `right` and `up` are the screen axes at that orientation. */
function orbitBasis(yaw: number, elevation: number): Basis {
  const backward = new THREE.Vector3(
    Math.cos(yaw) * Math.cos(elevation),
    Math.sin(elevation),
    Math.sin(yaw) * Math.cos(elevation),
  );
  const right = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw));
  return { backward, right, up: new THREE.Vector3().crossVectors(backward, right) };
}

/** The world projection and every navigation distance have one owner. Inputs move
 * the target on the floor and orbit the camera around it; the elevation never
 * dips far enough to put the camera under the floor or the horizon in frame. */
export class WorldCamera {
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  private yaw = DEFAULT_YAW;
  private elevation = DEFAULT_ELEVATION;
  private orientation = orbitBasis(DEFAULT_YAW, DEFAULT_ELEVATION);
  private readonly target = new THREE.Vector3();
  private readonly overviewTarget: THREE.Vector3;
  private width = 1;
  private height = 1;
  private rightInset = 0;
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
    // Artwork may expand the fit bounds after loading; it must not move the level's anchor.
    this.overviewTarget = bounds.getCenter(new THREE.Vector3());
    this.target.copy(this.overviewTarget);
  }
  setSubjectHeight(height: number) {
    this.subjectHeight = height;
    this.resize(this.width, this.height);
  }
  setRightInset(pixels: number) {
    this.rightInset = Math.max(0, pixels);
    this.resize(this.width, this.height);
  }
  resize(width: number, height: number) {
    if (this.width !== Math.max(1, width) || this.height !== Math.max(1, height)) this.grassCoverage = undefined;
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
    this.overviewMode = true;
    this.followed = false;
    this.target.copy(this.overviewTarget);
    this.distance = this.fitDistance;
    this.apply();
  }
  follow(position: THREE.Vector3) {
    this.mounting = false;
    this.overviewMode = false;
    this.followed = true;
    this.target.copy(position);
    this.distance = this.closeDistance;
    this.apply();
  }
  /** Named diagnostic views only; ordinary navigation restores the game elevation. */
  inspect(position: THREE.Vector3, distance: number, viewpoint: "rts" | "mounting" = "rts") {
    this.mounting = viewpoint === "mounting";
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
  /** Orbit around the current target. Screen pixels in, orientation only out:
   * the target, the zoom and the follow all survive a rotation. */
  rotate(screenX: number, screenY: number) {
    if (screenX === 0 && screenY === 0) return;
    this.mounting = false;
    this.yaw += screenX * RADIANS_PER_PIXEL;
    this.elevation = THREE.MathUtils.clamp(
      this.elevation - screenY * RADIANS_PER_PIXEL,
      MIN_ELEVATION,
      MAX_ELEVATION,
    );
    this.apply();
  }
  resetRotation() {
    this.mounting = false;
    this.yaw = DEFAULT_YAW;
    this.elevation = DEFAULT_ELEVATION;
    this.apply();
  }
  get rotated() {
    return this.yaw !== DEFAULT_YAW || this.elevation !== DEFAULT_ELEVATION;
  }
  pan(screenX: number, screenY: number) {
    if (screenX === 0 && screenY === 0) return;
    this.overviewMode = false;
    this.followed = false;
    const { backward, right } = this.orientation;
    const units =
      (2 * this.distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) / this.height;
    // Screen up walks the floor away from the camera, foreshortened by the elevation.
    const groundUp = new THREE.Vector3(-backward.x, 0, -backward.z).normalize();
    this.target.addScaledVector(right, screenX * units);
    this.target.addScaledVector(groundUp, (-screenY * units) / backward.y);
    this.target.x = THREE.MathUtils.clamp(this.target.x, this.bounds.min.x, this.bounds.max.x);
    this.target.z = THREE.MathUtils.clamp(this.target.z, this.bounds.min.z, this.bounds.max.z);
    this.apply();
  }
  /** Partial perspective compensation: doubling camera depth shrinks a fly by
   * about 13%, until the world-size cap takes over at distant views. */
  displayScale(nativeSpan: number, at?: { x: number; y: number; z: number }): number {
    const depth = at
      ? Math.max(
          this.camera.near,
          -new THREE.Vector3(at.x, at.y, at.z)
            .sub(this.camera.position)
            .dot(this.orientation.backward),
        )
      : this.distance;
    const unitsPerPixel =
      (2 * depth * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) / this.height;
    const size = this.bounds.getSize(new THREE.Vector3());
    const ceiling = Math.max(
      1,
      (MAX_ENLARGED_ROOM_FRACTION * Math.min(size.x, size.z)) / nativeSpan,
    );
    return Math.min(Math.pow((READABLE_PIXELS * unitsPerPixel) / nativeSpan, 0.8), ceiling);
  }
  /** Conservative normal-RTS ground coverage across the existing target/zoom limits
   * and the whole orbit, so rotating never rebuilds the meadow or bares a sector.
   * Grass is deliberately excluded from the bounds used to fit the house. */
  exteriorGroundCircle() {
    const vertical = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const center = this.bounds.getCenter(new THREE.Vector3());
    const targets = this.bounds.clone();
    // A tracked terminal/body centre can extend just beyond the room boundary.
    if (this.followed) targets.expandByPoint(this.target);
    // The flattest elevation of the band reaches farthest across the ground.
    const elevation = Math.max(
      MIN_ELEVATION,
      Math.floor(this.elevation / COVERAGE_ELEVATION_STEP) * COVERAGE_ELEVATION_STEP,
    );
    const key = [...targets.min.toArray(), ...targets.max.toArray(), this.camera.aspect, this.rightInset / this.width, elevation].join(",");
    if (this.grassCoverage?.key === key) return this.grassCoverage.circle;
    let radius = 0;
    for (let step = 0; step < 8; step++) {
      const basis = orbitBasis(DEFAULT_YAW + (step * Math.PI) / 4, elevation);
      const { backward, right, up } = basis;
      const distance = this.requiredFit(center, basis);
      for (const nx of [-1, 1]) for (const ny of [-1, 1]) {
        const ray = backward.clone().negate().addScaledVector(right, (nx + Math.min(this.rightInset / this.width, 0.75)) * vertical * this.camera.aspect).addScaledVector(up, ny * vertical);
        for (const x of [targets.min.x, targets.max.x])
          for (const y of [targets.min.y, targets.max.y])
            for (const z of [targets.min.z, targets.max.z])
              for (const d of [0, distance]) {
                const height = y + d * backward.y;
                radius = Math.max(radius, Math.hypot(x + d * backward.x - height * ray.x / ray.y - center.x,
                  z + d * backward.z - height * ray.z / ray.y - center.z));
              }
      }
    }
    // A phase or follow change must not rebuild a meadow that already covers this viewport.
    const prior = this.grassCoverage?.circle;
    if (prior?.x === center.x && prior.z === center.z) radius = Math.max(radius, prior.radius);
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
      yaw: this.yaw,
      elevation: this.elevation,
      rotated: this.rotated,
      width: this.width,
      height: this.height,
    };
  }
  private requiredFit(target: THREE.Vector3, basis = this.orientation) {
    const vertical = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const horizontal = vertical * Math.max(this.width * 0.25, this.width - this.rightInset) / this.height;
    const { backward, right, up } = basis;
    let fit = 0;
    for (const x of [this.bounds.min.x, this.bounds.max.x])
      for (const y of [this.bounds.min.y, this.bounds.max.y])
        for (const z of [this.bounds.min.z, this.bounds.max.z]) {
          const corner = new THREE.Vector3(x, y, z).sub(target);
          fit = Math.max(
            fit,
            corner.dot(backward) +
              Math.max(
                Math.abs(corner.dot(right)) / (horizontal * 0.92),
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
    this.orientation = this.mounting
      ? orbitBasis(DEFAULT_YAW, MOUNTING_ELEVATION)
      : orbitBasis(this.yaw, this.elevation);
    const atMinimumZoom = this.distance === this.fitDistance;
    this.fitDistance = this.maximumDistance();
    this.distance = atMinimumZoom ? this.fitDistance : Math.min(this.distance, this.fitDistance);
    this.camera.near = Math.min(0.1, this.distance / 20);
    this.camera.position.copy(this.orientation.backward).multiplyScalar(this.distance).add(this.target);
    this.camera.lookAt(this.target);
    // The meadow reaches farther than the house at low elevations; clipping it
    // would cut the ground plane inside the frame.
    const coverage = this.exteriorGroundCircle();
    this.camera.far = Math.max(
      this.fitDistance + this.bounds.getSize(new THREE.Vector3()).length() * 3,
      Math.hypot(this.camera.position.x - coverage.x, this.camera.position.z - coverage.z) +
        coverage.radius +
        this.camera.position.y,
    );
    // Shift the optical center into the unobscured play area without cropping the canvas.
    this.camera.setViewOffset(this.width, this.height, Math.min(this.rightInset, this.width * 0.75) / 2, 0, this.width, this.height);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }
}
