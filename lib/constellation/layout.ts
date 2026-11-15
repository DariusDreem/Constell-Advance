import type { Domain, Star } from "./types";

/** Geometry constants, in constellation units (1 unit = 1px at zoom 1). */
export const LAYOUT = {
  coreRadius: 44,
  firstRing: 150,
  ringStep: 118,
  /** Minimum distance between two neighbouring stars of the same ring. */
  minGap: 58,
  /** Share of a sector kept empty on each side. */
  sectorPadding: 0.14,
  /** Radial offset between bridge stars stacked on the same border, in ring steps. */
  borderStagger: 0.42,
  threadMargin: 34,
  threadGap: 16,
  minRings: 3,
} as const;

const TAU = Math.PI * 2;

export interface LayoutSector {
  domainId: string;
  index: number;
  startAngle: number;
  midAngle: number;
  endAngle: number;
}

export interface LayoutNode {
  starId: string;
  domainId: string;
  secondaryDomainId: string | null;
  x: number;
  y: number;
  angle: number;
  radius: number;
  depth: number;
  /** True when the star sits on the border between its two (neighbouring) domains. */
  onBorder: boolean;
}

/**
 * trunk: centre → first star of a branch. branch: prerequisite → star, straight.
 * cross: prerequisite in a non-neighbouring domain, drawn as a curved thread
 * that goes around the outside of the constellation.
 */
export type LinkKind = "trunk" | "branch" | "cross";

export interface LayoutLink {
  id: string;
  kind: LinkKind;
  /** null for trunk links, which start at the centre. */
  fromId: string | null;
  toId: string;
  path: string;
}

export interface ConstellationLayout {
  sectors: LayoutSector[];
  nodes: LayoutNode[];
  links: LayoutLink[];
  /** Radius of each depth ring, index 0 = depth 1. */
  ringRadii: number[];
  outerRadius: number;
}

const round = (value: number): number => {
  const rounded = Math.round(value * 100) / 100;
  return rounded === 0 ? 0 : rounded;
};

const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const byCreation = (a: Star, b: Star): number =>
  compareText(a.createdAt, b.createdAt) || compareText(a.id, b.id);

export function polar(angle: number, radius: number): { x: number; y: number } {
  return { x: round(Math.cos(angle) * radius), y: round(Math.sin(angle) * radius) };
}

/**
 * Deterministic radial layout: the same domains and stars always give the same
 * sky, whatever the order of the input arrays.
 */
export function computeLayout(domains: Domain[], stars: Star[]): ConstellationLayout {
  const ordered = [...domains].sort(
    (a, b) => a.position - b.position || compareText(a.id, b.id),
  );
  const count = ordered.length;
  const width = count > 0 ? TAU / count : TAU;
  const domainIndex = new Map(ordered.map((domain, index) => [domain.id, index]));

  // Sector 0 points up; the others follow clockwise.
  const sectors: LayoutSector[] = ordered.map((domain, index) => {
    const midAngle = -Math.PI / 2 + index * width;
    return {
      domainId: domain.id,
      index,
      startAngle: midAngle - width / 2,
      midAngle,
      endAngle: midAngle + width / 2,
    };
  });

  const placed = stars.filter((star) => domainIndex.has(star.domainId)).sort(byCreation);
  const byId = new Map(placed.map((star) => [star.id, star]));

  // A bridge star whose two domains are neighbours sits on their shared border.
  // The border is identified by the sector that ends on it.
  const borderOf = new Map<string, number>();
  for (const star of placed) {
    if (count < 2 || !star.secondaryDomainId || star.secondaryDomainId === star.domainId) continue;
    const primary = domainIndex.get(star.domainId) as number;
    const secondary = domainIndex.get(star.secondaryDomainId);
    if (secondary === undefined) continue;
    if (count === 2) borderOf.set(star.id, 0);
    else if (secondary === (primary + 1) % count) borderOf.set(star.id, primary);
    else if (secondary === (primary - 1 + count) % count) borderOf.set(star.id, secondary);
  }

  const prerequisitesOf = (star: Star): Star[] => {
    const found: Star[] = [];
    for (const id of new Set(star.prerequisiteIds)) {
      const prerequisite = byId.get(id);
      if (prerequisite && prerequisite.id !== star.id) found.push(prerequisite);
    }
    return found.sort(byCreation);
  };

  /** A prerequisite link is drawn straight when both stars share a sector or a border. */
  const isStraight = (star: Star, prerequisite: Star): boolean =>
    prerequisite.domainId === star.domainId ||
    (borderOf.has(star.id) && prerequisite.domainId === star.secondaryDomainId) ||
    (borderOf.has(prerequisite.id) && prerequisite.secondaryDomainId === star.domainId);

  // Depth = length of the longest chain of straight prerequisites behind the star.
  const depthMemo = new Map<string, number>();
  const visiting = new Set<string>();
  const depthOf = (star: Star): number => {
    const known = depthMemo.get(star.id);
    if (known !== undefined) return known;
    if (visiting.has(star.id)) return 0; // defensive: a loop in the data
    visiting.add(star.id);
    let depth = 1;
    for (const prerequisite of prerequisitesOf(star)) {
      if (isStraight(star, prerequisite)) depth = Math.max(depth, depthOf(prerequisite) + 1);
    }
    visiting.delete(star.id);
    depthMemo.set(star.id, depth);
    return depth;
  };

  // Each star hangs under its deepest prerequisite of the same domain.
  const childrenOf = new Map<string, Star[]>();
  const rootsOf = new Map<string, Star[]>(ordered.map((domain) => [domain.id, []]));
  for (const star of placed) {
    let parent: Star | null = null;
    for (const prerequisite of prerequisitesOf(star)) {
      if (prerequisite.domainId !== star.domainId) continue;
      if (depthOf(prerequisite) >= depthOf(star)) continue;
      if (!parent || depthOf(prerequisite) > depthOf(parent)) parent = prerequisite;
    }
    if (parent) {
      const siblings = childrenOf.get(parent.id) ?? [];
      siblings.push(star);
      childrenOf.set(parent.id, siblings);
    } else {
      (rootsOf.get(star.domainId) as Star[]).push(star);
    }
  }

  const weightMemo = new Map<string, number>();
  const weightOf = (star: Star): number => {
    const known = weightMemo.get(star.id);
    if (known !== undefined) return known;
    const children = childrenOf.get(star.id) ?? [];
    const weight =
      children.length === 0 ? 1 : children.reduce((sum, child) => sum + weightOf(child), 0);
    weightMemo.set(star.id, weight);
    return weight;
  };

  // Subtrees holding a bridge star are pushed towards the border they bridge to.
  const biasMemo = new Map<string, number>();
  const biasOf = (star: Star): number => {
    const known = biasMemo.get(star.id);
    if (known !== undefined) return known;
    const border = borderOf.get(star.id);
    let bias: number;
    if (border !== undefined) {
      bias = border === domainIndex.get(star.domainId) ? 1 : -1;
    } else {
      const children = childrenOf.get(star.id) ?? [];
      bias = Math.sign(children.reduce((sum, child) => sum + biasOf(child), 0));
    }
    biasMemo.set(star.id, bias);
    return bias;
  };

  // Radial tree: every subtree gets a slice of angle proportional to its leaves.
  const angleOf = new Map<string, number>();
  const spread = (group: Star[], from: number, to: number): void => {
    if (group.length === 0) return;
    const sorted = [...group].sort((a, b) => biasOf(a) - biasOf(b) || byCreation(a, b));
    const total = sorted.reduce((sum, star) => sum + weightOf(star), 0);
    let cursor = from;
    for (const star of sorted) {
      const span = ((to - from) * weightOf(star)) / total;
      angleOf.set(star.id, cursor + span / 2);
      spread(childrenOf.get(star.id) ?? [], cursor, cursor + span);
      cursor += span;
    }
  };
  for (const sector of sectors) {
    const padding = width * LAYOUT.sectorPadding;
    spread(
      rootsOf.get(sector.domainId) ?? [],
      sector.startAngle + padding,
      sector.endAngle - padding,
    );
  }
  for (const [starId, border] of borderOf) angleOf.set(starId, sectors[border].endAngle);

  // Ring radii: regular steps, widened when a ring would be too crowded.
  const maxDepth = placed.reduce((max, star) => Math.max(max, depthOf(star)), 0);
  const needed = new Array<number>(maxDepth + 1).fill(0);
  const anglesByRing = new Map<string, number[]>();
  for (const star of placed) {
    if (borderOf.has(star.id)) continue;
    const key = `${star.domainId}:${depthOf(star)}`;
    const angles = anglesByRing.get(key) ?? [];
    angles.push(angleOf.get(star.id) as number);
    anglesByRing.set(key, angles);
  }
  for (const [key, angles] of anglesByRing) {
    const depth = Number(key.slice(key.lastIndexOf(":") + 1));
    angles.sort((a, b) => a - b);
    for (let i = 1; i < angles.length; i++) {
      const gap = angles[i] - angles[i - 1];
      if (gap > 1e-6) needed[depth] = Math.max(needed[depth], LAYOUT.minGap / gap);
    }
  }
  const ringRadii: number[] = [];
  for (let depth = 1; depth <= maxDepth; depth++) {
    const regular = LAYOUT.firstRing + (depth - 1) * LAYOUT.ringStep;
    const previous = depth > 1 ? ringRadii[depth - 2] + LAYOUT.ringStep : 0;
    ringRadii.push(round(Math.max(regular, needed[depth], previous)));
  }

  // Bridge stars sharing a border and a ring are staggered outwards.
  const stackOf = new Map<string, number>();
  const nodes: LayoutNode[] = placed.map((star) => {
    const depth = depthOf(star);
    const angle = angleOf.get(star.id) as number;
    let radius = ringRadii[depth - 1];
    const border = borderOf.get(star.id);
    if (border !== undefined) {
      const key = `${border}:${depth}`;
      const stacked = stackOf.get(key) ?? 0;
      stackOf.set(key, stacked + 1);
      radius += stacked * LAYOUT.ringStep * LAYOUT.borderStagger;
    }
    return {
      starId: star.id,
      domainId: star.domainId,
      secondaryDomainId: star.secondaryDomainId,
      ...polar(angle, radius),
      angle,
      radius: round(radius),
      depth,
      onBorder: border !== undefined,
    };
  });
  const nodeOf = new Map(nodes.map((node) => [node.starId, node]));

  const farthest = nodes.reduce((max, node) => Math.max(max, node.radius), 0);
  const minimum = LAYOUT.firstRing + (LAYOUT.minRings - 1) * LAYOUT.ringStep;
  const outerRadius = round(Math.max(farthest, minimum) + LAYOUT.ringStep * 0.85);

  const links: LayoutLink[] = [];
  let threads = 0;
  for (const star of placed) {
    const node = nodeOf.get(star.id) as LayoutNode;
    let attached = false;
    for (const prerequisite of prerequisitesOf(star)) {
      const from = nodeOf.get(prerequisite.id) as LayoutNode;
      if (isStraight(star, prerequisite)) {
        attached = true;
        links.push({
          id: `${prerequisite.id}>${star.id}`,
          kind: "branch",
          fromId: prerequisite.id,
          toId: star.id,
          path: `M${from.x},${from.y}L${node.x},${node.y}`,
        });
      } else {
        const lane = outerRadius + LAYOUT.threadMargin + threads * LAYOUT.threadGap;
        threads += 1;
        links.push({
          id: `${prerequisite.id}>${star.id}`,
          kind: "cross",
          fromId: prerequisite.id,
          toId: star.id,
          path: threadPath(from, node, lane),
        });
      }
    }
    if (!attached) {
      const start = polar(node.angle, LAYOUT.coreRadius);
      links.push({
        id: `centre>${star.id}`,
        kind: "trunk",
        fromId: null,
        toId: star.id,
        path: `M${start.x},${start.y}L${node.x},${node.y}`,
      });
    }
  }

  return { sectors, nodes, links, ringRadii, outerRadius };
}

/** Curved thread between two stars that swings out to `lane` instead of crossing the centre. */
function threadPath(from: LayoutNode, to: LayoutNode, lane: number): string {
  let delta = (to.angle - from.angle) % TAU;
  if (delta > Math.PI) delta -= TAU;
  if (delta <= -Math.PI) delta += TAU;
  const bulge = lane - (from.radius + to.radius) / 2;
  const steps = 48;
  const points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = from.angle + delta * t;
    const radius = from.radius + (to.radius - from.radius) * t + bulge * Math.sin(Math.PI * t);
    const point = polar(angle, radius);
    points.push(`${point.x},${point.y}`);
  }
  return `M${points.join("L")}`;
}

/** SVG path of a pie slice centred on the origin. */
export function wedgePath(startAngle: number, endAngle: number, radius: number): string {
  if (endAngle - startAngle >= TAU - 1e-6) {
    return `M${-radius},0A${radius},${radius} 0 1 1 ${radius},0A${radius},${radius} 0 1 1 ${-radius},0Z`;
  }
  const start = polar(startAngle, radius);
  const end = polar(endAngle, radius);
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M0,0L${start.x},${start.y}A${radius},${radius} 0 ${large} 1 ${end.x},${end.y}Z`;
}

/** Domain whose sector contains the point, or null near the centre or far outside. */
export function domainAtPoint(layout: ConstellationLayout, x: number, y: number): string | null {
  const count = layout.sectors.length;
  if (count === 0) return null;
  const distance = Math.hypot(x, y);
  if (distance < LAYOUT.coreRadius || distance > layout.outerRadius + 140) return null;
  const relative = (((Math.atan2(y, x) - layout.sectors[0].startAngle) % TAU) + TAU) % TAU;
  const index = Math.min(count - 1, Math.floor(relative / (TAU / count)));
  return layout.sectors[index].domainId;
}
