import * as THREE from "three";
import type { RetinaProjection } from "./retina-projection";

/** Pool the captured linear colors on GPU; readback contains only the canonical RGB8 cells. */
export class RetinaPooling {
  readonly target: THREE.WebGLRenderTarget;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  private readonly geometry = new THREE.PlaneGeometry(2, 2);
  private readonly mapping: THREE.DataTexture;
  private readonly material: THREE.RawShaderMaterial;

  constructor(projection: RetinaProjection, atlas: THREE.Texture) {
    const table = projection.poolingTable();
    this.mapping = new THREE.DataTexture(table.data, table.width, table.height, THREE.RedIntegerFormat, THREE.IntType);
    this.mapping.internalFormat = "R32I";
    this.mapping.needsUpdate = true;
    this.target = new THREE.WebGLRenderTarget(projection.cells.length, 32, {
      type: THREE.UnsignedByteType, colorSpace: THREE.LinearSRGBColorSpace,
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
      generateMipmaps: false, depthBuffer: false,
    });
    this.material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3, depthTest: false, depthWrite: false,
      uniforms: { atlas: { value: atlas }, mapping: { value: this.mapping }, size: { value: new Int32Array([projection.profile.width, projection.profile.height]) } },
      vertexShader: `in vec3 position;
        void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `precision highp float;
        precision highp int;
        uniform highp sampler2D atlas;
        uniform highp isampler2D mapping;
        uniform ivec2 size;
        out vec4 result;
        void main() {
          ivec2 pixel = ivec2(gl_FragCoord.xy);
          int cell = pixel.x, eye = pixel.y;
          ivec2 origin = ivec2(eye % 8, eye / 8) * size;
          int count = texelFetch(mapping, ivec2(0, cell), 0).r;
          vec3 sum = vec3(0.0);
          for (int i = 1; i <= count; i++) {
            int source = texelFetch(mapping, ivec2(i, cell), 0).r;
            if (source >= 0) {
              ivec2 coordinate = origin + ivec2(source % size.x, size.y - 1 - source / size.x);
              sum += texelFetch(atlas, coordinate, 0).rgb;
            }
          }
          if (any(isnan(sum)) || any(isinf(sum))) { result = vec4(0.0); return; }
          result = vec4(floor(clamp(sum / float(count), 0.0, 1.0) * 255.0 + 0.5) / 255.0, 1.0);
        }`,
    });
    const quad = new THREE.Mesh(this.geometry, this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);
  }

  render(renderer: THREE.WebGLRenderer, views: number): void {
    this.target.viewport.set(0, 0, this.target.width, views);
    this.target.scissor.copy(this.target.viewport);
    this.target.scissorTest = true;
    renderer.setRenderTarget(this.target);
    renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.target.dispose(); this.mapping.dispose(); this.material.dispose(); this.geometry.dispose();
    this.scene.clear();
  }
}
