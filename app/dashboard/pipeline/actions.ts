'use server';

import { prisma } from '@/lib/prisma';
import type { PipelineDeal } from '@/lib/ai/types';
import type { enquirystatus } from '@/prisma/client';

export type PipelineStage = {
  id: string;
  name: string;
  stage: string;
  color: string;
  order: number;
};

export type WorkflowRead = {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  created_at: string;
  updated_at: string;
  status?: string;
  version?: string;
};

export type WorkflowNode = {
  id: string;
  name: string;
  phase: number;
  icon: string;
  description: string;
  label?: string;
};

export type WorkflowEdge = {
  from: string;
  to: string;
  condition?: string;
};

export type ExecutionRead = {
  id: string;
  workflow_id: string;
  status: string;
  started_at: string;
  completed_at?: string;
  result?: string;
  result_json?: Record<string, unknown>;
};

export async function listPipelineStages(): Promise<
  { success: true; stages: PipelineStage[] } | { success: false; error: string }
> {
  try {
    const statuses = [
      { id: 'draft', name: 'Draft', stage: 'draft', color: 'bg-muted', order: 1 },
      { id: 'open', name: 'Open', stage: 'open', color: 'bg-primary/10', order: 2 },
      { id: 'quotation', name: 'Quotation', stage: 'quotation', color: 'bg-amber/10', order: 3 },
      { id: 'converted', name: 'Converted', stage: 'converted', color: 'bg-sonar/10', order: 4 },
      { id: 'closed', name: 'Closed', stage: 'closed', color: 'bg-destructive/10', order: 5 },
    ];
    return { success: true, stages: statuses };
  } catch (error: any) {
    return { success: false, error: error?.message };
  }
}

export async function listPipelineDeals(stage?: string): Promise<
  { success: true; deals: PipelineDeal[] } | { success: false; error: string }
> {
  try {
    const where = stage ? { status: stage as enquirystatus } : {};
    const rows = await prisma.enquiries.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 200,
    });

    return {
      success: true,
      deals: rows.map((o) => ({
        id: o.id,
        title: o.client_name || o.id,
        amount: o.estimated_value || 0,
        stage: o.status || 'draft',
        created_at: o.created_at.toISOString(),
      })),
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to load pipeline deals' };
  }
}

export async function listWorkflows(): Promise<
  { success: true; workflows: WorkflowRead[] } | { success: false; error: string }
> {
  try {
    return { success: true, workflows: [] };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to load workflows' };
  }
}

export async function listExecutions(_workflowId?: string): Promise<
  { success: true; executions: ExecutionRead[] } | { success: false; error: string }
> {
  try {
    return { success: true, executions: [] };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to load executions' };
  }
}

export async function createWorkflow(_data: {
  name: string;
  description?: string;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
}): Promise<{ success: true; workflow: WorkflowRead } | { success: false; error: string }> {
  try {
    const workflow: WorkflowRead = {
      id: crypto.randomUUID(),
      name: _data.name,
      description: _data.description,
      nodes: _data.nodes || [],
      edges: _data.edges || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return { success: true, workflow };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to create workflow' };
  }
}

export async function executeWorkflow(_workflowId: string, _input?: Record<string, unknown>): Promise<
  { success: true; execution: ExecutionRead } | { success: false; error: string }
> {
  try {
    const execution: ExecutionRead = {
      id: crypto.randomUUID(),
      workflow_id: _workflowId,
      status: 'completed',
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    };
    return { success: true, execution };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to execute workflow' };
  }
}
