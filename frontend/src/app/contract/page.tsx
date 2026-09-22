"use client";

import { BaseLayout } from "@/components/layouts/base-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { useState } from "react";

interface ContractInfo {
  name: string;
  status: string;
  docstatus: number;
  is_signed: number;
  start_date: string | null;
  end_date: string | null;
  contract_terms: string | null;
  signed_on: string | null;
  signed_document: string | null;
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

function AttachSignedCopyForm({
  contract,
  needsSigneeName,
  onDone,
}: {
  contract: string;
  needsSigneeName: boolean;
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const file = formData.get("file") as File;
    if (!file || file.size === 0) {
      setError("Please choose a file to attach.");
      setLoading(false);
      return;
    }

    const body = new FormData();
    body.append("contract", contract);
    body.append("file", file);
    const signeeName = formData.get("signee_name") as string;
    if (signeeName) body.append("signee_name", signeeName);

    try {
      const res = await fetch(
        "/api/method/kings_manage.kings_manage.portal_api.upload_signed_contract",
        { method: "POST", credentials: "include", body },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(extractErrorMessage(data));
      }
      onDone();
    } catch (err: any) {
      setError(err.message || "Could not attach the signed contract.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      {needsSigneeName && (
        <div className="grid gap-2 max-w-sm">
          <Label htmlFor="signee_name">Full legal name (as signed)</Label>
          <Input id="signee_name" name="signee_name" placeholder="Full legal name" />
        </div>
      )}
      <div className="grid gap-2 max-w-sm">
        <Label htmlFor="signed_file">Photo or scan of the signed lease</Label>
        <Input id="signed_file" name="file" type="file" accept="image/*,.pdf" />
      </div>
      {error && <div className="text-sm text-destructive">{error}</div>}
      <div>
        <Button type="submit" disabled={loading} className="cursor-pointer">
          {loading ? "Uploading..." : "Attach Signed Copy"}
        </Button>
      </div>
    </form>
  );
}

export default function ContractPage() {
  const { data: response, error, isLoading, mutate } = useFrappeGetCall<{ message: ContractInfo | null }>(
    "kings_manage.kings_manage.portal_api.get_my_contract",
  );
  const contract = response?.message;
  const { call: callSign, loading: signing } = useFrappePostCall(
    "kings_manage.kings_manage.portal_api.sign_contract",
  );
  const [signeeName, setSigneeName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);

  const handleSign = async () => {
    if (!contract) return;
    setSignError(null);
    try {
      await callSign({ contract: contract.name, signee_name: signeeName });
      await mutate();
    } catch (err: any) {
      setSignError(extractErrorMessage(err));
    }
  };

  const handleDownload = () => {
    if (!contract) return;
    window.open(
      `/api/method/frappe.utils.print_format.download_pdf?doctype=Contract&name=${encodeURIComponent(
        contract.name,
      )}&format=Standard`,
      "_blank",
    );
  };

  return (
    <BaseLayout title="Contract" description="Your lease agreement">
      <div className="px-4 lg:px-6">
        {isLoading && (
          <div className="flex justify-center py-12">
            <Spinner className="size-6" />
          </div>
        )}

        {!isLoading && (error || !contract) && (
          <Card>
            <CardContent className="text-muted-foreground text-center py-8">
              No lease contract has been drawn up for you yet. Check back once your application
              has been approved.
            </CardContent>
          </Card>
        )}

        {!isLoading && contract && (
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{contract.name}</CardTitle>
                <Badge variant={contract.is_signed ? "default" : "secondary"}>
                  {contract.status}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Start Date</div>
                    <div>{contract.start_date || "-"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">End Date</div>
                    <div>{contract.end_date || "-"}</div>
                  </div>
                </div>

                <div
                  className="prose prose-sm max-w-none rounded-md border bg-muted/40 p-4"
                  dangerouslySetInnerHTML={{
                    __html: contract.contract_terms || "<p>No terms have been added yet.</p>",
                  }}
                />

                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" onClick={handleDownload} className="cursor-pointer">
                    Download PDF
                  </Button>
                  {contract.signed_document && (
                    <Button asChild variant="outline" className="cursor-pointer">
                      <a href={contract.signed_document} target="_blank" rel="noreferrer">
                        View Attached Signed Copy
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {!contract.is_signed && (
              <Card>
                <CardHeader>
                  <CardTitle>Sign your lease</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="grid gap-2 max-w-sm">
                    <Label htmlFor="signee_name">Type your full legal name</Label>
                    <Input
                      id="signee_name"
                      value={signeeName}
                      onChange={(e) => setSigneeName(e.target.value)}
                      placeholder="Full legal name"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="agree"
                      checked={agreed}
                      onCheckedChange={(v) => setAgreed(v === true)}
                    />
                    <Label htmlFor="agree" className="text-sm font-normal">
                      I have read and agree to the terms above
                    </Label>
                  </div>
                  {signError && <div className="text-sm text-destructive">{signError}</div>}
                  <div>
                    <Button
                      onClick={handleSign}
                      disabled={!agreed || !signeeName.trim() || signing}
                      className="cursor-pointer"
                    >
                      {signing ? "Signing..." : "Sign Lease"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {!!contract.is_signed && (
              <p className="text-sm text-muted-foreground">
                Signed on {contract.signed_on || "-"}.
              </p>
            )}

            <Card>
              <CardHeader>
                <CardTitle>
                  {contract.signed_document ? "Replace Signed Copy" : "Printed and signed by hand?"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AttachSignedCopyForm
                  contract={contract.name}
                  needsSigneeName={!contract.is_signed}
                  onDone={() => mutate()}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </BaseLayout>
  );
}
