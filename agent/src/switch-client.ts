import { z } from "zod";
import {
  assertInvestigationMessage,
  assertSwitchScope,
  type SwitchRequest,
} from "../../src/core/switch-investigation";
import type { AgentConfiguration } from "./config";

const entrySchema = z.object({
  id: z.string(),
  kind: z.string(),
  sender: z.string(),
  body: z.string(),
  timestamp: z.number(),
  sender_kind: z.string().optional(),
});
const contextSchema = z.object({
  threads: z.array(
    z.object({ root: entrySchema, replies: z.array(entrySchema) }),
  ),
  truncated: z.boolean(),
});

export async function investigateThroughSwitch(
  configuration: AgentConfiguration,
  input: {
    action: SwitchRequest["action"];
    caseId: string;
    sourceMessageId: string;
    jobId?: string;
  },
  fetcher: typeof fetch = fetch,
) {
  if (!configuration.scope.caseIds.includes(input.caseId))
    throw new Error("case_not_allowed");
  async function switchOperation(
    name: "get_room_detail" | "read_context",
    args: object,
  ) {
    const response = await fetcher(
      new URL(
        `/agents/${configuration.scope.agentId}/ops/${name}`,
        configuration.switchUrl,
      ),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${configuration.switchToken}`,
        },
        body: JSON.stringify(args),
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok) throw new Error("switch_context_unavailable");
    return z.object({ result: z.unknown() }).parse(await response.json())
      .result;
  }
  const room = z
    .object({
      id: z.uuid(),
      bridge_display_name: z.literal("Mattermost"),
      archived: z.literal(false),
      agent_names: z.array(z.string()),
    })
    .parse(
      await switchOperation("get_room_detail", {
        room_id: configuration.scope.roomId,
      }),
    );
  if (
    room.id !== configuration.scope.roomId ||
    !room.agent_names.includes("offboard")
  )
    throw new Error("room_not_allowed");
  const context = contextSchema.parse(
    await switchOperation("read_context", { room_id: room.id, limit: 500 }),
  );
  const message = context.threads
    .flatMap((thread) => [thread.root, ...thread.replies])
    .find((entry) => entry.id === input.sourceMessageId);
  if (!message || message.sender_kind === "platform")
    throw new Error("source_message_unavailable");
  assertInvestigationMessage(
    message,
    input.caseId,
    configuration.scope.senderId,
  );
  const request: SwitchRequest = {
    action: input.action,
    caseId: input.caseId,
    ...(input.jobId ? { jobId: input.jobId } : {}),
    context: {
      roomId: room.id,
      agentId: configuration.scope.agentId,
      messageId: message.id,
      senderId: message.sender,
      messageTimestamp: message.timestamp,
      verifiedAt: new Date().toISOString(),
    },
  };
  assertSwitchScope(request, configuration.scope);
  const response = await fetcher(new URL("/api/switch", configuration.appUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${configuration.token}`,
    },
    body: JSON.stringify(request),
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error("offboard_operation_denied");
  const data = z.record(z.string(), z.unknown()).parse(await response.json());
  const reports = z
    .object({
      reports: z.object({ records: z.array(z.object({ id: z.uuid() })) }),
    })
    .safeParse(data);
  return {
    ...data,
    appUrl: configuration.appUrl.origin,
    reviewUrl: new URL(`/people/${input.caseId}`, configuration.appUrl).href,
    reportLinks: reports.success
      ? reports.data.reports.records.map((report) => ({
          reportId: report.id,
          url: new URL(`/reports/${report.id}`, configuration.appUrl).href,
        }))
      : [],
  };
}
