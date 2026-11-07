import { LogIn, LogOut } from "lucide-react";
import { Brand } from "@/components/ui/brand";
import { SubmitButton } from "@/components/ui/submit-button";
import { signIn } from "@/features/auth/actions";
import { supabaseConfigured } from "@/server/supabase/config";

const errors: Record<string, string> = {
  credentials:
    "Sign-in failed. Check your confirmed email and password, then try again.",
  access: "This account does not have administrator access to Offboard.",
  database:
    "The database is not ready. Apply the Offboard migration before signing in.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const configured = supabaseConfigured();
  return (
    <main id="main-content" className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col justify-between border-b border-border bg-hero bg-[radial-gradient(#b4b6ff12_1px,transparent_1px)] bg-size-[12px_12px] p-8 lg:border-r lg:border-b-0 lg:p-14">
        <Brand />
        <div className="my-16 max-w-lg">
          <div className="mb-8 flex size-18 items-center justify-center rounded-2xl border border-brand/30 bg-brand/10">
            <LogOut
              className="size-10 text-brand"
              strokeWidth={1.3}
              aria-hidden="true"
            />
          </div>
          <h1 className="text-4xl leading-tight font-medium tracking-tight sm:text-5xl">
            A clear view.
            <br />
            <span className="text-brand">A controlled exit.</span>
          </h1>
          <p className="mt-6 max-w-sm text-base leading-8 text-indigo-100/75">
            Real access checks, deliberate human decisions, and evidence that
            stays with the case.
          </p>
        </div>
        <p className="text-xs text-indigo-100/65">
          Access is restricted to authorized administrators.
        </p>
      </div>
      <div className="flex items-center justify-center px-6 py-16 lg:p-16">
        <div className="w-full max-w-sm">
          <LogIn
            className="mb-7 size-9 text-brand"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <h2 className="text-2xl font-medium tracking-tight">
            Welcome to Offboard.
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Sign in to your administrator workspace.
          </p>
          {!configured ? (
            <div className="mt-8 rounded-xl border border-attention/25 bg-attention/5 p-5">
              <p className="text-sm font-medium text-attention">
                Supabase setup required
              </p>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                Add the project URL, publishable key, server secret key, and
                administrator email to the local .env file. Apply the database
                migration and create your confirmed Auth user as described in
                the README.
              </p>
              <p className="mt-3 text-xs leading-6 text-muted-foreground">
                No case data or integration status is available until the
                database is connected.
              </p>
            </div>
          ) : (
            <form action={signIn} className="mt-8 space-y-5">
              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-critical/20 bg-critical/5 p-3 text-sm leading-6 text-critical"
                >
                  {errors[error] ?? "Unable to sign in. Please try again."}
                </p>
              )}
              <label className="block text-sm">
                Email
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  className="mt-2 min-h-12 w-full rounded-lg border border-border bg-surface px-4 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 sm:text-sm"
                />
              </label>
              <label className="block text-sm">
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={256}
                  className="mt-2 min-h-12 w-full rounded-lg border border-border bg-surface px-4 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 sm:text-sm"
                />
              </label>
              <SubmitButton pendingLabel="Signing in…">
                Sign in securely
              </SubmitButton>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
