import * as THREE from "three";
import type { RoomDetails } from "./room-details";
export { loadRoomDetails } from "./room-details";
export type { RoomDetail } from "./room-details";
import { housePalette } from "./house-materials";
import { PlacementModels, type PlacementKind } from "./placement-models";
export { loadPlacementModel } from "./placement-models";
export type { PlacementKind } from "./placement-models";
import { FlyTrails, type TrailPoint } from "./trails";
export { recordedTrails } from "./trails";
import { HouseGeometry, cutAwayOccluders, type HouseAsset } from "./house";
export { loadHousePart, loadStaticHouseModel } from "./house";
export { loadHouseAssets } from "./house-assets";
export type { HousePart, HouseAsset } from "./house";
import { FlyMotion, type FlyAnimation } from "./fly-motion";
export { flyAnimation, interpolateRotation } from "./fly-motion";
export type { FlyAnimation } from "./fly-motion";
import { FlyModel } from "./fly-model";
import { disposeObjectResources } from "./resources";
export { disposeObjectResources } from "./resources";
export { loadFlyModel, FlyModel } from "./fly-model";
import { ExteriorGrass } from "./exterior-grass";
import { WorldCamera } from "./camera";
import { cameraInput } from "./camera-input";
import type { Geometry, FieldGrid, ContactRegion, ContactSurface, ExitOpening, Placement, ToolDef, Point } from "@fly-escape/sim-client";

export type FieldChannel = "attractiveOdor" | "repellentOdor" | "brightness" | "shade" | "exitCue";
/** Fixed modeled cue value at half overlay strength; never normalized per frame. */
export const FIELD_OVERLAY_HALF_VALUES: Record<FieldChannel, number> = {
  attractiveOdor: 1,
  repellentOdor: 1,
  brightness: 0.1,
  shade: 1,
  exitCue: 1,
};
export const FIELD_COLORS: Record<FieldChannel, [number, number, number]> = {
  attractiveOdor: [215, 110, 35],
  repellentOdor: [215, 110, 35],
  brightness: [67, 76, 211],
  shade: [74, 83, 166],
  exitCue: [45, 169, 156],
};

export interface FlyPose {
  x: number;
  y: number;
  z: number;
  /** Radians on the x/z floor: zero points +X, positive turns toward +Z. */
  heading: number;
  animation?: FlyAnimation;
  /** Core-computed native glTF orientation for supported poses. */
  rotation?: readonly [number, number, number, number];
}

/** A presentation-only fixture. The caller owns pose sampling and frame scheduling. */
export class WorldView {
  private readonly scene = new THREE.Scene();
  private inspectionModel?: THREE.Group;
  private roomDetails?: RoomDetails;
  private spawnArea: THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial> | null = null;
  private readonly placementModels = new PlacementModels();
  private readonly trails: FlyTrails;
  private trailSample?: {
    paths: readonly (readonly TrailPoint[])[];
    cursorTick: number;
  };
  private readonly navigation: WorldCamera;
  private controls?: ReturnType<typeof cameraInput>;
  private selectedFly: number | null = null;
  private readonly selectionRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private readonly raycaster = new THREE.Raycaster();
  private readonly house: HouseGeometry;
  private readonly exterior: ExteriorGrass;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly flies: THREE.Object3D[] = [createPlaceholderFly()];
  private motions: FlyMotion[] = [];
  private subjectCenterY = 0.35;
  private nativeSpan = 1;
  private readonly nativeScale = new THREE.Vector3(1, 1, 1);
  private displayScale = 1;
  private modelKind: "placeholder" | "glb" = "placeholder";
  private readonly observer: ResizeObserver;
  private readonly sensorMarkers = [createPointMarker("L"), createPointMarker("R")];
  private readonly windArrow = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(),
    1,
    "#244f88",
  );
  private readonly bounds: THREE.Box3;
  private readonly placementMarkers = new THREE.Group();
  private readonly contactMarkers = new THREE.Group();
  private readonly contactCenter = createPointMarker("C");
  private fieldOverlay: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null = null;
  private fieldTexture: THREE.DataTexture | null = null;

  constructor(
    private readonly container: HTMLElement,
    geometry: Geometry,
    flyCount = 1,
  ) {
    if (!Number.isInteger(flyCount) || flyCount < 1 || flyCount > 100)
      throw new Error("Scene requires 1..100 flies");
    while (this.flies.length < flyCount) this.flies.push(this.flies[0].clone(true));
    this.house = new HouseGeometry(geometry);
    this.exterior = new ExteriorGrass(geometry);
    this.scene.add(this.exterior.root);
    this.bounds = new THREE.Box3();
    for (const room of geometry.rooms) {
      this.bounds.expandByPoint(new THREE.Vector3(room.min.x, 0, room.min.z));
      this.bounds.expandByPoint(new THREE.Vector3(room.max.x, 1, room.max.z));
    }
    if (this.bounds.isEmpty()) throw new Error("Scene requires room geometry");
    const modelBounds = new THREE.Box3().setFromObject(this.flies[0]);
    const modelSize = modelBounds.getSize(new THREE.Vector3());
    const ringRadius = Math.max(modelSize.x, modelSize.z) * 0.6;
    this.selectionRing = new THREE.Mesh(
      new THREE.RingGeometry(ringRadius * 0.94, ringRadius, 64),
      new THREE.MeshBasicMaterial({
        color: "#f5cc35",
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    // Keep the yellow circle legible on pale surfaces with a narrow dark edge.
    // Ring UVs retain their authored 0.94..1 radial band as its screen width changes.
    this.selectionRing.material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying float ringBand;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nringBand = (length(uv - 0.5) * 2.0 - 0.94) / 0.06;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float ringBand;")
        .replace("#include <color_fragment>", `#include <color_fragment>
          float edge = 1.0 - ringBand;
          float antialias = fwidth(ringBand) * 0.5;
          float yellow = smoothstep(0.3 - antialias, 0.3 + antialias, edge);
          diffuseColor.rgb = mix(vec3(0.035, 0.024, 0.005), diffuseColor.rgb, yellow);
        `);
    };
    this.navigation = new WorldCamera(this.bounds, modelBounds.getSize(new THREE.Vector3()).y);
    this.trails = new FlyTrails(flyCount, this.navigation);
    this.scene.add(this.trails.mesh);
    const center = this.bounds.getCenter(new THREE.Vector3());
    const radius = this.bounds.getSize(new THREE.Vector3()).length() / 2;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.localClippingEnabled = true;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color(housePalette.background);
    const canvas = this.renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.setAttribute("role", "img");
    canvas.setAttribute(
      "aria-label",
      flyCount === 1
        ? "Three-dimensional neural test chamber and fly"
        : `Three-dimensional observation chamber with ${flyCount} flies`,
    );
    container.appendChild(canvas);

    this.scene.add(new THREE.HemisphereLight("#fff8e8", "#718d80", 2.5));
    const sun = new THREE.DirectionalLight("#fff4dc", 3);
    sun.position.copy(center).add(new THREE.Vector3(radius, radius * 2, radius));
    sun.target.position.copy(center);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -radius * 1.5;
    sun.shadow.camera.right = sun.shadow.camera.top = radius * 1.5;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = radius * 5;
    sun.shadow.normalBias = 0.025;
    sun.shadow.bias = -0.001;
    this.scene.add(
      sun,
      sun.target,
      this.house.root,
      ...this.flies,
      this.contactMarkers,
      this.selectionRing,
    );
    this.selectionRing.rotation.x = -Math.PI / 2;
    this.selectionRing.visible = false;
    this.flies.forEach((fly, id) => {
      fly.userData.flyId = id;
    });
    this.sensorMarkers.forEach((marker) => {
      marker.visible = false;
      this.scene.add(marker);
    });
    this.contactCenter.visible = false;
    this.scene.add(this.contactCenter);
    this.windArrow.visible = false;
    this.scene.add(this.windArrow);
    this.setPose({ x: 0, y: 0, z: 0, heading: 0 });
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
    this.navigation.overview();
  }

  get houseVisibility() {
    return { segments: this.house.walls.children.length, cutaway: this.house.walls.children.filter(wall => wall.userData.cutaway).length, solids: this.house.solids.children.length, solidsCutaway: this.house.solids.children.filter(prop => prop.scale.y < 1).length };
  }

  get exteriorStats() { return { ...this.exterior.stats }; }

  get houseAssetKeys(): HouseAsset[] { return this.house.assetKeys; }

  setHousePart(part: HouseAsset, source: THREE.Group): void {
    this.house.replace(part, source);
    cutAwayOccluders(this.house.solids);
    this.bounds.max.y = Math.max(1, new THREE.Box3().setFromObject(this.house.root).max.y);
    this.navigation.resize(this.container.clientWidth, this.container.clientHeight);
  }

  setRoomDetails(details: RoomDetails): void {
    if (this.roomDetails) {
      this.scene.remove(this.roomDetails.root);
      disposeObjectResources(this.roomDetails.root);
    }
    this.roomDetails = details;
    this.scene.add(details.root);
  }

  /** Diagnostic appearance only: no core occupancy, cutaway, palette or placement semantics. */
  setInspectionModel(source?: THREE.Group): void {
    if (this.inspectionModel) {
      this.scene.remove(this.inspectionModel);
      disposeObjectResources(this.inspectionModel);
    }
    this.inspectionModel = source;
    if (source) this.scene.add(source);
  }

  inspectModel(bounds: THREE.Box3, distance: number, viewpoint: "rts" | "mounting" = "rts"): void {
    this.navigation.inspect(bounds.getCenter(new THREE.Vector3()), distance, viewpoint);
  }

  /** Takes ownership of the model and all its shared resources. */
  setFlyModel(model: FlyModel): void {
    this.motions.forEach((motion) => motion.dispose());
    const removed = new THREE.Group();
    const replacements = this.flies.map((old, id) => {
      const fly = id === 0 ? model.root : model.instantiate();
      fly.visible = old.visible;
      fly.position.copy(old.position);
      fly.quaternion.copy(old.quaternion);
      fly.userData.flyId = id;
      removed.add(old);
      this.scene.add(fly);
      return fly;
    });
    this.flies.splice(0, this.flies.length, ...replacements);
    this.motions = replacements.map((fly) => new FlyMotion(fly, model.clips));
    disposeObjectResources(removed);
    this.modelKind = "glb";
    this.nativeScale.copy(model.root.scale);
    this.subjectCenterY = model.bounds.getCenter(new THREE.Vector3()).y;
    const size = model.bounds.getSize(new THREE.Vector3());
    this.nativeSpan = Math.max(size.x, size.y, size.z);
    this.navigation.setSubjectHeight(size.y);
    const radius = Math.max(size.x, size.z) * 0.6;
    this.selectionRing.geometry.dispose();
    this.selectionRing.geometry = new THREE.RingGeometry(radius * 0.94, radius, 64);
  }

  floorPoint(clientX: number, clientY: number): Point | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.raycaster.setFromCamera(
      new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        1 - ((clientY - rect.top) / rect.height) * 2,
      ),
      this.navigation.camera,
    );
    const hit = this.raycaster.ray.intersectPlane(
      new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      new THREE.Vector3(),
    );
    return hit ? { x: hit.x, z: hit.z } : null;
  }
  setPlacementModel(kind: PlacementKind, root: THREE.Group): void {
    this.placementModels.replace(kind, root);
    this.scene.add(this.placementModels.root);
  }

  setPlacements(
    placements: Placement[],
    catalog: ToolDef[],
    ghost?: { placement: Placement; valid: boolean | null },
    fixed: Placement[] = [],
  ): void {
    this.placementModels.setPlacements([...fixed, ...placements], catalog, ghost);
    disposeObjectResources(this.placementMarkers);
    this.placementMarkers.clear();
    if (!this.placementMarkers.parent) this.scene.add(this.placementMarkers);
    for (const item of [
      ...placements.map((placement) => ({ placement, valid: true, ghost: false })),
      ...(ghost ? [{ ...ghost, ghost: true }] : []),
    ]) {
      const p = item.placement;
      const color = item.ghost ? item.valid === null ? "#e5dbaf" : item.valid ? "#67e5ae" : "#ff657f" : "#d9eacf";
      if (p.kind === "fan")
        this.placementMarkers.add(
          new THREE.ArrowHelper(
            new THREE.Vector3(Math.cos(p.heading), 0, Math.sin(p.heading)),
            new THREE.Vector3(p.position.x, 0.015, p.position.z),
            0.85,
            color,
            0.25,
            0.15,
          ),
        );
    }
  }

  setContactGeometry(food: ContactSurface[], hazards: ContactRegion[], exit: ExitOpening, diagnostic = true): void {
    this.contactCenter.visible = diagnostic && food.length > 0;
    for (const child of [...this.contactMarkers.children]) {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        child.material.dispose();
      }
      this.contactMarkers.remove(child);
    }
    for (const surface of food) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(surface.vertices.flat(), 3));
      geometry.setIndex(surface.triangles.flat());
      geometry.computeVertexNormals();
      // Bias coplanar food in raster depth without moving its physical surface.
      const onFloor = surface.vertices.every(p => p[1] === 0);
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
        color: diagnostic ? "#6b9d52" : "#888888", roughness: 0.7,
        polygonOffset: onFloor, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      }));
      mesh.castShadow = !onFloor;
      mesh.receiveShadow = true;
      this.contactMarkers.add(mesh);
    }
    for (const region of hazards) {
      const mesh = new THREE.Mesh(
        new THREE.CircleGeometry(region.radius, 48),
        new THREE.MeshBasicMaterial({ color: "#bd5349", transparent: true, opacity: 0.55, depthWrite: false }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(region.center.x, 0.025, region.center.z);
      this.contactMarkers.add(mesh);
    }
    const length = Math.hypot(exit.b.x - exit.a.x, exit.b.z - exit.a.z);
    const doorway = new THREE.Mesh(
      new THREE.BoxGeometry(length, 0.025, 0.09),
      new THREE.MeshBasicMaterial(housePalette.exit),
    );
    doorway.position.set((exit.a.x + exit.b.x) / 2, 0.04, (exit.a.z + exit.b.z) / 2);
    doorway.rotation.y = -Math.atan2(exit.b.z - exit.a.z, exit.b.x - exit.a.x);
    this.contactMarkers.add(doorway);
  }

  setPose(pose: FlyPose): void {
    this.motions[0]?.sample(pose.animation);
    this.flies[0].position.set(pose.x, pose.y, pose.z);
    this.contactCenter.position.set(pose.x, 0, pose.z);
    // The replaceable model is +Y up, +Z forward, with its pivot at foot contact.
    if (pose.rotation) this.flies[0].quaternion.fromArray(pose.rotation);
    else this.flies[0].rotation.set(0, Math.PI / 2 - pose.heading, 0);
  }

  /** Authored release region only; no speculative fly positions before Run. */
  setSpawnArea(min: { x: number; z: number }, max: { x: number; z: number }): void {
    this.clearSpawnArea();
    this.selectedFly = null;
    this.selectionRing.visible = false;
    this.flies.forEach((fly) => {
      fly.visible = false;
    });
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(min.x, 0.016, min.z),
      new THREE.Vector3(max.x, 0.016, min.z),
      new THREE.Vector3(max.x, 0.016, max.z),
      new THREE.Vector3(min.x, 0.016, max.z),
    ]);
    this.spawnArea = new THREE.LineLoop(
      geometry,
      new THREE.LineBasicMaterial({ color: "#b8d2d7" }),
    );
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 64;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#203944";
    context.fillRect(0, 0, 160, 64);
    context.fillStyle = "#f4f7f5";
    context.font = "bold 28px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("Start", 80, 32);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        depthTest: false,
        depthWrite: false,
        sizeAttenuation: false,
      }),
    );
    label.center.set(0.5, 0);
    label.position.set((min.x + max.x) / 2, 0.08, min.z);
    label.scale.set(0.05, 0.02, 1);
    label.renderOrder = 10;
    this.spawnArea.add(label);
    this.scene.add(this.spawnArea);
  }

  private clearSpawnArea(): void {
    if (!this.spawnArea) return;
    this.scene.remove(this.spawnArea);
    disposeObjectResources(this.spawnArea);
    this.spawnArea = null;
  }

  /** Poses are sampled by the caller's one playback cursor. Fly instances
   * share geometry/materials while retaining independent transforms and skeletons. */
  setPoses(poses: readonly FlyPose[]): void {
    if (poses.length !== this.flies.length)
      throw new Error("Pose count differs from scene population");
    this.clearSpawnArea();
    poses.forEach((pose, index) => {
      const fly = this.flies[index];
      fly.visible = true;
      this.motions[index]?.sample(pose.animation);
      fly.position.set(pose.x, pose.y, pose.z);
      if (pose.rotation) fly.quaternion.fromArray(pose.rotation);
      else fly.rotation.set(0, Math.PI / 2 - pose.heading, 0);
    });
  }

  /** Explicit detailed snapshot; never collected on the render/report hot path. */
  estimateGpuMemory() {
    const attributes = new Set<THREE.BufferAttribute | THREE.InterleavedBuffer>();
    const textures = new Set<THREE.Texture>();
    const materials = new Set<THREE.Material>();
    let shadowFramebufferBytes = 0;
    this.scene.traverse((object) => {
      if (object instanceof THREE.SkinnedMesh && object.skeleton.boneTexture) {
        textures.add(object.skeleton.boneTexture);
      }
      if (
        object instanceof THREE.Mesh ||
        object instanceof THREE.Line ||
        object instanceof THREE.Sprite
      ) {
        const geometry = object.geometry;
        for (const attribute of Object.values(geometry.attributes)) {
          if (attribute instanceof THREE.InterleavedBufferAttribute) attributes.add(attribute.data);
          else if (attribute instanceof THREE.BufferAttribute) attributes.add(attribute);
        }
        if (geometry.index) attributes.add(geometry.index);
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          materials.add(material);
        }
      }
      if (object instanceof THREE.DirectionalLight && object.castShadow) {
        // RGBA8 color plus a conservative four-byte depth attachment.
        for (const target of [object.shadow.map, object.shadow.mapPass]) {
          if (target) shadowFramebufferBytes += target.width * target.height * 8;
        }
      }
    });
    for (const material of materials) {
      for (const value of Object.values(material))
        if (value instanceof THREE.Texture) textures.add(value);
    }
    const geometryBytes = [...attributes].reduce(
      (sum, attribute) => sum + attribute.array.byteLength,
      0,
    );
    const materialTextures = [...textures].map((texture) => {
      const image = texture.image as { width?: number; height?: number } | undefined;
      const width = Number(image?.width ?? 0),
        height = Number(image?.height ?? 0);
      let w = width,
        h = height,
        pixels = w * h,
        mipLevels = 1;
      while (texture.generateMipmaps && (w > 1 || h > 1)) {
        w = Math.max(1, Math.floor(w / 2));
        h = Math.max(1, Math.floor(h / 2));
        pixels += w * h;
        mipLevels++;
      }
      const bytesPerPixel =
        texture.type === THREE.FloatType ? 16 : texture.type === THREE.HalfFloatType ? 8 : 4;
      return { width, height, mipLevels, estimatedBytes: pixels * bytesPerPixel };
    });
    const textureBytes = materialTextures.reduce((sum, texture) => sum + texture.estimatedBytes, 0);
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const gl = this.renderer.getContext();
    const samples = Number(gl.getParameter(gl.SAMPLES));
    // Color/depth at each sample, plus a resolved color image when multisampled.
    const defaultFramebufferBytes =
      size.x * size.y * (8 * Math.max(1, samples) + (samples > 1 ? 4 : 0));
    return {
      geometryBytes,
      materialTextures,
      textureBytes,
      shadowFramebufferBytes,
      defaultFramebufferBytes,
      drawingBufferWidth: size.x,
      drawingBufferHeight: size.y,
      defaultSamples: samples,
      estimatedBytes:
        geometryBytes + textureBytes + shadowFramebufferBytes + defaultFramebufferBytes,
      note: "GPU estimate: live attributes/indices, RGBA textures including mipmaps, and conservative color/depth framebuffers; excludes driver and browser compositor overhead.",
    };
  }

  get statistics() {
    return {
      flyCount: this.flies.length,
      modelKind: this.modelKind,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
    };
  }

  enableCamera(onPick: (x: number, y: number) => void = () => {}): void {
    this.controls?.dispose();
    this.controls = cameraInput(this.renderer.domElement, this.navigation, onPick);
  }

  /** Web owns selected ID. Model picks return through its same card action. */
  enableSelection(onSelect: (id: number) => void): void {
    const canvas = this.renderer.domElement;
    this.enableCamera((x, y) => {
      this.scene.updateMatrixWorld(true);
      this.raycaster.setFromCamera(
        new THREE.Vector2((x / canvas.clientWidth) * 2 - 1, 1 - (y / canvas.clientHeight) * 2),
        this.navigation.camera,
      );
      const hit = this.raycaster.intersectObjects(
        this.flies.filter((fly) => fly.visible),
        true,
      )[0];
      if (!hit) return;
      let owner: THREE.Object3D | null = hit.object;
      while (owner && owner.userData.flyId === undefined) owner = owner.parent;
      if (owner) onSelect(owner.userData.flyId);
    });
  }

  selectFly(id: number): void {
    const fly = this.flies[id];
    if (!fly || !fly.visible) throw new Error("Selected fly does not exist or is hidden");
    this.selectedFly = id;
    this.selectionRing.visible = true;
    this.navigation.follow(this.flyCenter(fly, 1));
  }

  zoomClose(): void {
    this.navigation.zoomClose();
  }

  overview(): void {
    this.navigation.overview();
  }

  get cameraState() {
    return {
      ...this.navigation.state,
      selectedFlyId: this.selectedFly,
      displayScale: this.displayScale,
      flies: this.flies.map((fly, id) => ({
        id,
        ...this.navigation.project(
          this.flyCenter(fly, this.displayScale),
        ),
      })),
    };
  }

  /** Core-exported sample points keep diagnostics aligned with the actual sensory input. */
  setSensoryMarkers(points: [Point, Point], height: number): void {
    const dx = points[0].x - points[1].x;
    const dz = points[0].z - points[1].z;
    const cameraRight = new THREE.Vector3().setFromMatrixColumn(
      this.navigation.camera.matrixWorld,
      0,
    );
    const leftOnScreenRight = dx * cameraRight.x + dz * cameraRight.z >= 0;
    this.sensorMarkers.forEach((marker, i) => {
      marker.position.set(points[i].x, height, points[i].z);
      marker.visible = true;
      for (const child of marker.children) {
        if (child instanceof THREE.Sprite) child.center.x = (i === 0) === leftOnScreenRight ? 0 : 1;
      }
    });
  }

  /** Direction-only wind marker, offset from the fly so its wings cannot hide it. */
  setWind(pose: FlyPose, wind: { x: number; z: number }): void {
    const length = Math.hypot(wind.x, wind.z);
    this.windArrow.visible = length > 0;
    if (length === 0) return;
    this.windArrow.position.set(
      THREE.MathUtils.clamp(pose.x + 1.5, this.bounds.min.x + 1.5, this.bounds.max.x - 1.5),
      0.06,
      THREE.MathUtils.clamp(pose.z, this.bounds.min.z + 1.5, this.bounds.max.z - 1.5),
    );
    this.windArrow.setDirection(new THREE.Vector3(wind.x / length, 0, wind.z / length));
    this.windArrow.setLength(1.25, 0.35, 0.3);
  }

  /** Display core-exported cell samples. The renderer never evaluates a sensory field. */
  setFieldGrid(grid: FieldGrid | null, channel: FieldChannel): void {
    if (grid === null) {
      if (this.fieldOverlay) this.fieldOverlay.visible = false;
      return;
    }
    if (
      !this.fieldTexture ||
      this.fieldTexture.image.width !== grid.width ||
      this.fieldTexture.image.height !== grid.height
    ) {
      this.fieldTexture?.dispose();
      this.fieldTexture = new THREE.DataTexture(
        new Uint8Array(grid.width * grid.height * 4),
        grid.width,
        grid.height,
      );
      this.fieldTexture.magFilter = this.fieldTexture.minFilter = THREE.NearestFilter;
      this.fieldTexture.colorSpace = THREE.SRGBColorSpace;
      if (this.fieldOverlay) this.fieldOverlay.material.map = this.fieldTexture;
    }
    if (!this.fieldOverlay) {
      this.fieldOverlay = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          map: this.fieldTexture,
          transparent: true,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      // Ground transparency must blend before wings and measurement labels.
      this.fieldOverlay.renderOrder = -1;
      this.fieldOverlay.rotation.x = -Math.PI / 2;
      this.scene.add(this.fieldOverlay);
    }
    const color = FIELD_COLORS[channel];
    const data = this.fieldTexture.image.data!; // Allocated as Uint8Array above.
    for (let z = 0; z < grid.height; z++) {
      for (let x = 0; x < grid.width; x++) {
        const sample = grid.cells[z * grid.width + x];
        const value = sample ? sample[channel] : 0;
        // Plane UV bottom is world +Z after rotation; reverse rows to preserve core coordinates.
        const offset = ((grid.height - 1 - z) * grid.width + x) * 4;
        data[offset] = color[0];
        data[offset + 1] = color[1];
        data[offset + 2] = color[2];
        data[offset + 3] = Math.round(
          (220 * Math.max(0, value)) / (FIELD_OVERLAY_HALF_VALUES[channel] + Math.max(0, value)),
        );
      }
    }
    this.fieldTexture.needsUpdate = true;
    this.fieldOverlay.position.set(
      (grid.origin.x + grid.max.x) / 2,
      0.012,
      (grid.origin.z + grid.max.z) / 2,
    );
    this.fieldOverlay.scale.set(grid.max.x - grid.origin.x, grid.max.z - grid.origin.z, 1);
    this.fieldOverlay.visible = true;
  }

  private flyCenter(fly: THREE.Object3D, scale: number): THREE.Vector3 {
    return new THREE.Vector3(0, this.subjectCenterY * scale, 0).applyQuaternion(fly.quaternion).add(fly.position);
  }

  private updateSelectionRing(): void {
    const { geometry, position } = this.selectionRing;
    const vertices = geometry.attributes.position;
    const rimStart = geometry.parameters.thetaSegments + 1;
    const center = this.navigation.project(position);
    const point = new THREE.Vector3();
    let projectedRadius = Infinity;
    // Sample the fixed outer rim through the shared camera, including ground foreshortening.
    for (let i = rimStart; i < vertices.count; i++) {
      point.set(vertices.getX(i), vertices.getY(i), 0).applyMatrix4(this.selectionRing.matrixWorld);
      const rim = this.navigation.project(point);
      projectedRadius = Math.min(projectedRadius, Math.hypot(rim.x - center.x, rim.y - center.y));
    }
    const innerRatio = 1 - THREE.MathUtils.clamp(1.5 / projectedRadius, 0.06, 0.45);
    for (let i = 0; i < rimStart; i++) {
      vertices.setXY(
        i,
        vertices.getX(i + rimStart) * innerRatio,
        vertices.getY(i + rimStart) * innerRatio,
      );
    }
    vertices.needsUpdate = true;
  }

  resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.navigation.resize(width, height);
  }

  setTrails(paths: readonly (readonly TrailPoint[])[], cursorTick: number): void {
    this.trailSample = { paths, cursorTick };
  }

  render(timeSeconds = performance.now() / 1000): void {
    this.controls?.update(performance.now());
    this.displayScale = this.navigation.displayScale(this.nativeSpan);
    for (const fly of this.flies) fly.scale.copy(this.nativeScale).multiplyScalar(this.displayScale);
    this.selectionRing.scale.setScalar(this.displayScale);
    let selectedTarget: THREE.Vector3 | undefined;
    if (this.selectedFly !== null) {
      const fly = this.flies[this.selectedFly];
      selectedTarget = this.flyCenter(fly, this.displayScale);
      this.navigation.track(selectedTarget);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(fly.quaternion);
      this.selectionRing.position.copy(fly.position).addScaledVector(up, this.subjectCenterY * this.displayScale * 0.12);
      this.selectionRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), up);
      this.selectionRing.updateMatrixWorld(true);
      this.updateSelectionRing();
    }
    this.house.updateWallVisibility(this.navigation.camera);
    // Furniture cutaway follows the selected fly; wall cutaway exposes rooms.
    if (selectedTarget && this.navigation.project(selectedTarget).visible) {
      const direction = selectedTarget.clone().sub(this.navigation.camera.position);
      this.raycaster.set(this.navigation.camera.position, direction.clone().normalize());
      this.raycaster.far = direction.length();
      cutAwayOccluders(this.house.solids, this.raycaster);
      this.raycaster.far = Infinity;
    } else {
      cutAwayOccluders(this.house.solids);
    }
    if (this.trailSample) this.trails.sample(this.trailSample.paths, this.trailSample.cursorTick,
      this.selectionRing.geometry.parameters.outerRadius * this.displayScale);
    this.exterior.update(this.navigation.exteriorGroundCircle(), timeSeconds);
    this.roomDetails?.update(this.navigation.camera);
    this.renderer.render(this.scene, this.navigation.camera);
  }

  dispose(): void {
    this.clearSpawnArea();
    this.scene.remove(this.placementModels.root);
    this.placementModels.dispose();
    this.motions.forEach((motion) => motion.dispose());
    this.controls?.dispose();
    this.observer.disconnect();
    disposeObjectResources(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

function createPlaceholderFly(): THREE.Group {
  const fly = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: "#354d44", roughness: 0.7 });
  const eyes = new THREE.MeshStandardMaterial({ color: "#b34d30", roughness: 0.5 });
  const wings = new THREE.MeshStandardMaterial({
    color: "#f4fff7",
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    roughness: 0.35,
    side: THREE.DoubleSide,
  });
  const sphere = new THREE.SphereGeometry(1, 16, 12);
  const ellipsoid = (
    material: THREE.Material,
    position: [number, number, number],
    scale: [number, number, number],
  ) => {
    const mesh = new THREE.Mesh(sphere, material);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.scale.set(scale[0], scale[1], scale[2]);
    mesh.castShadow = material !== wings;
    fly.add(mesh);
    return mesh;
  };
  ellipsoid(shell, [0, 0.32, -0.32], [0.23, 0.23, 0.39]);
  ellipsoid(shell, [0, 0.4, 0.13], [0.25, 0.26, 0.29]);
  ellipsoid(shell, [0, 0.43, 0.48], [0.23, 0.2, 0.2]);
  for (const side of [-1, 1]) {
    ellipsoid(eyes, [side * 0.16, 0.48, 0.57], [0.13, 0.14, 0.11]);
    const wing = ellipsoid(wings, [side * 0.4, 0.53, -0.17], [0.27, 0.025, 0.52]);
    wing.rotation.y = side * -0.55;
    for (const z of [-0.26, 0.05, 0.3]) {
      const points = [
        new THREE.Vector3(side * 0.12, 0.29, z),
        new THREE.Vector3(side * 0.38, 0.17, z - 0.06),
        new THREE.Vector3(side * 0.5, 0.015, z - 0.2),
      ];
      const leg = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 4, 0.022, 5, false),
        shell,
      );
      leg.castShadow = true;
      fly.add(leg);
    }
  }
  return fly;
}

function createPointMarker(label: "L" | "R" | "C"): THREE.Group {
  const group = new THREE.Group();
  const color = label === "L" ? "#174845" : "#742b20";
  const pin = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 8, 6),
    new THREE.MeshBasicMaterial({ color }),
  );
  const leader = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1.4, 0),
    ]),
    new THREE.LineBasicMaterial({ color }),
  );
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(32, 32, 29, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = color;
  context.font = "bold 42px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, 32, 34);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, depthWrite: false, sizeAttenuation: false }),
  );
  sprite.position.y = 1.4;
  sprite.scale.set(0.023, 0.023, 1);
  sprite.center.set(0.5, 0.5);
  group.add(pin, leader, sprite);
  return group;
}
