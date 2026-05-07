'use server';

import { API_BASE } from '@/lib/api';
import { revalidatePath } from 'next/cache';

// ── Types ──────────────────────────────────────────────────────────────────

export interface WorkflowNode {
  id: string;
  node_type: string;
  label: string;
  config_json: Record<string, unknown> | null;
  position_x: number;
  position_y: number;
}

export interface WorkflowEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  condition: string | null;
}

export interface WorkflowRead {
  id: string;
  name: string;
  description: string | null;
  version: number;
  status: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  created_at: string;
  updated_at: string;
}

export interface ExecutionRead {
  id: string;
  workflow_id: string;
  enquiry_id: string | null;
  status: string;
  result_json: Record<string, unknown> | null;
  started_at: string;
  completed_at: string | null;
}

// ── API Helper ─────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const msg = typeof err.detail === 'string'
      ? err.detail
      : Array.isArray(err.detail)
        ? err.detail.map((e: any) => e.msg || JSON.stringify(e)).join('; ')
        : JSON.stringify(err.detail || err);
    throw new Error(msg || 'API Error');
  }
  return res.json();
}

// ── CRUD ───────────────────────────────────────────────────────────────────

export async function listWorkflows(): Promise<
  { success: true; workflows: WorkflowRead[] } | { success: false; error: string }
> {
  try {
    const workflows = await apiFetch<WorkflowRead[]>('/workflows');
    return { success: true, workflows };
  } catch (error: any) {
    console.error('[pipeline] listWorkflows failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch workflows' };
  }
}

export async function getWorkflow(id: string): Promise<
  { success: true; workflow: WorkflowRead } | { success: false; error: string }
> {
  try {
    const workflow = await apiFetch<WorkflowRead>(`/workflows/${id}`);
    return { success: true, workflow };
  } catch (error: any) {
    console.error('[pipeline] getWorkflow failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch workflow' };
  }
}

export async function createWorkflow(data: {
  name: string;
  description?: string;
}): Promise<
  { success: true; workflow: WorkflowRead } | { success: false; error: string }
> {
  try {
    const workflow = await apiFetch<WorkflowRead>('/workflows', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    revalidatePath('/pipeline');
    return { success: true, workflow };
  } catch (error: any) {
    console.error('[pipeline] createWorkflow failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to create workflow' };
  }
}

export async function updateWorkflow(id: string, data: {
  name?: string;
  description?: string;
  status?: string;
}): Promise<
  { success: true; workflow: WorkflowRead } | { success: false; error: string }
> {
  try {
    const workflow = await apiFetch<WorkflowRead>(`/workflows/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    revalidatePath('/pipeline');
    return { success: true, workflow };
  } catch (error: any) {
    console.error('[pipeline] updateWorkflow failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update workflow' };
  }
}

// ── Nodes & Edges ──────────────────────────────────────────────────────────

export async function addWorkflowNode(workflowId: string, data: {
  node_type: string;
  label: string;
  config_json?: Record<string, unknown>;
  position_x?: number;
  position_y?: number;
}): Promise<
  { success: true; node: WorkflowNode } | { success: false; error: string }
> {
  try {
    const node = await apiFetch<WorkflowNode>(`/workflows/${workflowId}/nodes`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    revalidatePath('/pipeline');
    return { success: true, node };
  } catch (error: any) {
    console.error('[pipeline] addNode failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to add node' };
  }
}

export async function addWorkflowEdge(workflowId: string, data: {
  source_node_id: string;
  target_node_id: string;
  condition?: string;
}): Promise<
  { success: true; edge: WorkflowEdge } | { success: false; error: string }
> {
  try {
    const edge = await apiFetch<WorkflowEdge>(`/workflows/${workflowId}/edges`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    revalidatePath('/pipeline');
    return { success: true, edge };
  } catch (error: any) {
    console.error('[pipeline] addEdge failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to add edge' };
  }
}

// ── Execution ──────────────────────────────────────────────────────────────

export async function executeWorkflow(workflowId: string, enquiryId?: string): Promise<
  { success: true; execution: ExecutionRead } | { success: false; error: string }
> {
  try {
    const execution = await apiFetch<ExecutionRead>('/workflows/execute', {
      method: 'POST',
      body: JSON.stringify({ workflow_id: workflowId, enquiry_id: enquiryId }),
    });
    revalidatePath('/pipeline');
    return { success: true, execution };
  } catch (error: any) {
    console.error('[pipeline] executeWorkflow failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to execute workflow' };
  }
}

export async function getExecution(id: string): Promise<
  { success: true; execution: ExecutionRead } | { success: false; error: string }
> {
  try {
    const execution = await apiFetch<ExecutionRead>(`/workflows/executions/${id}`);
    return { success: true, execution };
  } catch (error: any) {
    console.error('[pipeline] getExecution failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch execution' };
  }
}

export async function listExecutions(workflowId: string): Promise<
  { success: true; executions: ExecutionRead[] } | { success: false; error: string }
> {
  try {
    const executions = await apiFetch<ExecutionRead[]>(`/workflows/${workflowId}/executions`);
    return { success: true, executions };
  } catch (error: any) {
    console.error('[pipeline] listExecutions failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch executions' };
  }
}

export async function seedDefaultWorkflow(): Promise<
  { success: true; workflow: WorkflowRead } | { success: false; error: string }
> {
  try {
    const workflow = await apiFetch<WorkflowRead>('/workflows/seed-default', {
      method: 'POST',
    });
    revalidatePath('/pipeline');
    return { success: true, workflow };
  } catch (error: any) {
    console.error('[pipeline] seedDefault failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to seed default workflow' };
  }
}
