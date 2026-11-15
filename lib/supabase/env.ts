export interface SupabaseEnv {
  url: string;
  key: string;
}

/**
 * Supabase settings from `.env.local`, or null when the project is not configured yet.
 * The app then runs in demo mode only.
 */
export function getSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}
