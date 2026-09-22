"use client";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFrappePostCall } from "frappe-react-sdk";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

interface SubmitInterestResponse {
  lease: string;
  token: string;
}

export default function PropertyBookingPage() {
  const { property } = useParams<{ property: string }>();
  const navigate = useNavigate();
  // useFrappePostCall resolves with the raw response body ({ message: ... }),
  // it does not unwrap `message` the way useFrappeGetCall does.
  const { call, loading } = useFrappePostCall<{ message: SubmitInterestResponse }>(
    "kings_manage.kings_manage.portal_api.submit_property_interest",
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);

    try {
      const result = await call({
        property: property,
        full_name: formData.get("full_name") as string,
        phone: formData.get("phone") as string,
        email: formData.get("email") as string,
        id_passport_number: (formData.get("id_passport_number") as string) || undefined,
        move_in_date: (formData.get("move_in_date") as string) || undefined,
      });

      navigate(`/apply/status?token=${encodeURIComponent(result.message.token)}`);
    } catch (err: any) {
      setError(
        err?._server_messages
          ? JSON.parse(JSON.parse(err._server_messages)[0]).message
          : err?.message || "Something went wrong. Please try again.",
      );
    }
  };

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-lg">
        <Card className="overflow-hidden">
          <CardContent>
            <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
              <div className="flex justify-center mb-2">
                <Link to="/properties" className="flex items-center gap-2 font-medium">
                  <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
                    <Logo size={24} />
                  </div>
                  <span className="text-xl">Kings Manage</span>
                </Link>
              </div>
              <div className="flex flex-col items-center text-center">
                <h1 className="text-2xl font-bold">I'm interested in this house</h1>
                <p className="text-muted-foreground text-balance">
                  Tell us a bit about yourself and we'll get back to you. No account needed yet.
                </p>
              </div>

              <div className="grid gap-3">
                <Label htmlFor="full_name">Full Name</Label>
                <Input id="full_name" name="full_name" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-3">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" name="phone" type="tel" required />
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-3">
                  <Label htmlFor="id_passport_number">ID / Passport Number</Label>
                  <Input id="id_passport_number" name="id_passport_number" />
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="move_in_date">Preferred Move-in Date</Label>
                  <Input id="move_in_date" name="move_in_date" type="date" />
                </div>
              </div>

              {error && (
                <div className="text-sm text-destructive text-center">{error}</div>
              )}

              <Button type="submit" className="w-full cursor-pointer" disabled={loading}>
                {loading ? "Submitting..." : "Submit Application"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
