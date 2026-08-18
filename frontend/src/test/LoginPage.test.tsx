import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LoginPage } from "@/features/auth/LoginPage";
import foliumLogo from "@/assets/brand/folium_logo.svg";
import bgLogin from "@/assets/brand/bg_login.png";

vi.mock("@/lib/api/hooks", () => ({
  useLogin: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRegistrationStatus: () => ({ data: { allow_registration: true } }),
  useHealth: () => ({ data: { status: "ok", version: "0.1.23" } }),
}));

function renderLogin() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe("Login page", () => {
  it("renders the redesigned brand, copy, and sign-in path", () => {
    renderLogin();

    expect(screen.getByRole("heading", { name: "Folium" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByText("Sign in to access your documents")).toBeInTheDocument();
    expect(screen.getByText("v0.1.23")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.queryByLabelText("Email address")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter your username")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter your password")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByText("Self-hosted. Your data stays under your control.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /continue with local account/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Continue with local account")).not.toBeInTheDocument();
  });

  it("uses the supplied logo and background assets", () => {
    const { container } = renderLogin();
    const images = Array.from(container.querySelectorAll("img"));
    expect(images.some((img) => img.getAttribute("src") === foliumLogo)).toBe(true);
    const background = images.find((img) => img.getAttribute("src") === bgLogin);
    expect(background).toBeInTheDocument();
    expect(background).toHaveClass("opacity-70");
  });
});
