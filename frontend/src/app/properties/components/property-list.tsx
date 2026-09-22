"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFrappeGetCall } from "frappe-react-sdk";
import { Link } from "react-router-dom";
import { AlertCircle, Building2, Eye, Layers } from "lucide-react";

interface Unit {
  name: string;
  unit_number: string;
  floor: string | null;
  property: string;
  unit_type: string | null;
  rent_amount: number;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(
    value || 0,
  );
}

export function PropertyListing() {
  const {
    data: response,
    isLoading,
    error,
    mutate,
  } = useFrappeGetCall<{ message: Unit[] }>(
    "kings_manage.kings_manage.portal_api.get_available_units",
    {},
    undefined,
    { revalidateOnFocus: true, revalidateOnReconnect: true },
  );

  const units = response?.message || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vacant Units</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center p-3 rounded-lg border gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-destructive">Error Loading Units</CardTitle>
            <CardDescription>{error.message || "Failed to load units"}</CardDescription>
          </div>
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => mutate()}>
            <Eye className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardHeader>
      </Card>
    );
  }

  if (units.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8 text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <AlertCircle className="h-4 w-4 mx-auto mb-2" />
          <p>No vacant units at the moment. Check back soon.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vacant Units</CardTitle>
        <CardDescription>{units.length} unit(s) available now</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {units.map((unit) => (
          <Link
            key={unit.name}
            to={`/properties/${unit.name}`}
            className="flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-4"
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary shrink-0">
              <Building2 className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-medium truncate">
                  {unit.property} · Unit {unit.unit_number}
                </h3>
                {unit.unit_type && (
                  <Badge variant="outline" className="text-xs">
                    <Layers className="h-3 w-3 mr-1" />
                    {unit.unit_type}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {unit.floor ? `Floor ${unit.floor} · ` : ""}
                {formatCurrency(unit.rent_amount)} / month
              </p>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
