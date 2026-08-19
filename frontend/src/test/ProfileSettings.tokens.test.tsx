import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ProfileSettings } from "@/components/settings/ProfileSettings";

const mutateAsync = vi.fn();
const revokeMutate = vi.fn();
let mockTokens: Array<Record<string, unknown>> = [];
let mockSecret: string | null = "fol_secret_once";

vi.mock("@/lib/api/hooks", () => ({
  useSession: () => ({
    data: {
      user: {
        id: "user-1",
        username: "person",
        display_name: "Person",
        is_admin: false,
      },
      csrf_token: "test",
    },
  }),
  useMyUsage: () => ({ data: null }),
  useMySessions: () => ({ data: [], isLoading: false }),
  useRevokeSession: () => ({ mutate: vi.fn(), isPending: false }),
  useSignOutOtherSessions: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateProfile: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useChangePassword: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUploadAvatar: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteAvatar: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useApiTokens: () => ({ data: mockTokens, isLoading: false }),
  useCreateApiToken: () => ({
    mutateAsync,
    isPending: false,
  }),
  useRevokeApiToken: () => ({
    mutate: revokeMutate,
    isPending: false,
  }),
}));

describe("Profile settings chrome", () => {
  it("keeps password and tokens behind actions and does not invent 2FA", () => {
    render(
      <MemoryRouter>
        <ProfileSettings />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "Edit profile" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change password" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manage sessions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manage tokens" })).toBeInTheDocument();
    expect(screen.queryByText(/two-factor|2FA/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument();
  });
});

describe("Profile API tokens", () => {
  beforeEach(() => {
    mockTokens = [];
    mockSecret = "fol_secret_once";
    mutateAsync.mockReset();
    revokeMutate.mockReset();
    mutateAsync.mockImplementation(async (name: string) => {
      const created = {
        id: "tok-1",
        name,
        prefix: "fol_secret",
        created_at: "2026-08-18T00:00:00Z",
        last_used_at: null,
        token: mockSecret,
      };
      mockTokens = [
        {
          id: created.id,
          name: created.name,
          prefix: created.prefix,
          created_at: created.created_at,
          last_used_at: null,
        },
      ];
      return created;
    });
  });

  it("shows the secret once on create and lists prefix after", async () => {
    const { rerender } = render(
      <MemoryRouter>
        <ProfileSettings />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Manage tokens" }));
    fireEvent.change(screen.getByLabelText("Token name"), { target: { value: "Cursor" } });
    fireEvent.click(screen.getByRole("button", { name: "Create token" }));
    expect(mutateAsync).toHaveBeenCalledWith("Cursor");
    await screen.findByText("fol_secret_once");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByText("fol_secret_once")).not.toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <ProfileSettings />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Cursor/)).toBeInTheDocument();
    expect(screen.getByText(/fol_secret/)).toBeInTheDocument();
    expect(screen.queryByText("fol_secret_once")).not.toBeInTheDocument();
  });

  it("revokes a listed token", async () => {
    mockTokens = [
      {
        id: "tok-1",
        name: "Cursor",
        prefix: "fol_abcd",
        created_at: "2026-08-18T00:00:00Z",
        last_used_at: null,
      },
    ];
    revokeMutate.mockImplementation((id: string) => {
      mockTokens = mockTokens.filter((item) => item.id !== id);
    });
    const { rerender } = render(
      <MemoryRouter>
        <ProfileSettings />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Manage tokens" }));
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    expect(revokeMutate).toHaveBeenCalledWith("tok-1");
    rerender(
      <MemoryRouter>
        <ProfileSettings />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/Cursor/)).not.toBeInTheDocument();
    expect(screen.getByText("No API tokens yet.")).toBeInTheDocument();
  });
});
