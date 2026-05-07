import { Scale } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export default function TrialBalanceLoading() {
  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#0f172a]">
          <Scale className="h-6 w-6 text-[#0ea5e9]" />
          Trial Balance
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Opening balances, period movements, and closing balances per account</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-24" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="text-center w-24">Type</TableHead>
                <TableHead className="text-right w-28">Opening Dr</TableHead>
                <TableHead className="text-right w-28">Opening Cr</TableHead>
                <TableHead className="text-right w-28">Debit</TableHead>
                <TableHead className="text-right w-28">Credit</TableHead>
                <TableHead className="text-right w-28">Closing Dr</TableHead>
                <TableHead className="text-right w-28">Closing Cr</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
