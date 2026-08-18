import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import { useHealth, useLogin, useRegistrationStatus } from "@/lib/api/hooks";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import foliumLogo from "@/assets/brand/folium_logo.svg";
import bgLogin from "@/assets/brand/bg_login.png";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

const fieldClassName =
  "h-[52px] rounded-[12px] border-[rgba(148,163,184,0.24)] bg-[rgba(15,23,42,0.30)] " +
  "text-[14px] text-[#F8FAFC] placeholder:text-[#94A3B8] " +
  "focus-visible:border-[rgba(45,212,191,0.65)] focus-visible:ring-0 " +
  "focus-visible:shadow-[0_0_0_3px_rgba(45,212,191,0.12)]";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const notice =
    typeof location.state === "object" &&
    location.state &&
    "notice" in location.state &&
    typeof (location.state as { notice?: unknown }).notice === "string"
      ? (location.state as { notice: string }).notice
      : null;
  const login = useLogin();
  const { data: regStatus } = useRegistrationStatus();
  const { data: health } = useHealth();
  const version = health?.version?.trim();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      await login.mutateAsync(data);
      navigate("/documents", { replace: true });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Invalid username or password";
      setError("root", { message });
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F8FAFC] p-6">
      <img
        src={bgLogin}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-70"
      />

      <div
        className={cn(
          "relative z-10 w-full max-w-full rounded-[24px] border border-[rgba(148,163,184,0.14)]",
          "bg-navbar px-5 py-7 text-[#F8FAFC]",
          "shadow-[0_20px_50px_rgba(2,6,23,0.26),0_6px_18px_rgba(2,6,23,0.16)]",
          "sm:max-w-[520px] sm:p-8",
          "lg:max-w-[560px] lg:px-12 lg:pt-10 lg:pb-8",
        )}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <img
            src={foliumLogo}
            alt=""
            height={52}
            className="h-[52px] w-auto object-contain"
            aria-hidden="true"
          />
          <h1 className="text-[56px] leading-none font-bold tracking-[-0.03em] text-[#F8FAFC]">
            Folium
          </h1>
          <div className="flex items-center justify-center gap-2.5">
            {version ? (
              <span className="inline-flex h-9 items-center rounded-[10px] border border-[rgba(45,212,191,0.35)] bg-[rgba(13,148,136,0.10)] px-4 text-sm font-semibold text-[#2DD4BF]">
                v{version.replace(/^v/i, "")}
              </span>
            ) : null}
            <span className="inline-flex h-9 items-center rounded-[10px] border border-[rgba(148,163,184,0.12)] bg-[rgba(148,163,184,0.10)] px-4 text-sm font-medium text-[#CBD5E1] shadow-[0_3px_10px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.03)]">
              Beta
            </span>
          </div>
        </div>

        <div className="mt-3 mb-7 text-center">
          <h2 className="text-2xl font-semibold text-[#F8FAFC]">Welcome back</h2>
          <p className="mt-1 text-base font-normal text-[#94A3B8]">
            Sign in to access your documents
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          {notice && (
            <p className="rounded-lg bg-[rgba(148,163,184,0.10)] px-3 py-2 text-sm text-[#CBD5E1]">
              {notice}
            </p>
          )}

          <div>
            <label
              htmlFor="username"
              className="text-sm font-semibold text-[#E2E8F0]"
            >
              Username
            </label>
            <div className="relative mt-1.5">
              <User
                className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#CBD5E1]"
                aria-hidden="true"
              />
              <Input
                id="username"
                autoComplete="username"
                placeholder="Enter your username"
                className={cn(fieldClassName, "pl-11")}
                {...register("username")}
              />
            </div>
            {errors.username && (
              <p className="mt-1 text-xs text-danger">{errors.username.message}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="text-sm font-semibold text-[#E2E8F0]"
            >
              Password
            </label>
            <div className="relative mt-1.5">
              <Lock
                className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#CBD5E1]"
                aria-hidden="true"
              />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                className={cn(fieldClassName, "pr-11 pl-11")}
                {...register("password")}
              />
              <button
                type="button"
                className="absolute top-1/2 right-3.5 -translate-y-1/2 text-[#CBD5E1] transition-colors hover:text-[#F8FAFC]"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((open) => !open)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-danger">{errors.password.message}</p>
            )}
            <p className="mt-2 text-right">
              <Link
                to="/forgot-password"
                className="text-sm font-medium text-[#2DD4BF] transition-colors hover:text-[#5EEAD4]"
              >
                Forgot password?
              </Link>
            </p>
          </div>

          {errors.root && (
            <p className="text-center text-xs text-danger">{errors.root.message}</p>
          )}

          <Button
            type="submit"
            disabled={login.isPending}
            className={cn(
              "mt-2 h-[54px] w-full rounded-[12px] border-0 text-lg font-semibold text-white",
              "bg-[linear-gradient(180deg,#14B8A6_0%,#0F766E_100%)]",
              "shadow-[0_10px_24px_rgba(20,184,166,0.18)] hover:bg-[linear-gradient(180deg,#14B8A6_0%,#0F766E_100%)] hover:opacity-95",
            )}
          >
            {login.isPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="mt-5 mb-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-[rgba(148,163,184,0.20)]" />
          <span className="text-sm text-[#94A3B8]">or</span>
          <span className="h-px flex-1 bg-[rgba(148,163,184,0.20)]" />
        </div>

        <p className="text-center text-sm font-normal text-[#94A3B8]">
          Self-hosted. Your data stays under your control.
        </p>

        {(regStatus?.allow_registration ?? true) && (
          <p className="mt-3 text-center text-sm text-[#94A3B8]">
            New here?{" "}
            <Link
              to="/register"
              className="font-medium text-[#2DD4BF] transition-colors hover:text-[#5EEAD4]"
            >
              Create an account
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
