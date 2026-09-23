"use client";

import { BaseLayout } from "@/components/layouts/base-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { useFrappeGetCall } from "frappe-react-sdk";
import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

interface BuildingRow {
  name: string;
  property_name: string;
  lease_document: boolean;
  lease_document_name: string | null;
  contract_count: number;
}

interface ContractRow {
  name: string;
  status: string;
  is_signed: number;
  signed_on: string | null;
  start_date: string | null;
  end_date: string | null;
  signed_document: boolean;
  lease_document: boolean;
  tenant_name: string;
  unit: string | null;
  property: string | null;
}

const API = "/api/method/kings_manage.kings_manage.portal_api";

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

function downloadUrl(kind: string, name: string) {
  return `${API}.download_document?kind=${kind}&name=${encodeURIComponent(name)}`;
}

async function uploadFile(method: string, fields: Record<string, string>, file: File) {
  const body = new FormData();
  Object.entries(fields).forEach(([k, v]) => body.append(k, v));
  body.append("file", file);
  const res = await fetch(`${API}.${method}`, {
    method: "POST",
    credentials: "include",
    headers: { "X-Frappe-CSRF-Token": (window as any).csrf_token },
    body,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(extractErrorMessage(data));
  }
}

/** A hidden file input behind a button, so each table row/card needs no form. */
function UploadButton({
  label,
  accept,
  onFile,
  variant = "outline",
}: {
  label: string;
  accept: string;
  onFile: (file: File) => Promise<void>;
  variant?: "outline" | "default";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <Input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setError(null);
          setBusy(true);
          try {
            await onFile(file);
          } catch (err: any) {
            setError(err.message || "Upload failed.");
          } finally {
            setBusy(false);
          }
        }}
      />
      <Button
        size="sm"
        variant={variant}
        disabled={busy}
        className="cursor-pointer w-fit"
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "Uploading..." : label}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

function BuildingLeases({ canUpload }: { canUpload: boolean }) {
  const { data, error, isLoading, mutate } = useFrappeGetCall<{ message: BuildingRow[] }>(
    "kings_manage.kings_manage.portal_api.get_property_lease_documents",
  );
  const buildings = data?.message;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lease documents by building</CardTitle>
        <p className="text-sm text-muted-foreground">
          Each building's standard lease. New tenants in that building get a copy to download and
          sign; replacing it doesn't change contracts already drawn up.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex justify-center py-8">
            <Spinner className="size-6" />
          </div>
        )}
        {!isLoading && error && <p className="text-destructive">Could not load buildings.</p>}
        {!isLoading && buildings && buildings.length === 0 && (
          <p className="text-muted-foreground text-sm">
            No properties registered yet. Add one under Properties first.
          </p>
        )}
        {!isLoading && buildings && buildings.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {buildings.map((b) => (
              <div key={b.name} className="flex flex-col gap-3 rounded-lg border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium">{b.property_name}</div>
                  <Badge variant={b.lease_document ? "default" : "secondary"}>
                    {b.lease_document ? "Lease uploaded" : "No lease yet"}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {b.lease_document ? (
                    <a
                      href={downloadUrl("property_lease", b.name)}
                      className="underline underline-offset-4 break-all"
                    >
                      {b.lease_document_name}
                    </a>
                  ) : (
                    "Tenants here get the standard lease text only."
                  )}
                  <div>
                    {b.contract_count} tenant contract{b.contract_count === 1 ? "" : "s"}
                  </div>
                </div>
                {canUpload && (
                  <UploadButton
                    label={b.lease_document ? "Replace lease" : "Upload lease"}
                    variant={b.lease_document ? "outline" : "default"}
                    accept=".pdf,.doc,.docx"
                    onFile={async (file) => {
                      await uploadFile("upload_property_lease_document", { property: b.name }, file);
                      await mutate();
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TenantContracts({ canUpload }: { canUpload: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const propertyFilter = searchParams.get("property") || "";

  const { data: buildingsResponse } = useFrappeGetCall<{ message: BuildingRow[] }>(
    "kings_manage.kings_manage.portal_api.get_property_lease_documents",
  );
  const buildings = buildingsResponse?.message || [];

  const { data, error, isLoading, mutate } = useFrappeGetCall<{ message: ContractRow[] }>(
    "kings_manage.kings_manage.portal_api.get_contracts",
    { property: propertyFilter || undefined },
  );
  const contracts = data?.message;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tenant contracts</CardTitle>
      </CardHeader>
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
          <option value="">All Buildings</option>
          {buildings.map((b) => (
            <option key={b.name} value={b.name}>
              {b.property_name}
            </option>
          ))}
        </NativeSelect>

        {isLoading && (
          <div className="flex justify-center py-8">
            <Spinner className="size-6" />
          </div>
        )}
        {!isLoading && error && <p className="text-destructive">Could not load contracts.</p>}
        {!isLoading && contracts && contracts.length === 0 && (
          <p className="text-muted-foreground text-sm">
            No contracts yet. A contract is drawn up automatically once a tenant's deposit is
            confirmed.
          </p>
        )}
        {!isLoading && contracts && contracts.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Building</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Documents</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((c) => (
                <TableRow key={c.name}>
                  <TableCell className="font-medium">{c.tenant_name}</TableCell>
                  <TableCell>{c.property || "-"}</TableCell>
                  <TableCell>{c.unit || "-"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {c.start_date || "-"} → {c.end_date || "open"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.is_signed ? "default" : "secondary"}>
                      {c.is_signed ? "Signed" : "Awaiting signature"}
                    </Badge>
                    {c.signed_on && (
                      <div className="text-xs text-muted-foreground mt-1">{c.signed_on}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-start gap-2">
                      {c.lease_document && (
                        <Button asChild size="sm" variant="ghost" className="cursor-pointer">
                          <a href={downloadUrl("contract_lease", c.name)}>Lease</a>
                        </Button>
                      )}
                      {c.signed_document && (
                        <Button asChild size="sm" variant="ghost" className="cursor-pointer">
                          <a href={downloadUrl("contract_signed", c.name)}>Signed copy</a>
                        </Button>
                      )}
                      {canUpload && (
                        <UploadButton
                          label={c.signed_document ? "Replace signed copy" : "Upload signed copy"}
                          accept="image/*,.pdf"
                          onFile={async (file) => {
                            await uploadFile(
                              "upload_signed_contract_for_tenant",
                              { contract: c.name },
                              file,
                            );
                            await mutate();
                          }}
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminContractsPage() {
  const { user } = useUser();
  const roles: string[] = (user?.roles || []).map((r: any) => r.role);
  const canUpload = roles.includes("Landlord") || roles.includes("System Manager");

  return (
    <BaseLayout title="Contracts" description="Lease documents per building and every tenant's contract">
      <div className="px-4 lg:px-6 flex flex-col gap-6">
        <BuildingLeases canUpload={canUpload} />
        <TenantContracts canUpload={canUpload} />
      </div>
    </BaseLayout>
  );
}
