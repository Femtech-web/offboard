import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readAgentConfiguration } from "./config";
import { investigateThroughSwitch } from "./switch-client";

const server = new McpServer({
  name: "offboard-investigations",
  version: "0.1.0",
});
const inputs = {
  caseId: z.uuid(),
  sourceMessageId: z.string().regex(/^sw_[a-f0-9]{32}$/),
};
for (const action of ["inspect_case", "request_scan", "get_job"] as const) {
  server.registerTool(
    action,
    {
      description: `${action === "request_scan" ? "Queue one read-only GitHub scan" : action === "get_job" ? "Read a saved job and its report" : "Inspect saved case findings"}. Requires the ID of a real owner message in the configured Mattermost room starting with '@offboard investigate <case UUID>'. Read Switch context to obtain that sw_ message ID. No identity confirmation, approval, or removal capability.`,
      inputSchema: {
        ...inputs,
        ...(action === "get_job" ? { jobId: z.uuid() } : {}),
      },
      annotations: {
        readOnlyHint: action !== "request_scan",
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        const result = await investigateThroughSwitch(
          await readAgentConfiguration(),
          {
            action,
            caseId: args.caseId,
            sourceMessageId: args.sourceMessageId,
            ...("jobId" in args && typeof args.jobId === "string"
              ? { jobId: args.jobId }
              : {}),
          },
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "Investigation operation refused or unavailable. Check the configured case, authorized room message, message age, application, and worker. No approval or successful scan is implied.",
            },
          ],
        };
      }
    },
  );
}
await server.connect(new StdioServerTransport());
