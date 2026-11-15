import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountUser } from "@/lib/constellation/types";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { NOT_CONFIGURED } from "./types";

type Session =
  | { ok: true; supabase: SupabaseClient; user: AccountUser }
  | { ok: false; error: string };

/** Every Server Action starts here: no signed-in user, no write. */
export async function requireUser(): Promise<Session> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: NOT_CONFIGURED };
  const user = await getSessionUser(supabase);
  if (!user) return { ok: false, error: "Ta session a expiré : reconnecte-toi." };
  return { ok: true, supabase, user };
}

export const SAVE_FAILED = "L'enregistrement a échoué. Réessaie dans un instant.";
