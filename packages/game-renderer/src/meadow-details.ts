import * as THREE from "three";

/** Sparse, seeded scenery. One instance buffer per material, no per-frame allocation. */
export function meadowDetails(
  center: { x: number; z: number; radius: number },
  height: (x: number, z: number) => number,
  blocked: (x: number, z: number, margin: number) => boolean,
  time: { value: number },
) {
  const group = new THREE.Group();
  let seed = 92381;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
  const point = new THREE.Vector3();
  const rocks: THREE.Matrix4[] = [], flowers: THREE.Matrix4[] = [], leaves: THREE.Matrix4[] = [];
  for (let i = 0; i < 650; i++) {
    const angle = random()*Math.PI*2, radius = Math.sqrt(random())*center.radius;
    const x = center.x+Math.cos(angle)*radius, z = center.z+Math.sin(angle)*radius;
    if (blocked(x, z, 0.65)) continue;
    const rock = i < 90, leaf = i >= 550;
    const size = rock ? 0.09+random()*0.22 : leaf ? 0.035+random()*0.025 : 0.025+random()*0.025;
    point.set(x, height(x,z)+(rock ? size*0.38 : leaf ? 0.6+random()*0.8 : 0.24+random()*0.1), z);
    rotation.setFromEuler(new THREE.Euler(random()*0.4, random()*6.28, random()*0.5));
    scale.set(size*(rock ? 1.6 : 1), size*(rock ? 0.8 : 1), size);
    matrix.compose(point, rotation, scale);
    (rock ? rocks : leaf ? leaves : flowers).push(matrix.clone());
  }
  const add = (geometry: THREE.BufferGeometry, material: THREE.MeshStandardMaterial, matrices: THREE.Matrix4[], shadow: boolean) => {
    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    matrices.forEach((m,i) => mesh.setMatrixAt(i,m));
    mesh.castShadow = shadow; mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    // Leaves drift around their own seeded anchor without reallocating instances.
    if (mesh.boundingSphere) mesh.boundingSphere.radius += 0.7;
    group.add(mesh);
  };
  add(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#8c9086', roughness: 1, flatShading: true }), rocks, true);
  const flowerGeometry = new THREE.BufferGeometry();
  const vertices: number[] = [];
  for(let petal=0;petal<5;petal++) {
    const a=petal*Math.PI*2/5, b=a+0.7;
    vertices.push(0,0,0, Math.cos(a),0.16,Math.sin(a), Math.cos(b),0.16,Math.sin(b));
  }
  flowerGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices,3)); flowerGeometry.computeVertexNormals();
  add(flowerGeometry, new THREE.MeshStandardMaterial({color:'#efd58d', roughness:0.9, side:THREE.DoubleSide}), flowers, false);
  const leafGeometry = new THREE.BufferGeometry();
  leafGeometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,-1,-0.45,0,0,0,0,1,0,0,-1,0,0,1,0.45,0,0],3));
  leafGeometry.computeVertexNormals();
  const leafMaterial = new THREE.MeshStandardMaterial({color:'#c1b86a',roughness:0.95,side:THREE.DoubleSide});
  leafMaterial.onBeforeCompile = shader => {
    shader.uniforms.meadowTime = time;
    shader.vertexShader = 'uniform float meadowTime;\n'+shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
      vec4 mvPosition = vec4(transformed,1.0);
      mvPosition = instanceMatrix * mvPosition;
      float phase=instanceMatrix[3].x*1.7+instanceMatrix[3].z*0.6;
      mvPosition.xyz+=vec3(sin(meadowTime*0.7+phase)*0.45,sin(meadowTime*1.2+phase)*0.16,cos(meadowTime*0.9+phase)*0.25);
      mvPosition=modelViewMatrix*mvPosition;
      gl_Position=projectionMatrix*mvPosition;
    `);
  };
  add(leafGeometry, leafMaterial, leaves, false);
  return group;
}
