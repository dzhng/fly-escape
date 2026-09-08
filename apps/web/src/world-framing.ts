import type { WorldView } from '@fly-escape/game-renderer';

/** Keep the camera subject centered beside an overlay, including after a resize. */
export function frameBesidePanel(view: WorldView, canvasHost: HTMLElement, panel: HTMLElement) {
  const update = () => {
    const world = canvasHost.getBoundingClientRect();
    const overlay = panel.getBoundingClientRect();
    view.setRightInset(Math.max(0, world.right - overlay.left));
  };
  const observer = new ResizeObserver(update);
  observer.observe(canvasHost);
  observer.observe(panel);
  update();
  return () => observer.disconnect();
}
