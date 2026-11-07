import { z } from "zod";

export const switchContextSchema = z.strictObject({
  roomId: z.uuid(),
  agentId: z.uuid(),
  messageId: z.string().regex(/^sw_[a-f0-9]{32}$/),
  senderId: z.string().min(1).max(250),
  messageTimestamp: z.number().int().positive(),
  verifiedAt: z.iso.datetime(),
});
export const switchRequestSchema = z.strictObject({
  action: z.enum(["inspect_case", "request_scan", "get_job"]),
  caseId: z.uuid(),
  jobId: z.uuid().optional(),
  context: switchContextSchema,
});
export type SwitchRequest = z.infer<typeof switchRequestSchema>;
export type SwitchContext = z.infer<typeof switchContextSchema>;
export type SwitchScope = {
  roomId: string;
  agentId: string;
  senderId: string;
  caseIds: string[];
};

export function assertSwitchScope(
  request: SwitchRequest,
  scope: SwitchScope,
  now = Date.now(),
) {
  const { context } = request;
  const messageAge = now - context.messageTimestamp;
  const verificationAge = now - Date.parse(context.verifiedAt);
  if (
    context.roomId !== scope.roomId ||
    context.agentId !== scope.agentId ||
    context.senderId !== scope.senderId ||
    !scope.caseIds.includes(request.caseId) ||
    verificationAge < -5000 ||
    verificationAge > 60_000 ||
    messageAge < -5000 ||
    messageAge > (request.action === "request_scan" ? 900_000 : 86_400_000) ||
    (request.action === "get_job") !== Boolean(request.jobId)
  )
    throw new Error("switch_scope_denied");
}

export function assertInvestigationMessage(
  message: { kind: string; sender: string; body: string; timestamp: number },
  caseId: string,
  senderId: string,
  now = Date.now(),
) {
  // A server-read message must explicitly request this case, not merely mention a person.
  const command = new RegExp(
    `^@offboard\\s+investigate\\s+${caseId}(?:\\s|$)`,
    "i",
  );
  if (
    message.kind !== "message" ||
    message.sender !== senderId ||
    !command.test(message.body.trim()) ||
    message.timestamp > now + 5000 ||
    now - message.timestamp > 86_400_000
  )
    throw new Error("switch_message_denied");
}
