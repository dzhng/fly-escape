import React, { useEffect } from "react";
import { Stars } from "./stars";
import "./star-celebration.css";

/** Each attempt remembers the milestones actually shown, independently of seeking. */
export class WatchedStars {
  private highest = 0;
  observe(escaped: number, thresholds: readonly number[], watching: boolean): number | undefined {
    if (!watching) return;
    const earned = thresholds.filter(threshold => escaped >= threshold).length;
    if (earned <= this.highest) return;
    this.highest = earned;
    return earned;
  }
}

export function StarCelebration({ stars, onFinish }: { stars: number; onFinish: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onFinish, 4200);
    return () => window.clearTimeout(timer);
  }, [onFinish]);
  return <div className="star-celebration" data-testid="star-celebration">
    <div className="star-confetti" aria-hidden="true">
      {Array.from({ length: 32 }, (_, i) => <i key={i} style={{
        "--x": `${(i * 37 % 101)}%`, "--drift": `${(i % 2 ? 1 : -1) * (25 + i % 5 * 14)}px`,
        "--delay": `${i % 7 * 45}ms`, "--color": ["#ffc94d", "#ff8668", "#8bd9c3", "#fff2bd"][i % 4],
      } as React.CSSProperties} />)}
    </div>
    <div className="star-celebration-message" role="status">
      <Stars count={stars} />
      <strong>{["", "A star for freedom!", "Two stars. Beautiful teamwork!", "Three stars. What an escape!"][stars]}</strong>
      <span>{stars === 3 ? "You helped almost the whole house fly free." : "More flies are finding their way outside."}</span>
    </div>
  </div>;
}
