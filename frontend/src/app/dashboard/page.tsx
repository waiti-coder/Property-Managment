"use client";

import { BaseLayout } from "@/components/layouts/base-layout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "@/contexts/user-context";
import { cn } from "@/lib/utils";
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
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
  return err?.message || "Something went wrong. Please try again.";
}

function NoticeCard({
  noticeGiven,
  moveOutDate,
  onSubmitted,
}: {
  noticeGiven: boolean;
  moveOutDate: string | null;
  onSubmitted: () => void;
}) {
  const { call, loading } = useFrappePostCall<{ message: unknown }>(
    "kings_manage.kings_manage.portal_api.submit_notice",
  );
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (noticeGiven) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm">
            You've given notice to vacate on{" "}
            <span className="font-medium">{moveOutDate}</span>.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      await call({
        move_out_date: formData.get("move_out_date") as string,
        reason: (formData.get("reason") as string) || undefined,
      });
      onSubmitted();
    } catch (err: any) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notice to Vacate</CardTitle>
      </CardHeader>
      <CardContent>
        {!showForm && (
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => setShowForm(true)}
          >
            Give Notice
          </Button>
        )}
        {showForm && (
          <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
            <div className="grid gap-2 max-w-sm">
              <Label htmlFor="move_out_date">Intended move-out date</Label>
              <Input id="move_out_date" name="move_out_date" type="date" required />
            </div>
            <div className="grid gap-2 max-w-sm">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea id="reason" name="reason" placeholder="Let us know why you're leaving" />
            </div>
            {error && <div className="text-sm text-destructive">{error}</div>}
            <div>
              <Button type="submit" size="sm" disabled={loading} className="cursor-pointer">
                {loading ? "Submitting..." : "Submit Notice"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

interface DashboardInvoice {
  name: string;
  posting_date: string;
  status: string;
}

interface DashboardData {
  unit: string | null;
  property: string | null;
  lease_status: string | null;
  rent_balance: number;
  water_balance: number;
  deposit_amount: number;
  deposit_paid: boolean;
  recent_invoices: DashboardInvoice[];
  notice_given: number;
  move_out_date: string | null;
}

interface Issue {
  name: string;
  subject: string;
  status: string;
}

interface AdminStats {
  expected_monthly_rent: number;
  collected_rent_this_month: number;
  property_count: number;
  unit_count: number;
  vacant_count: number;
  issues_this_month: number;
  notices_count: number;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" })
    .format(value || 0)
    .replace("KES", "KES ");
}

function receiptUrl(invoiceName: string) {
  return `/api/method/frappe.utils.print_format.download_pdf?doctype=Sales%20Invoice&name=${encodeURIComponent(
    invoiceName,
  )}&format=Standard`;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-primary text-xs font-semibold tracking-widest uppercase">
      {children}
    </p>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

function Header({ firstName, fullName }: { firstName: string; fullName: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <Eyebrow>Karibu</Eyebrow>
          <h1 className="text-3xl font-semibold">Habari, {firstName}</h1>
        </div>
        <Avatar className="size-10">
          <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
            {initials(fullName)}
          </AvatarFallback>
        </Avatar>
      </CardContent>
    </Card>
  );
}

function StatCard({
  label,
  value,
  to,
}: {
  label: string;
  value: string | number;
  to?: string;
}) {
  const content = (
    <CardContent className="flex flex-col gap-1">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </CardContent>
  );

  if (to) {
    return (
      <Link to={to}>
        <Card className="transition-colors hover:bg-accent/50 cursor-pointer">{content}</Card>
      </Link>
    );
  }

  return <Card>{content}</Card>;
}

function AdminDashboard({ firstName, fullName }: { firstName: string; fullName: string }) {
  const { data: response, isLoading } = useFrappeGetCall<{ message: AdminStats }>(
    "kings_manage.kings_manage.portal_api.get_admin_dashboard",
  );
  const stats = response?.message;

  return (
    <BaseLayout>
      <div className="px-4 lg:px-6 flex flex-col gap-6">
        <Header firstName={firstName} fullName={fullName} />

        {isLoading && (
          <div className="flex justify-center py-12">
            <Spinner className="size-6" />
          </div>
        )}

        {!isLoading && stats && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard label="Expected Monthly Rent" value={formatCurrency(stats.expected_monthly_rent)} />
              <StatCard label="Collected This Month" value={formatCurrency(stats.collected_rent_this_month)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-5">
              <StatCard label="Properties" value={stats.property_count} to="/admin/properties" />
              <StatCard label="Units" value={stats.unit_count} to="/admin/units" />
              <StatCard label="Vacant Units" value={stats.vacant_count} to="/admin/units?status=Vacant" />
              <StatCard label="Issues This Month" value={stats.issues_this_month} to="/admin/issues" />
              <StatCard label="Notices" value={stats.notices_count} to="/admin/notices" />
            </div>
          </>
        )}
      </div>
    </BaseLayout>
  );
}

function TenantDashboard({ firstName, fullName }: { firstName: string; fullName: string }) {
  const { data: dashboardResponse, isLoading, mutate: mutateDashboard } = useFrappeGetCall<{
    message: DashboardData;
  }>("kings_manage.kings_manage.portal_api.get_my_dashboard");
  const data = dashboardResponse?.message;
  const { data: issuesResponse } = useFrappeGetCall<{ message: Issue[] }>(
    "kings_manage.kings_manage.portal_api.get_my_issues",
  );
  const issues = issuesResponse?.message;

  return (
    <BaseLayout>
      <div className="px-4 lg:px-6 flex flex-col gap-6">
        <Header firstName={firstName} fullName={fullName} />

        {isLoading && (
          <div className="flex justify-center py-12">
            <Spinner className="size-6" />
          </div>
        )}

        {!isLoading && data && (
          <>
            {data.unit && (
              <Card className="border-l-4 border-l-primary py-4">
                <CardContent className="flex flex-col gap-1">
                  <p className="text-muted-foreground text-sm">
                    Unit {data.unit}
                    {data.property ? ` · ${data.property}` : ""}
                  </p>
                  <p className="font-medium">
                    Lease {(data.lease_status || "pending").toLowerCase()}
                  </p>
                </CardContent>
              </Card>
            )}

            {data.lease_status === "Active" && (
              <NoticeCard
                noticeGiven={!!data.notice_given}
                moveOutDate={data.move_out_date}
                onSubmitted={() => mutateDashboard()}
              />
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="flex flex-col gap-1">
                  <p className="text-muted-foreground text-sm">Rent balance</p>
                  <p className="text-2xl font-bold">{formatCurrency(data.rent_balance)}</p>
                  {data.rent_balance > 0 ? (
                    <Link to="/payments" className="text-primary text-sm hover:underline">
                      Pay now
                    </Link>
                  ) : (
                    <p className="text-success text-sm">Settled</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col gap-1">
                  <p className="text-muted-foreground text-sm">Deposit</p>
                  <p className="text-primary text-2xl font-bold">
                    {formatCurrency(data.deposit_amount)}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {data.deposit_paid ? "Held / Paid" : "Pending"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col gap-1">
                  <p className="text-muted-foreground text-sm">Water bill</p>
                  <p className="text-2xl font-bold">{formatCurrency(data.water_balance)}</p>
                  {data.water_balance > 0 ? (
                    <Link to="/payments" className="text-primary text-sm hover:underline">
                      Pay now
                    </Link>
                  ) : (
                    <p className="text-success text-sm">Settled</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {!isLoading && !data && (
          <Card>
            <CardContent className="text-muted-foreground text-center py-8">
              Your tenancy details will show up here once your lease is active.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">Issues</h2>
              <Button asChild size="sm" className="cursor-pointer">
                <Link to="/issues">+ Report issue</Link>
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {!issues?.length && (
                <p className="text-muted-foreground text-sm">No issues reported yet.</p>
              )}
              {issues?.slice(0, 4).map((issue) => (
                <div key={issue.name} className="flex items-center justify-between text-sm">
                  <span>{issue.subject}</span>
                  <span
                    className={cn(
                      issue.status === "Resolved" || issue.status === "Closed"
                        ? "text-success"
                        : "text-primary",
                    )}
                  >
                    {issue.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {!!data?.recent_invoices?.length && (
          <Card>
            <CardContent className="flex flex-col gap-4">
              <h2 className="font-medium">Payment history</h2>
              <div className="flex flex-col gap-2">
                {data.recent_invoices.map((invoice) => (
                  <div
                    key={invoice.name}
                    className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0"
                  >
                    <span className="text-muted-foreground">
                      {new Date(invoice.posting_date).toLocaleString("en-KE", {
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className={invoice.status === "Paid" ? "text-success" : "text-primary"}>
                        {invoice.status}
                      </span>
                      {invoice.status === "Paid" && (
                        <a
                          href={receiptUrl(invoice.name)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary text-xs hover:underline"
                        >
                          Download Receipt
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </BaseLayout>
  );
}

export default function DashboardPage() {
  const { user } = useUser();
  const firstName = user?.first_name || user?.full_name || "there";
  const fullName = user?.full_name || firstName;
  const roles: string[] = (user?.roles || []).map((r: any) => r.role);
  const isStaff = roles.includes("Landlord") || roles.includes("Caretaker");

  if (isStaff) {
    return <AdminDashboard firstName={firstName} fullName={fullName} />;
  }

  return <TenantDashboard firstName={firstName} fullName={fullName} />;
}
