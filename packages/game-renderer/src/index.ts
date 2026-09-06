import * as THREE from 'three';
import type { Geometry, FieldGrid } from '@fly-escape/sim-client';

export type FieldChannel = 'odor' | 'brightness' | 'shade' | 'exitCue';
/** Fixed modeled cue value at half overlay strength; never normalized per frame. */
export const FIELD_OVERLAY_HALF_VALUES: Record<FieldChannel, number> = { odor: 1, brightness: 0.1, shade: 1, exitCue: 1 };
export const FIELD_COLORS: Record<FieldChannel, [number, number, number]> = {
  odor: [215, 110, 35], brightness: [67, 76, 211], shade: [74, 83, 166], exitCue: [45, 169, 156],
};

export interface FlyPose {
  x: number;
  y: number;
  z: number;
  /** Radians on the x/z floor: zero points +X, positive turns toward +Z. */
  heading: number;
}

/** A presentation-only fixture. The caller owns pose sampling and frame scheduling. */
export class ChamberView {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly fly = createPlaceholderFly();
  private readonly observer: ResizeObserver;
  private readonly sensorMarkers = [createSensorMarker('L'), createSensorMarker('R')];
  private readonly windArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, '#244f88');
  private readonly bounds: THREE.Box3;
  private fieldOverlay: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null = null;
  private fieldTexture: THREE.DataTexture | null = null;

  constructor(private readonly container: HTMLElement, geometry: Geometry) {
    this.bounds = new THREE.Box3();
    for (const room of geometry.rooms) {
      this.bounds.expandByPoint(new THREE.Vector3(room.min.x, 0, room.min.z));
      this.bounds.expandByPoint(new THREE.Vector3(room.max.x, 1, room.max.z));
    }
    if (this.bounds.isEmpty()) throw new Error('Scene requires room geometry');
    const center = this.bounds.getCenter(new THREE.Vector3());
    const radius = this.bounds.getSize(new THREE.Vector3()).length() / 2;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color('#e7ece6');
    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Three-dimensional neural test chamber and fly');
    container.appendChild(canvas);

    this.scene.add(new THREE.HemisphereLight('#fff8e8', '#718d80', 2.5));
    const sun = new THREE.DirectionalLight('#fff4dc', 3);
    sun.position.copy(center).add(new THREE.Vector3(radius, radius * 2, radius));
    sun.target.position.copy(center);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -radius * 1.5;
    sun.shadow.camera.right = sun.shadow.camera.top = radius * 1.5;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = radius * 5;
    sun.shadow.normalBias = 0.025;
    this.scene.add(sun, sun.target, createRoomGeometry(geometry), this.fly);
    this.sensorMarkers.forEach(marker => { marker.visible = false; this.scene.add(marker); });
    this.windArrow.visible = false;
    this.scene.add(this.windArrow);
    this.setPose({ x: 0, y: 0, z: 0, heading: 0 });
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
  }

  setPose(pose: FlyPose): void {
    this.fly.position.set(pose.x, pose.y, pose.z);
    // The replaceable model is +Y up, +Z forward, with its pivot at foot contact.
    this.fly.rotation.y = Math.PI / 2 - pose.heading;
  }

  /** Visual anchors for the recorded input pose, using the core's antenna offset. */
  setSensoryMarkers(pose: FlyPose, antennaOffset: number): void {
    const dx = Math.sin(pose.heading) * antennaOffset;
    const dz = -Math.cos(pose.heading) * antennaOffset;
    const cameraRight = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const leftOnScreenRight = dx * cameraRight.x + dz * cameraRight.z >= 0;
    this.sensorMarkers.forEach((marker, i) => {
      const side = i === 0 ? 1 : -1;
      marker.position.set(pose.x + side * dx, pose.y, pose.z + side * dz);
      marker.visible = true;
      for (const child of marker.children) {
        if (child instanceof THREE.Sprite) child.center.x = ((i === 0) === leftOnScreenRight) ? 0 : 1;
      }
    });
  }

  /** Arrow length is one second of the exported world-space wind velocity. */
  setWind(pose: FlyPose, wind: { x: number; z: number }): void {
    const length = Math.hypot(wind.x, wind.z);
    this.windArrow.visible = length > 0;
    if (length === 0) return;
    this.windArrow.position.set(pose.x, 0.05, pose.z);
    this.windArrow.setDirection(new THREE.Vector3(wind.x / length, 0, wind.z / length));
    this.windArrow.setLength(length, Math.min(0.2, length * 0.3), Math.min(0.15, length * 0.2));
  }

  /** Display core-exported cell samples. The renderer never evaluates a sensory field. */
  setFieldGrid(grid: FieldGrid | null, channel: FieldChannel): void {
    if (grid === null) {
      if (this.fieldOverlay) this.fieldOverlay.visible = false;
      return;
    }
    if (!this.fieldTexture || this.fieldTexture.image.width !== grid.width || this.fieldTexture.image.height !== grid.height) {
      this.fieldTexture?.dispose();
      this.fieldTexture = new THREE.DataTexture(new Uint8Array(grid.width * grid.height * 4), grid.width, grid.height);
      this.fieldTexture.magFilter = this.fieldTexture.minFilter = THREE.NearestFilter;
      this.fieldTexture.colorSpace = THREE.SRGBColorSpace;
      if (this.fieldOverlay) this.fieldOverlay.material.map = this.fieldTexture;
    }
    if (!this.fieldOverlay) {
      this.fieldOverlay = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
        map: this.fieldTexture, transparent: true, depthWrite: false, toneMapped: false,
      }));
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
        data[offset] = color[0]; data[offset + 1] = color[1]; data[offset + 2] = color[2];
        data[offset + 3] = Math.round(220 * Math.max(0, value) / (FIELD_OVERLAY_HALF_VALUES[channel] + Math.max(0, value)));
      }
    }
    this.fieldTexture.needsUpdate = true;
    this.fieldOverlay.position.set((grid.origin.x + grid.max.x) / 2, 0.012, (grid.origin.z + grid.max.z) / 2);
    this.fieldOverlay.scale.set(grid.max.x - grid.origin.x, grid.max.z - grid.origin.z, 1);
    this.fieldOverlay.visible = true;
  }

  resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    const verticalHalfAngle = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const horizontalHalfAngle = Math.atan(Math.tan(verticalHalfAngle) * this.camera.aspect);
    const center = this.bounds.getCenter(new THREE.Vector3());
    const backward = new THREE.Vector3(1, 1.8, 1).normalize();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), backward).normalize();
    const up = new THREE.Vector3().crossVectors(backward, right);
    let distance = 0;
    // Fit every corner in camera space. Perspective depth matters on the near edge.
    for (const x of [this.bounds.min.x, this.bounds.max.x]) {
      for (const y of [this.bounds.min.y, this.bounds.max.y]) {
        for (const z of [this.bounds.min.z, this.bounds.max.z]) {
          const corner = new THREE.Vector3(x, y, z).sub(center);
          distance = Math.max(distance, corner.dot(backward) + Math.max(
            Math.abs(corner.dot(right)) / (Math.tan(horizontalHalfAngle) * 0.92),
            Math.abs(corner.dot(up)) / (Math.tan(verticalHalfAngle) * 0.92),
          ));
        }
      }
    }
    this.camera.position.copy(backward).multiplyScalar(distance).add(center);
    this.camera.far = distance + this.bounds.getSize(new THREE.Vector3()).length() * 2;
    this.camera.lookAt(center);
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.observer.disconnect();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Sprite) {
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(material);
          if (material instanceof THREE.SpriteMaterial && material.map) textures.add(material.map);
        }
      }
      if (object instanceof THREE.DirectionalLight) object.shadow.dispose();
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    this.fieldTexture?.dispose();
    textures.forEach(texture => texture.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

/** Wall segments already contain doorway gaps; no room adjacency is inferred here. */
function createRoomGeometry(geometry: Geometry): THREE.Group {
  const group = new THREE.Group();
  const floorMaterial = new THREE.MeshStandardMaterial({ color: '#d9dfca', roughness: 1 });
  const wallMaterial = new THREE.MeshStandardMaterial({ color: '#8aab9d', roughness: 1 });
  for (const room of geometry.rooms) {
    const floor = new THREE.Mesh(new THREE.BoxGeometry(room.max.x - room.min.x, 0.25, room.max.z - room.min.z), floorMaterial);
    floor.position.set((room.min.x + room.max.x) / 2, -0.125, (room.min.z + room.max.z) / 2);
    floor.receiveShadow = true;
    group.add(floor);
  }
  // Low lab walls expose both the sampled floor and the fly. Final house art is a later slice.
  for (const segment of geometry.walls) {
    const dx = segment.b.x - segment.a.x;
    const dz = segment.b.z - segment.a.z;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(dx, dz), 0.6, 0.12), wallMaterial);
    wall.position.set((segment.a.x + segment.b.x) / 2, 0.3, (segment.a.z + segment.b.z) / 2);
    wall.rotation.y = -Math.atan2(dz, dx);
    wall.castShadow = wall.receiveShadow = true;
    group.add(wall);
  }
  return group;
}

function createPlaceholderFly(): THREE.Group {
  const fly = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: '#354d44', roughness: 0.7 });
  const eyes = new THREE.MeshStandardMaterial({ color: '#b34d30', roughness: 0.5 });
  const wings = new THREE.MeshStandardMaterial({
    color: '#f4fff7', transparent: true, opacity: 0.72, depthWrite: false,
    roughness: 0.35, side: THREE.DoubleSide,
  });
  const sphere = new THREE.SphereGeometry(1, 16, 12);
  const ellipsoid = (material: THREE.Material, position: [number, number, number], scale: [number, number, number]) => {
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
      const points = [new THREE.Vector3(side * 0.12, 0.29, z),
        new THREE.Vector3(side * 0.38, 0.17, z - 0.06),
        new THREE.Vector3(side * 0.5, 0.015, z - 0.2)];
      const leg = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 4, 0.022, 5, false), shell,
      );
      leg.castShadow = true;
      fly.add(leg);
    }
  }
  return fly;
}

function createSensorMarker(label: 'L' | 'R'): THREE.Group {
  const group = new THREE.Group();
  const color = label === 'L' ? '#174845' : '#742b20';
  const pin = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color }));
  const leader = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.85, 0),
  ]), new THREE.LineBasicMaterial({ color }));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#ffffff';
  context.beginPath(); context.arc(32, 32, 29, 0, Math.PI * 2); context.fill();
  context.fillStyle = color; context.font = 'bold 42px sans-serif';
  context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(label, 32, 34);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false, sizeAttenuation: false }));
  sprite.position.y = 0.85;
  sprite.scale.set(0.023, 0.023, 1);
  sprite.center.set(0.5, 0.5);
  group.add(pin, leader, sprite);
  return group;
}
