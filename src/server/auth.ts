import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSessionClient } from "./supabase/server";
import { supabaseConfigured } from "./supabase/config";

// Deduplicate validation within one render only; never cache authorization across requests.
export const requireAdministrator = cache(
  async function requireAdministrator() {
    if (!supabaseConfigured()) redirect("/sign-in");
    const client = await createSessionClient();
    // Ask Auth for a current, validated user; do not authorize using an unverified cookie.
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user || !user.email_confirmed_at) redirect("/sign-in");
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("id, email, role")
      .eq("id", user.id)
      .single();
    if (profileError || profile?.role !== "admin")
      redirect("/sign-in?error=access");
    return { client, user, profile };
  },
);
