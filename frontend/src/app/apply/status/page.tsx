"use client";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

interface ApplicationStatus {
  status: string;
  rejection_reason: string | null;
  can_submit_deposit: boolean;
  can_register: boolean;
  is_registered: boolean;
}

const STATE_LABELS: Record<string, string> = {
  Draft: "Getting started",
  Submitted: "Application received",
  "KYC Verification": "We're reviewing your application",
  "Awaiting Deposit": "Waiting on your deposit payment",
  Active: "Approved - your lease is ready",
  Rejected: "Not approved",
  Ended: "Lease ended",
};

function extractErrorMessage(err: any): string {
  try {
    if (err?._server_messages) {
      return JSON.parse(JSON.parse(err._server_messages)[0]).message;
    }
  } catch {
    // fall through
  }
  return err?.message || "Something went wrong. Please try again.";
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-lg">
        <Card className="overflow-hidden">
          <CardContent>
            <div className="flex flex-col gap-6">
              <div className="flex justify-center mb-2">
                <Link to="/properties" className="flex items-center gap-2 font-medium">
                  <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
                    <Logo size={24} />
                  </div>
                  <span className="text-xl">Kings Manage</span>
                </Link>
              </div>
              {children}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DepositProofForm({ token, onSubmitted }: { token: string; onSubmitted: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const body = new FormData();
    body.append("token", token);
    const reference = formData.get("reference") as string;
    if (reference) body.append("reference", reference);
    const file = formData.get("file") as File;
    if (file && file.size > 0) body.append("file", file);

    try {
      const res = await fetch(
        "/api/method/kings_manage.kings_manage.portal_api.submit_deposit_proof",
        {
          method: "POST",
          credentials: "include",
          headers: { "X-Frappe-CSRF-Token": (window as any).csrf_token },
          body,
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(extractErrorMessage(data));
      }
      onSubmitted();
    } catch (err: any) {
      setError(err.message || "Could not submit your payment proof.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="reference">M-Pesa / Bank Reference</Label>
        <Input id="reference" name="reference" placeholder="e.g. QFT4X7Y8Z9" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="file">Or attach a screenshot of the confirmation message</Label>
        <Input id="file" name="file" type="file" accept="image/*,.pdf" />
      </div>
      {error && <div className="text-sm text-destructive">{error}</div>}
      <Button type="submit" disabled={loading} className="cursor-pointer">
        {loading ? "Submitting..." : "Submit Payment Proof"}
      </Button>
    </form>
  );
}

function RegisterForm({ token }: { token: string }) {
  const { call, loading } = useFrappePostCall(
    "kings_manage.kings_manage.portal_api.complete_registration",
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirm = formData.get("confirm_password") as string;

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    try {
      await call({ token, password });
      window.location.href = "/rental-portal/dashboard";
    } catch (err: any) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="password">Choose a Password</Label>
        <Input id="password" name="password" type="password" required minLength={8} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirm_password">Confirm Password</Label>
        <Input id="confirm_password" name="confirm_password" type="password" required minLength={8} />
      </div>
      {error && <div className="text-sm text-destructive">{error}</div>}
      <Button type="submit" disabled={loading} className="cursor-pointer">
        {loading ? "Setting up your account..." : "Create My Account"}
      </Button>
    </form>
  );
}

export default function ApplicationStatusPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const { data: response, error, isLoading, mutate } = useFrappeGetCall<{ message: ApplicationStatus }>(
    "kings_manage.kings_manage.portal_api.get_application_status",
    { token },
    token ? undefined : null,
  );
  const data = response?.message;

  if (!token) {
    return (
      <Shell>
        <p className="text-center text-muted-foreground">
          This link is missing its tracking code. Please use the link from your application email.
        </p>
      </Shell>
    );
  }

  if (isLoading) {
    return (
      <Shell>
        <div className="flex justify-center">
          <Spinner className="size-6" />
        </div>
      </Shell>
    );
  }

  if (error || !data) {
    return (
      <Shell>
        <p className="text-center text-destructive">{extractErrorMessage(error)}</p>
      </Shell>
    );
  }

  const label = STATE_LABELS[data.status] || data.status;

  return (
    <Shell>
      <div className="flex flex-col items-center text-center gap-1">
        <h1 className="text-2xl font-bold">{label}</h1>
        {data.status === "Rejected" && data.rejection_reason && (
          <p className="text-muted-foreground text-balance">{data.rejection_reason}</p>
        )}
      </div>

      {data.is_registered && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-muted-foreground text-center text-balance">
            You're all set. Sign in to view your lease and payments.
          </p>
          <Button asChild className="cursor-pointer">
            <Link to="/auth/sign-in">Go to Sign In</Link>
          </Button>
        </div>
      )}

      {!data.is_registered && data.can_register && <RegisterForm token={token} />}

      {!data.is_registered && !data.can_register && data.can_submit_deposit && (
        <DepositProofForm token={token} onSubmitted={() => mutate()} />
      )}

      {!data.is_registered &&
        !data.can_register &&
        !data.can_submit_deposit &&
        data.status !== "Rejected" && (
          <p className="text-muted-foreground text-center text-balance">
            We'll keep you posted here as your application moves forward. You can bookmark this
            page or come back using the same link.
          </p>
        )}
    </Shell>
  );
}
