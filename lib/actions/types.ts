export type ActionResult = { ok: true } | { ok: false; error: string };

export interface AuthState {
  error: string | null;
  notice: string | null;
}

export const NOT_CONFIGURED =
  "Supabase n'est pas encore configuré : ajoute tes clés dans .env.local puis relance le site.";
