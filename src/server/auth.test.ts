import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  profile: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: (callback: unknown) => callback }));
vi.mock("next/navigation", () => ({
  redirect: (destination: string) => {
    throw new Error(`redirect:${destination}`);
  },
}));
vi.mock("./supabase/config", () => ({ supabaseConfigured: () => true }));
vi.mock("./supabase/server", () => ({
  createSessionClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({ select: () => ({ eq: () => ({ single: mocks.profile }) }) }),
    rpc: mocks.rpc,
  }),
}));
import { requireAdministrator, requireWorkspaceMember } from "./auth";

beforeEach(() => {
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "reviewer", email_confirmed_at: "2026-11-07" } },
    error: null,
  });
  mocks.profile.mockResolvedValue({
    data: { id: "reviewer", email: "judge@example.invalid", role: "viewer" },
    error: null,
  });
  mocks.rpc.mockReset().mockResolvedValue({ data: true, error: null });
});

it("admits a confirmed reviewer only while the database grant is active", async () => {
  expect((await requireWorkspaceMember()).profile.role).toBe("viewer");
  expect(mocks.rpc).toHaveBeenCalledWith("offboard_can_review");
  mocks.rpc.mockResolvedValue({ data: false, error: null });
  await expect(requireWorkspaceMember()).rejects.toThrow(
    "redirect:/sign-in?error=access",
  );
});

it("refuses a reviewer at the administrator boundary even with an active grant", async () => {
  await expect(requireAdministrator()).rejects.toThrow(
    "redirect:/sign-in?error=access",
  );
});

it("fails closed when review authorization cannot be checked", async () => {
  mocks.rpc.mockResolvedValue({
    data: null,
    error: { message: "unavailable" },
  });
  await expect(requireWorkspaceMember()).rejects.toThrow(
    "redirect:/sign-in?error=access",
  );
});

it("does not accept unconfirmed or invalid authentication", async () => {
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "reviewer", email_confirmed_at: null } },
    error: null,
  });
  await expect(requireWorkspaceMember()).rejects.toThrow("redirect:/sign-in");
  mocks.getUser.mockResolvedValue({
    data: { user: null },
    error: { message: "invalid" },
  });
  await expect(requireWorkspaceMember()).rejects.toThrow("redirect:/sign-in");
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("preserves administrator access without a reviewer grant", async () => {
  mocks.profile.mockResolvedValue({
    data: { id: "administrator", role: "admin" },
    error: null,
  });
  expect((await requireAdministrator()).profile.role).toBe("admin");
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("refuses missing profiles and unsupported roles", async () => {
  mocks.profile.mockResolvedValue({ data: null, error: null });
  await expect(requireWorkspaceMember()).rejects.toThrow(
    "redirect:/sign-in?error=access",
  );
  mocks.profile.mockResolvedValue({ data: { role: "owner" }, error: null });
  await expect(requireWorkspaceMember()).rejects.toThrow(
    "redirect:/sign-in?error=access",
  );
});
