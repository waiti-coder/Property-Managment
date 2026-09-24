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
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { Fragment, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

interface UnitRow {
  name: string;
  unit_number: string;
  floor: string | null;
  property: string;
  unit_type: string | null;
  rent_amount: number;
  status: string;
}

interface PropertyOption {
  name: string;
  property_name: string;
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(
    value || 0,
  );
}

function AddUnitForm({
  properties,
  onAdded,
}: {
  properties: PropertyOption[];
  onAdded: () => void;
}) {
  const { call, loading } = useFrappePostCall("kings_manage.kings_manage.portal_api.create_unit");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      await call({
        property: formData.get("property") as string,
        unit_number: formData.get("unit_number") as string,
        floor: (formData.get("floor") as string) || undefined,
        unit_type: (formData.get("unit_type") as string) || undefined,
        rent_amount: Number(formData.get("rent_amount")) || undefined,
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
        <CardTitle>Register a Unit</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="property">Property</Label>
            <NativeSelect id="property" name="property" defaultValue="" required>
              <option value="" disabled>
                Select a property
              </option>
              {properties.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.property_name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="unit_number">Unit / House Number</Label>
            <Input id="unit_number" name="unit_number" placeholder="e.g. A-04" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="floor">Floor</Label>
            <Input id="floor" name="floor" placeholder="e.g. 1, Ground" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="unit_type">Unit Type</Label>
            <Input id="unit_type" name="unit_type" placeholder="e.g. 1-Bedroom" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rent_amount">Monthly Rent (KES)</Label>
            <Input id="rent_amount" name="rent_amount" type="number" min="0" />
          </div>
          {error && <div className="text-sm text-destructive sm:col-span-2">{error}</div>}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={loading} className="cursor-pointer">
              {loading ? "Saving..." : "Add Unit"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function RegisterTenantForm({
  unit,
  onRegistered,
  onCancel,
}: {
  unit: string;
  onRegistered: () => void;
  onCancel: () => void;
}) {
  const { call, loading } = useFrappePostCall(
    "kings_manage.kings_manage.portal_api.register_tenant",
  );
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      await call({
        unit,
        full_name: formData.get("full_name") as string,
        phone: formData.get("phone") as string,
        email: formData.get("email") as string,
        id_passport_number: (formData.get("id_passport_number") as string) || undefined,
        move_in_date: (formData.get("move_in_date") as string) || undefined,
      });
      setDone(true);
      onRegistered();
    } catch (err: any) {
      setError(extractErrorMessage(err));
    }
  };

  if (done) {
    return (
      <div className="text-sm">
        Tenant registered - it now needs approval on the{" "}
        <Link to="/admin/applications" className="underline">
          Applications
        </Link>{" "}
        page.
      </div>
    );
  }

  return (
    <form className="grid gap-3 sm:grid-cols-2 mt-3" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <Label htmlFor={`full_name-${unit}`}>Full Name</Label>
        <Input id={`full_name-${unit}`} name="full_name" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`phone-${unit}`}>Phone</Label>
        <Input id={`phone-${unit}`} name="phone" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`email-${unit}`}>Email</Label>
        <Input id={`email-${unit}`} name="email" type="email" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`id_passport_number-${unit}`}>ID/Passport Number</Label>
        <Input id={`id_passport_number-${unit}`} name="id_passport_number" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`move_in_date-${unit}`}>Move-in Date</Label>
        <Input id={`move_in_date-${unit}`} name="move_in_date" type="date" />
      </div>
      {error && <div className="text-sm text-destructive sm:col-span-2">{error}</div>}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="sm" disabled={loading} className="cursor-pointer">
          {loading ? "Registering..." : "Register Tenant"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} className="cursor-pointer">
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default function AdminUnitsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get("status") || "";
  const propertyFilter = searchParams.get("property") || "";

  const { data: propertiesResponse } = useFrappeGetCall<{ message: PropertyOption[] }>(
    "kings_manage.kings_manage.portal_api.get_properties",
  );
  const properties = propertiesResponse?.message || [];

  const {
    data: response,
    error,
    isLoading,
    mutate,
  } = useFrappeGetCall<{ message: UnitRow[] }>(
    "kings_manage.kings_manage.portal_api.get_units",
    { property: propertyFilter || undefined, status: statusFilter || undefined },
  );
  const units = response?.message;
  const [registeringUnit, setRegisteringUnit] = useState<string | null>(null);

  const updateFilter = (key: "status" | "property", value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  return (
    <BaseLayout title="Units" description="Every house/unit across all your properties">
      <div className="px-4 lg:px-6 flex flex-col gap-6">
        <AddUnitForm properties={properties} onAdded={() => mutate()} />

        <Card>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-3">
              <NativeSelect
                value={propertyFilter}
                onChange={(e) => updateFilter("property", e.target.value)}
                className="w-fit"
              >
                <option value="">All Properties</option>
                {properties.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.property_name}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect
                value={statusFilter}
                onChange={(e) => updateFilter("status", e.target.value)}
                className="w-fit"
              >
                <option value="">All Statuses</option>
                <option value="Vacant">Vacant</option>
                <option value="Reserved">Reserved</option>
                <option value="Occupied">Occupied</option>
                <option value="Under Maintenance">Under Maintenance</option>
              </NativeSelect>
            </div>

            {isLoading && (
              <div className="flex justify-center py-8">
                <Spinner className="size-6" />
              </div>
            )}
            {!isLoading && error && <p className="text-destructive">Could not load units.</p>}
            {!isLoading && units && units.length === 0 && (
              <p className="text-muted-foreground text-sm">No units match this filter.</p>
            )}
            {!isLoading && units && units.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unit</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Floor</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Rent</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {units.map((u) => (
                    <Fragment key={u.name}>
                      <TableRow>
                        <TableCell className="font-medium">{u.unit_number}</TableCell>
                        <TableCell>{u.property}</TableCell>
                        <TableCell>{u.floor || "-"}</TableCell>
                        <TableCell>{u.unit_type || "-"}</TableCell>
                        <TableCell>{formatCurrency(u.rent_amount)}</TableCell>
                        <TableCell>
                          <Badge variant={u.status === "Vacant" ? "default" : "secondary"}>
                            {u.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {u.status === "Vacant" && registeringUnit !== u.name && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="cursor-pointer"
                              onClick={() => setRegisteringUnit(u.name)}
                            >
                              Register Tenant
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      {registeringUnit === u.name && (
                        <TableRow>
                          <TableCell colSpan={7}>
                            <RegisterTenantForm
                              unit={u.name}
                              onRegistered={() => mutate()}
                              onCancel={() => setRegisteringUnit(null)}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
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
