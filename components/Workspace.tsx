"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Constellation } from "@/components/constellation/Constellation";
import { StarForm, type StarFormRequest } from "@/components/constellation/StarForm";
import { StarPanel } from "@/components/constellation/StarPanel";
import { CloseIcon, PlusIcon } from "@/components/icons";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { deleteDomain, reorderDomains, saveDomain } from "@/lib/actions/domains";
import { deleteStar, saveStar } from "@/lib/actions/stars";
import type { ActionResult } from "@/lib/actions/types";
import { applyProgress, computeStatuses } from "@/lib/constellation/status";
import type { Domain, Star } from "@/lib/constellation/types";
import type { ConstellationData } from "@/lib/data";

/**
 * The whole screen: sidebar, constellation, detail panel and forms.
 * Changes are applied to the screen at once; when signed in they are then
 * saved through Server Actions, and undone on screen if saving fails.
 * In demo mode nothing leaves the browser.
 */
export function Workspace({ mode, user, domains: initialDomains, stars: initialStars, loadError }: ConstellationData) {
  const live = mode === "live";
  const router = useRouter();
  const [domains, setDomains] = useState(initialDomains);
  const [stars, setStars] = useState(initialStars);
  // When the server sends fresh data (after a refresh), it replaces the local copy.
  const [source, setSource] = useState({ domains: initialDomains, stars: initialStars });
  if (source.domains !== initialDomains || source.stars !== initialStars) {
    setSource({ domains: initialDomains, stars: initialStars });
    setDomains(initialDomains);
    setStars(initialStars);
  }
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusDomainId, setFocusDomainId] = useState<string | null>(null);
  const [form, setForm] = useState<StarFormRequest | null>(null);
  const [error, setError] = useState<string | null>(loadError);

  const statuses = useMemo(() => computeStatuses(stars), [stars]);
  const selected = stars.find((star) => star.id === selectedId) ?? null;
  const closePanel = useCallback(() => setSelectedId(null), []);

  const persist = useCallback(
    async (action: () => Promise<ActionResult>, undo: () => void) => {
      if (!live) return;
      let failure: string | null = null;
      try {
        const result = await action();
        if (!result.ok) failure = result.error;
      } catch {
        failure = "Connexion perdue : la modification n'a pas été enregistrée.";
      }
      if (failure === null) return;
      // Undo at once for immediate feedback, then reload the real state from the
      // server: the undo alone could erase another change made in the meantime,
      // or miss part of a save that failed half-way.
      undo();
      setError(failure);
      router.refresh();
    },
    [live, router],
  );

  const commitStar = useCallback(
    (star: Star) => {
      const before = stars;
      setStars(
        stars.some((other) => other.id === star.id)
          ? stars.map((other) => (other.id === star.id ? star : other))
          : [...stars, star],
      );
      void persist(
        () => saveStar(star),
        () => setStars(before),
      );
    },
    [stars, persist],
  );

  const removeStar = (id: string) => {
    const before = stars;
    setStars(
      stars
        .filter((star) => star.id !== id)
        .map((star) =>
          star.prerequisiteIds.includes(id)
            ? { ...star, prerequisiteIds: star.prerequisiteIds.filter((other) => other !== id) }
            : star,
        ),
    );
    setSelectedId(null);
    void persist(
      () => deleteStar(id),
      () => setStars(before),
    );
  };

  const submitForm = (star: Star) => {
    // A numeric goal already at its target counts as reached, unless the star is locked.
    const locked = star.prerequisiteIds.some(
      (id) => stars.find((other) => other.id === id)?.achievedAt === null,
    );
    const next =
      star.targetValue !== null
        ? applyProgress(star, star.currentValue ?? 0, locked, new Date().toISOString())
        : star;
    commitStar(next);
    setForm(null);
    setSelectedId(next.id);
  };

  const commitDomain = (domain: Domain) => {
    const before = domains;
    setDomains(
      domains.some((other) => other.id === domain.id)
        ? domains.map((other) => (other.id === domain.id ? domain : other))
        : [...domains, domain],
    );
    void persist(
      () => saveDomain(domain),
      () => setDomains(before),
    );
  };

  const removeDomain = (id: string) => {
    const beforeDomains = domains;
    const beforeStars = stars;
    const removed = new Set(stars.filter((star) => star.domainId === id).map((star) => star.id));
    setDomains(domains.filter((domain) => domain.id !== id));
    setStars(
      stars
        .filter((star) => !removed.has(star.id))
        .map((star) => ({
          ...star,
          secondaryDomainId: star.secondaryDomainId === id ? null : star.secondaryDomainId,
          prerequisiteIds: star.prerequisiteIds.filter((other) => !removed.has(other)),
        })),
    );
    if (selectedId && removed.has(selectedId)) setSelectedId(null);
    setFocusDomainId(null);
    void persist(
      () => deleteDomain(id),
      () => {
        setDomains(beforeDomains);
        setStars(beforeStars);
      },
    );
  };

  const reorder = (ids: string[]) => {
    const byId = new Map(domains.map((domain) => [domain.id, domain]));
    setDomains(
      ids.flatMap((id, position) => {
        const domain = byId.get(id);
        return domain ? [{ ...domain, position }] : [];
      }),
    );
  };

  const commitOrder = (ids: string[]) => {
    void persist(
      () => reorderDomains(ids),
      () => setError("L'ordre des domaines n'a pas été enregistré."),
    );
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <Sidebar
        domains={domains}
        stars={stars}
        user={user}
        focusDomainId={focusDomainId}
        onFocusDomain={setFocusDomainId}
        onSaveDomain={commitDomain}
        onDeleteDomain={removeDomain}
        onReorder={reorder}
        onReorderCommit={commitOrder}
      />

      <main className="relative min-w-0 flex-1">
        <Constellation
          domains={domains}
          stars={stars}
          statuses={statuses}
          selectedId={selectedId}
          focusDomainId={focusDomainId}
          onSelect={setSelectedId}
          onFocusDomain={setFocusDomainId}
          onCreateInDomain={(domainId) => {
            setSelectedId(null);
            setForm({ domainId });
          }}
          popover={
            selected && (
              <StarPanel
                key={selected.id}
                star={selected}
                status={statuses.get(selected.id) ?? "locked"}
                domains={domains}
                stars={stars}
                statuses={statuses}
                onClose={closePanel}
                onSelect={setSelectedId}
                onToggleAchieved={() => {
                  if (statuses.get(selected.id) === "locked") return;
                  // A star that other achieved stars build on cannot be un-validated.
                  const blocksDependents =
                    selected.achievedAt !== null &&
                    stars.some(
                      (other) => other.achievedAt !== null && other.prerequisiteIds.includes(selected.id),
                    );
                  if (blocksDependents) return;
                  commitStar({
                    ...selected,
                    achievedAt: selected.achievedAt === null ? new Date().toISOString() : null,
                  });
                }}
                onProgress={(value) =>
                  commitStar(
                    applyProgress(
                      selected,
                      value,
                      statuses.get(selected.id) === "locked",
                      new Date().toISOString(),
                    ),
                  )
                }
                onEdit={() => setForm({ star: selected })}
                onAddAfter={() => setForm({ domainId: selected.domainId, prerequisiteIds: [selected.id] })}
                onDelete={() => removeStar(selected.id)}
              />
            )
          }
        />

        <div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex items-start justify-between gap-3">
          {live ? (
            <span />
          ) : (
            <p className="glass pointer-events-auto flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full px-4 py-2 text-xs text-white/75">
              <span className="font-medium text-white">Ciel de démonstration</span>
              <span>Explore librement : rien n&apos;est enregistré.</span>
              <Link href="/register" className="font-medium text-violet-200 underline-offset-4 hover:underline">
                Créer mon ciel
              </Link>
            </p>
          )}
          <button
            type="button"
            disabled={domains.length === 0}
            onClick={() => setForm({})}
            className="btn btn-primary pointer-events-auto"
          >
            <PlusIcon width={14} height={14} />
            Nouveau palier
          </button>
        </div>

        {domains.length === 0 && (
          <EmptyHint title="Ton ciel est encore vide">
            Crée ton premier domaine dans le panneau de gauche : chaque domaine devient une branche de la
            constellation.
          </EmptyHint>
        )}
        {domains.length > 0 && stars.length === 0 && (
          <EmptyHint title="Allume ta première étoile">
            Ajoute un palier avec le bouton « Nouveau palier ». Les suivants viendront s&apos;y accrocher.
          </EmptyHint>
        )}

        <Legend />

        {form && (
          <StarForm
            key={form.star?.id ?? "new"}
            request={form}
            domains={domains}
            stars={stars}
            onSubmit={submitForm}
            onCancel={() => setForm(null)}
          />
        )}

        {error && (
          <div
            role="alert"
            className="glass absolute bottom-4 left-1/2 z-50 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-full border-rose-300/30 py-2 pr-2 pl-4 text-sm text-rose-100"
          >
            {error}
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label="Fermer le message"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full hover:bg-white/10"
            >
              <CloseIcon width={14} height={14} />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyHint({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center p-6">
      <div className="max-w-sm translate-y-28 text-center">
        <h2 className="font-display text-lg font-semibold text-white">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/60">{children}</p>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <ul className="glass pointer-events-none absolute bottom-4 left-[8.75rem] flex h-9 items-center gap-4 rounded-full px-4 text-[11px] text-white/65">
      <li className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-white shadow-[0_0_8px_#fff]" />
        Atteinte
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full border-[1.5px] border-white/75" />
        Accessible
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-[#716d8a]" />
        Verrouillée
      </li>
    </ul>
  );
}
