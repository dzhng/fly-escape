import * as THREE from "three";
import type { AttemptFrame, Group } from "@fly-escape/sim-client";
export const groupColor = (index: number) => `hsl(${index * 137.508 % 360}, 65%, 45%)`;

/** Positions are measured; colours summarize recorded groups rather than individual spikes. */
export function mountBrainView(container: HTMLElement, positionsData: number[][], groups: Group[], read: () => { frame?: AttemptFrame; selected: number }) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor("#102c2a");
    container.append(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 10);
    camera.position.set(0, 0, 2.4);
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(positionsData.length * 3);
    const colors = new Float32Array(positions.length);
    const memberships = new Map<number, number[]>();
    groups.forEach((group, index) => group.indices.forEach(cell => {
      const indices = memberships.get(cell) ?? [];
      indices.push(index); memberships.set(cell, indices);
    }));
    positionsData.forEach((p, index) => positions.set([p[1], -p[2], p[3]], index * 3));
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({ size: 0.006, vertexColors: true, transparent: true, opacity: 0.7, depthWrite: false });
    const highlightedGeometry = new THREE.BufferGeometry();
    highlightedGeometry.setAttribute("position", geometry.attributes.position);
    highlightedGeometry.setAttribute("color", geometry.attributes.color);
    highlightedGeometry.setIndex(positionsData.flatMap((p, index) => memberships.has(p[0]) ? [index] : []));
    const highlightedMaterial = new THREE.PointsMaterial({ size: 0.026, vertexColors: true, transparent: true, opacity: 1, depthWrite: false });
    const points = new THREE.Points(geometry, material);
    const highlights = new THREE.Points(highlightedGeometry, highlightedMaterial);
    highlights.renderOrder = 1;
    points.add(highlights);
    scene.add(points);
    let dirty = true, visible = true;
    const visibility = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; dirty = true; });
    visibility.observe(container);
    let dragging = false, lastX = 0, lastY = 0;
    const events = new AbortController();
    const signal = events.signal;
    renderer.domElement.addEventListener("pointerdown", event => {
      dragging = true; lastX = event.clientX; lastY = event.clientY;
      renderer.domElement.setPointerCapture(event.pointerId);
    }, { signal });
    renderer.domElement.addEventListener("pointermove", event => {
      if (!dragging) return;
      dirty = true;
      points.rotation.y += (event.clientX - lastX) * 0.008;
      points.rotation.x += (event.clientY - lastY) * 0.008;
      lastX = event.clientX; lastY = event.clientY;
    }, { signal });
    renderer.domElement.addEventListener("pointerup", () => { dragging = false; }, { signal });
    renderer.domElement.addEventListener("pointercancel", () => { dragging = false; }, { signal });
    const resize = new ResizeObserver(() => {
      const width = Math.max(1, container.clientWidth);
      dirty = true;
      renderer.setSize(width, 230); camera.aspect = width / 230; camera.updateProjectionMatrix();
    });
    resize.observe(container);
    let lastFrame: AttemptFrame | undefined, lastSelected = -1;
    const color = new THREE.Color();
    renderer.setAnimationLoop(() => {
      if (!visible) return;
      const { frame, selected } = read();
      if (!dirty && frame === lastFrame && selected === lastSelected) return;
      dirty = false;
      if (frame !== lastFrame || selected !== lastSelected) {
        const activity = frame?.flies[selected]?.neural?.groups;
        const groupColors = groups.map((group, index) => {
          const firing = activity?.find(value => value.id === group.id)?.spikeFraction ?? 0;
          return new THREE.Color(groupColor(index)).multiplyScalar(1.4 + firing * 3);
        });
        positionsData.forEach((p, index) => {
          const member = memberships.get(p[0]);
          color.set("#4f8b87").multiplyScalar(0.45);
          if (member) {
            color.setRGB(0, 0, 0);
            for (const group of member) color.add(groupColors[group]);
            color.multiplyScalar(1 / member.length);
          }
          color.toArray(colors, index * 3);
        });
        geometry.attributes.color.needsUpdate = true;
        lastFrame = frame; lastSelected = selected;
      }
      renderer.render(scene, camera);
    });
    return () => {
      renderer.setAnimationLoop(null); resize.disconnect(); visibility.disconnect(); events.abort();
      highlightedGeometry.dispose(); highlightedMaterial.dispose(); geometry.dispose(); material.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
}
