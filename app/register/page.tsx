import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Inscription · Constellation" };

export default function RegisterPage() {
  return <AuthForm mode="register" configured={getSupabaseEnv() !== null} />;
}
