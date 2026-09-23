"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "@/contexts/user-context";
import { cn } from "@/lib/utils";
import { useFrappeAuth } from "frappe-react-sdk";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { login } = useFrappeAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading: isUserLoading } = useUser();
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const redirectAttempted = useRef(false);

  const performRedirect = () => {
    if (redirectAttempted.current) return;
    redirectAttempted.current = true;

    const searchParams = new URLSearchParams(location.search);
    const redirectTo = searchParams.get("redirect-to");

    if (redirectTo) {
      const decodedRedirect = decodeURIComponent(redirectTo);
      if (decodedRedirect.startsWith("/")) {
        navigate(decodedRedirect, { replace: true });
        return;
      }
    }

    navigate("/", { replace: true });
  };

  useEffect(() => {
    if (!isUserLoading && user) {
      performRedirect();
    }
  }, [user, isUserLoading]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;

    if (!username || !password) {
      setAuthError("Username and password are required");
      return;
    }

    try {
      setLoading(true);
      setAuthError(null);

      const result = await login({
        username: username,
        password: password,
      });

      console.log("Login result:", result);

      if (!result.full_name) {
        setAuthError(result.error || "Invalid login credentials");
        setLoading(false);
      } else {
        window.location.reload();
      }
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : "Invalid login credentials",
      );
      setLoading(false);
    }
  };

  if (isUserLoading) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card className="overflow-hidden p-0">
          <CardContent className="grid p-0 md:grid-cols-2">
            <div className="p-6 md:p-8 flex items-center justify-center min-h-[400px]">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <p className="text-muted-foreground">Loading...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden">
        <CardContent>
          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            <div className="flex flex-col items-center text-center gap-1">
              <h1 className="text-2xl font-semibold">Kings Manage</h1>
              <p className="text-primary text-sm">Karibu tena</p>
            </div>
            <div className="grid gap-3">
              <Label htmlFor="username" className="sr-only">
                Email address
              </Label>
              <Input
                id="username"
                type="text"
                name="username"
                placeholder="Email address"
                required
              />
            </div>
            <div className="grid gap-3">
              <div className="relative">
                <Label htmlFor="password" className="sr-only">
                  Password
                </Label>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Password"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <Link
                to="/auth/forgot-password"
                className="text-muted-foreground text-xs hover:text-primary hover:underline"
              >
                Forgot your password?
              </Link>
            </div>

            {authError && (
              <div className="text-sm text-destructive text-center">
                {authError}
              </div>
            )}

            <Button
              type="submit"
              className="w-full cursor-pointer"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              Are you a landlord?{" "}
              <Link
                to="/auth/sign-up"
                className="text-primary underline underline-offset-4"
              >
                Create an account
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
