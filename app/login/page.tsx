import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Connexion · Constellation" };

export default function LoginPage() {
  return <AuthForm mode="login" configured={getSupabaseEnv() !== null} />;
}
