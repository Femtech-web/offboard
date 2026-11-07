import { readFile, stat } from "node:fs/promises";
import { parseEnv } from "node:util";
import { z } from "zod";

export function trustedBaseUrl(value: string) {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ))
  )
    throw new Error("invalid_service_origin");
  return url;
}

export async function readAgentConfiguration() {
  // This file contains only the restricted bridge configuration, never provider/DB keys.
  const path = new URL("../../.env.switch", import.meta.url);
  if ((await stat(path)).mode & 0o077)
    throw new Error("bridge_configuration_must_be_private");
  const env = parseEnv(await readFile(path, "utf8"));
  const configuration = z
    .object({
      OFFBOARD_APP_URL: z.url(),
      OFFBOARD_SWITCH_TOKEN: z.string().min(32),
      OFFBOARD_SWITCH_CREDENTIALS_FILE: z.string().startsWith("/"),
      OFFBOARD_SWITCH_ROOM_ID: z.uuid(),
      OFFBOARD_SWITCH_AGENT_ID: z.uuid(),
      OFFBOARD_SWITCH_SENDER_ID: z.string().min(1),
      OFFBOARD_SWITCH_CASE_IDS: z.string().min(1),
    })
    .parse(env);
  const credentials = z
    .object({
      env: z.object({
        SWITCH_API_ENDPOINT: z.url(),
        SWITCH_API_TOKEN: z.string().min(1),
        SWITCH_AGENT_ID: z.uuid(),
      }),
    })
    .parse(
      JSON.parse(
        await readFile(configuration.OFFBOARD_SWITCH_CREDENTIALS_FILE, "utf8"),
      ),
    ).env;
  if (credentials.SWITCH_AGENT_ID !== configuration.OFFBOARD_SWITCH_AGENT_ID)
    throw new Error("agent_identity_mismatch");
  return {
    appUrl: trustedBaseUrl(configuration.OFFBOARD_APP_URL),
    token: configuration.OFFBOARD_SWITCH_TOKEN,
    switchUrl: trustedBaseUrl(credentials.SWITCH_API_ENDPOINT),
    switchToken: credentials.SWITCH_API_TOKEN,
    scope: {
      roomId: configuration.OFFBOARD_SWITCH_ROOM_ID,
      agentId: configuration.OFFBOARD_SWITCH_AGENT_ID,
      senderId: configuration.OFFBOARD_SWITCH_SENDER_ID,
      caseIds: z
        .array(z.uuid())
        .min(1)
        .parse(configuration.OFFBOARD_SWITCH_CASE_IDS.split(",")),
    },
  };
}
export type AgentConfiguration = Awaited<
  ReturnType<typeof readAgentConfiguration>
>;
