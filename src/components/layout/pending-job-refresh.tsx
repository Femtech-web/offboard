"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Refresh saved state only while a real job is queued or leased. */
export function PendingJobRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [active, router]);
  return null;
}
