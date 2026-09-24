"use client";

import { BaseLayout } from "@/components/layouts/base-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { useState } from "react";

interface Application {
  name: string;
  tenant_name: string;
  status: string;
  unit: string | null;
  property: string | null;
  rent_amount: number;
  deposit_amount: number;
  deposit_reference: string | null;
  deposit_proof: string | null;
  id_passport_number: string | null;
  guarantor_name: string | null;
  guarantor_phone: string | null;
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

function RejectForm({
  lease,
  onDone,
  onCancel,
}: {
  lease: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { call, loading } = useFrappePostCall(
    "kings_manage.kings_manage.portal_api.advance_application",
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      await call({ lease, action: "Reject", rejection_reason: reason });
      onDone();
    } catch (err: any) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <div className="flex flex-col gap-2 mt-2">
      <Textarea
        placeholder="Reason for rejecting this application"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      {error && <div className="text-sm text-destructive">{error}</div>}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="destructive"
          disabled={loading || !reason.trim()}
          onClick={submit}
          className="cursor-pointer"
        >
          {loading ? "Rejecting..." : "Confirm Reject"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} className="cursor-pointer">
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ApplicationActions({
  application,
  onChanged,
}: {
  application: Application;
  onChanged: () => void;
}) {
  const { call, loading } = useFrappePostCall(
    "kings_manage.kings_manage.portal_api.advance_application",
  );
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [depositNote, setDepositNote] = useState("");

  const act = async (action: string, extra?: Record<string, string>) => {
    setError(null);
    try {
      await call({ lease: application.name, action, ...extra });
      onChanged();
    } catch (err: any) {
      setError(extractErrorMessage(err));
    }
  };

  if (rejecting) {
    return (
      <RejectForm
        lease={application.name}
        onDone={onChanged}
        onCancel={() => setRejecting(false)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2 mt-2">
      {error && <div className="text-sm text-destructive">{error}</div>}
      <div className="flex flex-wrap gap-2">
        {application.status === "Submitted" && (
          <Button
            size="sm"
            disabled={loading}
            onClick={() => act("Review")}
            className="cursor-pointer"
          >
            Move to KYC Review
          </Button>
        )}
        {application.status === "KYC Verification" && (
          <>
            <Button
              size="sm"
              disabled={loading}
              onClick={() => act("Approve")}
              className="cursor-pointer"
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={loading}
              onClick={() => setRejecting(true)}
              className="cursor-pointer"
            >
              Reject
            </Button>
          </>
        )}
        {application.status === "Awaiting Deposit" && (
          <div className="flex flex-wrap items-center gap-2">
            {!(application.deposit_reference || application.deposit_proof) && (
              <input
                type="text"
                placeholder="Reference/note (optional)"
                value={depositNote}
                onChange={(e) => setDepositNote(e.target.value)}
                className="border-input h-8 rounded-md border bg-transparent px-2 text-sm"
              />
            )}
            <Button
              size="sm"
              disabled={loading}
              onClick={() => act("Confirm Deposit", { deposit_reference: depositNote })}
              className="cursor-pointer"
            >
              {loading ? "Confirming..." : "Deposit Paid"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ApplicationsPage() {
  const { data: response, error, isLoading, mutate } = useFrappeGetCall<{
    message: Application[];
  }>("kings_manage.kings_manage.portal_api.get_applications");
  const applications = response?.message;

  return (
    <BaseLayout
      title="Applications"
      description="Applications moving through KYC and deposit confirmation - approve tenants from here, no ERPNext desk needed"
    >
      <div className="px-4 lg:px-6 flex flex-col gap-4">
        {isLoading && (
          <div className="flex justify-center py-12">
            <Spinner className="size-6" />
          </div>
        )}
        {!isLoading && error && <p className="text-destructive">Could not load applications.</p>}
        {!isLoading && applications && applications.length === 0 && (
          <p className="text-muted-foreground text-sm">No applications are pending right now.</p>
        )}
        {!isLoading &&
          applications?.map((application) => (
            <Card key={application.name}>
              <CardContent>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{application.tenant_name}</p>
                    <p className="text-muted-foreground text-xs">
                      {application.property ? `${application.property} · ` : ""}
                      {application.unit ? `Unit ${application.unit} · ` : ""}
                      Rent {formatCurrency(application.rent_amount)} · Deposit{" "}
                      {formatCurrency(application.deposit_amount)}
                    </p>
                    {application.id_passport_number && (
                      <p className="text-muted-foreground text-xs">
                        ID/Passport: {application.id_passport_number}
                      </p>
                    )}
                    {application.guarantor_name && (
                      <p className="text-muted-foreground text-xs">
                        Guarantor: {application.guarantor_name} ({application.guarantor_phone})
                      </p>
                    )}
                    {(application.deposit_reference || application.deposit_proof) && (
                      <p className="text-muted-foreground text-xs">
                        Deposit ref: {application.deposit_reference || "-"}
                        {application.deposit_proof && (
                          <>
                            {" · "}
                            <a
                              href={application.deposit_proof}
                              target="_blank"
                              rel="noreferrer"
                              className="underline"
                            >
                              View proof
                            </a>
                          </>
                        )}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary">{application.status}</Badge>
                </div>
                <ApplicationActions application={application} onChanged={() => mutate()} />
              </CardContent>
            </Card>
          ))}
      </div>
    </BaseLayout>
  );
}
