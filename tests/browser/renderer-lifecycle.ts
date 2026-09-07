import { WorldView } from "../../packages/game-renderer/src";
import geometry from "../../assets/house/five-rooms.json";
import type { Geometry } from "../../packages/sim-client/src";

const first = new WorldView(document.querySelector<HTMLElement>("#first")!, geometry as Geometry);
const second = new WorldView(document.querySelector<HTMLElement>("#second")!, geometry as Geometry);
first.setPose({ x: 1, y: 0.1, z: 1, heading: 0 });
second.setPose({ x: 1, y: 0.1, z: 1, heading: 0 });
first.render();
second.render();
Object.assign(window, {
  lifecycle: {
    statistics: () => second.statistics,
    disposeFirst: () => first.dispose(),
    renderSecond: () => second.render(),
    disposeSecond: () => second.dispose(),
  },
});
