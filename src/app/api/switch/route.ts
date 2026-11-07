import { switchRequestSchema } from "@/core/switch-investigation";
import {
  runSwitchOperation,
  switchBridgeAuthorized,
} from "@/server/switch-api";
import { privateJson } from "@/server/worker-api";

export async function POST(request: Request) {
  if (!switchBridgeAuthorized(request))
    return privateJson({ error: "unauthorized" }, 401);
  try {
    const body = await request.text();
    if (body.length > 5000)
      return privateJson({ error: "request_too_large" }, 413);
    const operation = switchRequestSchema.parse(JSON.parse(body));
    return privateJson(await runSwitchOperation(operation));
  } catch {
    return privateJson({ error: "switch_operation_denied" }, 403);
  }
}
