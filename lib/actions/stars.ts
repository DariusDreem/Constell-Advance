"use server";

import { wouldCreateCycle } from "@/lib/constellation/status";
import { idSchema, starSchema } from "@/lib/validation";
import { requireUser, SAVE_FAILED } from "./session";
import type { ActionResult } from "./types";

const fail = (error: string): ActionResult => ({ ok: false, error });

/**
 * Creates or updates a star together with its prerequisites.
 * The skill-tree rules are checked again here, since a Server Action can be
 * called directly: no loops, and no validating a star that is still locked.
 */
export async function saveStar(input: unknown): Promise<ActionResult> {
  const parsed = starSchema.safeParse(input);
  if (!parsed.success) return fail("Ce palier n'est pas valide.");
  const session = await requireUser();
  if (!session.ok) return session;
  const { supabase, user } = session;
  const star = parsed.data;

  const [existing, links] = await Promise.all([
    supabase.from("stars").select("id, achieved_at"),
    supabase.from("star_prerequisites").select("star_id, prerequisite_id"),
  ]);
  if (existing.error || links.error) return fail(SAVE_FAILED);

  const achievedOf = new Map<string, string | null>(
    (existing.data as { id: string; achieved_at: string | null }[]).map((row) => [
      row.id,
      row.achieved_at,
    ]),
  );
  if (star.prerequisiteIds.some((id) => !achievedOf.has(id))) {
    return fail("Un des prérequis n'existe plus.");
  }

  const allLinks = links.data as { star_id: string; prerequisite_id: string }[];
  const prerequisitesOf = new Map<string, string[]>();
  for (const link of allLinks) {
    const list = prerequisitesOf.get(link.star_id) ?? [];
    list.push(link.prerequisite_id);
    prerequisitesOf.set(link.star_id, list);
  }
  const graph = [...achievedOf.keys()].map((id) => ({
    id,
    prerequisiteIds: prerequisitesOf.get(id) ?? [],
  }));
  if (wouldCreateCycle(graph, star.id, star.prerequisiteIds)) {
    return fail("Ces prérequis créeraient une boucle entre les paliers.");
  }

  const isNew = !achievedOf.has(star.id);
  const wasAchieved = !isNew && achievedOf.get(star.id) !== null;
  const previous = new Set(prerequisitesOf.get(star.id) ?? []);
  const wanted = new Set(star.prerequisiteIds);

  if (star.achievedAt !== null) {
    // Validating a star requires all its prerequisites. An already achieved star
    // keeps its status, but cannot gain a prerequisite that is not achieved.
    const blocking = [...wanted].filter(
      (id) => achievedOf.get(id) === null && (!wasAchieved || !previous.has(id)),
    );
    if (blocking.length > 0) {
      return fail("Ce palier est verrouillé : atteins d'abord ses prérequis.");
    }
  } else if (wasAchieved) {
    // Un-validating a star would leave the stars built on it achieved but locked.
    const achievedDependents = allLinks.some(
      (link) => link.prerequisite_id === star.id && achievedOf.get(link.star_id) !== null,
    );
    if (achievedDependents) {
      return fail("Des paliers qui en dépendent sont atteints : annule-les d'abord.");
    }
  }

  const row = {
    domain_id: star.domainId,
    secondary_domain_id: star.secondaryDomainId,
    title: star.title,
    description: star.description,
    tier: star.tier,
    achieved_at: star.achievedAt,
    current_value: star.currentValue,
    target_value: star.targetValue,
    unit: star.unit,
  };
  const written = isNew
    ? await supabase
        .from("stars")
        .insert({ ...row, id: star.id, user_id: user.id, created_at: star.createdAt })
    : await supabase.from("stars").update(row).eq("id", star.id);
  if (written.error) return fail(SAVE_FAILED);

  // Only the links that actually change are touched: if one step fails, the
  // prerequisites that were kept are never lost.
  const removed = [...previous].filter((id) => !wanted.has(id));
  const added = [...wanted].filter((id) => !previous.has(id));
  if (removed.length > 0) {
    const deleted = await supabase
      .from("star_prerequisites")
      .delete()
      .eq("star_id", star.id)
      .in("prerequisite_id", removed);
    if (deleted.error) return fail(SAVE_FAILED);
  }
  if (added.length > 0) {
    const inserted = await supabase.from("star_prerequisites").insert(
      added.map((prerequisiteId) => ({
        star_id: star.id,
        prerequisite_id: prerequisiteId,
        user_id: user.id,
      })),
    );
    if (inserted.error) return fail(SAVE_FAILED);
  }
  return { ok: true };
}

/** Deletes a star; its prerequisite links go with it by cascade. */
export async function deleteStar(input: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Ce palier n'est pas valide.");
  const session = await requireUser();
  if (!session.ok) return session;

  const { error } = await session.supabase.from("stars").delete().eq("id", parsed.data);
  return error ? fail(SAVE_FAILED) : { ok: true };
}
