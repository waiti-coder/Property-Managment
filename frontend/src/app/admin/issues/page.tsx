"use client";

import { BaseLayout } from "@/components/layouts/base-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useFrappeGetCall } from "frappe-react-sdk";
import { useState } from "react";

interface ManagedIssue {
  name: string;
  subject: string;
  description: string;
  status: string;
  category: string | null;
  unit: string | null;
  customer: string | null;
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

function ResolveForm({ issue, onResolved }: { issue: string; onResolved: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const body = new FormData();
    body.append("issue", issue);
    body.append("resolution_details", formData.get("resolution_details") as string);
    const file = formData.get("file") as File;
    if (file && file.size > 0) body.append("file", file);

    try {
      const res = await fetch(
        "/api/method/kings_manage.kings_manage.portal_api.resolve_issue",
        { method: "POST", credentials: "include", body },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(extractErrorMessage(data));
      }
      onResolved();
    } catch (err: any) {
      setError(err.message || "Could not resolve this issue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="flex flex-col gap-3 mt-3" onSubmit={handleSubmit}>
      <Textarea
        name="resolution_details"
        placeholder="What was done to fix this?"
        required
      />
      <input type="file" name="file" accept="image/*" className="text-sm" />
      {error && <div className="text-sm text-destructive">{error}</div>}
      <div>
        <Button type="submit" size="sm" disabled={loading} className="cursor-pointer">
          {loading ? "Saving..." : "Mark Resolved"}
        </Button>
      </div>
    </form>
  );
}

export default function ManageIssuesPage() {
  const { data: response, error, isLoading, mutate } = useFrappeGetCall<{ message: ManagedIssue[] }>(
    "kings_manage.kings_manage.portal_api.get_managed_issues",
  );
  const issues = response?.message;
  const [resolvingName, setResolvingName] = useState<string | null>(null);

  return (
    <BaseLayout title="Manage Issues" description="Every issue reported across all tenants">
      <div className="px-4 lg:px-6 flex flex-col gap-4">
        {isLoading && (
          <div className="flex justify-center py-12">
            <Spinner className="size-6" />
          </div>
        )}
        {!isLoading && error && <p className="text-destructive">Could not load issues.</p>}
        {!isLoading && issues && issues.length === 0 && (
          <p className="text-muted-foreground text-sm">No issues have been reported yet.</p>
        )}
        {!isLoading &&
          issues?.map((issue) => {
            const isOpen = issue.status !== "Closed" && issue.status !== "Resolved";
            return (
              <Card key={issue.name}>
                <CardContent className="flex flex-col gap-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{issue.subject}</p>
                      <p className="text-muted-foreground text-xs">
                        {issue.unit ? `Unit ${issue.unit} · ` : ""}
                        {issue.customer ? `${issue.customer} · ` : ""}
                        {issue.category ? `${issue.category} · ` : ""}
                        {issue.opening_date}
                      </p>
                    </div>
                    <Badge variant={isOpen ? "secondary" : "default"}>{issue.status}</Badge>
                  </div>
                  <p className="text-sm">{issue.description}</p>
                  {issue.photo && (
                    <img src={issue.photo} alt="Issue photo" className="h-24 w-24 rounded-md object-cover" />
                  )}

                  {!isOpen && issue.resolution_details && (
                    <div className="bg-muted/40 rounded-md p-2 text-sm">
                      <p className="text-muted-foreground text-xs">Resolution</p>
                      <p>{issue.resolution_details}</p>
                      {issue.resolution_photo && (
                        <img
                          src={issue.resolution_photo}
                          alt="Resolution photo"
                          className="mt-2 h-24 w-24 rounded-md object-cover"
                        />
                      )}
                    </div>
                  )}

                  {isOpen && resolvingName !== issue.name && (
                    <div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="cursor-pointer w-fit"
                        onClick={() => setResolvingName(issue.name)}
                      >
                        Resolve
                      </Button>
                    </div>
                  )}
                  {isOpen && resolvingName === issue.name && (
                    <ResolveForm
                      issue={issue.name}
                      onResolved={() => {
                        setResolvingName(null);
                        mutate();
                      }}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
      </div>
    </BaseLayout>
  );
}
