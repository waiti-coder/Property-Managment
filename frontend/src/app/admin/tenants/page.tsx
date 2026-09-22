"use client";

import { BaseLayout } from "@/components/layouts/base-layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { useFrappeGetCall } from "frappe-react-sdk";
import { useSearchParams } from "react-router-dom";

interface TenantRow {
  name: string;
  tenant_name: string;
  status: string;
  rent_amount: number;
  unit: string | null;
  property: string | null;
}

interface PropertyOption {
  name: string;
  property_name: string;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(
    value || 0,
  );
}

export default function AdminTenantsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const propertyFilter = searchParams.get("property") || "";

  const { data: propertiesResponse } = useFrappeGetCall<{ message: PropertyOption[] }>(
    "kings_manage.kings_manage.portal_api.get_properties",
  );
  const properties = propertiesResponse?.message || [];

  const { data: response, error, isLoading } = useFrappeGetCall<{ message: TenantRow[] }>(
    "kings_manage.kings_manage.portal_api.get_tenants",
    { property: propertyFilter || undefined },
  );
  const tenants = response?.message;

  return (
    <BaseLayout title="Tenants" description="Everyone who has applied for or holds a lease">
      <div className="px-4 lg:px-6 flex flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col gap-4">
            <NativeSelect
              value={propertyFilter}
              onChange={(e) => {
                const next = new URLSearchParams(searchParams);
                if (e.target.value) next.set("property", e.target.value);
                else next.delete("property");
                setSearchParams(next);
              }}
              className="w-fit"
            >
              <option value="">All Properties</option>
              {properties.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.property_name}
                </option>
              ))}
            </NativeSelect>

            {isLoading && (
              <div className="flex justify-center py-8">
                <Spinner className="size-6" />
              </div>
            )}
            {!isLoading && error && <p className="text-destructive">Could not load tenants.</p>}
            {!isLoading && tenants && tenants.length === 0 && (
              <p className="text-muted-foreground text-sm">No tenants match this filter.</p>
            )}
            {!isLoading && tenants && tenants.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Rent</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((t) => (
                    <TableRow key={t.name}>
                      <TableCell className="font-medium">{t.tenant_name}</TableCell>
                      <TableCell>{t.unit || "-"}</TableCell>
                      <TableCell>{t.property || "-"}</TableCell>
                      <TableCell>{formatCurrency(t.rent_amount)}</TableCell>
                      <TableCell>
                        <Badge variant={t.status === "Active" ? "default" : "secondary"}>
                          {t.status}
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
