import { BrainView } from "./brain-view";
import { groupColor } from "@fly-escape/game-renderer";
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import type { AttemptFrame, AttemptInfo, FlyFrame, FrameArchive, Group } from "@fly-escape/sim-client";
import { PREVIEW_PIXELS, useFlyPreviews } from "./fly-preview";
import type { PreviewUpdate } from "./fly-preview";
import "./science-panel.css";

type Point = ReturnType<FrameArchive["neuralTrace"]>[number];
const shortNames: Record<string, string> = {
  odorExcL: "Smell + L",
  odorExcR: "Smell + R",
  odorInhL: "Smell − L",
  odorInhR: "Smell − R",
  visionL: "Vision L",
  visionR: "Vision R",
  turnL: "Turning L",
  turnR: "Turning R",
  flightL: "Flight L",
  flightR: "Flight R",
  landingL: "Landing L",
  landingR: "Landing R",
  taste: "Taste",
  feeding: "Feeding",
  proboscis: "Mouth",
  loom: "Approach",
};
function pathway(group: Group) {
  if (group.id.startsWith("odor"))
    return "This candidate group is labeled as a lateral-horn olfactory pathway in the source model. Excitation and inhibition describe effects on other neurons: they do not mean attraction and avoidance. Several synaptic steps can reverse an input’s net effect.";
  if (group.id.startsWith("vision"))
    return "This candidate group is labeled as an anterior optic tubercle (AOTU) pathway. Visual circuits pass and combine signals through synapses; the activity here summarizes this chosen pathway, not the entire visual system.";
  if (group.id === "taste")
    return "This candidate group combines cells labeled as taste receptors and taste pathways. Sensory neurons turn chemical stimulation into electrical signals that other neurons can integrate.";
  if (group.id === "feeding")
    return "This candidate group is labeled as gnathal ganglion interneurons in a feeding pathway. Interneurons combine signals from other cells and pass activity through the circuit; an average cannot reveal each cell’s contribution.";
  if (group.id === "proboscis")
    return "This candidate group is labeled as proboscis motor neurons, associated with the fly’s mouthparts. Motor neurons pass neural signals toward muscles. Their group activity is a summary, not a measurement of muscle force.";
  if (group.id === "loom")
    return "This group selects cells annotated LC4, associated with visual looming pathways. Looming means an image expanding as an object approaches. A pathway’s presence in a wiring map does not establish its response in this model.";
  return "Descending neurons carry signals from brain circuits toward body motor circuits. This candidate group uses a selected descending pathway from the source model. Left and right groups remain separate. A pathway name describes the selected cells; it does not prove that their mean activity uniquely encodes an action.";
}
function Explanation({ group }: { group: Group }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  return (
    <span
      className="science-help"
      onMouseEnter={() => {
        clearTimeout(closeTimer.current);
        setOpen(true);
      }}
      onMouseLeave={() => {
        closeTimer.current = setTimeout(() => setOpen(false), 300);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-label={`Explain ${group.label}`}
        aria-expanded={open}
        aria-controls={id}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      >
        ?
      </button>
      {open && (
        <div
          id={id}
          className="science-tooltip"
          role="region"
          aria-label={`${group.label} explained`}
        >
          <button
            className="close-explanation"
            onClick={() => setOpen(false)}
            aria-label="Close explanation"
          >
            Close
          </button>
          <strong>{group.label}</strong>
          <p>{pathway(group)}</p>
          <p>
            A neuron is a signaling cell. It receives input through connections called synapses.
            Electrical charge on either side of its membrane creates a voltage difference. In this
            model, incoming signals change that voltage while it also drifts toward rest. Crossing
            a threshold emits a brief signal called a spike, then resets the voltage. A refractory
            period is the short interval when the cell cannot fire again. A lower voltage can
            therefore follow firing.
          </p>
          <p>
            Measured here: average model voltage and the fraction of this group’s{" "}
            {group.indices.length} cells that spiked this update. The fraction is not spikes per
            second. Averages hide differences between cells.
          </p>
          <p>
            Candidate group: <code>{group.id}</code>, selected MaleCNS wiring. The body-ID selection
            was inherited from an exploratory model; its circuit label is not independent anatomical
            validation. Group membership can overlap. Synaptic signs, injected sensory currents and
            simplified voltage dynamics are modeling assumptions; these units and timing are not
            living-fly measurements.
          </p>
          <a
            href="https://neuronaldynamics.epfl.ch/online/Ch1.S3.html"
            target="_blank"
            rel="noreferrer"
          >
            Neuron model: integration, leak and spikes
          </a>
          <p>
            <a
              href={
                group.id === "loom"
                  ? "https://www.nature.com/articles/s41586-022-05562-8"
                  : group.id.startsWith("vision")
                    ? "https://www.nature.com/articles/s41586-024-07967-z"
                    : "https://www.nature.com/articles/s41586-024-07523-9"
              }
              target="_blank"
              rel="noreferrer"
            >
              Research context:{" "}
              {group.id === "loom"
                ? "LC4 looming pathways"
                : group.id.startsWith("vision")
                  ? "anterior visual pathways"
                  : "descending motor circuits"}
            </a>
          </p>
        </div>
      )}
    </span>
  );
}
function Trace({
  series,
  field,
  endTick,
}: {
  series: { group: Group; points: Point[] }[];
  field: "meanVoltage" | "spikeFraction";
  endTick: number;
}) {
  const values = series.flatMap(({ points }) => points.flatMap(point => point[field] === null ? [] : [point[field]!]));
  const lower = field === "spikeFraction" ? 0 : Math.min(0, ...values);
  const upper = field === "spikeFraction" ? 1 : Math.max(1, ...values);
  const startTick = Math.max(1, endTick - 99);
  const paths = series.map(({ points }) => {
  let path = "", connected = false;
  for (const point of points) {
    const value = point[field];
    if (value === null) {
      connected = false;
      continue;
    }
    const x = 30 + ((point.tick - startTick) / Math.max(1, endTick - startTick)) * 252;
    const y = 33 - ((value - lower) / (upper - lower)) * 28;
    path += `${connected ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)} `;
    connected = true;
  }
  return path;
  });
  return (
    <div className={`science-trace ${field}`}>
      <div>
        <span>
          {field === "meanVoltage" ? "Average electrical state" : "Fraction firing this tick"}
        </span>
        <span>
          {field === "meanVoltage"
            ? `${lower.toFixed(1)}–${upper.toFixed(1)} model units`
            : "0–100%"}
        </span>
      </div>
      <svg
        viewBox="0 0 284 52"
        role="img"
        aria-label={`${field === "meanVoltage" ? "Mean voltage" : "Spike fraction"} history through tick ${endTick}`}
        data-end-tick={endTick}
      >
        <path d="M30 3V36H282M156 3V36" className="trace-axis" />
        {[0, 0.5, 1].map((fraction) => (
          <g key={fraction}>
            <path d={`M27 ${33 - fraction * 28}H282`} className="trace-grid" />
            <text x="1" y={36 - fraction * 28}>
              {field === "spikeFraction"
                ? `${fraction * 100}%`
                : (lower + fraction * (upper - lower)).toFixed(1)}
            </text>
          </g>
        ))}
        {paths.map((path, index) => <path key={series[index].group.id} d={path} fill="none" stroke={groupColor(index)} strokeWidth="1.1"><title>{series[index].group.label}</title></path>)}
        {[0, 0.5, 1].map((fraction) => (
          <text
            key={`time-${fraction}`}
            x={30 + fraction * 252}
            y="49"
            textAnchor={fraction === 0 ? "start" : fraction === 1 ? "end" : "middle"}
          >
            {(endTick === 0 ? 0 : (startTick + fraction * (endTick - startTick)) * 0.1).toFixed(1)}s
          </text>
        ))}
      </svg>
    </div>
  );
}
function RosterEntry({
  id,
  fly,
  selected,
  selectFly,
  register,
  registerPreview,
}: {
  id: number;
  fly?: FlyFrame;
  selected: boolean;
  selectFly: (id: number) => void;
  register: (id: number, button: HTMLButtonElement | null) => void;
  registerPreview: (id: number, canvas: HTMLCanvasElement | null) => void;
}) {
  return (
    <button
      className="fly-card"
      data-testid={`fly-card-${id}`}
      data-fly-id={id}
      aria-label={`Select fly ${id + 1}`}
      aria-pressed={selected}
      ref={(button) => register(id, button)}
      onClick={() => selectFly(id)}
    >
      <canvas
        className="fly-preview"
        width={PREVIEW_PIXELS}
        height={PREVIEW_PIXELS}
        aria-hidden="true"
        ref={(canvas) => registerPreview(id, canvas)}
      />
      <strong>{String(id + 1).padStart(2, "0")}</strong>
      <span>{(fly?.body.outcome ?? fly?.body.mode ?? "initial").replace("timedOut", "dead")}</span>
    </button>
  );
}
/** The one open fly: every diagram, chart and explanation reads the selected roster entry. */
function FlyDetails({
  id,
  info,
  frame,
  archive,
}: {
  id: number;
  info: AttemptInfo;
  frame?: AttemptFrame;
  archive?: FrameArchive;
}) {
  const [groupId, setGroupId] = useState(info.groups[0].id);
  const tick = frame?.tick ?? 0;
  const group = info.groups.find((group) => group.id === groupId) ?? info.groups[0];
  const fly = frame?.flies[id];
  const series = useMemo(
    () => info.groups.map(group => ({ group, points: archive ? archive.neuralTrace(id, group.id, tick) : [] })),
    [archive, id, info.groups, tick],
  );
  const activity = fly?.neural?.groups.find((group) => group.id === groupId);
  const positions = useMemo(
    () =>
      new Map(
        info.groups.map((group, index) => [
          group.id,
          { x: index < 8 ? 88 : 212, y: 12 + (index % 8) * 24 },
        ]),
      ),
    [info],
  );
  return (
    <article
      className="science-details"
      data-fly-id={id}
      data-testid="selected-fly"
      data-sample-tick={tick}
    >
      <BrainView groups={info.groups} frame={frame} selected={id} />
      <div className="science-status">
        <span>{(fly?.body.outcome ?? fly?.body.mode ?? "Initial state").replace("timedOut", "dead")}</span>
        <small>{(tick * 0.1).toFixed(1)} s</small>
      </div>
      <svg
        className="group-network"
        viewBox="0 0 306 194"
        role="img"
        aria-label={`Fly ${id + 1} grouped connectivity and current activity`}
      >
        <defs>
          <marker
            id={`arrow-${id}`}
            viewBox="0 0 6 6"
            refX="6"
            refY="3"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0 0L6 3L0 6Z" fill="#34563e" />
          </marker>
        </defs>
        {info.groupLinks.map((link) => {
          const from = positions.get(link.source),
            to = positions.get(link.target);
          if (!from || !to || (link.source !== groupId && link.target !== groupId)) return null;
          if (link.source === link.target)
            return (
              <path
                key={`${link.source}-${link.target}`}
                d={`M${from.x - 4} ${from.y - 5} C${from.x - 17} ${from.y - 20},${from.x + 17} ${from.y - 20},${from.x + 4} ${from.y - 5}`}
                fill="none"
                stroke="#819186"
                strokeWidth=".7"
                opacity=".85"
                markerEnd={`url(#arrow-${id})`}
              />
            );
          const dx = to.x - from.x,
            dy = to.y - from.y,
            length = Math.hypot(dx, dy);
          const ux = dx / length,
            uy = dy / length;
          const controlX =
            from.x === to.x
              ? from.x + (from.x < 150 ? 1 : -1) * (20 + Math.abs(dy) * 0.2)
              : (from.x + to.x) / 2 - uy * 9;
          return (
            <path
              key={`${link.source}-${link.target}`}
              d={`M${from.x + ux * 8} ${from.y + uy * 8} Q${controlX} ${(from.y + to.y) / 2 + ux * 9},${to.x - ux * 9} ${to.y - uy * 9}`}
              fill="none"
              stroke="#687f70"
              strokeWidth={0.7 + Math.min(1, Math.log1p(link.edgeCount) / 8)}
              opacity=".85"
              markerEnd={`url(#arrow-${id})`}
            >
              <title>{`${link.source} → ${link.target}: ${link.edgeCount} edges; positive weight ${link.positiveWeight}, negative weight ${link.negativeWeight}`}</title>
            </path>
          );
        })}
        {info.groups.map((group) => {
          const point = positions.get(group.id)!;
          const value = fly?.neural?.groups.find((value) => value.id === group.id);
          return (
            <g key={group.id}>
              <circle
                cx={point.x}
                cy={point.y}
                r="6"
                fill={value ? `hsl(148 28% ${85 - value.spikeFraction * 50}%)` : "#e1e3dc"}
                stroke={groupId === group.id ? "#b78a17" : "#718571"}
                strokeWidth={groupId === group.id ? 2 : 1}
              />
              <text
                x={point.x < 150 ? point.x - 12 : point.x + 12}
                y={point.y + 4}
                textAnchor={point.x < 150 ? "end" : "start"}
              >
                {shortNames[group.id] ?? group.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="network-key">Nodes: fraction firing · arrows: selected group’s links</div>
      <div className="science-legend" aria-label="All recorded neuron groups">
        {info.groups.map((item, index) => <button key={item.id} onClick={() => setGroupId(item.id)} aria-pressed={groupId === item.id}>
          <span style={{ background: groupColor(index) }} />{shortNames[item.id] ?? item.label}
        </button>)}
      </div>
      <div className="science-group-picker"><span>{group.label}</span><Explanation group={group} /></div>
      <div className="science-current">
        <output>{activity ? activity.meanVoltage.toFixed(3) : "—"} voltage</output>
        <output>{activity ? (activity.spikeFraction * 100).toFixed(1) + "%" : "—"} firing</output>
      </div>
      <Trace series={series} field="meanVoltage" endTick={tick} />
      <Trace series={series} field="spikeFraction" endTick={tick} />
      <div className="science-time">All {info.groups.length} recorded groups · last 10 simulated seconds · gaps = no sample</div>
    </article>
  );
}
export function SciencePanel({
  info,
  frame,
  archive,
  selected,
  selectFly,
  register,
  previews,
}: {
  info: AttemptInfo;
  frame?: AttemptFrame;
  archive?: FrameArchive;
  selected: number | null;
  selectFly: (id: number) => void;
  register: (id: number, button: HTMLButtonElement | null) => void;
  previews: React.RefObject<PreviewUpdate | null>;
}) {
  const registerPreview = useFlyPreviews(previews);
  return (
    <div className="science-panel">
      <div className="fly-roster" role="group" aria-label="Fly roster">
        {Array.from({ length: info.spec.flyCount }, (_, id) => (
          <RosterEntry
            key={id}
            id={id}
            fly={frame?.flies[id]}
            selected={selected === id}
            selectFly={selectFly}
            register={register}
            registerPreview={registerPreview}
          />
        ))}
      </div>
      {selected !== null && <FlyDetails id={selected} info={info} frame={frame} archive={archive} />}
    </div>
  );
}
