import * as THREE from "three";
import type { FlyPose } from "./index";
import type { FlyModel } from "./fly-model";
import { FlyMotion } from "./fly-motion";

/** One WebGL context and one posed instance serve an entire roster: callers hand in plain
 * 2D canvases and receive a painted copy, so a list of any length costs a single context. */
export class FlyPreviews {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.001, 20);
  private readonly pivot = new THREE.Group();
  private readonly holder = new THREE.Group();
  private instance?: THREE.Object3D;
  private motion?: FlyMotion;
  private distance = 1;
  constructor(readonly pixels: number) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(pixels, pixels, false);
    this.renderer.setClearColor(0x000000, 0);
    this.scene.add(new THREE.HemisphereLight("#fff8e8", "#718d80", 2.5));
    const sun = new THREE.DirectionalLight("#fff4dc", 3);
    sun.position.set(0.8, 1.3, 0.9);
    this.scene.add(sun);
    this.pivot.add(this.holder);
    this.scene.add(this.pivot);
  }

  /** Borrows the model: instances share its resources, so the loader keeps ownership. */
  setModel(model: FlyModel): void {
    if (this.instance) {
      this.motion?.dispose();
      this.disposeSkeletons();
      this.holder.remove(this.instance);
    }
    this.instance = model.instantiate();
    this.holder.add(this.instance);
    this.motion = new FlyMotion(this.instance, model.clips);
    const center = model.bounds.getCenter(new THREE.Vector3());
    this.holder.position.copy(center).negate();
    const radius = model.bounds.getSize(new THREE.Vector3()).length() / 2;
    this.distance = (radius / Math.tan((this.camera.fov * Math.PI) / 360)) * 1.2;
  }

  /** Render the atlas before copying any tile, avoiding a GPU readback between flies. */
  paint(entries: readonly { canvas: HTMLCanvasElement; pose?: FlyPose }[], rotation: readonly [number, number, number, number]): void {
    if (!this.instance || !entries.length) return;
    const columns = Math.ceil(Math.sqrt(entries.length));
    const rows = Math.ceil(entries.length / columns);
    const width = columns * this.pixels, height = rows * this.pixels;
    if (this.renderer.domElement.width !== width || this.renderer.domElement.height !== height)
      this.renderer.setSize(width, height, false);
    this.camera.quaternion.fromArray(rotation);
    this.camera.position.set(0, 0, this.distance).applyQuaternion(this.camera.quaternion);
    this.renderer.setScissorTest(false);
    this.renderer.clear();
    this.renderer.autoClear = false;
    this.renderer.setScissorTest(true);
    entries.forEach(({ pose }, index) => {
      if (!pose || pose.hidden) return;
      const x = (index % columns) * this.pixels;
      const y = (rows - 1 - Math.floor(index / columns)) * this.pixels;
      this.renderer.setViewport(x, y, this.pixels, this.pixels);
      this.renderer.setScissor(x, y, this.pixels, this.pixels);
      if (pose.rotation) this.pivot.quaternion.fromArray(pose.rotation);
      else this.pivot.rotation.set(0, Math.PI / 2 - pose.heading, 0);
      this.motion?.sample(pose.animation);
      this.renderer.render(this.scene, this.camera);
    });
    entries.forEach(({ canvas }, index) => {
      const context = canvas.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(this.renderer.domElement, (index % columns) * this.pixels,
        Math.floor(index / columns) * this.pixels, this.pixels, this.pixels,
        0, 0, canvas.width, canvas.height);
    });
  }

  private disposeSkeletons(): void {
    const skeletons = new Set<THREE.Skeleton>();
    this.instance?.traverse(object => { if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton); });
    skeletons.forEach(skeleton => skeleton.dispose());
  }

  dispose(): void {
    this.motion?.dispose();
    this.disposeSkeletons();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
