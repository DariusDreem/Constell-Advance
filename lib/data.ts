import "server-only";
import { connection } from "next/server";
import type { AccountUser, Domain, Star, Tier } from "@/lib/constellation/types";
import { DEMO_DOMAINS, DEMO_STARS } from "@/lib/demo";
import { createClient, getSessionUser } from "@/lib/supabase/server";

export interface ConstellationData {
  /** demo: sample sky kept in memory. live: the signed-in user's sky, saved in Supabase. */
  mode: "demo" | "live";
  user: AccountUser | null;
  domains: Domain[];
  stars: Star[];
  loadError: string | null;
}

interface DomainRow {
  id: string;
  name: string;
  color: string;
  position: number;
}

interface StarRow {
  id: string;
  domain_id: string;
  secondary_domain_id: string | null;
  title: string;
  description: string;
  tier: Tier;
  achieved_at: string | null;
  current_value: number | null;
  target_value: number | null;
  unit: string | null;
  created_at: string;
}

interface LinkRow {
  star_id: string;
  prerequisite_id: string;
}

const demo = (): ConstellationData => ({
  mode: "demo",
  user: null,
  domains: DEMO_DOMAINS,
  stars: DEMO_STARS,
  loadError: null,
});

const iso = (value: string): string => new Date(value).toISOString();

/** Loads the signed-in user's sky, or the demo sky for visitors. */
export async function loadConstellation(): Promise<ConstellationData> {
  // The Supabase client reads the clock (token expiry) as soon as it starts,
  // which Next.js forbids while prerendering: wait for the real request first.
  await connection();
  const supabase = await createClient();
  if (!supabase) return demo();
  const user = await getSessionUser(supabase);
  if (!user) return demo();

  const [domains, stars, links] = await Promise.all([
    supabase.from("domains").select("id, name, color, position").order("position"),
    supabase
      .from("stars")
      .select(
        "id, domain_id, secondary_domain_id, title, description, tier, achieved_at, current_value, target_value, unit, created_at",
      )
      .order("created_at"),
    supabase.from("star_prerequisites").select("star_id, prerequisite_id"),
  ]);

  if (domains.error || stars.error || links.error) {
    return {
      mode: "live",
      user,
      domains: [],
      stars: [],
      loadError:
        "Impossible de charger ton ciel. Vérifie que la migration SQL a bien été exécutée dans Supabase.",
    };
  }

  const prerequisitesOf = new Map<string, string[]>();
  for (const link of links.data as LinkRow[]) {
    const list = prerequisitesOf.get(link.star_id) ?? [];
    list.push(link.prerequisite_id);
    prerequisitesOf.set(link.star_id, list);
  }

  return {
    mode: "live",
    user,
    domains: (domains.data as DomainRow[]).map((row) => ({ ...row })),
    stars: (stars.data as StarRow[]).map((row) => ({
      id: row.id,
      domainId: row.domain_id,
      secondaryDomainId: row.secondary_domain_id,
      title: row.title,
      description: row.description,
      tier: row.tier,
      achievedAt: row.achieved_at ? iso(row.achieved_at) : null,
      currentValue: row.current_value,
      targetValue: row.target_value,
      unit: row.unit,
      createdAt: iso(row.created_at),
      prerequisiteIds: prerequisitesOf.get(row.id) ?? [],
    })),
    loadError: null,
  };
}
