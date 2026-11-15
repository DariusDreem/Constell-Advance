"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Logo } from "@/components/Logo";
import { signIn, signUp } from "@/lib/actions/auth";
import { NOT_CONFIGURED, type AuthState } from "@/lib/actions/types";

const INITIAL: AuthState = { error: null, notice: null };

const COPY = {
  login: {
    title: "Retrouve ton ciel",
    submit: "Connexion",
    pending: "Connexion…",
    other: "Pas encore de compte ?",
    otherLink: "Inscription",
    otherHref: "/register",
  },
  register: {
    title: "Crée ton ciel",
    submit: "Inscription",
    pending: "Création…",
    other: "Déjà un compte ?",
    otherLink: "Connexion",
    otherHref: "/login",
  },
} as const;

/** Sign-in / sign-up card. `configured` is false until the Supabase keys are set. */
export function AuthForm({ mode, configured }: { mode: "login" | "register"; configured: boolean }) {
  const [state, action, pending] = useActionState(mode === "login" ? signIn : signUp, INITIAL);
  const copy = COPY[mode];

  return (
    <main className="grid min-h-dvh place-items-center overflow-y-auto p-4">
      <div className="glass flex w-full max-w-sm flex-col gap-6 rounded-2xl p-7">
        <Link href="/" aria-label="Constellation, accueil" className="self-start">
          <Logo />
        </Link>
        <h1 className="font-display text-2xl font-semibold text-white">{copy.title}</h1>

        {!configured && (
          <p className="rounded-xl border border-amber-200/25 bg-amber-200/[0.07] p-3 text-xs leading-relaxed text-amber-100/90">
            {NOT_CONFIGURED}
          </p>
        )}

        <form action={action} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-white/60">Email</span>
            <input className="field" type="email" name="email" autoComplete="email" required />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-white/60">Mot de passe</span>
            <input
              className="field"
              type="password"
              name="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={8}
              required
            />
            {mode === "register" && <span className="text-xs text-white/40">8 caractères minimum.</span>}
          </label>

          {state.error && (
            <p role="alert" className="text-sm text-rose-200">
              {state.error}
            </p>
          )}
          {state.notice && (
            <p role="status" className="text-sm text-emerald-200">
              {state.notice}
            </p>
          )}

          <button type="submit" disabled={pending || !configured} className="btn btn-primary mt-1 py-2.5">
            {pending ? copy.pending : copy.submit}
          </button>
        </form>

        <p className="text-sm text-white/55">
          {copy.other}{" "}
          <Link href={copy.otherHref} className="font-medium text-violet-200 underline-offset-4 hover:underline">
            {copy.otherLink}
          </Link>
        </p>
      </div>
    </main>
  );
}
