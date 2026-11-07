import "server-only";
import { timingSafeEqual } from "node:crypto";
import { createServiceClient } from "./supabase/service";

export function workerAuthorized(request: Request) {
  const configuredToken = process.env.OFFBOARD_WORKER_TOKEN;
  if (!configuredToken || configuredToken.length < 32) return false;
  const authorization = request.headers.get("authorization") ?? "";
  const actual = Buffer.from(authorization);
  const expected = Buffer.from(`Bearer ${configuredToken}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function workerRpc(
  name: string,
  parameters: Record<string, unknown>,
) {
  const { data, error } = await createServiceClient().rpc(name, parameters);
  if (error) throw new Error("worker_operation_denied");
  return data;
}

export function privateJson(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
