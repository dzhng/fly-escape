import { WorldCamera } from "./camera";

/** Sits over the canvas, appears only once the view is off its default orbit, and
 * restores the orientation without disturbing the target, the zoom or the follow. */
function resetRotationButton(canvas: HTMLCanvasElement, camera: WorldCamera) {
  const parent = canvas.parentElement;
  const button = canvas.ownerDocument.createElement("button");
  button.type = "button";
  button.textContent = "Reset rotation";
  button.setAttribute("data-testid", "reset-rotation");
  button.style.cssText =
    "position:absolute;right:14px;top:14px;padding:5px 10px;border-radius:7px;cursor:pointer;" +
    "font-family:inherit;font-size:11px;font-weight:600;color:#2f3d33;background:#f7f7ede0;border:1px solid #bdcabb;";
  button.hidden = true;
  button.addEventListener("click", () => camera.resetRotation());
  parent?.appendChild(button);
  return {
    sync() {
      button.hidden = !camera.rotated;
    },
    dispose() {
      button.remove();
    },
  };
}

/** Inputs are scoped to the drawable canvas. Panel fields/cards never become
 * movement controls, and a drag cannot also select a fly on pointer release. */
export function cameraInput(canvas: HTMLCanvasElement, camera: WorldCamera, pick: (x: number, y: number) => void) {
  const events = new AbortController();
  const signal = events.signal;
  const keys = new Set<string>();
  const reset = resetRotationButton(canvas, camera);
  let hover: { x: number; y: number } | null = null;
  let down: { id: number; button: number; x: number; y: number; lastX: number; lastY: number; dragged: boolean } | null = null;
  let lastTime: number | null = null;
  canvas.tabIndex = -1;
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", event => {
    if (event.button !== 0 && event.button !== 2) return;
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(event.pointerId);
    down = { id: event.pointerId, button: event.button, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, dragged: false };
  }, { signal });
  canvas.addEventListener("pointermove", event => {
    const box = canvas.getBoundingClientRect();
    hover = { x: event.clientX - box.left, y: event.clientY - box.top };
    if (!down || down.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 4) down.dragged = true;
    // Rotating drags the world with the pointer, as panning does.
    if (down.dragged && down.button === 2) camera.rotate(event.clientX - down.lastX, event.clientY - down.lastY);
    else if (down.dragged) camera.pan(down.lastX - event.clientX, down.lastY - event.clientY);
    down.lastX = event.clientX;
    down.lastY = event.clientY;
    reset.sync();
  }, { signal });
  canvas.addEventListener("pointerup", event => {
    if (!down || down.id !== event.pointerId) return;
    const { dragged, button } = down;
    down = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (!dragged && button === 0) {
      const box = canvas.getBoundingClientRect();
      pick(event.clientX - box.left, event.clientY - box.top);
    }
  }, { signal });
  // The right button is the orbit control here, so it never opens a menu instead.
  canvas.addEventListener("contextmenu", event => event.preventDefault(), { signal });
  canvas.addEventListener("pointercancel", () => { down = null; hover = null; }, { signal });
  canvas.addEventListener("pointerleave", () => { hover = null; }, { signal });
  canvas.addEventListener("wheel", event => {
    event.preventDefault();
    const scale = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? canvas.clientHeight : 1;
    camera.zoom(event.deltaY * scale);
  }, { passive: false, signal });
  window.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();
    if ((event.target !== canvas && event.target !== document.body) || !["w", "a", "s", "d"].includes(key) || event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault();
    keys.add(key);
  }, { signal });
  window.addEventListener("keyup", event => keys.delete(event.key.toLowerCase()), { signal });
  window.addEventListener("blur", () => { keys.clear(); hover = null; down = null; lastTime = null; }, { signal });
  return {
    update(now: number) {
      const seconds = lastTime === null ? 0 : Math.min(0.05, Math.max(0, now - lastTime) / 1000);
      lastTime = now;
      reset.sync();
      if (document.hidden || down) return;
      let x = Number(keys.has("d")) - Number(keys.has("a"));
      let y = Number(keys.has("s")) - Number(keys.has("w"));
      if (hover) {
        x += hover.x < 18 ? -1 : hover.x > canvas.clientWidth - 18 ? 1 : 0;
        y += hover.y < 18 ? -1 : hover.y > canvas.clientHeight - 18 ? 1 : 0;
      }
      const length = Math.hypot(x, y);
      if (length) camera.pan(x / length * 300 * seconds, y / length * 300 * seconds);
    },
    dispose() { events.abort(); keys.clear(); reset.dispose(); },
  };
}
