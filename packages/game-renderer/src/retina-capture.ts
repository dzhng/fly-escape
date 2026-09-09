import * as THREE from "three";
import type { EyePose } from "@fly-escape/sim-client";
import { RetinaProjection, retinaProfile, retinaCameraProjection, type RetinaProfile } from "./retina-projection";
import { retinalEyeRig } from "./retina-eye-rig";
import { RetinaPooling } from "./retina-pooling";

export type RetinalPose = Pick<EyePose, "position" | "rotation">;

/** One renderer/readback batch for the complete frozen swarm, independent of the player's view. */
export class RetinaCapture {
  readonly projection: RetinaProjection;
  readonly renderer: THREE.WebGLRenderer;
  private readonly target: THREE.WebGLRenderTarget;
  private readonly pooling: RetinaPooling;
  private readonly samplePixels: Uint8Array;
  private diagnosticPixels?: Float32Array;
  private readonly camera = new THREE.PerspectiveCamera(retinaCameraProjection.verticalFovDegrees, retinaCameraProjection.aspect, retinaCameraProjection.nearMetres, retinaCameraProjection.farMetres);
  private readonly bodyRotation = new THREE.Quaternion();
  private readonly eyeRotation = new THREE.Quaternion();
  private pending = false;
  private disposed = false;
  private cancelReadback?: () => void;
  private readonly gl: WebGL2RenderingContext;
  private readonly readbackBuffer: WebGLBuffer;
  private readbackCapacity: number;
  private readonly contextLost = () => this.dispose();

  constructor(private readonly scene: THREE.Scene,
    profile: Readonly<RetinaProfile> = retinaProfile) {
    this.projection = new RetinaProjection(profile);
    const width = profile.width * 8, height = profile.height * 4;
    const canvas = new OffscreenCanvas(width, height);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
    const gl = this.renderer.getContext();
    if (!(gl instanceof WebGL2RenderingContext) || !this.renderer.extensions.has("EXT_color_buffer_float")) {
      this.renderer.dispose(); this.renderer.forceContextLoss();
      throw new Error("Retinal capture requires floating-point WebGL2 color buffers");
    }
    this.gl = gl;
    gl.disable(gl.DITHER);
    canvas.addEventListener("webglcontextlost", this.contextLost);
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.info.autoReset = false;
    this.target = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.FloatType, colorSpace: THREE.LinearSRGBColorSpace,
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false,
    });
    this.pooling = new RetinaPooling(this.projection, this.target.texture);
    this.samplePixels = new Uint8Array(this.projection.cells.length * 32 * 4);
    this.readbackCapacity = this.samplePixels.byteLength;
    this.readbackBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.readbackBuffer);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, this.readbackCapacity, gl.STREAM_READ);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
  }

  async acquire(poses: readonly RetinalPose[], diagnostic = false) {
    if (this.disposed) throw new Error("Retinal capture is disposed");
    if (this.pending) throw new Error("Retinal acquisition already pending");
    if (!poses.length || poses.length > 16) throw new Error("Retinal capture requires 1–16 active flies");
    if (poses.some(pose => pose.position.length !== 3 || pose.rotation.length !== 4
      || ![...pose.position, ...pose.rotation].every(Number.isFinite)
      || Math.abs(pose.rotation.reduce((sum, value) => sum + value * value, 0) - 1) > 1e-6))
      throw new Error("Retinal poses must be finite and normalized");
    this.pending = true;
    const began = performance.now(), views = poses.length * 2;
    const { width, height } = this.projection.profile;
    const sampleBytes = this.projection.cells.length * 3;
    const samples = new Uint8Array(views * sampleBytes);
    try {
      this.renderer.info.reset();
      for (let fly = 0; fly < views / 2; fly++) {
        const pose = poses[fly];
        this.bodyRotation.fromArray(pose.rotation);
        for (let eye = 0; eye < 2; eye++) {
          const index = fly * 2 + eye, mount = retinalEyeRig.eyes[eye];
          this.camera.position.fromArray(mount.positionMetres).applyQuaternion(this.bodyRotation);
          this.camera.position.x += pose.position[0]; this.camera.position.y += pose.position[1]; this.camera.position.z += pose.position[2];
          this.eyeRotation.fromArray(mount.cameraToBodyQuaternion);
          this.camera.quaternion.copy(this.bodyRotation).multiply(this.eyeRotation);
          this.target.viewport.set((index % 8) * width, Math.floor(index / 8) * height, width, height);
          this.target.scissor.copy(this.target.viewport);
          this.target.scissorTest = true;
          this.renderer.setRenderTarget(this.target);
          this.renderer.render(this.scene, this.camera);
        }
      }
      const poolingBegan = performance.now();
      this.pooling.render(this.renderer, views);
      const submitted = performance.now();
      await this.readback(this.pooling.target, views, this.samplePixels.subarray(0, views * this.projection.cells.length * 4), began + 4900);
      const read = performance.now();
      for (let cell = 0; cell < samples.length / 3; cell++) {
        if (this.samplePixels[cell * 4 + 3] !== 255) throw new Error("Retinal capture contains invalid optical samples");
        samples[cell * 3] = this.samplePixels[cell * 4];
        samples[cell * 3 + 1] = this.samplePixels[cell * 4 + 1];
        samples[cell * 3 + 2] = this.samplePixels[cell * 4 + 2];
      }
      const completed = performance.now();
      let cameraImages: Uint8ClampedArray<ArrayBuffer>[] | undefined;
      let oracleMaxByteDifference: number | undefined;
      if (diagnostic) {
        const pixels = this.diagnosticPixels ??= new Float32Array(this.target.width * this.target.height * 4);
        await this.readback(this.target, this.target.height, pixels, began + 4900);
        cameraImages = [0, 1].map(eye => this.projection.cameraImage(pixels, this.target.width, eye * width, 0));
        oracleMaxByteDifference = 0;
        for (let eye = 0; eye < views; eye++) {
          const oracle = this.projection.sample(pixels, this.target.width, (eye % 8) * width, Math.floor(eye / 8) * height);
          for (let i = 0; i < oracle.length; i++) oracleMaxByteDifference = Math.max(oracleMaxByteDifference, Math.abs(oracle[i] - samples[eye * sampleBytes + i]));
        }
      }
      return { samples, cameraImages, oracleMaxByteDifference, metrics: {
        submissionMs: submitted - began, poolingSubmissionMs: submitted - poolingBegan,
        readbackMs: read - submitted, unpackMs: completed - read, totalMs: completed - began,
        diagnosticMs: performance.now() - completed,
        draws: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles,
        geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures,
        stagingBytes: this.samplePixels.byteLength, gpuReadbackBytes: this.readbackCapacity,
        diagnosticStagingBytes: this.diagnosticPixels?.byteLength ?? 0, sampleBytes: samples.byteLength,
      } };
    } catch (error) {
      this.dispose();
      throw error;
    } finally {
      this.pending = false;
      if (this.disposed) this.release();
    }
  }

  /** One persistent pixel buffer and one bounded fence; no queued readbacks. */
  private async readback(target: THREE.WebGLRenderTarget, height: number, pixels: Uint8Array | Float32Array, deadline: number): Promise<void> {
    const gl = this.gl;
    this.renderer.setRenderTarget(target);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.readbackBuffer);
    if (pixels.byteLength > this.readbackCapacity) {
      this.readbackCapacity = pixels.byteLength;
      gl.bufferData(gl.PIXEL_PACK_BUFFER, this.readbackCapacity, gl.STREAM_READ);
    }
    gl.readPixels(0, 0, target.width, height, gl.RGBA, pixels instanceof Float32Array ? gl.FLOAT : gl.UNSIGNED_BYTE, 0);
    if (gl.getError() !== gl.NO_ERROR) throw new Error("Retinal rendering or readback produced a WebGL error");
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    if (!sync) throw new Error("Retinal readback fence unavailable");
    try {
      await new Promise<void>((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout>;
        this.cancelReadback = () => { clearTimeout(timer); reject(new Error("Retinal acquisition cancelled or context lost")); };
        const poll = () => {
          const state = gl.clientWaitSync(sync, 0, 0);
          if (this.disposed || gl.isContextLost() || state === gl.WAIT_FAILED) reject(new Error("Retinal readback failed"));
          else if (performance.now() >= deadline) this.dispose();
          else if (state === gl.TIMEOUT_EXPIRED) timer = setTimeout(poll, 1);
          else resolve();
        };
        timer = setTimeout(poll, 1);
      });
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.readbackBuffer);
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, pixels);
      if (gl.isContextLost() || gl.getError() !== gl.NO_ERROR) throw new Error("Retinal GPU copy failed");
    } finally {
      this.cancelReadback = undefined;
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      gl.deleteSync(sync);
    }
  }

  get gpu(): string {
    const extension = this.gl.getExtension("WEBGL_debug_renderer_info");
    return extension ? String(this.gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)) : this.gl.getParameter(this.gl.RENDERER);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelReadback?.();
    if (!this.gl.isContextLost()) this.renderer.forceContextLoss();
    if (!this.pending) this.release();
  }
  private release(): void {
    this.renderer.domElement.removeEventListener("webglcontextlost", this.contextLost);
    this.gl.deleteBuffer(this.readbackBuffer);
    this.pooling.dispose(); this.target.dispose(); this.renderer.dispose();
  }
}
