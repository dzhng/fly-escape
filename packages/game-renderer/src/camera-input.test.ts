import { afterAll, expect, test } from "bun:test";
import * as THREE from "three";
import { WorldCamera } from "./camera";
import { cameraInput } from "./camera-input";

/** Minimal event plumbing: the input layer only needs listeners, abort and pointer capture. */
class FakeTarget {
  private readonly handlers = new Map<string, Set<(event: any) => void>>();
  readonly style: Record<string, string> = {};
  tabIndex = 0;
  hidden = false;
  type = "";
  textContent = "";
  clientWidth = 800;
  clientHeight = 600;
  attributes: Record<string, string> = {};
  children: FakeTarget[] = [];
  parentElement: FakeTarget | null = null;
  ownerDocument = { createElement: () => new FakeTarget() };
  addEventListener(type: string, handler: (event: any) => void, options?: { signal?: AbortSignal }) {
    const set = this.handlers.get(type) ?? new Set();
    set.add(handler);
    this.handlers.set(type, set);
    options?.signal?.addEventListener("abort", () => set.delete(handler));
  }
  removeEventListener(type: string, handler: (event: any) => void) {
    this.handlers.get(type)?.delete(handler);
  }
  emit(type: string, event: Record<string, unknown> = {}) {
    for (const handler of [...(this.handlers.get(type) ?? [])])
      handler({ preventDefault() {}, ...event });
  }
  get listenerCount() {
    return [...this.handlers.values()].reduce((total, set) => total + set.size, 0);
  }
  setAttribute(name: string, value: string) { this.attributes[name] = value; }
  appendChild(child: FakeTarget) { this.children.push(child); child.parentElement = this; }
  remove() {
    this.parentElement?.children.splice(this.parentElement.children.indexOf(this), 1);
    this.parentElement = null;
  }
  focus() {}
  setPointerCapture() {}
  hasPointerCapture() { return true; }
  releasePointerCapture() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; }
}

const globals = globalThis as Record<string, unknown>;
const priorWindow = globals.window;
const priorDocument = globals.document;
const priorWheel = globals.WheelEvent;
afterAll(() => {
  globals.window = priorWindow;
  globals.document = priorDocument;
  globals.WheelEvent = priorWheel;
});

function harness() {
  const canvas = new FakeTarget();
  const parent = new FakeTarget();
  parent.appendChild(canvas);
  globals.window = new FakeTarget();
  globals.document = { hidden: false, body: new FakeTarget() };
  globals.WheelEvent = { DOM_DELTA_LINE: 1, DOM_DELTA_PAGE: 2 };
  const camera = new WorldCamera(new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(4, 1, 4)), 0.003);
  camera.resize(800, 600);
  camera.follow(new THREE.Vector3(2, 0.5, 2));
  const picks: number[][] = [];
  const controls = cameraInput(canvas as unknown as HTMLCanvasElement, camera, (x, y, button) => picks.push([x, y, button]));
  const button = () => parent.children[1];
  const drag = (button: number, from: [number, number], to: [number, number]) => {
    canvas.emit("pointerdown", { button, pointerId: 1, clientX: from[0], clientY: from[1] });
    canvas.emit("pointermove", { pointerId: 1, clientX: to[0], clientY: to[1] });
    canvas.emit("pointerup", { pointerId: 1, clientX: to[0], clientY: to[1] });
  };
  return { canvas, parent, camera, picks, controls, button, drag };
}

test("the right button orbits while the left button still pans and picks", () => {
  const { camera, picks, drag, canvas } = harness();
  const followed = camera.state;
  drag(2, [400, 300], [520, 260]);
  expect(camera.state.yaw).not.toBe(followed.yaw);
  expect(camera.state.elevation).not.toBe(followed.elevation);
  // Orbiting is orientation only: the fly stays followed, centred and at its zoom.
  expect(camera.state.target).toEqual(followed.target);
  expect(camera.state.distance).toBeCloseTo(followed.distance);
  expect(camera.state.following).toBe(true);
  expect(picks).toEqual([]);
  const turned = camera.state;
  drag(0, [400, 300], [500, 300]);
  expect(camera.state.following).toBe(false);
  expect(camera.state.target).not.toEqual(turned.target);
  expect(camera.state.yaw).toBe(turned.yaw);
  canvas.emit("pointerdown", { button: 0, pointerId: 2, clientX: 210, clientY: 120 });
  canvas.emit("pointerup", { pointerId: 2, clientX: 210, clientY: 120 });
  expect(picks).toEqual([[210, 120, 0]]);
});

test("a right click reports its button without moving the camera or opening a menu", () => {
  const { camera, picks, canvas } = harness();
  const before = camera.state;
  let defaulted = true;
  canvas.emit("pointerdown", { button: 2, pointerId: 3, clientX: 300, clientY: 300 });
  canvas.emit("pointerup", { pointerId: 3, clientX: 300, clientY: 300 });
  expect(picks).toEqual([[300, 300, 2]]);
  expect(camera.state).toEqual(before);
  canvas.emit("contextmenu", { preventDefault: () => (defaulted = false) });
  expect(defaulted).toBe(false);
});

test("the reset control appears once turned and restores orientation alone", () => {
  const { camera, drag, button, controls, parent } = harness();
  expect(button().attributes["data-testid"]).toBe("reset-rotation");
  expect(button().hidden).toBe(true);
  drag(2, [400, 300], [520, 260]);
  expect(button().hidden).toBe(false);
  const turned = camera.state;
  button().emit("click");
  expect(camera.state.rotated).toBe(false);
  expect(camera.state.target).toEqual(turned.target);
  expect(camera.state.distance).toBeCloseTo(turned.distance);
  expect(camera.state.following).toBe(true);
  controls.update(16);
  expect(button().hidden).toBe(true);
  controls.dispose();
  expect(parent.children.length).toBe(1);
});

test("disposal releases every canvas listener", () => {
  const { canvas, controls, camera, drag } = harness();
  expect(canvas.listenerCount).toBeGreaterThan(0);
  controls.dispose();
  expect(canvas.listenerCount).toBe(0);
  const idle = camera.state;
  drag(2, [400, 300], [520, 260]);
  expect(camera.state).toEqual(idle);
});
