"use client";

import { memo, useState } from "react";
import type { LayoutNode } from "@/lib/constellation/layout";
import { sparklePath } from "@/lib/constellation/shapes";
import { progressRatio } from "@/lib/constellation/status";
import type { Star, StarStatus } from "@/lib/constellation/types";

export const STATUS_LABEL: Record<StarStatus, string> = {
  achieved: "Atteinte",
  available: "Accessible",
  locked: "Verrouillée",
};

interface StarNodeProps {
  node: LayoutNode;
  star: Star;
  status: StarStatus;
  color: string;
  /** Colour of the second domain for bridge stars. */
  secondaryColor: string | null;
  selected: boolean;
  dimmed: boolean;
  showLabel: boolean;
  /** Counter-scale applied to the label so it stays readable when zoomed out. */
  labelScale: number;
  onSelect: (id: string) => void;
}

const LINE_LIMIT = 20;

/** Splits a title over two short lines so neighbouring labels overlap less. */
function wrapLabel(title: string): string[] {
  const clip = (line: string) =>
    line.length > LINE_LIMIT ? `${line.slice(0, LINE_LIMIT - 1)}…` : line;
  if (title.length <= 16) return [title];
  const middle = title.length / 2;
  let split = -1;
  for (let i = 0; i < title.length; i++) {
    if (title[i] !== " ") continue;
    if (split === -1 || Math.abs(i - middle) < Math.abs(split - middle)) split = i;
  }
  if (split === -1) return [clip(title)];
  return [clip(title.slice(0, split)), clip(title.slice(split + 1))];
}

/** Stable pseudo-random offset so stars do not all twinkle in step. */
function twinkleDelay(id: string): number {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return (sum % 50) / 10;
}

/**
 * One milestone. Achieved: bright white with a halo. Available: softer, breathing.
 * Locked: grey, no halo. Major milestones are larger; numeric goals carry a ring.
 */
export const StarNode = memo(function StarNode({
  node,
  star,
  status,
  color,
  secondaryColor,
  selected,
  dimmed,
  showLabel,
  labelScale,
  onSelect,
}: StarNodeProps) {
  const [hovered, setHovered] = useState(false);
  const major = star.tier === "major";
  const size = major ? 12 : 7;
  const ratio = progressRatio(star);
  const ringRadius = size + 6;
  const circumference = 2 * Math.PI * ringRadius;
  const lines = wrapLabel(star.title);
  const accent = (size + 5) * Math.SQRT1_2;
  const fontSize = (major ? 12.5 : 11.5) * labelScale;

  return (
    <g
      transform={`translate(${node.x},${node.y})`}
      className="star-node fade"
      style={{ opacity: dimmed ? 0.5 : 1 }}
      role="button"
      tabIndex={0}
      aria-label={`${star.title}, ${STATUS_LABEL[status]}`}
      aria-pressed={selected}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(star.id);
      }}
      // A double-click on a star only selects it; it must not open the creation form.
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(star.id);
        }
      }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      {status !== "locked" && (
        <circle
          r={size * 3.4}
          fill={`url(#halo-${node.domainId})`}
          className={status === "achieved" ? "halo-achieved" : "halo-available"}
          style={{ animationDelay: `-${twinkleDelay(star.id)}s` }}
        />
      )}
      {status === "achieved" && <circle r={size * 1.9} fill="url(#halo-white)" />}

      {selected && (
        <circle
          r={size + 13}
          fill="none"
          stroke="#fff"
          strokeOpacity="0.8"
          strokeWidth="1"
          strokeDasharray="3 5"
          className="spin-slow"
        />
      )}

      {ratio !== null && (
        <>
          <circle r={ringRadius} fill="none" stroke="#fff" strokeOpacity="0.14" strokeWidth="2" />
          <circle
            r={ringRadius}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={`${circumference * ratio} ${circumference}`}
            transform="rotate(-90)"
            opacity={status === "locked" ? 0.5 : 1}
          />
        </>
      )}

      <path
        className="star-shape"
        d={sparklePath(size, major ? 0.17 : 0.22)}
        fill={status === "locked" ? "#716d8a" : "#fff"}
        fillOpacity={status === "achieved" ? 1 : status === "available" ? 0.72 : 0.55}
        filter={status === "achieved" ? "url(#star-glow)" : undefined}
      />

      {secondaryColor && (
        <circle cx={accent} cy={-accent} r="2.6" fill={secondaryColor} stroke="#05030d" strokeWidth="0.8" />
      )}

      {(showLabel || hovered || selected) && (
        <text
          y={size + (ratio !== null ? 10 : 6) + fontSize}
          textAnchor="middle"
          fontSize={fontSize}
          fontWeight={major ? 600 : 400}
          fill="#fff"
          fillOpacity={status === "achieved" ? 0.95 : status === "available" ? 0.72 : 0.42}
          stroke="#05030d"
          strokeOpacity="0.85"
          strokeWidth={3.5 * labelScale}
          strokeLinejoin="round"
          pointerEvents="none"
          style={{ paintOrder: "stroke" }}
        >
          {lines.map((line, index) => (
            <tspan key={index} x="0" dy={index === 0 ? 0 : fontSize * 1.15}>
              {line}
            </tspan>
          ))}
        </text>
      )}

      {/* Generous transparent target: small stars stay easy to click. */}
      <circle r={Math.max(18, size + 9)} fill="transparent" />
    </g>
  );
});
