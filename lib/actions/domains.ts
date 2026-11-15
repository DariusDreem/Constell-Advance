"use server";

import { domainSchema, idListSchema, idSchema } from "@/lib/validation";
import { requireUser, SAVE_FAILED } from "./session";
import type { ActionResult } from "./types";

const fail = (error: string): ActionResult => ({ ok: false, error });

/** Creates or updates a domain. Row level security keeps it inside the user's own sky. */
export async function saveDomain(input: unknown): Promise<ActionResult> {
  const parsed = domainSchema.safeParse(input);
  if (!parsed.success) return fail("Ce domaine n'est pas valide.");
  const session = await requireUser();
  if (!session.ok) return session;

  const { id, name, color, position } = parsed.data;
  const { error } = await session.supabase
    .from("domains")
    .upsert({ id, user_id: session.user.id, name, color, position });
  return error ? fail(SAVE_FAILED) : { ok: true };
}

/** Deletes a domain and, by cascade, the stars that belong to it. */
export async function deleteDomain(input: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Ce domaine n'est pas valide.");
  const session = await requireUser();
  if (!session.ok) return session;

  const { error } = await session.supabase.from("domains").delete().eq("id", parsed.data);
  return error ? fail(SAVE_FAILED) : { ok: true };
}

/** Stores the order of the domains around the centre. */
export async function reorderDomains(input: unknown): Promise<ActionResult> {
  const parsed = idListSchema.safeParse(input);
  if (!parsed.success) return fail("Cet ordre n'est pas valide.");
  const session = await requireUser();
  if (!session.ok) return session;

  const results = await Promise.all(
    parsed.data.map((id, position) =>
      session.supabase.from("domains").update({ position }).eq("id", id),
    ),
  );
  return results.some((result) => result.error) ? fail(SAVE_FAILED) : { ok: true };
}
