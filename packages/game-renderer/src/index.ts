import * as THREE from 'three';

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

  constructor(private readonly container: HTMLElement, private readonly chamberSize: number) {
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
    sun.position.set(4, 14, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -9;
    sun.shadow.camera.right = sun.shadow.camera.top = 9;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 35;
    sun.shadow.normalBias = 0.025;
    this.scene.add(sun, sun.target, createChamberFixture(chamberSize), this.fly);
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

  resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    const verticalHalfAngle = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const horizontalHalfAngle = Math.atan(Math.tan(verticalHalfAngle) * this.camera.aspect);
    const distance = (this.chamberSize * 0.75) / Math.sin(Math.min(verticalHalfAngle, horizontalHalfAngle));
    this.camera.position.set(1, 1.8, 1).normalize().multiplyScalar(distance);
    this.camera.lookAt(0, 0.3, 0);
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.observer.disconnect();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(material);
        }
      }
      if (object instanceof THREE.DirectionalLight) object.shadow.dispose();
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

// Dimensions come from the core. The environment seam replaces this chamber-only
// mesh builder with exported room/wall geometry; it never owns collision rules.
function createChamberFixture(size: number): THREE.Group {
  const half = size / 2;
  const chamber = new THREE.Group();
  const floorMaterial = new THREE.MeshStandardMaterial({ color: '#d9dfca', roughness: 1 });
  const wallMaterial = new THREE.MeshStandardMaterial({ color: '#8aab9d', roughness: 1 });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(size + 0.4, 0.25, size + 0.4), floorMaterial);
  floor.position.y = -0.125;
  floor.receiveShadow = true;
  chamber.add(floor);
  for (const [x, z, width, depth, height] of [
    [0, -half-0.1, size+0.4, 0.2, 1.6], [-half-0.1, 0, 0.2, size+0.4, 1.6],
    [0, half+0.1, size+0.4, 0.2, 0.18], [half+0.1, 0, 0.2, size+0.4, 0.18],
  ] as const) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallMaterial);
    wall.position.set(x, height / 2, z);
    wall.castShadow = wall.receiveShadow = true;
    chamber.add(wall);
  }
  const grid = new THREE.GridHelper(size, 12, '#acbca9', '#c0ccb9');
  grid.position.y = 0.006;
  chamber.add(grid);
  return chamber;
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
