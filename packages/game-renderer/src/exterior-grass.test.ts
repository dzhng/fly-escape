import { test, expect } from 'bun:test';
import * as THREE from 'three';
import type { Geometry } from '@fly-escape/sim-client';
import { grassMask, grassBlocked, grassRecords } from './exterior-grass';
const geometry={rooms:[{min:{x:0,z:0},max:{x:2,z:2}},{min:{x:2,z:0},max:{x:4,z:1}}],walls:[{a:{x:0,z:0},b:{x:2,z:0}},{a:{x:2,z:0},b:{x:2,z:2}}]} as Geometry;
test('grass masks actual rooms and joined wall thickness, retaining concave exterior',()=>{
 const mask=grassMask(geometry);
 expect(grassBlocked(mask,3,1.5)).toBe(false);
 expect(grassBlocked(mask,3,.5)).toBe(true);
 expect(grassBlocked(mask,1,-.05)).toBe(true);
 expect(grassBlocked(mask,2.05,-.05)).toBe(true);
 expect(grassBlocked(mask,1,-.2)).toBe(false);
});
test('packed field is repeatable, bounded, uniformly covers circle and respects blade clearance',()=>{
 const circle={x:2,z:1,radius:40}, mask=grassMask(geometry),reach=.04;
 const a=grassRecords(circle,mask,reach),b=grassRecords(circle,mask,reach);
 expect(a.records).toEqual(b.records); expect(a.candidateCells).toBeLessThanOrEqual(1048576);
 const sectors=Array(8).fill(0);
 for(let i=0;i<a.records.length;i+=8){const x=a.records[i],z=a.records[i+1];
  expect(grassBlocked(mask,x,z,reach-1e-5)).toBe(false);
  expect(Math.hypot(x-circle.x,z-circle.z)).toBeLessThan(circle.radius);
  sectors[Math.min(7,Math.floor((Math.atan2(z-circle.z,x-circle.x)+Math.PI)/Math.PI*4))]++;
 }
 expect(Math.min(...sectors)/Math.max(...sectors)).toBeGreaterThan(.97);
});

test('resizing replaces the owned batches and releases shared resources once', async()=>{
 const {ExteriorGrass}=await import('./exterior-grass');
 const field=new ExteriorGrass(geometry);field.update({x:2,z:1,radius:4});
 const geometries=new Set<any>(),materials=new Set<any>();
 field.root.traverse((object:any)=>{if(object.geometry)geometries.add(object.geometry);if(object.material)materials.add(object.material)});
 let disposedGeometry=0,disposedMaterial=0,instancedMeshes=0,disposedInstances=0;
 field.root.traverse(object=>{if(object instanceof THREE.InstancedMesh){instancedMeshes++;object.addEventListener("dispose",()=>disposedInstances++);}});
 for(const g of geometries)g.addEventListener('dispose',()=>disposedGeometry++);
 for(const m of materials)m.addEventListener('dispose',()=>disposedMaterial++);
 const children=[...field.root.children];field.update({x:2,z:1,radius:4.01});
 expect(field.root.children).toEqual(children);expect(disposedGeometry).toBe(0);
 field.update({x:2,z:1,radius:5});
 expect(disposedInstances).toBe(instancedMeshes);expect(instancedMeshes).toBeGreaterThan(0);
 expect(disposedGeometry).toBe(geometries.size);expect(disposedMaterial).toBe(materials.size);
 expect(field.stats.batches).toBeGreaterThan(1);expect(materials.size).toBe(5);
});

 test('terrain keeps house approaches level and distant hills bounded', async()=>{
 const {meadowHeight}=await import('./exterior-grass');const mask=grassMask(geometry);
 expect(meadowHeight(mask,1,-.5)).toBe(0);
 expect(meadowHeight(mask,1,1)).toBe(0);
 const heights=Array.from({length:50},(_,i)=>meadowHeight(mask,i-25,14));
 expect(Math.max(...heights)-Math.min(...heights)).toBeGreaterThan(.3);
 expect(Math.min(...heights)).toBeGreaterThanOrEqual(0);
 expect(Math.max(...heights)).toBeLessThanOrEqual(.9);
 });
