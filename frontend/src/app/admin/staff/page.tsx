"use client";

import { BaseLayout } from "@/components/layouts/base-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useUser } from "@/contexts/user-context";
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { useState } from "react";

interface StaffRow {
  name: string;
  full_name: string;
  enabled: number;
  mobile_no: string | null;
  roles: string;
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

function AddStaffForm({ canAddLandlord, onAdded }: { canAddLandlord: boolean; onAdded: () => void }) {
  const { call, loading } = useFrappePostCall(
    "kings_manage.kings_manage.portal_api.create_staff_user",
  );
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setAdded(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const value = (key: string) => (formData.get(key) as string) || undefined;
    try {
      await call({
        email: value("email"),
        first_name: value("first_name"),
        last_name: value("last_name"),
        mobile_no: value("mobile_no"),
        role: value("role") || "Caretaker",
        password: value("password"),
      });
      setAdded(value("email") || null);
      form.reset();
      onAdded();
    } catch (err: any) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a {canAddLandlord ? "staff member" : "Caretaker"}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Tenants don't need to be added here: they set up their own account from the link they
          get once their application is approved.
        </p>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="first_name">First Name</Label>
            <Input id="first_name" name="first_name" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="last_name">Last Name</Label>
            <Input id="last_name" name="last_name" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mobile_no">Phone</Label>
            <Input id="mobile_no" name="mobile_no" placeholder="e.g. 0712 345 678" />
          </div>
          {canAddLandlord && (
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <NativeSelect id="role" name="role" defaultValue="Caretaker">
                <option value="Caretaker">Caretaker</option>
                <option value="Landlord">Landlord</option>
              </NativeSelect>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="password">Temporary Password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" />
            <span className="text-xs text-muted-foreground">
              Leave blank to email them a set-your-password link instead (needs outgoing email set
              up).
            </span>
          </div>
          {error && <div className="text-sm text-destructive sm:col-span-2">{error}</div>}
          {added && (
            <div className="text-sm text-primary sm:col-span-2">
              {added} can now sign in to the portal.
            </div>
          )}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={loading} className="cursor-pointer">
              {loading ? "Adding..." : "Add Account"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function AdminStaffPage() {
  const { user } = useUser();
  const roles: string[] = (user?.roles || []).map((r: any) => r.role);
  const canAddLandlord = roles.includes("System Manager");

  const { data, error, isLoading, mutate } = useFrappeGetCall<{ message: StaffRow[] }>(
    "kings_manage.kings_manage.portal_api.get_staff",
  );
  const staff = data?.message;

  return (
    <BaseLayout title="Staff" description="Landlords and Caretakers who can manage your properties">
      <div className="px-4 lg:px-6 flex flex-col gap-6">
        <AddStaffForm canAddLandlord={canAddLandlord} onAdded={() => mutate()} />

        <Card>
          <CardContent>
            {isLoading && (
              <div className="flex justify-center py-8">
                <Spinner className="size-6" />
              </div>
            )}
            {!isLoading && error && <p className="text-destructive">Could not load staff.</p>}
            {!isLoading && staff && staff.length === 0 && (
              <p className="text-muted-foreground text-sm">No staff accounts yet.</p>
            )}
            {!isLoading && staff && staff.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((s) => (
                    <TableRow key={s.name}>
                      <TableCell className="font-medium">{s.full_name}</TableCell>
                      <TableCell>{s.name}</TableCell>
                      <TableCell>{s.mobile_no || "-"}</TableCell>
                      <TableCell>{s.roles.split(",").join(", ")}</TableCell>
                      <TableCell>
                        <Badge variant={s.enabled ? "default" : "secondary"}>
                          {s.enabled ? "Active" : "Disabled"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </BaseLayout>
  );
}
