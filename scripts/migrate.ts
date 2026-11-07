import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import postgres from "postgres";

const connectionUrl = process.env.SUPABASE_DB_URL;
if (!connectionUrl) {
  console.error(
    "Add SUPABASE_DB_URL to .env, or run the migration in Supabase SQL Editor.",
  );
  process.exit(1);
}
const sql = postgres(connectionUrl, {
  max: 1,
  ssl: "require",
  connect_timeout: 15,
  onnotice: () => {},
});
try {
  await sql.begin(async (transaction) => {
    await transaction`select pg_advisory_xact_lock(77831942)`;
    await transaction`create table if not exists public.offboard_migrations (name text primary key, checksum text not null, applied_at timestamptz not null default now())`;
    await transaction`revoke all on public.offboard_migrations from anon, authenticated`;
    await transaction`alter table public.offboard_migrations enable row level security`;
    const directory = new URL("../supabase/migrations/", import.meta.url);
    for (const name of (await readdir(directory))
      .filter((name) => name.endsWith(".sql"))
      .sort()) {
      const source = await readFile(new URL(name, directory), "utf8");
      const checksum = createHash("sha256").update(source).digest("hex");
      const [existing] =
        await transaction`select checksum from public.offboard_migrations where name=${name}`;
      if (existing) {
        if (existing.checksum !== checksum)
          throw new Error("migration_checksum_mismatch");
        console.info(`${name}: already applied`);
        continue;
      }
      await transaction.unsafe(source);
      await transaction`insert into public.offboard_migrations(name,checksum) values(${name},${checksum})`;
      console.info(`${name}: applied`);
    }
  });
} catch (error) {
  // Driver errors may include connection strings, SQL literals, or authentication details.
  const code =
    error instanceof postgres.PostgresError
      ? error.code
      : error instanceof Error &&
          error.message === "migration_checksum_mismatch"
        ? error.message
        : typeof error === "object" &&
            error !== null &&
            "code" in error &&
            typeof error.code === "string" &&
            /^[A-Z0-9_]+$/.test(error.code)
          ? error.code
          : "connection_or_migration_failed";
  console.error(
    `Migration failed (${code}). Check the connection, password encoding, and SQL migration in the Supabase dashboard.`,
  );
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
