import React, { useEffect, useRef } from "react";
import { mountBrainView } from "@fly-escape/game-renderer";
import type { AttemptFrame, Group } from "@fly-escape/sim-client";
import anatomy from "./brain-positions.json";



/** Measured soma positions; colour reports group aggregates, never invented cell spikes. */
export function BrainView({ groups, frame, selected }: { groups: Group[]; frame?: AttemptFrame; selected: number }) {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef({ frame, selected });
  state.current = { frame, selected };
  useEffect(() => {
    return mountBrainView(host.current!, anatomy.positions, groups, () => state.current);
  }, [groups]);
  return <section className="brain-view">
    <strong>Inside fly {String(selected + 1).padStart(2, "0")}</strong>
    <div ref={host} role="img" aria-label="Drag to rotate measured neuron positions, coloured by recorded group activity" />
    <small>{anatomy.measuredCount.toLocaleString()} measured cell positions · drag to rotate</small>
    <small>Colour: group activity. Other cells shown dimly. Cells without measured positions omitted.</small>
  </section>;
}
