import Link from "next/link";

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6 py-16"
    >
      <p className="font-mono text-sm text-brand">404</p>
      <h1 className="mt-4 text-4xl font-medium tracking-tight text-foreground">
        This page could not be found.
      </h1>
      <p className="mt-4 text-muted-foreground">
        Return to Offboard to continue.
      </p>
      <Link
        href="/"
        className="mt-8 w-fit bg-brand px-5 py-3 text-sm font-medium text-ink hover:bg-brand focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
      >
        Back to Offboard
      </Link>
    </main>
  );
}
