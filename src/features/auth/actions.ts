"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSessionClient } from "@/server/supabase/server";
import { createServiceClient } from "@/server/supabase/service";
import { supabaseConfigured } from "@/server/supabase/config";

export async function signIn(formData: FormData) {
  const parsed = z
    .object({ email: z.email(), password: z.string().min(1).max(256) })
    .safeParse(Object.fromEntries(formData));
  if (!supabaseConfigured() || !parsed.success)
    redirect("/sign-in?error=credentials");
  const client = await createSessionClient();
  const { data, error } = await client.auth.signInWithPassword(parsed.data);
  if (error || !data.user?.email_confirmed_at)
    redirect("/sign-in?error=credentials");
  const allowedEmail = process.env.OFFBOARD_ADMIN_EMAIL?.trim().toLowerCase();
  // Only the server-configured, confirmed identity may be bootstrapped as administrator.
  if (allowedEmail && data.user.email?.toLowerCase() === allowedEmail) {
    const { error: bootstrapError } = await createServiceClient()
      .from("profiles")
      .upsert({ id: data.user.id, email: allowedEmail, role: "admin" });
    if (bootstrapError) redirect("/sign-in?error=database");
  }
  const { data: profile } = await client
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();
  if (profile?.role !== "admin") {
    await client.auth.signOut();
    redirect("/sign-in?error=access");
  }
  redirect("/overview");
}

export async function signOut() {
  const client = await createSessionClient();
  await client.auth.signOut();
  redirect("/sign-in");
}
