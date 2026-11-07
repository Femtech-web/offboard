import {
  approvalApplicationOrigin,
  emailReviewInput,
} from "@/features/approvals/email-contract";
import { performEmailDecision } from "@/server/approval-email";
import { privateJson } from "@/server/worker-api";

export async function POST(request: Request) {
  let applicationOrigin: string;
  try {
    // Next's internal request URL can use localhost behind a proxy/dev server.
    // Authorize the configured public origin, never a caller-supplied forwarding header.
    applicationOrigin = approvalApplicationOrigin(
      process.env.OFFBOARD_APP_URL ?? "",
    ).origin;
  } catch {
    return privateJson({ error: "request_denied" }, 403);
  }
  if (
    request.headers.get("origin") !== applicationOrigin ||
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    return privateJson({ error: "request_denied" }, 403);
  try {
    const reader = request.body?.getReader();
    if (!reader) return privateJson({ error: "request_denied" }, 403);
    const decoder = new TextDecoder();
    let body = "";
    let bytes = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 1500) {
        await reader.cancel();
        return privateJson({ error: "request_denied" }, 413);
      }
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
    return privateJson(
      await performEmailDecision(emailReviewInput.parse(JSON.parse(body))),
    );
  } catch {
    return privateJson(
      {
        error:
          "This review link is unavailable, expired, already used, or its target changed. Request a new proposal review from the administrator.",
      },
      403,
    );
  }
}
