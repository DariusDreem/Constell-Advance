import { describe, expect, it } from "vitest";
import { computeLayout, domainAtPoint, LAYOUT } from "../lib/constellation/layout";
import {
  applyProgress,
  computeStatuses,
  progressRatio,
  wouldCreateCycle,
} from "../lib/constellation/status";
import type { Domain, Star } from "../lib/constellation/types";
import { DEMO_DOMAINS, DEMO_STARS } from "../lib/demo";

const domains: Domain[] = ["a", "b", "c", "d", "e"].map((id, position) => ({
  id,
  name: id.toUpperCase(),
  color: "#ffffff",
  position,
}));

let clock = 0;
function star(id: string, domainId: string, extra: Partial<Star> = {}): Star {
  clock += 1;
  return {
    id,
    domainId,
    secondaryDomainId: null,
    title: id,
    description: "",
    tier: "minor",
    achievedAt: null,
    currentValue: null,
    targetValue: null,
    unit: null,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, clock)).toISOString(),
    prerequisiteIds: [],
    ...extra,
  };
}

const node = (layout: ReturnType<typeof computeLayout>, id: string) => {
  const found = layout.nodes.find((n) => n.starId === id);
  if (!found) throw new Error(`no node ${id}`);
  return found;
};

describe("computeLayout", () => {
  it("is deterministic and independent of input order", () => {
    const first = computeLayout(DEMO_DOMAINS, DEMO_STARS);
    const again = computeLayout(DEMO_DOMAINS, DEMO_STARS);
    const shuffled = computeLayout([...DEMO_DOMAINS].reverse(), [...DEMO_STARS].reverse());
    expect(again).toEqual(first);
    expect(shuffled).toEqual(first);
  });

  it("gives each domain an equal sector, the first one pointing up", () => {
    const layout = computeLayout(domains, []);
    expect(layout.sectors).toHaveLength(5);
    expect(layout.sectors[0].midAngle).toBeCloseTo(-Math.PI / 2);
    for (const sector of layout.sectors) {
      expect(sector.endAngle - sector.startAngle).toBeCloseTo((Math.PI * 2) / 5);
    }
    expect(layout.nodes).toEqual([]);
  });

  it("places stars farther from the centre than their prerequisites, inside their sector", () => {
    const stars = [
      star("root", "b"),
      star("child1", "b", { prerequisiteIds: ["root"] }),
      star("child2", "b", { prerequisiteIds: ["root"] }),
      star("leaf", "b", { prerequisiteIds: ["child1", "child2"] }),
    ];
    const layout = computeLayout(domains, stars);
    const sector = layout.sectors[1];

    expect(node(layout, "root").depth).toBe(1);
    expect(node(layout, "child1").depth).toBe(2);
    expect(node(layout, "leaf").depth).toBe(3);
    expect(node(layout, "child1").radius).toBeGreaterThan(node(layout, "root").radius);
    expect(node(layout, "leaf").radius).toBeGreaterThan(node(layout, "child2").radius);
    for (const n of layout.nodes) {
      expect(n.angle).toBeGreaterThan(sector.startAngle);
      expect(n.angle).toBeLessThan(sector.endAngle);
    }
    // Siblings are spread apart by at least the minimum gap.
    const gap = Math.abs(node(layout, "child1").angle - node(layout, "child2").angle);
    expect(gap * node(layout, "child1").radius).toBeGreaterThanOrEqual(LAYOUT.minGap - 0.5);
  });

  it("links roots to the centre and other stars to their prerequisites", () => {
    const stars = [star("root", "a"), star("next", "a", { prerequisiteIds: ["root"] })];
    const layout = computeLayout(domains, stars);
    expect(layout.links.map((l) => [l.kind, l.fromId, l.toId])).toEqual([
      ["trunk", null, "root"],
      ["branch", "root", "next"],
    ]);
  });

  it("puts a bridge star on the border of two neighbouring domains", () => {
    const stars = [
      star("a1", "a"),
      star("b1", "b"),
      star("bridge", "a", { secondaryDomainId: "b", prerequisiteIds: ["a1", "b1"] }),
      star("wrap", "a", { secondaryDomainId: "e" }),
    ];
    const layout = computeLayout(domains, stars);

    const bridge = node(layout, "bridge");
    expect(bridge.onBorder).toBe(true);
    expect(bridge.angle).toBeCloseTo(layout.sectors[0].endAngle);
    expect(bridge.depth).toBe(2);
    const kinds = layout.links.filter((l) => l.toId === "bridge").map((l) => l.kind);
    expect(kinds).toEqual(["branch", "branch"]);

    // The first and last domains are neighbours too.
    const wrap = node(layout, "wrap");
    expect(wrap.onBorder).toBe(true);
    expect(Math.cos(wrap.angle)).toBeCloseTo(Math.cos(layout.sectors[0].startAngle));
    expect(Math.sin(wrap.angle)).toBeCloseTo(Math.sin(layout.sectors[0].startAngle));
  });

  it("keeps a star in its branch and draws a thread when the domains are not neighbours", () => {
    const stars = [
      star("a1", "a"),
      star("c1", "c"),
      star("far", "a", { secondaryDomainId: "c", prerequisiteIds: ["a1", "c1"] }),
    ];
    const layout = computeLayout(domains, stars);
    const far = node(layout, "far");
    const sector = layout.sectors[0];

    expect(far.onBorder).toBe(false);
    expect(far.angle).toBeGreaterThan(sector.startAngle);
    expect(far.angle).toBeLessThan(sector.endAngle);

    const thread = layout.links.find((l) => l.fromId === "c1" && l.toId === "far");
    expect(thread?.kind).toBe("cross");
    // The thread goes around the outside: its farthest point is beyond the outer radius.
    const points = (thread?.path ?? "").slice(1).split("L").map((p) => p.split(",").map(Number));
    const reach = Math.max(...points.map(([x, y]) => Math.hypot(x, y)));
    expect(reach).toBeGreaterThan(layout.outerRadius);
  });

  it("ignores stars whose domain no longer exists and survives a loop in the data", () => {
    const stars = [
      star("orphan", "zzz"),
      star("x", "a", { prerequisiteIds: ["y"] }),
      star("y", "a", { prerequisiteIds: ["x"] }),
    ];
    const layout = computeLayout(domains, stars);
    expect(layout.nodes.map((n) => n.starId).sort()).toEqual(["x", "y"]);
    for (const n of layout.nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    }
  });

  it("finds the domain under a point", () => {
    const layout = computeLayout(domains, []);
    expect(domainAtPoint(layout, 0, -200)).toBe("a");
    expect(domainAtPoint(layout, 0, 0)).toBeNull();
    expect(domainAtPoint(layout, 0, -(layout.outerRadius + 500))).toBeNull();
    const second = layout.sectors[1];
    expect(domainAtPoint(layout, Math.cos(second.midAngle) * 200, Math.sin(second.midAngle) * 200)).toBe("b");
  });
});

describe("statuses", () => {
  it("locks a star until all its prerequisites are achieved", () => {
    const stars = [
      star("done", "a", { achievedAt: "2026-01-01T00:00:00.000Z" }),
      star("open", "a", { prerequisiteIds: ["done"] }),
      star("pending", "a"),
      star("locked", "a", { prerequisiteIds: ["done", "pending"] }),
    ];
    const statuses = computeStatuses(stars);
    expect(statuses.get("done")).toBe("achieved");
    expect(statuses.get("open")).toBe("available");
    expect(statuses.get("pending")).toBe("available");
    expect(statuses.get("locked")).toBe("locked");
  });

  it("computes the progress of a numeric goal", () => {
    expect(progressRatio({ currentValue: 7500, targetValue: 15000 })).toBe(0.5);
    expect(progressRatio({ currentValue: 20000, targetValue: 15000 })).toBe(1);
    expect(progressRatio({ currentValue: null, targetValue: 10 })).toBe(0);
    expect(progressRatio({ currentValue: 3, targetValue: null })).toBeNull();
  });

  it("validates a numeric star when the target is reached, unless it is locked", () => {
    const goal = star("goal", "a", { currentValue: 5, targetValue: 10 });
    const now = "2026-06-01T00:00:00.000Z";
    expect(applyProgress(goal, 7, false, now).achievedAt).toBeNull();
    expect(applyProgress(goal, 10, false, now).achievedAt).toBe(now);
    expect(applyProgress(goal, 12, true, now).achievedAt).toBeNull();
    expect(applyProgress(goal, 12, true, now).currentValue).toBe(12);
  });

  it("refuses prerequisites that would create a loop", () => {
    const stars = [
      star("a1", "a"),
      star("a2", "a", { prerequisiteIds: ["a1"] }),
      star("a3", "a", { prerequisiteIds: ["a2"] }),
    ];
    expect(wouldCreateCycle(stars, "a1", ["a3"])).toBe(true);
    expect(wouldCreateCycle(stars, "a1", ["a1"])).toBe(true);
    expect(wouldCreateCycle(stars, "a3", ["a1"])).toBe(false);
    expect(wouldCreateCycle(stars, "new", ["a3"])).toBe(false);
  });
});
