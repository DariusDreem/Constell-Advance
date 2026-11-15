"use client";

import { motion } from "motion/react";
import { CIRCLE_PINCH, sparklePath } from "@/lib/constellation/shapes";

const HOLE = sparklePath(5.6, CIRCLE_PINCH);
const STAR = sparklePath(13, 0.14);
const EASE = [0.6, 0, 0.2, 1] as const;

/**
 * Sidebar switch. Open: a black hole, ready to swallow the panel.
 * Collapsed: the hole has turned into a four-pointed star that brings it back.
 */
export function CollapseToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const label = collapsed ? "Déployer le panneau" : "Réduire le panneau";
  const disk = {
    scale: collapsed ? 0.15 : 1,
    opacity: collapsed ? 0 : 1,
    rotate: collapsed ? 200 : -18,
  };
  const transition = { duration: 0.6, ease: EASE };

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-expanded={!collapsed}
      title={label}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors hover:bg-white/[0.07]"
    >
      <svg width="32" height="32" viewBox="-16 -16 32 32" className="overflow-visible">
        <defs>
          <linearGradient id="toggle-disk" x1="-13" y1="0" x2="13" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#8b6cff" />
            <stop offset="0.45" stopColor="#ffd9a8" />
            <stop offset="1" stopColor="#ff7ab8" />
          </linearGradient>
          <radialGradient id="toggle-glow">
            <stop offset="0.45" stopColor="#ffb86b" stopOpacity="0.55" />
            <stop offset="1" stopColor="#8b6cff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Far side of the accretion disk, behind the hole. */}
        <motion.g initial={false} animate={disk} transition={transition}>
          {/* Invisible circle: keeps both halves rotating around the same centre. */}
          <circle r="13" fill="none" />
          <circle r="10" fill="url(#toggle-glow)" />
          <path
            d="M-13,0A13,4.6 0 0 1 13,0"
            fill="none"
            stroke="url(#toggle-disk)"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="disk-flow"
          />
        </motion.g>

        <motion.path
          initial={false}
          animate={{
            d: collapsed ? STAR : HOLE,
            fill: collapsed ? "#ffffff" : "#000000",
            stroke: collapsed ? "rgba(255,255,255,0)" : "rgba(255,217,168,0.9)",
            rotate: collapsed ? 0 : -90,
          }}
          transition={transition}
          strokeWidth="0.8"
          style={{ filter: collapsed ? "drop-shadow(0 0 5px rgba(255,255,255,0.85))" : "none" }}
        />

        {/* Near side of the disk, in front of the hole. */}
        <motion.g initial={false} animate={disk} transition={transition}>
          <circle r="13" fill="none" />
          <path
            d="M-13,0A13,4.6 0 0 0 13,0"
            fill="none"
            stroke="url(#toggle-disk)"
            strokeWidth="1.8"
            strokeLinecap="round"
            className="disk-flow"
          />
        </motion.g>
      </svg>
    </button>
  );
}
