"use client";

import { useIsMobile } from "@/hooks/use-responsive";
import { CheckCircle, FileText, Brain, Shield, Zap, Workflow } from "lucide-react";

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

const PHASE_COLORS = {
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

export default function PipelinePage() {
  const isMobile = useIsMobile();

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Pipeline Architecture</h2>

      <div className={isMobile ? "space-y-4" : "grid grid-cols-2 gap-6"}>
        {[1, 2, 3, 4].map((phase) => (
          <div key={phase}>
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{PHASE_NAMES[phase]}</h3>
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

      <div className="mt-8 rounded-xl border bg-card p-6">
        <h3 className="mb-3 font-semibold">Hard Rules (from spec)</h3>
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
