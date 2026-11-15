import { computeAncestors, impliedPrerequisites } from "./status";
import type { Domain, Star } from "./types";

/** Geometry constants, in constellation units (1 unit = 1px at zoom 1). */
export const LAYOUT = {
  coreRadius: 44,
  firstRing: 150,
  ringStep: 118,
  /** Minimum distance between two neighbouring stars of the same ring (room for their labels). */
  minGap: 84,
  /** Room taken on a ring by a waypoint of a long line, relative to a star. */
  waypointWeight: 0.45,
  /** Share of a sector kept empty on each side. */
  sectorPadding: 0.12,
  /** Radial offset between bridge stars stacked on the same border, in ring steps. */
  borderStagger: 0.42,
  threadMargin: 34,
  threadGap: 16,
  minRings: 3,
  /** Alternating passes (towards the outside, then back) used to untangle the links. */
  sweeps: 4,
  /** Maximum rounds of "sifting" used to remove the remaining crossings. */
  swapRounds: 8,
  /** How far (in places) a star may move along its ring during one sifting step. */
  siftWindow: 6,
  /** Above this many slots in a sector, only one starting order is tried (speed). */
  restartLimit: 60,
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
 * trunk: centre → first star of a branch. branch: prerequisite → star, straight,
 * or gently curved when it passes several rings. cross: prerequisite in a
 * non-neighbouring domain, drawn as a thread that goes around the outside.
 */
export type LinkKind = "trunk" | "branch" | "cross";

export interface Point {
  x: number;
  y: number;
}

export interface LayoutLink {
  id: string;
  kind: LinkKind;
  /** null for trunk links, which start at the centre. */
  fromId: string | null;
  toId: string;
  /** Points the line goes through, from start to end. */
  points: Point[];
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

/**
 * Something that takes a place on a ring: a star, or a waypoint where a long
 * line (skipping rings) passes through an intermediate ring.
 */
interface Slot {
  id: string;
  depth: number;
  weight: number;
  /** Tie-breaker that keeps the result independent of the input order. */
  key: string;
}

/** A piece of line between two consecutive rings, used to count crossings. */
interface Segment {
  inner: string;
  outer: string;
  depth: number;
}

const round = (value: number): number => {
  const rounded = Math.round(value * 100) / 100;
  return rounded === 0 ? 0 : rounded;
};

const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const byCreation = (a: Star, b: Star): number =>
  compareText(a.createdAt, b.createdAt) || compareText(a.id, b.id);

/** Brings `angle` within half a turn of `reference`, so angles can be compared and averaged. */
const unwrap = (angle: number, reference: number): number =>
  reference + ((((angle - reference + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

export function polar(angle: number, radius: number): Point {
  return { x: round(Math.cos(angle) * radius), y: round(Math.sin(angle) * radius) };
}

/**
 * Places ordered slots on an arc between `low` and `high`, each as close as
 * possible to its target angle, keeping `gaps[i]` between slots i and i + 1.
 */
function placeOnArc(targets: number[], gaps: number[], low: number, high: number): number[] {
  const count = targets.length;
  if (count === 0) return [];
  const needed = gaps.reduce((sum, gap) => sum + gap, 0);
  const scale = needed > high - low && needed > 0 ? (high - low) / needed : 1;
  const step = gaps.map((gap) => gap * scale);
  const result = targets.map((target) => Math.min(high, Math.max(low, target)));
  for (let i = 1; i < count; i++) result[i] = Math.max(result[i], result[i - 1] + step[i - 1]);
  if (result[count - 1] > high) {
    result[count - 1] = high;
    for (let i = count - 2; i >= 0; i--) result[i] = Math.min(result[i], result[i + 1] - step[i]);
  }
  return result;
}

/** Number of pairs i < j with values[i] > values[j] (merge sort, O(n log n)). */
function countInversions(values: number[]): number {
  if (values.length < 2) return 0;
  const middle = values.length >> 1;
  const left = values.slice(0, middle);
  const right = values.slice(middle);
  let total = countInversions(left) + countInversions(right);
  left.sort((a, b) => a - b);
  right.sort((a, b) => a - b);
  let j = 0;
  for (const value of left) {
    while (j < right.length && right[j] < value) j++;
    total += j;
  }
  return total;
}

/** Smooth line through the points (Catmull-Rom spline turned into Bézier curves). */
function smoothPath(points: Point[]): string {
  if (points.length === 2) {
    return `M${points[0].x},${points[0].y}L${points[1].x},${points[1].y}`;
  }
  let path = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = { x: round(p1.x + (p2.x - p0.x) / 6), y: round(p1.y + (p2.y - p0.y) / 6) };
    const c2 = { x: round(p2.x - (p3.x - p1.x) / 6), y: round(p2.y - (p3.y - p1.y) / 6) };
    path += `C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`;
  }
  return path;
}

/**
 * Deterministic radial layout: the same domains and stars always give the same
 * sky, whatever the order of the input arrays.
 *
 * Distance to the centre = depth in the chain of prerequisites. Inside each
 * sector, the rings are untangled with the layered (Sugiyama) method:
 * - a line that skips rings gets a waypoint on every ring it crosses;
 * - stars and waypoints are ordered by the average angle of what they are
 *   linked to, sweeping outwards then inwards;
 * - neighbours are then swapped whenever that removes crossings.
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
  const maxDepth = placed.reduce((max, star) => Math.max(max, depthOf(star)), 0);

  // Only direct links are drawn: if a star needs A and B, and B already needs A,
  // the line A → star adds nothing and would only cross the sky.
  const ancestors = computeAncestors(placed);
  const drawnPrerequisites = new Map<string, Star[]>();
  for (const star of placed) {
    const prerequisites = prerequisitesOf(star);
    const implied = impliedPrerequisites(
      ancestors,
      prerequisites.map((prerequisite) => prerequisite.id),
    );
    drawnPrerequisites.set(
      star.id,
      prerequisites.filter((prerequisite) => !implied.has(prerequisite.id)),
    );
  }

  // Slots on each ring of each sector. Bridge stars are fixed on their border.
  const rings = new Map<string, Slot[]>();
  const ringKey = (domainId: string, depth: number) => `${domainId}:${depth}`;
  const addSlot = (domainId: string, slot: Slot) => {
    const key = ringKey(domainId, slot.depth);
    rings.set(key, [...(rings.get(key) ?? []), slot]);
  };
  for (const star of placed) {
    if (borderOf.has(star.id)) continue;
    addSlot(star.domainId, {
      id: star.id,
      depth: depthOf(star),
      weight: 1,
      key: `${star.createdAt}|${star.id}`,
    });
  }

  // Straight lines, split into one segment per pair of consecutive rings.
  // `chains` keeps, for each drawn line, the slots it passes through.
  const chains = new Map<string, string[]>();
  const segmentsOf = new Map<string, Segment[]>(); // per sector
  const inward = new Map<string, string[]>();
  const outward = new Map<string, string[]>();
  for (const star of placed) {
    for (const prerequisite of drawnPrerequisites.get(star.id) ?? []) {
      if (!isStraight(star, prerequisite)) continue;
      const lineId = `${prerequisite.id}>${star.id}`;
      // The sector that hosts the line: the one of its free end.
      const host = !borderOf.has(star.id)
        ? star.domainId
        : !borderOf.has(prerequisite.id)
          ? prerequisite.domainId
          : null;
      const chain = [prerequisite.id];
      if (host) {
        for (let depth = depthOf(prerequisite) + 1; depth < depthOf(star); depth++) {
          const waypoint = `${lineId}#${depth}`;
          addSlot(host, {
            id: waypoint,
            depth,
            weight: LAYOUT.waypointWeight,
            key: `${star.createdAt}|${lineId}`,
          });
          chain.push(waypoint);
        }
      }
      chain.push(star.id);
      chains.set(lineId, chain);
      for (let i = 0; i < chain.length - 1; i++) {
        inward.set(chain[i + 1], [...(inward.get(chain[i + 1]) ?? []), chain[i]]);
        outward.set(chain[i], [...(outward.get(chain[i]) ?? []), chain[i + 1]]);
        if (host) {
          // Consecutive slots of a chain sit on consecutive rings.
          segmentsOf.set(host, [
            ...(segmentsOf.get(host) ?? []),
            { inner: chain[i], outer: chain[i + 1], depth: depthOf(prerequisite) + i },
          ]);
        }
      }
    }
  }

  const padding = width * LAYOUT.sectorPadding;
  const usable = width - 2 * padding;

  // Borders holding a bridge star, per depth: the stars of both sectors keep clear of it.
  const bridgeDepths = new Map<number, Set<number>>();
  for (const [starId, border] of borderOf) {
    const depths = bridgeDepths.get(border) ?? new Set<number>();
    depths.add(depthOf(byId.get(starId) as Star));
    bridgeDepths.set(border, depths);
  }
  const borderBusy = (border: number, depth: number) =>
    bridgeDepths.get(border)?.has(depth) ?? false;
  const bordersOf = (sector: LayoutSector) => ({
    start: (sector.index - 1 + count) % count,
    end: sector.index,
  });

  // Ring radii: regular steps, widened when a ring holds too much for its arc.
  const ringRadii: number[] = [];
  for (let depth = 1; depth <= maxDepth; depth++) {
    let needed = 0;
    for (const sector of sectors) {
      const ring = rings.get(ringKey(sector.domainId, depth)) ?? [];
      if (ring.length === 0) continue;
      const total = ring.reduce((sum, slot) => sum + slot.weight, 0);
      const smallest = ring.reduce((min, slot) => Math.min(min, slot.weight), 1);
      const { start, end } = bordersOf(sector);
      const reserved =
        count > 1 ? Number(borderBusy(start, depth)) + Number(borderBusy(end, depth)) : 0;
      needed = Math.max(needed, (LAYOUT.minGap * (total - smallest + reserved)) / usable);
    }
    const regular = LAYOUT.firstRing + (depth - 1) * LAYOUT.ringStep;
    const previous = depth > 1 ? ringRadii[depth - 2] + LAYOUT.ringStep : 0;
    ringRadii.push(round(Math.max(regular, needed, previous)));
  }

  /** Free arc of a ring: the sector minus its padding and minus busy borders. */
  const arcOf = (sector: LayoutSector, depth: number) => {
    const clearance = LAYOUT.minGap / ringRadii[depth - 1];
    const { start, end } = bordersOf(sector);
    let low = sector.startAngle + padding;
    let high = sector.endAngle - padding;
    if (count > 1 && borderBusy(start, depth)) low = Math.max(low, sector.startAngle + clearance);
    if (count > 1 && borderBusy(end, depth)) high = Math.min(high, sector.endAngle - clearance);
    if (low > high) low = high = sector.midAngle;
    return { low, high };
  };

  const gapsOf = (ring: Slot[], depth: number) =>
    ring
      .slice(0, -1)
      .map(
        (slot, i) =>
          (LAYOUT.minGap * (slot.weight + ring[i + 1].weight)) / 2 / ringRadii[depth - 1],
      );

  const angleOf = new Map<string, number>();
  for (const [starId, border] of borderOf) angleOf.set(starId, sectors[border].endAngle);

  const angleIn = (id: string, sector: LayoutSector) =>
    unwrap(angleOf.get(id) as number, sector.midAngle);

  /** Re-spreads a ring in its current order, each slot as close as possible to `targets`. */
  const spread = (sector: LayoutSector, depth: number, ring: Slot[], targets: number[]) => {
    const { low, high } = arcOf(sector, depth);
    const angles = placeOnArc(targets, gapsOf(ring, depth), low, high);
    ring.forEach((slot, index) => angleOf.set(slot.id, angles[index]));
  };

  const outwards = Array.from({ length: maxDepth }, (_, index) => index + 1);
  const inwards = [...outwards].reverse();

  // Sectors only meet through bridge stars, whose place is fixed: each sector
  // is arranged on its own.
  for (const sector of sectors) {
    const ringsHere = outwards
      .map((depth) => ({ depth, key: ringKey(sector.domainId, depth) }))
      .filter(({ key }) => (rings.get(key)?.length ?? 0) > 0);
    if (ringsHere.length === 0) continue;

    // Two segments between the same rings cross when their ends are in opposite orders.
    const byDepth = new Map<number, Segment[]>();
    for (const segment of segmentsOf.get(sector.domainId) ?? []) {
      byDepth.set(segment.depth, [...(byDepth.get(segment.depth) ?? []), segment]);
    }
    // Counted as inversions: sorted by inner angle, every pair whose outer angles
    // come in the opposite order is a crossing (segments sharing an end never are).
    const crossingsBetween = (depth: number): number => {
      const list = byDepth.get(depth);
      if (!list || list.length < 2) return 0;
      const pairs = list
        .map((segment) => [angleIn(segment.inner, sector), angleIn(segment.outer, sector)])
        .sort((p, q) => p[0] - q[0] || p[1] - q[1]);
      return countInversions(pairs.map((pair) => pair[1]));
    };
    const around = (depth: number) => crossingsBetween(depth - 1) + crossingsBetween(depth);
    const totalCrossings = () => outwards.reduce((sum, depth) => sum + crossingsBetween(depth), 0);

    // Barycentre sweep: each slot aims at the average angle of its neighbours.
    const sweep = (depths: number[], neighboursOf: Map<string, string[]>) => {
      for (const depth of depths) {
        const ring = rings.get(ringKey(sector.domainId, depth));
        if (!ring || ring.length === 0) continue;
        const target = new Map<string, number>();
        for (const slot of ring) {
          const neighbours = neighboursOf.get(slot.id) ?? [];
          target.set(
            slot.id,
            neighbours.length > 0
              ? neighbours.reduce((sum, id) => sum + angleIn(id, sector), 0) / neighbours.length
              : angleIn(slot.id, sector),
          );
        }
        ring.sort(
          (a, b) =>
            (target.get(a.id) as number) - (target.get(b.id) as number) ||
            angleIn(a.id, sector) - angleIn(b.id, sector) ||
            compareText(a.key, b.key) ||
            compareText(a.id, b.id),
        );
        spread(sector, depth, ring, ring.map((slot) => target.get(slot.id) as number));
      }
    };

    // "Sifting": each slot in turn tries every position of its ring (the ring
    // keeps the same set of angles, only their owners change); the order with
    // the fewest crossings wins, ties keeping the current one.
    const sift = () => {
      for (let round_ = 0; round_ < LAYOUT.swapRounds; round_++) {
        let improved = false;
        for (const { depth, key } of ringsHere) {
          let ring = rings.get(key) as Slot[];
          if (ring.length < 2) continue;
          const angles = ring.map((slot) => angleOf.get(slot.id) as number);
          const apply = (order: Slot[]) =>
            order.forEach((slot, index) => angleOf.set(slot.id, angles[index]));
          for (const slot of [...ring]) {
            const current = ring;
            const from = current.indexOf(slot);
            const others = current.filter((other) => other !== slot);
            let best = current;
            let bestScore = around(depth);
            const first = Math.max(0, from - LAYOUT.siftWindow);
            const last = Math.min(others.length, from + LAYOUT.siftWindow);
            for (let position = first; position <= last; position++) {
              const candidate = [...others.slice(0, position), slot, ...others.slice(position)];
              if (candidate.every((other, index) => other === current[index])) continue;
              apply(candidate);
              const score = around(depth);
              if (score < bestScore) {
                best = candidate;
                bestScore = score;
              }
            }
            if (best !== current) improved = true;
            ring = best;
            apply(ring);
          }
          rings.set(key, ring);
          spread(sector, depth, ring, ring.map((slot) => angleOf.get(slot.id) as number));
        }
        if (!improved) break;
      }
    };

    /** Full arrangement from a starting order; returns the crossings left. */
    const arrange = (reversed: boolean): number => {
      for (const { depth, key } of ringsHere) {
        const ring = rings.get(key) as Slot[];
        ring.sort((a, b) => compareText(a.key, b.key) || compareText(a.id, b.id));
        if (reversed) ring.reverse();
        const { low, high } = arcOf(sector, depth);
        ring.forEach((slot, index) => {
          angleOf.set(slot.id, low + ((high - low) * (index + 0.5)) / ring.length);
        });
      }
      for (let pass = 0; pass < LAYOUT.sweeps; pass++) {
        if (pass % 2 === 0) sweep(outwards, inward);
        else sweep(inwards, outward);
      }
      sift();
      return totalCrossings();
    };

    // Two starting points (creation order and its reverse): the barycentre
    // method can get stuck depending on where it starts, so the best result wins.
    const snapshot = () =>
      ringsHere.map(({ key }) => {
        const ring = [...(rings.get(key) as Slot[])];
        return { key, ring, angles: ring.map((slot) => angleOf.get(slot.id) as number) };
      });
    const firstScore = arrange(false);
    const size = ringsHere.reduce((sum, { key }) => sum + (rings.get(key) as Slot[]).length, 0);
    if (firstScore === 0 || size > LAYOUT.restartLimit) continue;
    const first = snapshot();
    const secondScore = arrange(true);
    if (firstScore <= secondScore) {
      for (const { key, ring, angles } of first) {
        rings.set(key, ring);
        ring.forEach((slot, index) => angleOf.set(slot.id, angles[index]));
      }
    }
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

  const pointOf = (id: string): Point => {
    const node = nodeOf.get(id);
    if (node) return { x: node.x, y: node.y };
    // A waypoint: "<line>#<depth>".
    const depth = Number(id.slice(id.lastIndexOf("#") + 1));
    return polar(angleOf.get(id) as number, ringRadii[depth - 1]);
  };

  const links: LayoutLink[] = [];
  let threads = 0;
  for (const star of placed) {
    const node = nodeOf.get(star.id) as LayoutNode;
    let attached = false;
    for (const prerequisite of prerequisitesOf(star)) {
      if (isStraight(star, prerequisite)) attached = true;
    }
    for (const prerequisite of drawnPrerequisites.get(star.id) ?? []) {
      const id = `${prerequisite.id}>${star.id}`;
      if (isStraight(star, prerequisite)) {
        const points = (chains.get(id) ?? [prerequisite.id, star.id]).map(pointOf);
        links.push({
          id,
          kind: "branch",
          fromId: prerequisite.id,
          toId: star.id,
          points,
          path: smoothPath(points),
        });
      } else {
        const lane = outerRadius + LAYOUT.threadMargin + threads * LAYOUT.threadGap;
        threads += 1;
        const points = threadPoints(nodeOf.get(prerequisite.id) as LayoutNode, node, lane);
        links.push({
          id,
          kind: "cross",
          fromId: prerequisite.id,
          toId: star.id,
          points,
          path: `M${points.map((point) => `${point.x},${point.y}`).join("L")}`,
        });
      }
    }
    if (!attached) {
      const points = [polar(node.angle, LAYOUT.coreRadius), { x: node.x, y: node.y }];
      links.push({
        id: `centre>${star.id}`,
        kind: "trunk",
        fromId: null,
        toId: star.id,
        points,
        path: smoothPath(points),
      });
    }
  }

  return { sectors, nodes, links, ringRadii, outerRadius };
}

/** Thread between two stars that swings out to `lane` instead of crossing the centre. */
function threadPoints(from: LayoutNode, to: LayoutNode, lane: number): Point[] {
  let delta = (to.angle - from.angle) % TAU;
  if (delta > Math.PI) delta -= TAU;
  if (delta <= -Math.PI) delta += TAU;
  const bulge = lane - (from.radius + to.radius) / 2;
  const steps = 48;
  const points: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = from.angle + delta * t;
    const radius = from.radius + (to.radius - from.radius) * t + bulge * Math.sin(Math.PI * t);
    points.push(polar(angle, radius));
  }
  return points;
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
