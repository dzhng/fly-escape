import React, { useLayoutEffect, useMemo, useRef } from "react";
import type { FrameArchive, RetinalConfig } from "@fly-escape/sim-client";
import { RetinaProjection, retinaProfile } from "../../../packages/game-renderer/src/retina-projection";
import identities from "../../../packages/game-renderer/src/retina-map-identities.json";

const identityFields = ["profileHash", "layoutHash", "rigHash", "colorModelHash"] as const;
const profileFields = [...identityFields, "width", "height", "sampleCount"] as const;

/** Displays one recorded input; selection, acquisition and neural work stay with their owners. */
export function EyePanels({ flyId, tick, config, expectedConfig, archive }: {
  flyId: number;
  tick: number;
  config: RetinalConfig | null;
  expectedConfig?: RetinalConfig | null;
  archive: FrameArchive | null;
}) {
  const left = useRef<HTMLCanvasElement>(null);
  const right = useRef<HTMLCanvasElement>(null);
  const supported = !!config && !!expectedConfig &&
    config.sceneId === expectedConfig.sceneId && config.mapHash === expectedConfig.mapHash &&
    config.clientGeneration === expectedConfig.clientGeneration &&
    identityFields.every(field => config.profile[field] === identities[field]) &&
    profileFields.every(field => config.profile[field] === expectedConfig.profile[field]) &&
    config.profile.width === retinaProfile.width && config.profile.height === retinaProfile.height &&
    config.profile.sampleCount === 1 + 3 * retinaProfile.radius * (retinaProfile.radius + 1);
  const projection = useMemo(() => supported ? new RetinaProjection(retinaProfile) : null, [supported]);
  const present = supported && !!archive?.hasRetina(tick, flyId);
  useLayoutEffect(() => {
    if (!present || !projection || !archive) return;
    const sample = archive.retina(tick, flyId);
    if (!sample) return;
    const width = projection.cells.length * 3;
    for (const [eye, canvas] of [left.current, right.current].entries()) {
      if (!canvas) continue;
      canvas.getContext("2d")!.putImageData(new ImageData(
        projection.image(sample.rgb.subarray(eye * width, (eye + 1) * width)),
        projection.profile.width, projection.profile.height,
      ), 0, 0);
    }
  }, [present, projection, archive, tick, flyId]);
  const unavailable = !config ? "This recording has no eye samples."
    : !supported ? "Recorded eyes do not match this scene or eye layout."
      : tick === 0 ? "Eye input begins with the first recorded tick."
        : !present ? "No eye input was recorded at this time."
          : "Eye samples are unavailable for this fly.";
  return <section className="eye-panels" aria-label={`Recorded eyes of fly ${flyId + 1}`}
    data-fly-id={flyId} data-eye-tick={tick} data-eye-state={present ? "present" : "unavailable"}
    data-profile-hash={config?.profile.profileHash} data-scene-id={config?.sceneId}>
    <div className="eye-pair">
      {(["Left eye", "Right eye"] as const).map((label, eye) => <figure key={label}>
        <figcaption>{label}</figcaption>
        {present ? <canvas ref={eye === 0 ? left : right} width={retinaProfile.width} height={retinaProfile.height}
          aria-label={`${label} recorded for fly ${flyId + 1} at ${(tick * 0.1).toFixed(1)} seconds`} />
          : <div className="eye-unavailable">No sample</div>}
      </figure>)}
    </div>
    <p className="eye-time">{present ? `Recorded input · ${(tick * 0.1).toFixed(1)} seconds` : unavailable}</p>
    <p className="eye-explanation">Model color inputs, not a picture of a fly’s subjective experience.</p>
  </section>;
}
