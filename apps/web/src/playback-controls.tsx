import React, { useEffect, useRef, useState } from "react";
import type { PlaybackMode } from "@fly-escape/sim-client";

type Icon = "pause" | "play" | "fast" | "replay" | "cancel";
function ControlIcon({ icon }: { icon: Icon }) {
  const shapes = {
    pause: <><path d="M8 5v14M16 5v14" strokeWidth="4" /></>,
    play: <path d="m7 4 14 8-14 8Z" fill="currentColor" stroke="none" />,
    fast: <><path d="m3 5 9 7-9 7Zm10 0 9 7-9 7Z" fill="currentColor" stroke="none" /></>,
    replay: <><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" /></>,
    cancel: <><path d="m6 6 12 12M18 6 6 18" /></>,
  };
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[icon]}</svg>;
}
function IconButton({ icon, label, tooltip = label, ...props }: {
  icon: Icon; label: string; tooltip?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <span className="playback-icon-tooltip" title={tooltip}>
    <button {...props} type="button" className="playback-icon" aria-label={label}><ControlIcon icon={icon} /></button>
  </span>;
}

export function PlaybackControls({ ready, fastReady, replayReady, requested, mode, returnLabel, returnToSetup, onPause, onResume, onPlay, onFast, onReplay, onReturn }: {
  ready: boolean; fastReady: boolean; replayReady: boolean; requested: boolean; mode: PlaybackMode;
  returnLabel: string; returnToSetup: boolean;
  onPause: () => void; onResume: () => void; onPlay: () => void; onFast: () => void;
  onReplay: () => void; onReturn: () => void;
}) {
  const [confirmation, setConfirmation] = useState<{ action: "replay" | "return"; resume: boolean }>();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (confirmation) dialog.current?.showModal(); }, [confirmation]);
  const dismiss = () => {
    if (confirmation?.resume) onResume();
    setConfirmation(undefined);
  };
  const ask = (action: "replay" | "return") => {
    setConfirmation({ action, resume: requested });
    onPause();
  };
  const replay = confirmation?.action === "replay";
  return <>
    <IconButton icon="pause" label="Pause" tooltip="Pause playback" disabled={!ready} aria-pressed={!requested} onClick={onPause} />
    <IconButton icon="play" label="Play" tooltip="Play in real time" disabled={!ready} aria-pressed={requested && mode === "realTime"} onClick={onPlay} />
    <IconButton icon="fast" label="Fast" tooltip={fastReady ? "Fast-forward — fit the attempt into about a minute" : "Fast-forward will be ready when the simulation has finished computing"} disabled={!fastReady} aria-pressed={requested && mode === "fast"} onClick={onFast} />
    <IconButton icon="replay" label="Replay" tooltip="Replay this attempt from the beginning" disabled={!replayReady} onClick={() => ask("replay")} />
    <IconButton icon="cancel" label={returnLabel} tooltip={returnLabel} onClick={() => ask("return")} />
    {confirmation && <dialog ref={dialog} className="playback-confirmation" aria-labelledby="playback-confirmation-title" onCancel={event => { event.preventDefault(); dismiss(); }}>
      <h2 id="playback-confirmation-title">{replay ? "Replay this attempt?" : "Leave this attempt?"}</h2>
      <p>{replay
        ? "Watch the same flies and events again from the beginning. Your setup and earned stars stay saved; celebrations you have already seen will not repeat."
        : !returnToSetup ? "Close this recording and start a new attempt with a fresh random seed. The current recording will no longer be available."
        : "Return to setup to edit your objects. This replay will be closed, and releasing the flies again starts a new attempt. Your object placements and stars you have already watched stay saved. Unseen results are not awarded."}</p>
      <div>
        <button autoFocus onClick={dismiss}>Keep watching</button>
        <button onClick={() => { setConfirmation(undefined); if (replay) onReplay(); else onReturn(); }}>{replay ? "Replay from start" : "Leave attempt"}</button>
      </div>
    </dialog>}
  </>;
}
