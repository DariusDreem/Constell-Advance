const numberFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export const formatNumber = (value: number): string => numberFormat.format(value);

export const formatDate = (iso: string): string => dateFormat.format(new Date(iso));

/** "7 500 / 15 000 €" */
export function formatGoal(current: number | null, target: number, unit: string | null): string {
  const suffix = unit ? ` ${unit}` : "";
  return `${formatNumber(current ?? 0)} / ${formatNumber(target)}${suffix}`;
}

/** Parses "7 500,5" or "7500.5"; returns null when the text is not a number. */
export function parseNumber(text: string): number | null {
  const cleaned = text.replace(/[\s  ]/g, "").replace(",", ".");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}
