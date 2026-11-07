import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Brand } from "@/components/ui/brand";
import { EmailApprovalReview } from "@/features/approvals/email-approval-review";

export const metadata: Metadata = {
  title: "Review access removal · Offboard",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};
export default async function EmailApprovalPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  if (!z.uuid().safeParse(requestId).success) notFound();
  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-5 py-10 sm:py-16">
      <Brand />
      <EmailApprovalReview requestId={requestId} />
    </main>
  );
}
