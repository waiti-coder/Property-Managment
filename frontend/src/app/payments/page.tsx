"use client";

import { BaseLayout } from "@/components/layouts/base-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

interface InvoiceRow {
  name: string;
  posting_date: string;
  due_date: string;
  invoice_type: "Rent" | "Water Bill" | "Deposit";
  grand_total: number;
  outstanding_amount: number;
  status: string;
}

interface Dues {
  invoices: InvoiceRow[];
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(
    value || 0,
  );
}

function receiptUrl(invoiceName: string) {
  return `/api/method/frappe.utils.print_format.download_pdf?doctype=Sales%20Invoice&name=${encodeURIComponent(
    invoiceName,
  )}&format=Standard`;
}

export default function PaymentsPage() {
  const { data: response, error, isLoading } = useFrappeGetCall<{ message: Dues }>(
    "kings_manage.kings_manage.portal_api.get_my_dues",
  );
  const invoices = response?.message?.invoices;

  return (
    <BaseLayout title="Payments" description="Amounts due and paid for your tenancy">
      <div className="px-4 lg:px-6 flex flex-col gap-6">
        {isLoading && (
          <div className="flex justify-center py-12">
            <Spinner className="size-6" />
          </div>
        )}

        {!isLoading && error && (
          <p className="text-destructive">Could not load your payments.</p>
        )}

        {!isLoading && invoices && invoices.length === 0 && (
          <Card>
            <CardContent className="text-muted-foreground text-center py-8">
              No invoices yet.
            </CardContent>
          </Card>
        )}

        {!isLoading && invoices && invoices.length > 0 && (
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Posted</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{row.invoice_type}</TableCell>
                      <TableCell>{row.posting_date}</TableCell>
                      <TableCell>{row.due_date}</TableCell>
                      <TableCell>{formatCurrency(row.grand_total)}</TableCell>
                      <TableCell>{formatCurrency(row.outstanding_amount)}</TableCell>
                      <TableCell>
                        <Badge variant={row.outstanding_amount > 0 ? "destructive" : "secondary"}>
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {row.status === "Paid" && (
                          <Button asChild size="sm" variant="outline" className="cursor-pointer">
                            <a href={receiptUrl(row.name)} target="_blank" rel="noreferrer">
                              Receipt
                            </a>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </BaseLayout>
  );
}
