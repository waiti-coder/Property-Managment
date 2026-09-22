"use client";

import { BaseLayout } from "@/components/layouts/base-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useFrappeGetCall } from "frappe-react-sdk";
import { Building2, Layers, MapPin } from "lucide-react";
import { Link, useParams } from "react-router-dom";

interface PropertyDetail {
  name: string;
  unit_number: string;
  floor: string | null;
  unit_type: string | null;
  rent_amount: number;
  status: string;
  property: string;
  address: string | null;
  county: string | null;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(
    value || 0,
  );
}

export default function PropertyDetailsPage() {
  const { property } = useParams<{ property: string }>();
  const { data: response, error, isLoading } = useFrappeGetCall<{ message: PropertyDetail }>(
    "kings_manage.kings_manage.portal_api.get_property",
    { name: property },
    property ? undefined : null,
  );
  const data = response?.message;

  return (
    <BaseLayout title="Unit Details">
      <div className="px-4 lg:px-6">
        {isLoading && (
          <div className="flex justify-center py-12">
            <Spinner className="size-6" />
          </div>
        )}

        {!isLoading && (error || !data) && (
          <p className="text-destructive">This unit could not be found.</p>
        )}

        {!isLoading && data && (
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                {data.property} · Unit {data.unit_number}
              </CardTitle>
              <Badge variant={data.status === "Vacant" ? "default" : "secondary"}>
                {data.status}
              </Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {data.floor && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-4 w-4" /> Floor {data.floor}
                  </span>
                )}
                {data.unit_type && (
                  <span className="flex items-center gap-1">
                    <Layers className="h-4 w-4" /> {data.unit_type}
                  </span>
                )}
                {(data.address || data.county) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {[data.address, data.county].filter(Boolean).join(", ")}
                  </span>
                )}
              </div>

              <p className="text-lg font-semibold">{formatCurrency(data.rent_amount)} / month</p>

              {data.status === "Vacant" && (
                <div>
                  <Button asChild className="cursor-pointer">
                    <Link to={`/properties/${data.name}/book`}>Apply for this House</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </BaseLayout>
  );
}
