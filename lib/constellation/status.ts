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
 * Applies a new numeric value. The star is validated automatically when the value
 * reaches the target, but only if it is not locked.
 */
export function applyProgress(star: Star, value: number, locked: boolean, now: string): Star {
  const reached = star.targetValue !== null && value >= star.targetValue;
  const achievedAt = star.achievedAt ?? (reached && !locked ? now : null);
  return { ...star, currentValue: value, achievedAt };
}
