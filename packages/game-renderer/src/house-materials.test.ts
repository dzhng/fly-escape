import { expect, test } from "bun:test";
import * as THREE from "three";
import { disposeObjectResources } from "./resources";
import { contactGeometry } from "./contact-geometry";
import { HouseGeometry, loadHousePart } from "./house";
import geometry from "../../../assets/house/five-rooms.json";

test("house replacement preserves authored materials and floor grain density across room sizes", () => {
  const house = new HouseGeometry(geometry);
  const map = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({ color: "#aa7733", roughness: 0.37, map });
  const source = new THREE.Group();
  source.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material));
  house.replace("floor", source);
  expect(material.color.getHexString()).toBe("aa7733");
  expect(material.roughness).toBe(0.37);
  expect(material.map).toBe(map);
  for (const placement of house.floors.children) {
    const mesh = placement.children[0].children[0] as THREE.Mesh;
    expect(mesh.material).toBe(material);
    const uv = mesh.geometry.getAttribute("uv");
    // The same authored texture interval covers the same world distance in every room.
    expect((uv.getX(1) - uv.getX(0)) / placement.scale.x).toBeCloseTo(1, 6);
    expect(Math.abs(uv.getY(2) - uv.getY(0)) / placement.scale.z).toBeCloseTo(1, 6);
  }
});

test("tile replacement preserves wood resources and one physical floor per room", () => {
  const house = new HouseGeometry(geometry, [{ roomId: 2, finish: "tile" }]);
  const template = () => {
    const map = new THREE.Texture();
    const material = new THREE.MeshStandardMaterial({ map });
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(1, .25, 1), material));
    return { root, map, material };
  };
  const wood = template(), tile = template(), replacement = template();
  let woodDisposed = 0, tileDisposed = 0, replacementDisposed = 0;
  wood.map.addEventListener("dispose", () => woodDisposed++);
  tile.map.addEventListener("dispose", () => tileDisposed++);
  replacement.map.addEventListener("dispose", () => replacementDisposed++);
  house.replace("floor", wood.root);
  const woodRooms = house.floors.children.filter(room => room.userData.roomId !== 2);
  house.replace("tileFloor", tile.root);
  expect(woodDisposed).toBe(0);
  expect(house.floors.children.filter(room => room.userData.roomId !== 2)).toEqual(woodRooms);
  house.replace("tileFloor", replacement.root);
  expect(tileDisposed).toBe(1);
  expect(woodDisposed).toBe(0);
  expect(house.floors.children.length).toBe(geometry.rooms.length);
  for (const room of geometry.rooms) {
    const placement = house.floors.children.find(child => child.userData.roomId === room.id)!;
    expect(placement.scale.toArray()).toEqual([room.max.x-room.min.x,1,room.max.z-room.min.z]);
    expect(placement.position.toArray()).toEqual([(room.min.x+room.max.x)/2,0,(room.min.z+room.max.z)/2]);
    const mesh = placement.children[0].children[0] as THREE.Mesh;
    expect(mesh.material).toBe(room.id === 2 ? replacement.material : wood.material);
  }
  disposeObjectResources(house.root);
  expect(woodDisposed).toBe(1);
  expect(replacementDisposed).toBe(1);
});

test("tile kit preserves the exact floor triangle coordinates", async () => {
  const load = async (name: string, kind: "floor" | "tileFloor") => loadHousePart(await Bun.file(new URL(name, import.meta.url)).arrayBuffer(),kind);
  const wood = await load("../../../assets/house/floor.glb","floor");
  const tile = await load("../../../assets/house/tile-floor/tile-floor.glb","tileFloor");
  expect(contactGeometry(tile.root)).toEqual(contactGeometry(wood.root));
  wood.dispose(); tile.dispose();
});


test("authored tile UV density stays constant across different room sizes", async () => {
  const roomFloors = geometry.rooms.map(room => ({ roomId: room.id, finish: "tile" as const }));
  const house = new HouseGeometry(geometry, roomFloors);
  const model = await loadHousePart(await Bun.file(new URL("../../../assets/house/tile-floor/tile-floor.glb", import.meta.url)).arrayBuffer(), "tileFloor");
  house.replace("tileFloor", model.root);
  house.root.updateMatrixWorld(true);
  for (const placement of house.floors.children) {
    placement.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const positions = object.geometry.getAttribute("position");
      const uv = object.geometry.getAttribute("uv");
      const origin = new THREE.Vector3().fromBufferAttribute(positions, 0).applyMatrix4(object.matrixWorld);
      for (let i = 1; i < positions.count; i++) {
        const point = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
        expect(uv.getX(i) - uv.getX(0)).toBeCloseTo((point.x - origin.x) / 1.6, 5);
        expect(uv.getY(i) - uv.getY(0)).toBeCloseTo((point.z - origin.z) / 1.6, 5);
      }
    });
  }
  disposeObjectResources(house.root);
});
