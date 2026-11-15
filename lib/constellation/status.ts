import type { Star, StarStatus } from "./types";

/**
 * Skill-tree logic: a star is achieved once validated, available when every
 * prerequisite is achieved, locked otherwise. Unknown prerequisite ids are ignored.
 */
export function computeStatuses(stars: Star[]): Map<string, StarStatus> {
  const byId = new Map(stars.map((star) => [star.id, star]));
  const statuses = new Map<string, StarStatus>();
  for (const star of stars) {
    if (star.achievedAt !== null) {
      statuses.set(star.id, "achieved");
      continue;
    }
    const unlocked = star.prerequisiteIds.every((id) => {
      const prerequisite = byId.get(id);
      return !prerequisite || prerequisite.achievedAt !== null;
    });
    statuses.set(star.id, unlocked ? "available" : "locked");
  }
  return statuses;
}

/** Progress of a numeric goal between 0 and 1, or null when the star has no numeric goal. */
export function progressRatio(star: Pick<Star, "currentValue" | "targetValue">): number | null {
  if (star.targetValue === null || star.targetValue <= 0) return null;
  const ratio = (star.currentValue ?? 0) / star.targetValue;
  return Math.min(1, Math.max(0, ratio));
}

/**
 * True when giving `starId` the prerequisites `prerequisiteIds` would create a loop
 * (the star would end up, directly or not, being its own prerequisite).
 */
export function wouldCreateCycle(
  stars: Pick<Star, "id" | "prerequisiteIds">[],
  starId: string,
  prerequisiteIds: string[],
): boolean {
  const byId = new Map(stars.map((star) => [star.id, star]));
  const seen = new Set<string>();
  const stack = [...prerequisiteIds];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (id === starId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    const star = byId.get(id);
    if (star) stack.push(...star.prerequisiteIds);
  }
  return false;
}

/**
 * For each star, every star it depends on, directly or through a chain of
 * prerequisites. Loops in the data are tolerated (a star never lists itself).
 */
export function computeAncestors(
  stars: Pick<Star, "id" | "prerequisiteIds">[],
): Map<string, Set<string>> {
  const byId = new Map(stars.map((star) => [star.id, star]));
  const memo = new Map<string, Set<string>>();
  const visiting = new Set<string>();
  const visit = (id: string): Set<string> => {
    const known = memo.get(id);
    if (known) return known;
    const result = new Set<string>();
    if (visiting.has(id)) return result;
    visiting.add(id);
    for (const prerequisiteId of byId.get(id)?.prerequisiteIds ?? []) {
      if (!byId.has(prerequisiteId) || prerequisiteId === id) continue;
      result.add(prerequisiteId);
      for (const ancestor of visit(prerequisiteId)) if (ancestor !== id) result.add(ancestor);
    }
    visiting.delete(id);
    memo.set(id, result);
    return result;
  };
  for (const star of stars) visit(star.id);
  return memo;
}

/**
 * Among `prerequisiteIds`, the ones already required through another of them:
 * maps each implied prerequisite to the one that implies it. If C needs A and B,
 * and B already needs A, then A is implied by B.
 */
export function impliedPrerequisites(
  ancestors: Map<string, Set<string>>,
  prerequisiteIds: string[],
): Map<string, string> {
  const implied = new Map<string, string>();
  for (const id of prerequisiteIds) {
    const via = prerequisiteIds.find((other) => other !== id && ancestors.get(other)?.has(id));
    if (via) implied.set(id, via);
  }
  return implied;
}

/**
 * Applies a new numeric value. The star is validated automatically when the value
 * reaches the target, but only if it is not locked.
 */
export function applyProgress(star: Star, value: number, locked: boolean, now: string): Star {
  const reached = star.targetValue !== null && value >= star.targetValue;
  const achievedAt = star.achievedAt ?? (reached && !locked ? now : null);
  return { ...star, currentValue: value, achievedAt };
}
