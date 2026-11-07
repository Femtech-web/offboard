import { createClient } from "@supabase/supabase-js";

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "OFFBOARD_ADMIN_EMAIL",
];
for (const field of [...required, "SUPABASE_DB_URL"])
  console.info(`${field}: ${process.env[field] ? "present" : "missing"}`);
if (required.some((field) => !process.env[field])) process.exit(1);
const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false } },
);
const { data, error } = await client.auth.admin.listUsers({
  page: 1,
  perPage: 100,
});
if (error) {
  console.error(
    "Supabase Auth connection failed; check the URL and server key.",
  );
  process.exit(1);
}
const administrator = data.users.find(
  (user) =>
    user.email?.toLowerCase() ===
    process.env.OFFBOARD_ADMIN_EMAIL?.trim().toLowerCase(),
);
console.info(
  `Supabase Auth: reachable; configured administrator: ${administrator ? (administrator.email_confirmed_at ? "exists and confirmed" : "exists, email not confirmed") : "not created yet"}`,
);

const { data: heartbeat, error: databaseError } = await client
  .from("worker_heartbeats")
  .select("last_seen_at")
  .order("last_seen_at", { ascending: false })
  .limit(1)
  .maybeSingle();
console.info(
  `Offboard database: ${databaseError ? "schema unavailable" : "reachable"}; worker heartbeat: ${heartbeat && Date.now() - Date.parse(heartbeat.last_seen_at) < 90_000 ? "recent" : "no recent signal"}`,
);
