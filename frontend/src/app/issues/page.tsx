"use client";

import { BaseLayout } from "@/components/layouts/base-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useFrappeGetCall } from "frappe-react-sdk";
import { useState } from "react";

interface IssueRow {
  name: string;
  subject: string;
  status: string;
  category: string | null;
  opening_date: string;
  photo: string | null;
  resolution_details: string | null;
  resolution_photo: string | null;
}

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

export default function IssuesPage() {
  const { data: response, error, isLoading, mutate } = useFrappeGetCall<{ message: IssueRow[] }>(
    "kings_manage.kings_manage.portal_api.get_my_issues",
  );
  const data = response?.message;
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    setLoading(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await fetch(
        "/api/method/kings_manage.kings_manage.portal_api.report_issue",
        { method: "POST", credentials: "include", body: formData },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(extractErrorMessage(data));
      }
      form.reset();
      await mutate();
    } catch (err: any) {
      setFormError(err.message || "Could not submit your issue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseLayout title="Issues" description="Report and track problems with your unit">
      <div className="px-4 lg:px-6 flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Report an Issue</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="grid gap-2">
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" name="subject" placeholder="e.g. Leaking kitchen tap" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <NativeSelect id="category" name="category" defaultValue="">
                  <option value="" disabled>
                    Select a category
                  </option>
                  <option value="Plumbing">Plumbing</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Structural">Structural</option>
                  <option value="Other">Other</option>
                </NativeSelect>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Describe the issue in a bit more detail"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="file">Photo (optional)</Label>
                <Input id="file" name="file" type="file" accept="image/*" />
              </div>
              {formError && <div className="text-sm text-destructive">{formError}</div>}
              <div>
                <Button type="submit" disabled={loading} className="cursor-pointer">
                  {loading ? "Submitting..." : "Submit Issue"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your Issues</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {isLoading && (
              <div className="flex justify-center py-8">
                <Spinner className="size-6" />
              </div>
            )}
            {!isLoading && error && (
              <p className="text-destructive">Could not load your issues.</p>
            )}
            {!isLoading && data && data.length === 0 && (
              <p className="text-muted-foreground text-sm">You haven't reported any issues.</p>
            )}
            {!isLoading &&
              data?.map((row) => (
                <div key={row.name} className="flex flex-col gap-2 border-b border-border/50 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{row.subject}</p>
                      <p className="text-muted-foreground text-xs">
                        {row.category ? `${row.category} · ` : ""}
                        {row.opening_date}
                      </p>
                    </div>
                    <Badge
                      variant={row.status === "Closed" || row.status === "Resolved" ? "default" : "secondary"}
                    >
                      {row.status}
                    </Badge>
                  </div>
                  {row.photo && (
                    <img src={row.photo} alt="Issue photo" className="h-24 w-24 rounded-md object-cover" />
                  )}
                  {row.resolution_details && (
                    <div className="bg-muted/40 rounded-md p-2 text-sm">
                      <p className="text-muted-foreground text-xs">Resolution</p>
                      <p>{row.resolution_details}</p>
                      {row.resolution_photo && (
                        <img
                          src={row.resolution_photo}
                          alt="Resolution photo"
                          className="mt-2 h-24 w-24 rounded-md object-cover"
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}
          </CardContent>
        </Card>
      </div>
    </BaseLayout>
  );
}
