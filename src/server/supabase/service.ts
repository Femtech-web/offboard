import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicSupabaseConfiguration } from "./config";

export function createServiceClient() {
  const { url } = publicSupabaseConfiguration();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret)
    throw new Error("Configure the server-only SUPABASE_SECRET_KEY.");
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
