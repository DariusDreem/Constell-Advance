"use client";

import { Reorder } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PencilIcon, PlusIcon } from "@/components/icons";
import { Logo, LogoMark } from "@/components/Logo";
import { DOMAIN_COLORS } from "@/lib/constellation/palette";
import type { AccountUser, Domain, Star } from "@/lib/constellation/types";
import { AccountSection } from "./AccountSection";
import { CollapseToggle } from "./CollapseToggle";
import { DomainEditor } from "./DomainEditor";
import { useSidebarCollapsed } from "./useSidebarCollapsed";

interface SidebarProps {
  domains: Domain[];
  stars: Star[];
  user: AccountUser | null;
  focusDomainId: string | null;
  onFocusDomain: (id: string | null) => void;
  onSaveDomain: (domain: Domain) => void;
  onDeleteDomain: (id: string) => void;
  /** Called while dragging, with the new order of domain ids. */
  onReorder: (ids: string[]) => void;
  /** Called when the drag ends, to store the order. */
  onReorderCommit: (ids: string[]) => void;
}

/**
 * Left panel, about one seventh of the screen: logo top-left, black-hole
 * switch top-right, domains in the middle, account bottom-left.
 * Collapsed, it becomes a thin bar of icons.
 */
export function Sidebar({
  domains,
  stars,
  user,
  focusDomainId,
  onFocusDomain,
  onSaveDomain,
  onDeleteDomain,
  onReorder,
  onReorderCommit,
}: SidebarProps) {
  const [collapsed, toggle] = useSidebarCollapsed();
  const [editing, setEditing] = useState<string | null>(null);

  const counts = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>();
    for (const star of stars) {
      const count = map.get(star.domainId) ?? { done: 0, total: 0 };
      count.total += 1;
      if (star.achievedAt !== null) count.done += 1;
      map.set(star.domainId, count);
    }
    return map;
  }, [stars]);

  const ids = domains.map((domain) => domain.id);
  const nextPosition = domains.reduce((max, domain) => Math.max(max, domain.position), -1) + 1;

  return (
    <div className="sidebar-slot relative z-30 h-full shrink-0">
      <aside
        data-collapsed={collapsed}
        className="sidebar glass flex h-full flex-col overflow-hidden border-y-0 border-l-0"
      >
        <header className="relative shrink-0">
          <div className="flex h-[60px] items-center pr-[3.75rem] pl-3">
            {!collapsed && (
              <Link href="/" aria-label="Constellation, accueil" className="min-w-0">
                <Logo />
              </Link>
            )}
          </div>
          {/* Pinned 14px from the top and right edges: the switch never changes height,
              and ends up centred in the 64px bar once the panel is collapsed. */}
          <div className="absolute top-3 right-3.5">
            <CollapseToggle collapsed={collapsed} onToggle={toggle} />
          </div>
          {collapsed && (
            <Link href="/" aria-label="Constellation, accueil" className="flex justify-center pb-2">
              <LogoMark />
            </Link>
          )}
        </header>

        <nav
          aria-label="Domaines"
          className="scroll-thin min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 pb-2"
        >
          {collapsed ? (
            <ul className="flex flex-col items-center gap-1 pt-2">
              {domains.map((domain) => (
                <li key={domain.id}>
                  <button
                    type="button"
                    title={domain.name}
                    aria-label={domain.name}
                    onPointerEnter={() => onFocusDomain(domain.id)}
                    onPointerLeave={() => onFocusDomain(null)}
                    onFocus={() => onFocusDomain(domain.id)}
                    onBlur={() => onFocusDomain(null)}
                    className="grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-white/[0.07]"
                    style={{ background: focusDomainId === domain.id ? "rgb(255 255 255 / 0.07)" : undefined }}
                  >
                    <DomainDot color={domain.color} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <>
              <div className="flex items-center justify-between px-2 pt-2 pb-1">
                <h2 className="text-[11px] font-medium tracking-[0.18em] text-white/40 uppercase">
                  Domaines
                </h2>
                <button
                  type="button"
                  onClick={() => setEditing("new")}
                  aria-label="Ajouter un domaine"
                  title="Ajouter un domaine"
                  className="grid h-6 w-6 place-items-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <PlusIcon width={14} height={14} />
                </button>
              </div>

              <Reorder.Group
                as="ul"
                axis="y"
                values={ids}
                onReorder={onReorder}
                className="flex flex-col gap-0.5"
              >
                {domains.map((domain) =>
                  editing === domain.id ? (
                    <li key={domain.id} className="py-1">
                      <DomainEditor
                        initialName={domain.name}
                        initialColor={domain.color}
                        onCancel={() => setEditing(null)}
                        onSave={(values) => {
                          onSaveDomain({ ...domain, ...values });
                          setEditing(null);
                        }}
                        onDelete={() => {
                          onDeleteDomain(domain.id);
                          setEditing(null);
                        }}
                      />
                    </li>
                  ) : (
                    <Reorder.Item
                      key={domain.id}
                      value={domain.id}
                      onDragEnd={() => onReorderCommit(ids)}
                      onPointerEnter={() => onFocusDomain(domain.id)}
                      onPointerLeave={() => onFocusDomain(null)}
                      className="group flex cursor-grab items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors select-none hover:bg-white/[0.06] active:cursor-grabbing"
                      style={{
                        background: focusDomainId === domain.id ? "rgb(255 255 255 / 0.06)" : undefined,
                      }}
                    >
                      <DomainDot color={domain.color} />
                      <span className="min-w-0 flex-1 truncate text-white/90">{domain.name}</span>
                      <span className="text-[11px] text-white/40 tabular-nums group-hover:hidden">
                        {counts.get(domain.id)?.done ?? 0}/{counts.get(domain.id)?.total ?? 0}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditing(domain.id)}
                        aria-label={`Modifier ${domain.name}`}
                        title="Modifier"
                        className="hidden h-5 w-5 place-items-center rounded-full text-white/60 group-hover:grid hover:text-white focus-visible:grid"
                      >
                        <PencilIcon width={13} height={13} />
                      </button>
                    </Reorder.Item>
                  ),
                )}
              </Reorder.Group>

              {editing === "new" && (
                <div className="py-1">
                  <DomainEditor
                    initialColor={DOMAIN_COLORS[domains.length % DOMAIN_COLORS.length]}
                    onCancel={() => setEditing(null)}
                    onSave={(values) => {
                      onSaveDomain({ id: crypto.randomUUID(), position: nextPosition, ...values });
                      setEditing(null);
                    }}
                  />
                </div>
              )}

              {domains.length === 0 && editing !== "new" && (
                <p className="px-2 py-2 text-xs leading-relaxed text-white/45">
                  Aucun domaine pour l&apos;instant. Ajoute le premier avec le bouton +.
                </p>
              )}
            </>
          )}
        </nav>

        <AccountSection user={user} collapsed={collapsed} />
      </aside>
    </div>
  );
}

function DomainDot({ color }: { color: string }) {
  return (
    <span
      className="h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ background: color, boxShadow: `0 0 8px ${color}` }}
    />
  );
}
