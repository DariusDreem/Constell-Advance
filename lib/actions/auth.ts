"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { credentialsSchema } from "@/lib/validation";
import { NOT_CONFIGURED, type AuthState } from "./types";

const fail = (error: string): AuthState => ({ error, notice: null });

export async function signIn(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return fail("Email ou mot de passe incorrect.");

  const supabase = await createClient();
  if (!supabase) return fail(NOT_CONFIGURED);

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error?.code === "email_not_confirmed") {
    return fail("Ton email n'est pas encore confirmé : ouvre le lien reçu à l'inscription.");
  }
  if (error) return fail("Email ou mot de passe incorrect.");
  redirect("/");
}

export async function signUp(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return fail("Entre un email valide et un mot de passe d'au moins 8 caractères.");
  }

  const supabase = await createClient();
  if (!supabase) return fail(NOT_CONFIGURED);

  const origin = (await headers()).get("origin");
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: origin ? { emailRedirectTo: `${origin}/auth/callback` } : undefined,
  });
  if (error) return fail("L'inscription a échoué. Vérifie ton email et réessaie.");
  if (data.session) redirect("/");
  return {
    error: null,
    notice: "Compte créé. Ouvre le lien reçu par email pour l'activer, puis connecte-toi.",
  };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}
