"use client";

import { select } from "d3-selection";
import { zoom, zoomIdentity, zoomTransform, type ZoomBehavior } from "d3-zoom";
import { motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { MinusIcon, PlusIcon, TargetIcon } from "@/components/icons";
import { computeLayout, domainAtPoint, LAYOUT, polar, wedgePath } from "@/lib/constellation/layout";
import type { Domain, Star, StarStatus } from "@/lib/constellation/types";
import { StarNode } from "./StarNode";

interface ConstellationProps {
  domains: Domain[];
  stars: Star[];
  statuses: Map<string, StarStatus>;
  selectedId: string | null;
  focusDomainId: string | null;
  onSelect: (id: string | null) => void;
  onFocusDomain: (id: string | null) => void;
  /** Content of the small window shown next to the selected star. */
  popover?: ReactNode;
  /** Double-click inside a domain's sector: create a milestone in that domain. */
  onCreateInDomain?: (domainId: string) => void;
}

/** Zoom level from which every star shows its name, not only the major ones. */
const LABEL_ZOOM = 1.15;
const FIT_MARGIN = 44;
const POPOVER_WIDTH = 320;
/** Minimum distance between the popover and the edges of the sky. */
const POPOVER_EDGE = 12;

/**
 * The sky: the user at the centre, one tinted sector per domain, stars placed
 * by `computeLayout`. Wheel to zoom, drag to move, hover a sector to focus it,
 * double-click inside one to add a milestone there.
 */
export function Constellation({
  domains,
  stars,
  statuses,
  selectedId,
  focusDomainId,
  onSelect,
  onFocusDomain,
  popover,
  onCreateInDomain,
}: ConstellationProps) {
  const layout = useMemo(() => computeLayout(domains, stars), [domains, stars]);
  const starOf = useMemo(() => new Map(stars.map((star) => [star.id, star])), [stars]);
  const domainOf = useMemo(() => new Map(domains.map((domain) => [domain.id, domain])), [domains]);

  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  const outerRef = useRef(layout.outerRadius);
  const [view, setView] = useState({ x: 0, y: 0, k: 1, ready: false });
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    outerRef.current = layout.outerRadius;
  }, [layout.outerRadius]);

  /** Centres the whole constellation in the available space. */
  const fit = useCallback(() => {
    const svg = svgRef.current;
    const behaviour = zoomRef.current;
    const { width, height } = sizeRef.current;
    if (!svg || !behaviour || !width || !height) return;
    const scale = Math.min(1.4, Math.min(width, height) / (2 * (outerRef.current + FIT_MARGIN)));
    select(svg).call(
      behaviour.transform,
      zoomIdentity.translate(width / 2, height / 2).scale(scale),
    );
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const selection = select(svg);
    const behaviour = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 4])
      .on("zoom", (event) => {
        const { x, y, k } = event.transform;
        setView({ x, y, k, ready: true });
      });
    selection.call(behaviour).on("dblclick.zoom", null);
    zoomRef.current = behaviour;

    // Keep the same point of the sky in the middle when the space changes
    // (window resize, sidebar opening or closing).
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const previous = sizeRef.current;
      sizeRef.current = { width, height };
      setSize({ width, height });
      if (!previous.width || !previous.height) {
        fit();
        return;
      }
      const current = zoomTransform(svg);
      selection.call(
        behaviour.transform,
        zoomIdentity
          .translate(current.x + (width - previous.width) / 2, current.y + (height - previous.height) / 2)
          .scale(current.k),
      );
    });
    observer.observe(svg);

    return () => {
      observer.disconnect();
      selection.on(".zoom", null);
      zoomRef.current = null;
    };
  }, [fit]);

  const zoomBy = (factor: number) => {
    const svg = svgRef.current;
    const behaviour = zoomRef.current;
    if (svg && behaviour) select(svg).call(behaviour.scaleBy, factor);
  };

  /** Domain under the cursor, converting screen coordinates into sky coordinates. */
  const domainUnder = (event: PointerEvent<SVGSVGElement> | MouseEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left - view.x) / view.k;
    const y = (event.clientY - bounds.top - view.y) / view.k;
    return domainAtPoint(layout, x, y);
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    onFocusDomain(domainUnder(event));
  };

  const handleDoubleClick = (event: MouseEvent<SVGSVGElement>) => {
    const domainId = domainUnder(event);
    if (domainId && onCreateInDomain) onCreateInDomain(domainId);
  };

  const isLit = (...ids: (string | null | undefined)[]) =>
    focusDomainId === null || ids.includes(focusDomainId);

  const wedgeRadius = layout.outerRadius + 60;
  const showAllLabels = view.k >= LABEL_ZOOM;
  // Rounded so the stars only re-render when the label size really changes.
  const labelScale = Math.round(Math.min(1.6, Math.max(0.6, 1 / view.k)) * 10) / 10;

  // The popover follows the selected star on screen: to its right when there is
  // room, otherwise to its left, and always inside the visible sky.
  const selectedNode = selectedId
    ? layout.nodes.find((node) => node.starId === selectedId)
    : undefined;
  let popoverStyle: CSSProperties | null = null;
  if (popover && selectedNode && view.ready && size.width > 0) {
    const anchorX = view.x + selectedNode.x * view.k;
    const anchorY = view.y + selectedNode.y * view.k;
    const width = Math.min(POPOVER_WIDTH, size.width - POPOVER_EDGE * 2);
    const gap = 26 * view.k + 14; // clears the star and its selection ring
    const onRight = anchorX + gap;
    const onLeft = anchorX - gap - width;
    const left =
      onRight + width <= size.width - POPOVER_EDGE
        ? onRight
        : onLeft >= POPOVER_EDGE
          ? onLeft
          : Math.max(POPOVER_EDGE, Math.min(size.width - width - POPOVER_EDGE, onRight));
    // Grows downwards from a star in the upper half, upwards from one in the lower half.
    const upper = anchorY <= size.height / 2;
    const offset = Math.max(POPOVER_EDGE, (upper ? anchorY : size.height - anchorY) - 44);
    popoverStyle = {
      left,
      width,
      maxHeight: size.height - offset - POPOVER_EDGE,
      ...(upper ? { top: offset } : { bottom: offset }),
    };
  }

  return (
    <div className="absolute inset-0">
      <svg
        ref={svgRef}
        role="group"
        aria-label="Constellation de tes paliers"
        className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => onFocusDomain(null)}
        onClick={() => onSelect(null)}
        onDoubleClick={handleDoubleClick}
      >
        <defs>
          <filter id="star-glow" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="halo-white">
            <stop offset="0" stopColor="#fff" stopOpacity="0.85" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="core-halo">
            <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
            <stop offset="0.25" stopColor="#d9ccff" stopOpacity="0.5" />
            <stop offset="1" stopColor="#8b6cff" stopOpacity="0" />
          </radialGradient>
          {domains.map((domain) => (
            <radialGradient key={`halo-${domain.id}`} id={`halo-${domain.id}`}>
              <stop offset="0" stopColor={domain.color} stopOpacity="0.6" />
              <stop offset="1" stopColor={domain.color} stopOpacity="0" />
            </radialGradient>
          ))}
          {domains.map((domain) => (
            <radialGradient
              key={`sector-${domain.id}`}
              id={`sector-${domain.id}`}
              gradientUnits="userSpaceOnUse"
              cx="0"
              cy="0"
              r={wedgeRadius}
            >
              <stop offset="0" stopColor={domain.color} stopOpacity="0" />
              <stop offset="0.14" stopColor={domain.color} stopOpacity="0.07" />
              <stop offset="0.55" stopColor={domain.color} stopOpacity="0.15" />
              <stop offset="1" stopColor={domain.color} stopOpacity="0" />
            </radialGradient>
          ))}
        </defs>

        <g
          transform={`translate(${view.x},${view.y}) scale(${view.k})`}
          style={{ opacity: view.ready ? 1 : 0, transition: "opacity 0.9s ease" }}
        >
          {/* Domain sectors: a subtle tint that tells them apart at a glance. */}
          {layout.sectors.map((sector) => (
            <path
              key={sector.domainId}
              d={wedgePath(sector.startAngle, sector.endAngle, wedgeRadius)}
              fill={`url(#sector-${sector.domainId})`}
              className="fade"
              style={{
                opacity: focusDomainId === null ? 0.75 : focusDomainId === sector.domainId ? 1 : 0.5,
              }}
            />
          ))}

          {layout.sectors.length > 1 &&
            layout.sectors.map((sector) => {
              const from = polar(sector.startAngle, LAYOUT.coreRadius + 16);
              const to = polar(sector.startAngle, layout.outerRadius - 12);
              return (
                <line
                  key={sector.domainId}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="#fff"
                  strokeOpacity="0.06"
                />
              );
            })}

          {layout.ringRadii.map((radius, index) => (
            <circle
              key={index}
              r={radius}
              fill="none"
              stroke="#fff"
              strokeOpacity="0.05"
              strokeDasharray="2 10"
            />
          ))}

          {/* Constellation lines. */}
          {layout.links.map((link) => {
            const target = starOf.get(link.toId);
            if (!target) return null;
            const source = link.fromId ? starOf.get(link.fromId) : null;
            const status = statuses.get(link.toId) ?? "locked";
            const lit = isLit(target.domainId, target.secondaryDomainId, source?.domainId);
            const cross = link.kind === "cross";
            const colorId = cross && source ? source.domainId : target.domainId;
            const color = domainOf.get(colorId)?.color ?? "#fff";
            const opacity = cross
              ? status === "achieved"
                ? 0.85
                : 0.5
              : status === "achieved"
                ? 0.8
                : status === "available"
                  ? 0.36
                  : 0.15;
            return (
              <path
                key={link.id}
                d={link.path}
                fill="none"
                stroke={cross || status === "achieved" ? color : "#fff"}
                strokeWidth={status === "achieved" ? 1.6 : 1.1}
                strokeLinecap="round"
                strokeDasharray={!cross && status === "locked" ? "2 7" : undefined}
                className={cross ? "thread fade" : "fade"}
                style={{ opacity: lit ? opacity : opacity * 0.55 }}
              />
            );
          })}

          {/* The centre: you. */}
          <g>
            <circle r={LAYOUT.coreRadius * 2.3} fill="url(#core-halo)" opacity="0.55" />
            <circle
              r={LAYOUT.coreRadius}
              fill="none"
              stroke="#fff"
              strokeOpacity="0.14"
              strokeDasharray="1 6"
              className="spin-slow"
            />
            <circle r={LAYOUT.coreRadius * 0.34} fill="#fff" filter="url(#star-glow)" />
          </g>

          {layout.sectors.map((sector) => {
            const domain = domainOf.get(sector.domainId);
            if (!domain) return null;
            const at = polar(sector.midAngle, layout.outerRadius - 30);
            return (
              <text
                key={sector.domainId}
                x={at.x}
                y={at.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={13 * labelScale}
                fontWeight="600"
                letterSpacing="0.2em"
                fill={domain.color}
                pointerEvents="none"
                className="fade font-display uppercase"
                style={{
                  opacity: focusDomainId === null ? 0.7 : focusDomainId === domain.id ? 1 : 0.45,
                }}
              >
                {domain.name}
              </text>
            );
          })}

          {layout.nodes.map((node) => {
            const star = starOf.get(node.starId);
            if (!star) return null;
            return (
              <StarNode
                key={node.starId}
                node={node}
                star={star}
                status={statuses.get(node.starId) ?? "locked"}
                color={domainOf.get(node.domainId)?.color ?? "#fff"}
                secondaryColor={
                  node.secondaryDomainId
                    ? (domainOf.get(node.secondaryDomainId)?.color ?? null)
                    : null
                }
                selected={selectedId === node.starId}
                dimmed={!isLit(node.domainId, node.secondaryDomainId)}
                showLabel={star.tier === "major" || showAllLabels}
                labelScale={labelScale}
                onSelect={onSelect}
              />
            );
          })}
        </g>
      </svg>

      {popoverStyle && (
        <motion.div
          key={selectedId}
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="absolute z-20 flex flex-col"
          style={popoverStyle}
        >
          {popover}
        </motion.div>
      )}

      <div className="glass absolute bottom-4 left-4 flex overflow-hidden rounded-full">
        <ControlButton label="Zoomer" onClick={() => zoomBy(1.35)}>
          <PlusIcon />
        </ControlButton>
        <ControlButton label="Dézoomer" onClick={() => zoomBy(1 / 1.35)}>
          <MinusIcon />
        </ControlButton>
        <ControlButton label="Recentrer" onClick={fit}>
          <TargetIcon />
        </ControlButton>
      </div>
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center text-white/70 transition-colors hover:bg-white/10 hover:text-white"
    >
      {children}
    </button>
  );
}
