export type Tier = "major" | "minor";

export type StarStatus = "achieved" | "available" | "locked";

export interface Domain {
  id: string;
  name: string;
  /** Hex colour, e.g. "#a78bfa". */
  color: string;
  /** Angular order around the centre, ascending. */
  position: number;
}

export interface Star {
  id: string;
  domainId: string;
  /** Optional second domain: the star then acts as a bridge between two branches. */
  secondaryDomainId: string | null;
  title: string;
  description: string;
  tier: Tier;
  /** ISO date when the milestone was reached, null while it is still pending. */
  achievedAt: string | null;
  /** Optional numeric goal: current / target, with a unit. */
  currentValue: number | null;
  targetValue: number | null;
  unit: string | null;
  createdAt: string;
  prerequisiteIds: string[];
}

export interface AccountUser {
  id: string;
  email: string;
}
