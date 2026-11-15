import type { Domain, Star } from "./constellation/types";

/** Sample sky shown to visitors who are not signed in. Nothing here is saved. */

const domainId = (n: number) => `00000000-0000-4000-8000-0000000000d${n}`;
const starId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const CREATIVE = domainId(1);
const WORK = domainId(2);
const MONEY = domainId(3);
const SPORT = domainId(4);
const LIFE = domainId(5);

export const DEMO_DOMAINS: Domain[] = [
  { id: CREATIVE, name: "Créatif", color: "#c4a5ff", position: 0 },
  { id: WORK, name: "Professionnel", color: "#7dd3fc", position: 1 },
  { id: MONEY, name: "Financier", color: "#fcd34d", position: 2 },
  { id: SPORT, name: "Sportif", color: "#fb7185", position: 3 },
  { id: LIFE, name: "Personnel", color: "#6ee7b7", position: 4 },
];

interface Seed {
  n: number;
  domain: string;
  title: string;
  description?: string;
  major?: boolean;
  done?: string;
  after?: number[];
  with?: string;
  goal?: { current: number; target: number; unit: string };
}

const SEEDS: Seed[] = [
  // Créatif
  { n: 1, domain: CREATIVE, title: "Premier carnet rempli", done: "2025-02-10", major: true },
  { n: 2, domain: CREATIVE, title: "30 jours de croquis", done: "2025-04-02", after: [1] },
  { n: 3, domain: CREATIVE, title: "Première toile à l'huile", done: "2025-07-19", after: [2], major: true },
  { n: 4, domain: CREATIVE, title: "Série de 10 toiles", after: [3], goal: { current: 6, target: 10, unit: "toiles" } },
  { n: 5, domain: CREATIVE, title: "Exposition locale", after: [4], major: true },
  { n: 6, domain: CREATIVE, title: "Apprendre la photo argentique", done: "2025-09-01", after: [1] },
  { n: 7, domain: CREATIVE, title: "Développer mes propres pellicules", after: [6] },

  // Professionnel
  { n: 10, domain: WORK, title: "Premier poste", done: "2024-09-01", major: true },
  { n: 11, domain: WORK, title: "Mener un projet de bout en bout", done: "2025-05-15", after: [10] },
  { n: 12, domain: WORK, title: "Certification obtenue", after: [10] },
  { n: 13, domain: WORK, title: "Passer lead", after: [11, 12], major: true },
  { n: 14, domain: WORK, title: "Donner une conférence", after: [11] },
  {
    n: 15,
    domain: CREATIVE,
    with: WORK,
    title: "Vendre ma première création",
    description: "Un palier à cheval sur deux domaines : il se place sur leur frontière.",
    after: [3, 11],
    major: true,
  },

  // Financier
  { n: 20, domain: MONEY, title: "Budget mensuel tenu 3 mois", done: "2025-03-31", major: true },
  { n: 21, domain: MONEY, title: "Fonds d'urgence", done: "2025-08-30", after: [20], goal: { current: 3000, target: 3000, unit: "€" } },
  {
    n: 22,
    domain: MONEY,
    title: "15 000 € d'épargne",
    description: "Un palier chiffré : mets à jour la valeur actuelle et l'anneau se remplit.",
    after: [21],
    major: true,
    goal: { current: 7500, target: 15000, unit: "€" },
  },
  { n: 23, domain: MONEY, title: "Premier investissement", after: [21] },
  { n: 24, domain: MONEY, title: "Apport pour un achat", after: [22, 23], major: true },
  {
    n: 25,
    domain: MONEY,
    with: CREATIVE,
    title: "Financer un stage photo",
    description: "Lié à un domaine non voisin : un fil courbe le relie à l'autre branche.",
    after: [21, 6],
  },

  // Sportif
  { n: 30, domain: SPORT, title: "Courir 5 km sans s'arrêter", done: "2025-03-08", major: true },
  { n: 31, domain: SPORT, title: "10 km en moins d'une heure", done: "2025-06-21", after: [30] },
  { n: 32, domain: SPORT, title: "Semi-marathon", after: [31], major: true, goal: { current: 14, target: 21, unit: "km" } },
  { n: 33, domain: SPORT, title: "Marathon", after: [32], major: true },
  { n: 34, domain: SPORT, title: "10 tractions d'affilée", after: [30], goal: { current: 4, target: 10, unit: "tractions" } },

  // Personnel
  { n: 40, domain: LIFE, title: "Lire 12 livres dans l'année", major: true, goal: { current: 9, target: 12, unit: "livres" } },
  { n: 41, domain: LIFE, title: "Bénévolat régulier", done: "2025-05-04", major: true },
  { n: 42, domain: LIFE, title: "Voyager seul", after: [41] },
  { n: 43, domain: LIFE, title: "Parler espagnol couramment", after: [42], major: true },
  {
    n: 44,
    domain: SPORT,
    with: LIFE,
    title: "Courir pour une association",
    after: [31, 41],
  },
];

export const DEMO_STARS: Star[] = SEEDS.map((seed, index) => ({
  id: starId(seed.n),
  domainId: seed.domain,
  secondaryDomainId: seed.with ?? null,
  title: seed.title,
  description: seed.description ?? "",
  tier: seed.major ? "major" : "minor",
  achievedAt: seed.done ? `${seed.done}T12:00:00.000Z` : null,
  currentValue: seed.goal?.current ?? null,
  targetValue: seed.goal?.target ?? null,
  unit: seed.goal?.unit ?? null,
  createdAt: `2025-01-01T00:${String(index).padStart(2, "0")}:00.000Z`,
  prerequisiteIds: (seed.after ?? []).map(starId),
}));
