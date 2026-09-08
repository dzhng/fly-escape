import type { FlyPose } from "./index";

/** A reversible presentation after the recorded escape; the simulation stays at its exit pose. */
export function departingFly(pose: FlyPose, seconds: number, outward: { x: number; z: number }): FlyPose {
  const t = Math.max(0, Math.min(8, seconds));
  const distance = 0.35 * t + 0.18 * t * t;
  const heading = Math.atan2(outward.z, outward.x);
  return {
    ...pose,
    x: pose.x + outward.x * distance,
    z: pose.z + outward.z * distance,
    y: pose.y + 0.2 * t + 0.08 * t * t,
    heading,
    rotation: [0, Math.sin((Math.PI / 2 - heading) / 2), 0, Math.cos((Math.PI / 2 - heading) / 2)],
    animation: { clip: "Fly", seconds: t * 5 },
    focus: [pose.x, pose.y, pose.z],
    presentationScale: 1 - (t / 8) ** 2,
    hidden: t >= 8,
  };
}
