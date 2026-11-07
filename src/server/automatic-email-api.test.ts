import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  workerRpc: vi.fn(),
  authorized: vi.fn(),
  dispatch: vi.fn(),
}));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("./approval-email", () => ({
  dispatchNextApprovalEmail: mocks.dispatch,
}));
vi.mock("./worker-api", () => ({
  workerAuthorized: mocks.authorized,
  workerRpc: mocks.workerRpc,
  privateJson: (data: unknown, status = 200) => Response.json(data, { status }),
}));
import { POST } from "@/app/api/worker/claim/route";

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
});
it("requires worker authentication before it can schedule email dispatch", async () => {
  mocks.authorized.mockReturnValue(false);
  expect(
    (
      await POST(
        new Request("https://offboard.example/api/worker/claim", {
          method: "POST",
          body: "{}",
        }),
      )
    ).status,
  ).toBe(401);
  expect(mocks.after).not.toHaveBeenCalled();
  expect(mocks.workerRpc).not.toHaveBeenCalled();
});
it("returns the polling response before running the persisted email dispatch", async () => {
  mocks.authorized.mockReturnValue(true);
  mocks.workerRpc.mockResolvedValue(null);
  const response = await POST(
    new Request("https://offboard.example/api/worker/claim", {
      method: "POST",
      body: JSON.stringify({
        workerId: "2080d791-6d6b-43e2-9226-32ca3e52aac5",
      }),
    }),
  );
  expect(response.status).toBe(200);
  expect(mocks.dispatch).not.toHaveBeenCalled();
  await mocks.after.mock.calls[0]![0]();
  expect(mocks.dispatch).toHaveBeenCalledTimes(1);
});
