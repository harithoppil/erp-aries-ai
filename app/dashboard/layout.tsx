import { AppLayout } from "@/app/dashboard/app-layout";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <AppLayout>{children}</AppLayout>
    </TooltipProvider>
  );
}
