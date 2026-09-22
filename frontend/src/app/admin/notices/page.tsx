"use client";

import { BaseLayout } from "@/components/layouts/base-layout";
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

interface NoticeRow {
  name: string;
  tenant_name: string;
  unit: string | null;
  notice_date: string;
  move_out_date: string;
  notice_reason: string | null;
}

export default function AdminNoticesPage() {
  const { data: response, error, isLoading } = useFrappeGetCall<{ message: NoticeRow[] }>(
    "kings_manage.kings_manage.portal_api.get_notices",
  );
  const notices = response?.message;

  return (
    <BaseLayout title="Notices" description="Tenants who have given notice to vacate">
      <div className="px-4 lg:px-6">
        <Card>
          <CardContent>
            {isLoading && (
              <div className="flex justify-center py-8">
                <Spinner className="size-6" />
              </div>
            )}
            {!isLoading && error && <p className="text-destructive">Could not load notices.</p>}
            {!isLoading && notices && notices.length === 0 && (
              <p className="text-muted-foreground text-sm">No one has given notice yet.</p>
            )}
            {!isLoading && notices && notices.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Notice Date</TableHead>
                    <TableHead>Move-out Date</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notices.map((n) => (
                    <TableRow key={n.name}>
                      <TableCell className="font-medium">{n.tenant_name}</TableCell>
                      <TableCell>{n.unit || "-"}</TableCell>
                      <TableCell>{n.notice_date}</TableCell>
                      <TableCell>{n.move_out_date}</TableCell>
                      <TableCell>{n.notice_reason || "-"}</TableCell>
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
