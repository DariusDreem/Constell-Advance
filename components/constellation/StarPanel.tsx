"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CheckIcon, CloseIcon, LockIcon, PencilIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { progressRatio } from "@/lib/constellation/status";
import type { Domain, Star, StarStatus } from "@/lib/constellation/types";
import { formatDate, formatGoal, formatNumber, parseNumber } from "@/lib/format";
import { STATUS_LABEL } from "./StarNode";

interface StarPanelProps {
  star: Star;
  status: StarStatus;
  domains: Domain[];
  stars: Star[];
  statuses: Map<string, StarStatus>;
  onClose: () => void;
  onSelect: (id: string) => void;
  onToggleAchieved: () => void;
  onProgress: (value: number) => void;
  onEdit: () => void;
  onAddAfter: () => void;
  onDelete: () => void;
}

/** Small window shown next to a star: status, numeric progress, prerequisites, actions. */
export function StarPanel({
  star,
  status,
  domains,
  stars,
  statuses,
  onClose,
  onSelect,
  onToggleAchieved,
  onProgress,
  onEdit,
  onAddAfter,
  onDelete,
}: StarPanelProps) {
  const [draft, setDraft] = useState(star.currentValue === null ? "" : String(star.currentValue));
  const [invalid, setInvalid] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const domain = domains.find((d) => d.id === star.domainId);
  const secondary = domains.find((d) => d.id === star.secondaryDomainId);
  const color = domain?.color ?? "#fff";
  const ratio = progressRatio(star);
  const prerequisites = stars.filter((other) => star.prerequisiteIds.includes(other.id));
  const unlocks = stars.filter((other) => other.prerequisiteIds.includes(star.id));
  const missing = prerequisites.filter((other) => other.achievedAt === null);
  const achievedDependents = unlocks.filter((other) => other.achievedAt !== null);

  const submitProgress = (event: FormEvent) => {
    event.preventDefault();
    const value = parseNumber(draft);
    if (value === null || value < 0) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onProgress(value);
  };

  return (
    <section
      role="dialog"
      aria-label={`Palier : ${star.title}`}
      className="glass flex min-h-0 w-full flex-col rounded-2xl shadow-[0_18px_50px_rgb(0_0_0/0.55)]"
    >
      <header className="flex shrink-0 items-center justify-between gap-2 px-4 pt-3">
        <StatusBadge status={status} />
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="grid h-7 w-7 place-items-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <CloseIcon width={14} height={14} />
        </button>
      </header>

      <div className="scroll-thin flex min-h-0 flex-col gap-4 overflow-y-auto px-4 py-3">
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-lg leading-snug font-semibold text-white">{star.title}</h2>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {domain && <DomainChip domain={domain} />}
            {secondary && <DomainChip domain={secondary} />}
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-white/55">
              {star.tier === "major" ? "Palier majeur" : "Palier"}
            </span>
          </div>
          {star.description && (
            <p className="text-sm leading-relaxed whitespace-pre-line text-white/75">{star.description}</p>
          )}
        </div>

        {ratio !== null && star.targetValue !== null && (
          <section className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-white">
                {formatGoal(star.currentValue, star.targetValue, star.unit)}
              </span>
              <span className="text-sm text-white/60 tabular-nums">{formatNumber(Math.round(ratio * 100))} %</span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(ratio * 100)}
              className="h-2 overflow-hidden rounded-full bg-white/10"
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${ratio * 100}%`,
                  background: `linear-gradient(90deg, ${color}88, ${color})`,
                  boxShadow: `0 0 12px ${color}`,
                  transition: "width 0.5s ease",
                }}
              />
            </div>
            <form onSubmit={submitProgress} className="mt-1.5 flex gap-2">
              <input
                className="field"
                inputMode="decimal"
                value={draft}
                aria-label="Valeur actuelle"
                placeholder="Valeur actuelle"
                onChange={(event) => setDraft(event.target.value)}
              />
              <button type="submit" className="btn btn-ghost shrink-0">
                Mettre à jour
              </button>
            </form>
            {invalid && <p className="text-xs text-rose-200">Entre un nombre positif.</p>}
          </section>
        )}

        <section className="flex flex-col gap-2">
          {status === "achieved" && star.achievedAt && (
            <>
              <p className="flex items-center gap-2 text-sm text-white/85">
                <CheckIcon />
                Atteint le {formatDate(star.achievedAt)}
              </p>
              {achievedDependents.length === 0 ? (
                <button type="button" onClick={onToggleAchieved} className="btn btn-ghost self-start">
                  Annuler la validation
                </button>
              ) : (
                <p className="text-xs leading-relaxed text-white/45">
                  Pour annuler ce palier, annule d&apos;abord :{" "}
                  {achievedDependents.map((other) => other.title).join(", ")}.
                </p>
              )}
            </>
          )}
          {status === "available" && (
            <button type="button" onClick={onToggleAchieved} className="btn btn-primary">
              <CheckIcon />
              Valider ce palier
            </button>
          )}
          {status === "locked" && (
            <p className="flex items-start gap-2 text-sm leading-relaxed text-white/60">
              <LockIcon className="mt-0.5 shrink-0" />
              <span>
                Atteins d&apos;abord : {missing.map((other) => other.title).join(", ")}.
              </span>
            </p>
          )}
        </section>

        {prerequisites.length > 0 && (
          <StarList title="Prérequis" stars={prerequisites} statuses={statuses} domains={domains} onSelect={onSelect} />
        )}
        {unlocks.length > 0 && (
          <StarList title="Débloque" stars={unlocks} statuses={statuses} domains={domains} onSelect={onSelect} />
        )}
      </div>

      <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-white/[0.07] px-4 py-3">
        <button type="button" onClick={onAddAfter} className="btn btn-ghost">
          <PlusIcon width={14} height={14} />
          Palier suivant
        </button>
        <button type="button" onClick={onEdit} className="btn btn-ghost">
          <PencilIcon width={14} height={14} />
          Modifier
        </button>
        {confirming ? (
          <button type="button" onClick={onDelete} className="btn btn-danger ml-auto">
            Supprimer ?
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label="Supprimer ce palier"
            title="Supprimer"
            className="ml-auto grid h-8 w-8 place-items-center rounded-full text-white/45 transition-colors hover:bg-rose-400/15 hover:text-rose-200"
          >
            <TrashIcon />
          </button>
        )}
      </footer>
    </section>
  );
}

function StatusBadge({ status }: { status: StarStatus }) {
  const style =
    status === "achieved"
      ? "bg-white text-[#0b0618] shadow-[0_0_14px_rgb(255_255_255/0.4)]"
      : status === "available"
        ? "border border-white/35 text-white"
        : "border border-white/12 text-white/50";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${style}`}>
      {status === "locked" && <LockIcon width={12} height={12} />}
      {STATUS_LABEL[status]}
    </span>
  );
}

function DomainChip({ domain }: { domain: Domain }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5"
      style={{ background: `${domain.color}1f`, color: domain.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: domain.color }} />
      {domain.name}
    </span>
  );
}

function StarList({
  title,
  stars,
  statuses,
  domains,
  onSelect,
}: {
  title: string;
  stars: Star[];
  statuses: Map<string, StarStatus>;
  domains: Domain[];
  onSelect: (id: string) => void;
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-[11px] font-medium tracking-[0.18em] text-white/40 uppercase">{title}</h3>
      <ul className="flex flex-col gap-0.5">
        {stars.map((star) => {
          const status = statuses.get(star.id) ?? "locked";
          const color = domains.find((d) => d.id === star.domainId)?.color ?? "#fff";
          return (
            <li key={star.id}>
              <button
                type="button"
                onClick={() => onSelect(star.id)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-white/[0.06]"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={
                    status === "achieved"
                      ? { background: "#fff", boxShadow: `0 0 8px ${color}` }
                      : status === "available"
                        ? { border: "1.5px solid rgb(255 255 255 / 0.75)" }
                        : { background: "#716d8a" }
                  }
                />
                <span className={status === "locked" ? "truncate text-white/50" : "truncate text-white/90"}>
                  {star.title}
                </span>
                <span className="ml-auto text-[11px] whitespace-nowrap text-white/35">
                  {STATUS_LABEL[status]}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
