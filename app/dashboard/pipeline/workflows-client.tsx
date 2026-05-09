"use client";

import { useState, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-responsive";
import { CheckCircle, FileText, Brain, Shield, Zap, Workflow, Play, Loader2, Plus, ChevronDown, ChevronUp, Clock, Layers, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { WorkflowRead, ExecutionRead } from "@/app/dashboard/pipeline/actions";

// ── Reference Architecture (original static infographic) ────────────────────

const NODES = [
  { id: 1, name: "New Enquiry", phase: 1, icon: FileText, desc: "Client enquiry captured from email, WhatsApp, phone, or web" },
  { id: 2, name: "Intake UI", phase: 1, icon: FileText, desc: "Operations team reviews and captures details" },
  { id: 3, name: "Backend API + MCP Gateway", phase: 1, icon: Workflow, desc: "API orchestration and MCP tool federation" },
  { id: 4, name: "MarkItDown Ingestion", phase: 2, icon: FileText, desc: "Documents converted to clean markdown" },
  { id: 7, name: "LLM Wiki", phase: 2, icon: Brain, desc: "Git-versioned knowledge repository" },
  { id: 8, name: "Hybrid Retrieval", phase: 2, icon: Workflow, desc: "Wiki-first + vector + keyword search" },
  { id: 9, name: "Wiki-First Retrieval", phase: 3, icon: Brain, desc: "Read index.md, follow links to relevant pages" },
  { id: 10, name: "Gemini Classification", phase: 3, icon: Brain, desc: "Structured JSON classification via Gemini" },
  { id: 11, name: "Rules Engine", phase: 3, icon: Shield, desc: "Deterministic pricing, margins, tax, policy" },
  { id: 12, name: "Gemini 2.5 Pro Reasoning", phase: 3, icon: Brain, desc: "1M context proposal drafting" },
  { id: 13, name: "Policy Gate", phase: 3, icon: Shield, desc: "Validated and within policy?" },
  { id: 14, name: "MCP Agent Orchestration", phase: 4, icon: Zap, desc: "Coordinate tools, workflows, system actions" },
  { id: 15, name: "Human Approval", phase: 4, icon: CheckCircle, desc: "Two-person rule for high-value" },
  { id: 16, name: "Execution (Parallel)", phase: 4, icon: Zap, desc: "ERP, SAP, Outlook, PDF, Wiki Update" },
];

const PHASE_COLORS: Record<number, string> = {
  1: "border-primary/20 bg-primary/10",
  2: "border-purple-200 bg-purple-50",
  3: "border-amber-200 bg-amber-50",
  4: "border-green-200 bg-green-50",
};

const PHASE_NAMES: Record<number, string> = {
  1: "Phase 1: Input & Intake",
  2: "Phase 2: Knowledge Compilation",
  3: "Phase 3: AI & Decisioning",
  4: "Phase 4: Orchestration & Execution",
};

function ReferenceArchitecture({ isMobile }: { isMobile: boolean }) {
  return (
    <div>
      <h3 className="mb-4 text-lg font-semibold flex items-center gap-2">
        <Layers className="h-5 w-5 text-muted-foreground" /> Reference Architecture
      </h3>
      <div className={isMobile ? "space-y-4" : "grid grid-cols-2 gap-6"}>
        {[1, 2, 3, 4].map((phase) => (
          <div key={phase}>
            <h4 className="mb-3 text-sm font-semibold text-muted-foreground">{PHASE_NAMES[phase]}</h4>
            <div className="space-y-2">
              {NODES.filter((n) => n.phase === phase).map((node) => {
                const Icon = node.icon;
                return (
                  <div
                    key={node.id}
                    className={`rounded-xl border p-4 ${PHASE_COLORS[node.phase as keyof typeof PHASE_COLORS]}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-card p-2 shadow-sm">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Node {node.id}: {node.name}</p>
                        <p className="text-xs text-foreground">{node.desc}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border bg-card p-3">
        <h4 className="mb-3 font-semibold">Hard Rules (from spec)</h4>
        <ul className="space-y-2 text-sm text-foreground">
          <li className="flex items-start gap-2"><Shield className="mt-0.5 h-4 w-4 text-red-500" /> Rules engine runs BEFORE LLM — pricing, margins, tax never decided by AI alone</li>
          <li className="flex items-start gap-2"><Shield className="mt-0.5 h-4 w-4 text-red-500" /> Two human gates: policy validation (Node 13) + release approval (Node 15)</li>
          <li className="flex items-start gap-2"><Zap className="mt-0.5 h-4 w-4 text-amber-500" /> Execution fan-out is parallel, not sequential</li>
          <li className="flex items-start gap-2"><Brain className="mt-0.5 h-4 w-4 text-purple-500" /> Wiki writes are append-or-merge, never overwrite-without-trace</li>
          <li className="flex items-start gap-2"><Brain className="mt-0.5 h-4 w-4 text-purple-500" /> index.md is read on every query — agent&apos;s mental model</li>
        </ul>
      </div>
    </div>
  );
}

// ── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700 border-slate-200",
    active: "bg-green-50 text-green-700 border-green-200",
    paused: "bg-amber-50 text-amber-700 border-amber-200",
    archived: "bg-slate-50 text-slate-500 border-slate-100",
    completed: "bg-blue-50 text-blue-700 border-blue-200",
    running: "bg-sky-50 text-sky-700 border-sky-200",
    failed: "bg-red-50 text-red-700 border-red-200",
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  };
  return (
    <Badge variant="outline" className={`text-[10px] ${map[status] || "bg-muted text-muted-foreground"}`}>
      {status}
    </Badge>
  );
}

// ── Execution History Row ───────────────────────────────────────────────────

function ExecutionRow({ exec }: { exec: ExecutionRead }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border rounded-lg p-2 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusBadge status={exec.status} />
          <span className="text-muted-foreground">
            {new Date(exec.started_at).toLocaleString()}
          </span>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>
      {expanded && exec.result_json && (
        <pre className="mt-2 max-h-32 overflow-y-auto rounded bg-muted p-2 text-[10px]">
          {JSON.stringify(exec.result_json, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ── Workflow Card ───────────────────────────────────────────────────────────

function WorkflowCard({
  workflow,
  onExecute,
  executing,
}: {
  workflow: WorkflowRead;
  onExecute: (id: string) => void;
  executing: string | null;
}) {
  const [showExecutions, setShowExecutions] = useState(false);
  const [executions, setExecutions] = useState<ExecutionRead[]>([]);
  const [loadingExec, setLoadingExec] = useState(false);

  const loadExecutions = useCallback(async () => {
    setLoadingExec(true);
    try {
      const { listExecutions } = await import("@/app/dashboard/pipeline/actions");
      const result = await listExecutions(workflow.id);
      if (result.success) {
        setExecutions(result.executions);
      } else {
        toast.error(result.error);
      }
    } catch (error:any) {
      toast.error(error.message || "Failed to load executions");
    } finally {
      setLoadingExec(false);
    }
  }, [workflow.id]);

  const toggleExecutions = () => {
    if (!showExecutions && executions.length === 0) {
      loadExecutions();
    }
    setShowExecutions(!showExecutions);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Workflow className="h-4 w-4 text-primary" />
            {workflow.name}
          </CardTitle>
          <StatusBadge status={workflow.status || 'draft'} />
        </div>
        {workflow.description && (
          <p className="text-xs text-muted-foreground mt-1">{workflow.description}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Layers className="h-3 w-3" /> {workflow.nodes.length} node{workflow.nodes.length !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" /> v{workflow.version || '1.0'}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {new Date(workflow.updated_at).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={toggleExecutions}
            >
              <Clock className="h-3 w-3 mr-1" />
              History
            </Button>
            <Button
              size="sm"
              className="text-xs h-7 bg-primary hover:bg-primary/90"
              onClick={() => onExecute(workflow.id)}
              disabled={executing === workflow.id}
            >
              {executing === workflow.id ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Play className="h-3 w-3 mr-1" />
              )}
              Execute
            </Button>
          </div>
        </div>

        {/* Nodes preview */}
        {workflow.nodes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {workflow.nodes.slice(0, 6).map((node) => (
              <Badge key={node.id} variant="outline" className="text-[10px] py-0">
                {node.label || node.name}
              </Badge>
            ))}
            {workflow.nodes.length > 6 && (
              <span className="text-[10px] text-muted-foreground">+{workflow.nodes.length - 6} more</span>
            )}
          </div>
        )}

        {/* Execution history */}
        {showExecutions && (
          <div className="mt-3 space-y-2">
            <h4 className="text-xs font-semibold flex items-center gap-1">
              <Clock className="h-3 w-3" /> Execution History
            </h4>
            {loadingExec ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : executions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No executions recorded yet.</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {executions.map((exec) => (
                  <ExecutionRow key={exec.id} exec={exec} />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Client Component ───────────────────────────────────────────────────

interface WorkflowsClientProps {
  initialWorkflows: WorkflowRead[];
  initialError: string | null;
}

export default function WorkflowsClient({ initialWorkflows, initialError }: WorkflowsClientProps) {
  const isMobile = useIsMobile();
  const [workflows, setWorkflows] = useState<WorkflowRead[]>(initialWorkflows);
  const [error, setError] = useState<string | null>(initialError);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  const [showReference, setShowReference] = useState(false);

  const refreshWorkflows = useCallback(async () => {
    try {
      const { listWorkflows } = await import("@/app/dashboard/pipeline/actions");
      const result = await listWorkflows();
      if (result.success) {
        setWorkflows(result.workflows);
        setError(null);
      } else {
        setError(result.error);
      }
    } catch (error:any) {
      setError(error.message || "Failed to refresh workflows");
    }
  }, []);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const { createWorkflow } = await import("@/app/dashboard/pipeline/actions");
      const result = await createWorkflow({
        name: newName.trim(),
        description: newDesc.trim() || undefined,
      });
      if (result.success) {
        toast.success(`Workflow "${result.workflow.name}" created`);
        setNewName("");
        setNewDesc("");
        setShowCreate(false);
        await refreshWorkflows();
      } else {
        toast.error(result.error);
      }
    } catch (error:any) {
      toast.error(error.message || "Failed to create workflow");
    } finally {
      setCreating(false);
    }
  }, [newName, newDesc, refreshWorkflows]);

  const handleExecute = useCallback(async (workflowId: string) => {
    setExecuting(workflowId);
    try {
      const { executeWorkflow } = await import("@/app/dashboard/pipeline/actions");
      const result = await executeWorkflow(workflowId);
      if (result.success) {
        toast.success("Workflow execution started");
      } else {
        toast.error(result.error);
      }
    } catch (error:any) {
      toast.error(error.message || "Failed to execute workflow");
    } finally {
      setExecuting(null);
    }
  }, []);

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Workflow className="h-6 w-6 text-primary" />
          Workflows
        </h2>
        <Button size="sm" className="gap-1" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-4 w-4" /> Create Workflow
        </Button>
      </div>

      {/* ── Create form ── */}
      {showCreate && (
        <Card className="mb-6">
          <CardContent className="pt-4 space-y-3">
            <Input
              placeholder="Workflow name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Input
              placeholder="Description (optional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreate} disabled={creating || !newName.trim()}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Error state ── */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-700">Failed to load workflows</p>
            <p className="text-xs text-red-600">{error}</p>
          </div>
          <Button variant="outline" size="sm" className="ml-auto" onClick={refreshWorkflows}>
            Retry
          </Button>
        </div>
      )}

      {/* ── Workflow list ── */}
      {workflows.length === 0 && !error ? (
        <div className="mb-8 rounded-lg border bg-muted/30 p-8 text-center">
          <Workflow className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No workflows yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Create your first workflow to start automating pipeline stages.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> Create Workflow
          </Button>
        </div>
      ) : (
        <div className={isMobile ? "space-y-4" : "grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8"}>
          {workflows.map((wf) => (
            <WorkflowCard
              key={wf.id}
              workflow={wf}
              onExecute={handleExecute}
              executing={executing}
            />
          ))}
        </div>
      )}

      {/* ── Reference Architecture toggle ── */}
      <div className="border-t pt-6">
        <button
          className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowReference(!showReference)}
        >
          {showReference ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Pipeline Reference Architecture
        </button>
        {showReference && (
          <div className="mt-4">
            <ReferenceArchitecture isMobile={isMobile} />
          </div>
        )}
      </div>
    </div>
  );
}
