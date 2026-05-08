import { Skeleton } from "@/components/ui/skeleton";

const sections = [
  { title: 'Financial Overview', labels: ['Total Invoiced','Total Paid','Outstanding','Overdue'] },
  { title: 'Projects', labels: ['Total Projects','Active Projects','Estimated Value','Total Hours'] },
  { title: 'Personnel & Compliance', labels: ['Total Personnel','Billable Hours','Expiring Certs','Expired Certs'] },
  { title: 'Assets & Stock', labels: ['Total Assets','In Maintenance','Calibration Due','Low Stock'] },
];

export default function ReportsLoading() {
  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-6 pb-4">
          {/* Header */}
          <div>
            <Skeleton className="h-8 w-52 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          {/* Section cards */}
          {sections.map((section, si) => (
            <section key={si}>
              <div className="flex items-center gap-2 mb-3">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {section.labels.map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Skeleton className="h-4 w-4 rounded" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-6 w-16" />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
