"use client";

import { BaseLayout } from "@/components/layouts/base-layout";
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
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { useState } from "react";

interface PropertyRow {
  name: string;
  property_name: string;
  property_type: string | null;
  address: string | null;
  county: string | null;
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

function AddPropertyForm({ onAdded }: { onAdded: () => void }) {
  const { call, loading } = useFrappePostCall(
    "kings_manage.kings_manage.portal_api.create_property",
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      await call({
        property_name: formData.get("property_name") as string,
        property_type: (formData.get("property_type") as string) || undefined,
        address: (formData.get("address") as string) || undefined,
        county: (formData.get("county") as string) || undefined,
      });
      (e.target as HTMLFormElement).reset();
      onAdded();
    } catch (err: any) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Register a Property</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="property_name">Property Name</Label>
            <Input id="property_name" name="property_name" placeholder="e.g. Kileleshwa Gardens" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="property_type">Type</Label>
            <NativeSelect id="property_type" name="property_type" defaultValue="">
              <option value="" disabled>
                Select a type
              </option>
              <option value="Estate">Estate</option>
              <option value="Building">Building</option>
            </NativeSelect>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" placeholder="Street address" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="county">County</Label>
            <Input id="county" name="county" placeholder="e.g. Nairobi" />
          </div>
          {error && <div className="text-sm text-destructive sm:col-span-2">{error}</div>}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={loading} className="cursor-pointer">
              {loading ? "Saving..." : "Add Property"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function AdminPropertiesPage() {
  const { data: response, error, isLoading, mutate } = useFrappeGetCall<{ message: PropertyRow[] }>(
    "kings_manage.kings_manage.portal_api.get_properties",
  );
  const properties = response?.message;

  return (
    <BaseLayout title="Properties" description="Every building/estate registered in Kings Manage">
      <div className="px-4 lg:px-6 flex flex-col gap-6">
        <AddPropertyForm onAdded={() => mutate()} />

        <Card>
          <CardContent>
            {isLoading && (
              <div className="flex justify-center py-8">
                <Spinner className="size-6" />
              </div>
            )}
            {!isLoading && error && <p className="text-destructive">Could not load properties.</p>}
            {!isLoading && properties && properties.length === 0 && (
              <p className="text-muted-foreground text-sm">No properties registered yet.</p>
            )}
            {!isLoading && properties && properties.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>County</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {properties.map((p) => (
                    <TableRow key={p.name}>
                      <TableCell className="font-medium">{p.property_name}</TableCell>
                      <TableCell>{p.property_type || "-"}</TableCell>
                      <TableCell>{p.address || "-"}</TableCell>
                      <TableCell>{p.county || "-"}</TableCell>
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
