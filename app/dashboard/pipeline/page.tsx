import { listWorkflows, type WorkflowRead } from "@/app/dashboard/pipeline/actions";
import WorkflowsClient from "@/app/dashboard/pipeline/workflows-client";

// Force dynamic rendering — workflow list comes from Python backend
export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  let initialWorkflows: WorkflowRead[] = [];
  let initialError: string | null = null;

  try {
    const result = await listWorkflows();
    if (result.success) {
      initialWorkflows = result.workflows;
    } else {
      initialError = result.error;
    }
  } catch (error:any) {
    initialError = error.message || "Failed to load workflows";
  }

  return <WorkflowsClient initialWorkflows={initialWorkflows} initialError={initialError} />;
}
