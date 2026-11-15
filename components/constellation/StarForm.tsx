"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CloseIcon } from "@/components/icons";
import { wouldCreateCycle } from "@/lib/constellation/status";
import type { Domain, Star, Tier } from "@/lib/constellation/types";
import { parseNumber } from "@/lib/format";
import { starSchema } from "@/lib/validation";

export interface StarFormRequest {
  /** Star being edited; absent when creating. */
  star?: Star;
  /** Pre-filled values for a new star. */
  domainId?: string;
  prerequisiteIds?: string[];
}

interface StarFormProps {
  request: StarFormRequest;
  domains: Domain[];
  stars: Star[];
  onSubmit: (star: Star) => void;
  onCancel: () => void;
}

/** Modal form to create or edit a milestone. */
export function StarForm({ request, domains, stars, onSubmit, onCancel }: StarFormProps) {
  const editing = request.star;
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [domainId, setDomainId] = useState(editing?.domainId ?? request.domainId ?? domains[0]?.id ?? "");
  const [secondaryDomainId, setSecondaryDomainId] = useState(editing?.secondaryDomainId ?? "");
  const [tier, setTier] = useState<Tier>(editing?.tier ?? "minor");
  const [hasGoal, setHasGoal] = useState(editing ? editing.targetValue !== null : false);
  const [target, setTarget] = useState(editing?.targetValue != null ? String(editing.targetValue) : "");
  const [current, setCurrent] = useState(editing?.currentValue != null ? String(editing.currentValue) : "");
  const [unit, setUnit] = useState(editing?.unit ?? "");
  const [prerequisiteIds, setPrerequisiteIds] = useState<string[]>(
    editing?.prerequisiteIds ?? request.prerequisiteIds ?? [],
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // Candidate prerequisites, grouped by domain, the star's own domain first.
  // Blocked: a star that already depends on the one being edited (that would be
  // a loop), and, for an achieved star, a new prerequisite that is not achieved.
  const groups = useMemo(() => {
    const blockedReason = (star: Star): string | null => {
      if (editing && wouldCreateCycle(stars, editing.id, [star.id])) {
        return "Ce palier dépend déjà de celui que tu modifies.";
      }
      if (
        editing?.achievedAt &&
        star.achievedAt === null &&
        !editing.prerequisiteIds.includes(star.id)
      ) {
        return "Ce palier est atteint : ses nouveaux prérequis doivent l'être aussi.";
      }
      return null;
    };
    return [...domains]
      .sort((a, b) => Number(b.id === domainId) - Number(a.id === domainId))
      .map((domain) => ({
        domain,
        stars: stars
          .filter((star) => star.domainId === domain.id && star.id !== editing?.id)
          .map((star) => ({ star, reason: blockedReason(star) })),
      }))
      .filter((group) => group.stars.length > 0);
  }, [domains, stars, editing, domainId]);

  const togglePrerequisite = (id: string) =>
    setPrerequisiteIds((ids) => (ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id]));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    let targetValue: number | null = null;
    let currentValue: number | null = null;
    if (hasGoal) {
      targetValue = parseNumber(target);
      currentValue = current.trim() === "" ? 0 : parseNumber(current);
      if (targetValue === null || currentValue === null) {
        setError("L'objectif et la valeur actuelle doivent être des nombres.");
        return;
      }
    }

    const draft: Star = {
      id: editing?.id ?? crypto.randomUUID(),
      domainId,
      secondaryDomainId: secondaryDomainId || null,
      title,
      description,
      tier,
      achievedAt: editing?.achievedAt ?? null,
      currentValue,
      targetValue,
      unit: hasGoal && unit.trim() ? unit : null,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
      prerequisiteIds,
    };
    const parsed = starSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Ce palier n'est pas valide.");
      return;
    }
    onSubmit(parsed.data);
  };

  return (
    <div
      className="absolute inset-0 z-40 grid place-items-center bg-black/55 p-4 backdrop-blur-sm"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "Modifier le palier" : "Nouveau palier"}
        className="glass scroll-thin flex max-h-full w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-2xl p-6"
      >
        <header className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-white">
            {editing ? "Modifier le palier" : "Nouveau palier"}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fermer"
            className="grid h-8 w-8 place-items-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <CloseIcon />
          </button>
        </header>

        <Field label="Titre">
          <input
            autoFocus
            required
            className="field"
            value={title}
            maxLength={80}
            placeholder="Courir un semi-marathon"
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>

        <Field label="Description" optional>
          <textarea
            className="field min-h-[4.5rem] resize-y"
            value={description}
            maxLength={2000}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Domaine">
            <select
              className="field"
              value={domainId}
              onChange={(event) => {
                setDomainId(event.target.value);
                if (event.target.value === secondaryDomainId) setSecondaryDomainId("");
              }}
            >
              {domains.map((domain) => (
                <option key={domain.id} value={domain.id}>
                  {domain.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Second domaine" optional>
            <select
              className="field"
              value={secondaryDomainId}
              onChange={(event) => setSecondaryDomainId(event.target.value)}
            >
              <option value="">Aucun</option>
              {domains
                .filter((domain) => domain.id !== domainId)
                .map((domain) => (
                  <option key={domain.id} value={domain.id}>
                    {domain.name}
                  </option>
                ))}
            </select>
          </Field>
        </div>

        <Field label="Importance">
          <div className="grid grid-cols-2 gap-2" role="radiogroup">
            {(
              [
                ["minor", "Palier", "Étoile discrète"],
                ["major", "Palier majeur", "Grande étoile"],
              ] as const
            ).map(([value, name, hint]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={tier === value}
                onClick={() => setTier(value)}
                className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                  tier === value
                    ? "border-white/50 bg-white/10 text-white"
                    : "border-white/10 text-white/60 hover:bg-white/[0.05]"
                }`}
              >
                <span className="block text-sm font-medium">{name}</span>
                <span className="block text-xs text-white/45">{hint}</span>
              </button>
            ))}
          </div>
        </Field>

        <div className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-white/90">
            <input
              type="checkbox"
              checked={hasGoal}
              onChange={(event) => setHasGoal(event.target.checked)}
              className="h-4 w-4 accent-violet-300"
            />
            Objectif chiffré avec barre de progression
          </label>
          {hasGoal && (
            <div className="grid grid-cols-[1fr_1fr_5.5rem] gap-2">
              <Field label="Objectif">
                <input
                  className="field"
                  inputMode="decimal"
                  value={target}
                  placeholder="15000"
                  onChange={(event) => setTarget(event.target.value)}
                />
              </Field>
              <Field label="Actuel">
                <input
                  className="field"
                  inputMode="decimal"
                  value={current}
                  placeholder="7500"
                  onChange={(event) => setCurrent(event.target.value)}
                />
              </Field>
              <Field label="Unité">
                <input
                  className="field"
                  value={unit}
                  maxLength={12}
                  placeholder="€"
                  onChange={(event) => setUnit(event.target.value)}
                />
              </Field>
            </div>
          )}
        </div>

        {groups.length > 0 && (
          <Field label="Prérequis" optional hint="Le palier reste verrouillé tant qu'ils ne sont pas atteints.">
            <div className="scroll-thin flex max-h-44 flex-col gap-2 overflow-y-auto rounded-xl border border-white/[0.08] p-2.5">
              {groups.map(({ domain, stars: candidates }) => (
                <div key={domain.id} className="flex flex-col gap-0.5">
                  <span className="px-1 text-[11px] font-medium tracking-wider uppercase" style={{ color: domain.color }}>
                    {domain.name}
                  </span>
                  {candidates.map(({ star, reason }) => (
                    <label
                      key={star.id}
                      title={reason ?? undefined}
                      className={`flex items-center gap-2.5 rounded-md px-1 py-1 text-sm ${
                        reason ? "cursor-not-allowed text-white/30" : "cursor-pointer text-white/85 hover:bg-white/[0.05]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={reason !== null}
                        checked={prerequisiteIds.includes(star.id)}
                        onChange={() => togglePrerequisite(star.id)}
                        className="h-4 w-4 accent-violet-300"
                      />
                      <span className="truncate">{star.title}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </Field>
        )}

        {error && (
          <p role="alert" className="text-sm text-rose-200">
            {error}
          </p>
        )}

        <footer className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCancel} className="btn btn-ghost">
            Annuler
          </button>
          <button type="submit" disabled={!title.trim() || !domainId} className="btn btn-primary">
            {editing ? "Enregistrer" : "Créer le palier"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function Field({
  label,
  optional = false,
  hint,
  children,
}: {
  label: string;
  optional?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium text-white/60">
        {label}
        {optional && <span className="font-normal text-white/35"> (facultatif)</span>}
      </span>
      {children}
      {hint && <span className="text-xs text-white/40">{hint}</span>}
    </label>
  );
}
