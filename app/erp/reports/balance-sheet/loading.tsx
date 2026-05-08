import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

function SectionSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted border-b pb-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-28" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead className="text-right w-40">Balance (AED)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function BalanceSheetLoading() {
  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#0f172a]">
            <TrendingUp className="h-6 w-6 text-[#0ea5e9]" />
            Balance Sheet
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Assets = Liabilities + Equity</p>
        </div>
        <div className="flex items-end gap-3">
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>

      <div className="space-y-5">
        <SectionSkeleton />
        <SectionSkeleton />
        <SectionSkeleton />
        <Card className="bg-muted/30">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-6 w-32" />
            </div>
            <Skeleton className="mt-1.5 h-3 w-24" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
