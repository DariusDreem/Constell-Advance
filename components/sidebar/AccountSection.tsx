"use client";

import Link from "next/link";
import { LogOutIcon, UserIcon } from "@/components/icons";
import { signOut } from "@/lib/actions/auth";
import type { AccountUser } from "@/lib/constellation/types";

/** Bottom-left of the sidebar: sign in / sign up, or the signed-in account. */
export function AccountSection({ user, collapsed }: { user: AccountUser | null; collapsed: boolean }) {
  if (!user) {
    return collapsed ? (
      <div className="flex justify-center border-t border-white/[0.07] p-3">
        <Link
          href="/login"
          aria-label="Connexion"
          title="Connexion"
          className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-white/80 transition-colors hover:bg-white/10"
        >
          <UserIcon />
        </Link>
      </div>
    ) : (
      <div className="flex flex-col gap-2 border-t border-white/[0.07] p-3">
        <Link href="/login" className="btn btn-ghost">
          Connexion
        </Link>
        <Link href="/register" className="btn btn-primary">
          Inscription
        </Link>
      </div>
    );
  }

  const initial = (user.email[0] ?? "?").toUpperCase();
  const avatar = (
    <span
      title={user.email}
      className="font-display grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-300/90 to-fuchsia-400/80 text-sm font-semibold text-[#0b0618]"
    >
      {initial}
    </span>
  );
  const logout = (
    <form action={signOut}>
      <button
        type="submit"
        aria-label="Déconnexion"
        title="Déconnexion"
        className="grid h-8 w-8 place-items-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white"
      >
        <LogOutIcon />
      </button>
    </form>
  );

  return collapsed ? (
    <div className="flex flex-col items-center gap-2 border-t border-white/[0.07] p-3">
      {avatar}
      {logout}
    </div>
  ) : (
    <div className="flex items-center gap-2 border-t border-white/[0.07] p-3">
      {avatar}
      <span className="min-w-0 flex-1 truncate text-xs text-white/70">{user.email}</span>
      {logout}
    </div>
  );
}
