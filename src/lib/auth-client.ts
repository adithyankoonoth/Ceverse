"use client";

import { createClient } from "@/lib/supabase/client";

export function getSupabaseBrowser() {
  return createClient();
}

export async function signInWithPassword(email: string, password: string) {
  const supabase = createClient();
  return supabase.auth.signInWithPassword({
    email: email.toLowerCase().trim(),
    password,
  });
}

export async function signUpWithPassword(input: {
  email: string;
  password: string;
  name: string;
  role: string;
}) {
  const supabase = createClient();
  return supabase.auth.signUp({
    email: input.email.toLowerCase().trim(),
    password: input.password,
    options: {
      data: {
        full_name: input.name,
        role: input.role,
      },
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });
}

export async function signInWithGoogle(nextPath = "/dashboard") {
  const supabase = createClient();
  const origin = window.location.origin;
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });
}

export async function signOut() {
  const supabase = createClient();
  return supabase.auth.signOut();
}
