import * as THREE from "three";
import type { Geometry } from "@fly-escape/sim-client";
import { wallFootprints } from "./house";
import { meadowDetails } from "./meadow-details";
import { disposeObjectResources } from "./resources";

export interface GrassCircle { x: number; z: number; radius: number }
const CELL_LIMIT = 1024;
const BATCH_CELLS = 64;
const WIDTH_SCALE_MAX = 1.25;
const WIND_REACH = 0.12;
function hash(x: number, z: number, salt: number) {
  let value = Math.imul(x ^ salt, 374761393) ^ Math.imul(z, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

/** Room union and the exact rendered wall strips; no bounding-box lawn exclusion. */
export function grassMask(geometry: Geometry) {
  const strips = wallFootprints(geometry.walls);
  const rectangles = geometry.rooms.map(r => ({ x: (r.min.x + r.max.x) / 2, z: (r.min.z + r.max.z) / 2,
    wall: false, ux: 1, uz: 0, halfX: (r.max.x - r.min.x) / 2, halfZ: (r.max.z - r.min.z) / 2 }));
  for (const w of strips) rectangles.push({
    x: (w.segment.a.x + w.segment.b.x) / 2 + (w.end - w.start) * w.dx / (2 * w.length),
    z: (w.segment.a.z + w.segment.b.z) / 2 + (w.end - w.start) * w.dz / (2 * w.length),
    wall: true, ux: w.dx / w.length, uz: w.dz / w.length, halfX: (w.length + w.start + w.end) / 2, halfZ: w.halfDepth,
  });
  return rectangles;
}
export function grassBlocked(mask: ReturnType<typeof grassMask>, x: number, z: number, margin = 0) {
  return mask.some(r => Math.abs((x - r.x) * r.ux + (z - r.z) * r.uz) <= r.halfX + margin &&
    Math.abs(-(x - r.x) * r.uz + (z - r.z) * r.ux) <= r.halfZ + margin);
}

/** Keep the foundation and exit approaches flat; hills begin beyond the house. */
export function meadowHeight(mask: ReturnType<typeof grassMask>, x: number, z: number) {
  let distance = Infinity;
  for (const r of mask) {
    const dx = Math.max(0, Math.abs((x-r.x)*r.ux+(z-r.z)*r.uz)-r.halfX);
    const dz = Math.max(0, Math.abs(-(x-r.x)*r.uz+(z-r.z)*r.ux)-r.halfZ);
    distance = Math.min(distance, Math.hypot(dx, dz));
  }
  const t = Math.min(1, Math.max(0, (distance - 0.8) / 5));
  return t*t*(3-2*t) * (0.45 + 0.3*Math.sin(x*0.31+z*0.19) + 0.15*Math.cos(z*0.43-x*0.12));
}

/** Uniform deterministic cells: capacity never truncates a row and leaves a bare sector. */
export function grassRecords(circle: GrassCircle, mask: ReturnType<typeof grassMask>, reach: number) {
  const count = Math.min(CELL_LIMIT, Math.ceil(circle.radius * 2 / 0.055));
  const spacing = circle.radius * 2 / count;
  const records = new Float32Array(count * count * 8);
  let accepted = 0;
  for (let z = 0; z < count; z++) for (let x = 0; x < count; x++) {
    const px = circle.x - circle.radius + (x + 0.15 + hash(x, z, 13) * 0.7) * spacing;
    const pz = circle.z - circle.radius + (z + 0.15 + hash(x, z, 29) * 0.7) * spacing;
    if (Math.hypot(px - circle.x, pz - circle.z) > circle.radius - reach || grassBlocked(mask, px, pz, reach)) continue;
    const tint = hash(x >> 2, z >> 2, 83) * 0.5 + hash(x, z, 91) * 0.5;
    records.set([px, pz, hash(x, z, 47) * Math.PI * 2, 0.6 + hash(x, z, 59) * 0.8,
      0.75 + hash(x, z, 71) * 0.5, 0.065 + tint * 0.11, 0.14 + tint * 0.16, 0.018 + tint * 0.035], accepted++ * 8);
  }
  return { records: records.slice(0, accepted * 8), candidateCells: count * count, spacing, count };
}

function bladeGeometry() {
  const positions: number[] = [], indices: number[] = [];
  for (let blade = 0; blade < 8; blade++) {
    const angle = blade * 2.39996;
    const cx = Math.sin(angle) * 0.024, cz = Math.cos(angle) * 0.024;
    const offset = positions.length / 3;
    for (let row = 0; row < 3; row++) {
      const t = row / 2, width = 0.008 * (1 - t);
      for (const side of [-1, 1]) positions.push(cx + Math.cos(angle) * width * side + Math.sin(angle) * 0.06 * t * t,
        0.32 * t, cz - Math.sin(angle) * width * side + Math.cos(angle) * 0.06 * t * t);
    }
    indices.push(offset, offset + 1, offset + 2, offset + 1, offset + 3, offset + 2,
      offset + 2, offset + 3, offset + 4);
  }
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  let reach = 0;
  for (let i = 0; i < positions.length; i += 3) reach = Math.max(reach, Math.hypot(positions[i], positions[i + 2]) * WIDTH_SCALE_MAX);
  return { geometry, reach: reach + WIND_REACH };
}

/** One appearance owner, static uploads, one blade detail level. No simulation state. */
export class ExteriorGrass {
  readonly root = new THREE.Group();
  private circle?: GrassCircle;
  private readonly windTime = { value: 0 };
  private readonly sunDirection = { value: new THREE.Vector2(-1, 0) };
  private readonly mask: ReturnType<typeof grassMask>;
  stats = { batches: 0, clumps: 0, candidateCells: 0, packedBytes: 0, spacing: 0, radius: 0 };
  constructor(geometry: Geometry) {
    this.mask = grassMask(geometry);
    // Stable opaque ordering preserves antialiased wall edges across field rebuilds.
    this.root.renderOrder = -1;
  }
  setSunDirection(direction: { x: number; z: number }) {
    this.sunDirection.value.set(direction.x, direction.z).normalize();
  }
  update(circle: GrassCircle, timeSeconds = 0) {
    this.windTime.value = timeSeconds;
    // Round outward to avoid allocation churn from tiny tracked-centre differences.
    const radius = Math.ceil((circle.radius + 0.1) * 2) / 2;
    if (this.circle?.radius === radius && this.circle.x === circle.x && this.circle.z === circle.z) return;
    disposeObjectResources(this.root); this.root.clear(); this.circle = { ...circle, radius };
    const { geometry, reach } = bladeGeometry();
    const sampled = grassRecords(this.circle, this.mask, reach);
    // Meadow-only atmosphere uses distance outside the house, so close greenery
    // retains contrast and neither indoor surfaces nor flies inherit a fog layer.
    const roomDistanceCode = this.mask.filter(r => !r.wall).map(r =>
      `meadowDistance=min(meadowDistance,length(max(abs(p-vec2(${r.x.toFixed(8)},${r.z.toFixed(8)}))-vec2(${r.halfX.toFixed(8)},${r.halfZ.toFixed(8)}),vec2(0.0))));`
    ).join("\n");
    const atmosphereCode = `
      float meadowHaze(vec2 p) {
        float meadowDistance=10000.0;
        ${roomDistanceCode}
        return smoothstep(3.0,${Math.max(9, radius * 0.7).toFixed(8)},meadowDistance)*0.30;
      }
    `;
    const atmosphereFragment = `
      gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(0.88,0.77,0.48),meadowHaze(grassWorld));
    `;
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, side: THREE.DoubleSide });
    material.onBeforeCompile = shader => {
      shader.uniforms.meadowTime = this.windTime;
      shader.uniforms.meadowSunDirection = this.sunDirection;
      shader.vertexShader = "uniform float meadowTime; uniform vec2 meadowSunDirection; attribute float grassElevation; attribute vec4 grassPlacement; attribute vec4 grassStyle; varying vec3 grassTint; varying vec2 grassWorld; varying float grassTip; varying float grassSheen;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace("#include <beginnormal_vertex>", `vec3 objectNormal = vec3(normal); float cy=cos(grassPlacement.z), sy=sin(grassPlacement.z); objectNormal/=vec3(grassStyle.x,grassPlacement.w,grassStyle.x); objectNormal.xz=mat2(cy,-sy,sy,cy)*objectNormal.xz;`);
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `vec3 transformed=position; transformed.xz*=grassStyle.x; transformed.y*=grassPlacement.w; transformed.xz=mat2(cy,-sy,sy,cy)*transformed.xz+grassPlacement.xy; float tip=position.y/0.32; float breeze=sin(meadowTime*1.7+grassPlacement.x*0.65+grassPlacement.y*0.43)*0.065+sin(meadowTime*2.8+grassPlacement.y*1.2)*0.025; transformed.xz+=vec2(breeze,breeze*0.45)*tip*tip; transformed.y+=grassElevation; grassWorld=(modelMatrix*vec4(transformed,1.0)).xz; grassTip=tip;
        float sunFacing=0.5+0.5*dot(normalize(objectNormal.xz+vec2(0.0001)),meadowSunDirection);
        float windShimmer=0.5+0.5*sin(meadowTime*1.7+dot(grassPlacement.xy,vec2(0.65,0.43)));
        grassSheen=pow(sunFacing,3.0)*(0.55+0.45*windShimmer);
        grassTint=mix(grassStyle.yzw,vec3(0.40,0.39,0.075),tip*tip*0.52)*(0.55+0.45*tip);`);
      shader.fragmentShader = "varying vec3 grassTint; varying vec2 grassWorld; varying float grassTip; varying float grassSheen;\n" + atmosphereCode + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb *= grassTint;");
      shader.fragmentShader = shader.fragmentShader.replace("#include <opaque_fragment>", `outgoingLight+=vec3(0.42,0.29,0.035)*grassSheen*pow(grassTip,2.0);\n#include <opaque_fragment>\n${atmosphereFragment}`);
    };
    material.customProgramCacheKey = () => atmosphereCode;
    const batchCount = Math.ceil(sampled.count / BATCH_CELLS);
    const buffers = new Map<number, { data: Float32Array; count: number; bounds: THREE.Box3 }>();
    for (let i = 0; i < sampled.records.length; i += 8) {
      const x = sampled.records[i], z = sampled.records[i + 1];
      const column = Math.floor((x - circle.x + radius) / (sampled.spacing * BATCH_CELLS));
      const row = Math.floor((z - circle.z + radius) / (sampled.spacing * BATCH_CELLS));
      const key = row * batchCount + column;
      let batch = buffers.get(key);
      if (!batch) { batch = { data: new Float32Array(BATCH_CELLS * BATCH_CELLS * 8), count: 0, bounds: new THREE.Box3() }; buffers.set(key, batch); }
      batch.data.set(sampled.records.subarray(i, i + 8), batch.count++ * 8);
      batch.bounds.expandByPoint(new THREE.Vector3(x, 0, z));
    }
    for (const batch of buffers.values()) {
      const instances = new THREE.InstancedBufferGeometry();
      instances.setAttribute("position", geometry.getAttribute("position"));
      instances.setAttribute("normal", geometry.getAttribute("normal"));
      instances.setIndex(geometry.index);
      const data = new THREE.InstancedInterleavedBuffer(batch.data.slice(0, batch.count * 8), 8);
      instances.setAttribute("grassPlacement", new THREE.InterleavedBufferAttribute(data, 4, 0));
      instances.setAttribute("grassStyle", new THREE.InterleavedBufferAttribute(data, 4, 4));
      instances.instanceCount = batch.count;
      const elevations = new Float32Array(batch.count);
      for (let i = 0; i < batch.count; i++) elevations[i] = meadowHeight(this.mask, batch.data[i*8], batch.data[i*8+1]);
      instances.setAttribute("grassElevation", new THREE.InstancedBufferAttribute(elevations, 1));
      batch.bounds.expandByScalar(reach); batch.bounds.max.y = 1.4;
      instances.boundingBox = batch.bounds;
      instances.boundingSphere = batch.bounds.getBoundingSphere(new THREE.Sphere());
      const blades = new THREE.Mesh(instances, material); blades.receiveShadow = true;
      this.root.add(blades);
    }
    geometry.dispose();
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    // The base extends invisibly beneath wall thickness so two antialiased edges
    // cannot expose the background. Blades still exclude the full wall footprint.
    const boundaryCode = `if(distance(grassWorld, vec2(${circle.x.toFixed(8)},${circle.z.toFixed(8)})) > ${radius.toFixed(8)}) discard;`;
    const maskCode = boundaryCode + this.mask.filter(r => !r.wall).map(r => `if(abs(dot(grassWorld-vec2(${r.x.toFixed(8)},${r.z.toFixed(8)}),vec2(${r.ux.toFixed(8)},${r.uz.toFixed(8)})))<=${r.halfX.toFixed(8)} && abs(dot(grassWorld-vec2(${r.x.toFixed(8)},${r.z.toFixed(8)}),vec2(${(-r.uz).toFixed(8)},${r.ux.toFixed(8)})))<=${r.halfZ.toFixed(8)}) discard;`).join("\n");
    groundMaterial.onBeforeCompile = shader => {
      shader.vertexShader = "varying vec2 grassWorld;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\ngrassWorld=(modelMatrix*vec4(position,1.0)).xz;");
      shader.fragmentShader = atmosphereCode + `varying vec2 grassWorld; float lawnHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);} float lawnNoise(vec2 p){vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(lawnHash(i),lawnHash(i+vec2(1,0)),f.x),mix(lawnHash(i+vec2(0,1)),lawnHash(i+vec2(1,1)),f.x),f.y);}\n` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>\n${maskCode}\nfloat coarse=lawnNoise(grassWorld*3.0); float fine=lawnNoise(grassWorld*450.0); float detail=1.0-smoothstep(0.001,0.008,length(fwidth(grassWorld))); float tone=mix(0.5,fine,detail)*0.55+coarse*0.45; diffuseColor.rgb*=mix(vec3(0.022,0.068,0.012),vec3(0.05,0.12,0.022),tone);`);
      shader.fragmentShader = shader.fragmentShader.replace("#include <opaque_fragment>", `#include <opaque_fragment>\n${atmosphereFragment}`);
    };
    groundMaterial.customProgramCacheKey = () => maskCode + atmosphereCode;
    // A bounded grid covers the camera footprint, with shared terrain heights for plants and props.
    const groundGeometry = new THREE.PlaneGeometry(radius*2, radius*2, 160, 160);
    groundGeometry.rotateX(-Math.PI/2);
    const vertices = groundGeometry.getAttribute("position");
    for (let i=0; i<vertices.count; i++) vertices.setY(i, meadowHeight(this.mask, vertices.getX(i)+circle.x, vertices.getZ(i)+circle.z));
    vertices.needsUpdate = true; groundGeometry.computeVertexNormals();
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.position.set(circle.x, 0, circle.z); ground.receiveShadow = true;
    this.root.add(ground);
    this.root.add(meadowDetails(this.circle, (x,z) => meadowHeight(this.mask,x,z), (x,z,margin) => grassBlocked(this.mask,x,z,margin), this.windTime));
    this.stats = { batches: buffers.size, clumps: sampled.records.length / 8, candidateCells: sampled.candidateCells, packedBytes: sampled.records.byteLength, spacing: sampled.spacing, radius };
  }
}
