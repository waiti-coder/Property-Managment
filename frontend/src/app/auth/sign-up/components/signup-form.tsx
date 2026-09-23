"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useFrappePostCall } from "frappe-react-sdk";
import { useState } from "react";
import { Link } from "react-router-dom";

function extractErrorMessage(err: any): string {
  try {
    if (err?._server_messages) {
      return JSON.parse(JSON.parse(err._server_messages)[0]).message;
    }
  } catch {
    // fall through
  }
  if (err?.httpStatus === 429) {
    return "Too many sign-up attempts. Please try again in an hour.";
  }
  return err?.message || "Something went wrong. Please try again.";
}

/** Landlord self sign-up. Tenants don't sign up here: they apply for a house
 * and set up their account from the link they get once approved. */
export function SignupForm({ className, ...props }: React.ComponentProps<"div">) {
  const { call, loading } = useFrappePostCall(
    "kings_manage.kings_manage.portal_api.register_landlord",
  );
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const value = (key: string) => ((formData.get(key) as string) || "").trim();

    if (value("password") !== value("confirm_password")) {
      setError("The passwords don't match.");
      return;
    }

    try {
      await call({
        first_name: value("first_name"),
        last_name: value("last_name") || undefined,
        email: value("email"),
        mobile_no: value("mobile_no") || undefined,
        password: value("password"),
      });
      // Full reload so the new session (and its CSRF token) is picked up.
      window.location.href = "/rental-portal/admin/properties";
    } catch (err: any) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden">
        <CardContent>
          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            <div className="flex flex-col items-center text-center gap-1">
              <h1 className="text-2xl font-semibold">Kings Manage</h1>
              <p className="text-primary text-sm">List and manage your properties</p>
              <p className="text-muted-foreground text-sm mt-2">
                Create a landlord account. Only you and the caretakers you add will see your
                properties, tenants and payments.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input id="first_name" name="first_name" autoComplete="given-name" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input id="last_name" name="last_name" autoComplete="family-name" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mobile_no">Phone</Label>
              <Input
                id="mobile_no"
                name="mobile_no"
                type="tel"
                autoComplete="tel"
                placeholder="e.g. 0712 345 678"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm_password">Confirm Password</Label>
              <Input
                id="confirm_password"
                name="confirm_password"
                type="password"
                autoComplete="new-password"
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="terms" checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} />
              <Label htmlFor="terms" className="text-sm font-normal">
                I agree to the Terms of Service and Privacy Policy
              </Label>
            </div>
            {error && <div className="text-sm text-destructive">{error}</div>}
            <Button type="submit" disabled={loading || !agreed} className="w-full cursor-pointer">
              {loading ? "Creating account..." : "Create Landlord Account"}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/auth/sign-in" className="text-primary underline underline-offset-4">
                Sign in
              </Link>
            </div>
            <div className="text-center text-xs text-muted-foreground">
              Looking for a house?{" "}
              <Link to="/properties" className="underline underline-offset-4">
                Browse available properties
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
