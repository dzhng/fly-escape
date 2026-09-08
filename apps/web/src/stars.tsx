import React from "react";

/** One accessible score label; the individual shapes are decorative. */
export function Stars({ count }: { count: number }) {
  const earned = Math.max(0, Math.min(3, Math.floor(count)));
  return (
    <span className="game-stars" role="img" aria-label={`${earned} of 3 stars`}>
      {[0, 1, 2].map(index => (
        <svg key={index} viewBox="0 0 24 24" aria-hidden="true" focusable="false"
          className={index < earned ? "earned" : "unearned"}>
          <path d="m12 2 3.1 6.3 7 .95-5.05 4.9 1.2 6.95L12 17.8l-6.25 3.3 1.2-6.95L1.9 9.25l7-.95Z" />
        </svg>
      ))}
    </span>
  );
}
