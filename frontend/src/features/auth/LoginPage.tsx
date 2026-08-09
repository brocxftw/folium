import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Leaf } from "lucide-react";
import { useLogin, useRegistrationStatus } from "@/lib/api/hooks";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiError } from "@/lib/api/client";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const notice =
    typeof location.state === "object" &&
    location.state &&
    "notice" in location.state &&
    typeof (location.state as { notice?: unknown }).notice === "string"
      ? (location.state as { notice: string }).notice
      : null;
  const login = useLogin();
  const { data: regStatus } = useRegistrationStatus();

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
    <div className="flex min-h-screen items-center justify-center bg-surface-muted p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-2">
            <Leaf className="h-7 w-7 text-accent" />
            <span className="text-2xl font-semibold text-text-primary tracking-tight">
              Folium
            </span>
          </div>
          <p className="text-sm text-text-secondary">
            Sign in to your document library
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="rounded-lg border border-surface-border bg-surface p-6 shadow-sm space-y-4"
        >
          {notice && (
            <p className="rounded bg-surface-muted px-2 py-1.5 text-xs text-text-secondary">
              {notice}
            </p>
          )}
          <div>
            <label htmlFor="username" className="text-xs font-medium text-text-secondary">
              Username
            </label>
            <Input
              id="username"
              autoComplete="username"
              className="mt-1"
              {...register("username")}
            />
            {errors.username && (
              <p className="mt-1 text-xs text-danger">{errors.username.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="text-xs font-medium text-text-secondary">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              className="mt-1"
              {...register("password")}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-danger">{errors.password.message}</p>
            )}
          </div>

          {errors.root && (
            <p className="text-xs text-danger text-center">{errors.root.message}</p>
          )}

          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending ? "Signing in…" : "Sign in"}
          </Button>

          <p className="text-center text-xs text-text-secondary">
            <Link to="/forgot-password" className="text-accent hover:underline">
              Forgot password?
            </Link>
          </p>

          {(regStatus?.allow_registration ?? true) && (
            <p className="text-center text-xs text-text-secondary">
              New here?{" "}
              <Link to="/register" className="text-accent hover:underline">
                Create an account
              </Link>
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
