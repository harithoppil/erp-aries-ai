'use server';

import { prisma } from '@/lib/prisma';
import { getDelegate, toDisplayLabel } from '@/lib/erpnext/prisma-delegate';

/* ════════════════════════════════════════════════════════════════════════════
   TYPES
   ════════════════════════════════════════════════════════════════════════════ */

export interface WorkflowStateInfo {
  state: string;
  docStatus: number;
  updateField: string | null;
  updateValue: string | null;
  allowEdit: string | null;
  isOptional: boolean;
  message: string | null;
}

export interface WorkflowTransitionInfo {
  name: string;
  state: string;
  action: string;
  nextState: string;
  allowed: string;
  allowSelfApproval: boolean;
  condition: string | null;
}

export interface WorkflowInfo {
  name: string;
  workflowName: string;
  documentType: string;
  isActive: boolean;
  workflowStateField: string;
  states: WorkflowStateInfo[];
  transitions: WorkflowTransitionInfo[];
}

export interface WorkflowActionResult {
  success: boolean;
  error?: string;
  workflow?: WorkflowInfo;
  nextActions?: WorkflowTransitionInfo[];
  currentState?: string;
}

/* ════════════════════════════════════════════════════════════════════════════
   READ OPERATIONS
   ════════════════════════════════════════════════════════════════════════════ */

/** Get the active workflow for a DocType (if any) */
export async function getWorkflowForDoctype(doctype: string): Promise<WorkflowActionResult> {
  try {
    const workflow = await prisma.workflow.findFirst({
      where: { document_type: doctype, is_active: 1 },
      include: { states: { orderBy: { idx: 'asc' } }, transitions: { orderBy: { idx: 'asc' } } },
    });

    if (!workflow) {
      return { success: true, workflow: undefined };
    }

    const info: WorkflowInfo = {
      name: workflow.name,
      workflowName: workflow.workflow_name,
      documentType: workflow.document_type,
      isActive: Boolean(workflow.is_active),
      workflowStateField: workflow.workflow_state_field,
      states: workflow.states.map((s) => ({
        state: s.state,
        docStatus: s.doc_status,
        updateField: s.update_field,
        updateValue: s.update_value,
        allowEdit: s.allow_edit,
        isOptional: Boolean(s.is_optional_state),
        message: s.message,
      })),
      transitions: workflow.transitions.map((t) => ({
        name: t.name,
        state: t.state,
        action: t.action,
        nextState: t.next_state,
        allowed: t.allowed,
        allowSelfApproval: Boolean(t.allow_self_approval),
        condition: t.condition,
      })),
    };

    return { success: true, workflow: info };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, error: message };
  }
}

/** Get available transitions for a document's current workflow state */
export async function getAvailableTransitions(
  doctype: string,
  recordName: string,
): Promise<WorkflowActionResult> {
  try {
    const wfResult = await getWorkflowForDoctype(doctype);
    if (!wfResult.success || !wfResult.workflow) {
      return { success: true, nextActions: [], currentState: undefined };
    }

    const workflow = wfResult.workflow;

    // Fetch the record to get its current workflow_state
    const delegate = getDelegate(prisma, doctype);
    if (!delegate) {
      return { success: false, error: `Unknown DocType: ${doctype}` };
    }

    const record = await delegate.findUnique({ where: { name: recordName } }) as Record<string, unknown> | null;
    if (!record) {
      return { success: false, error: `${doctype} "${recordName}" not found` };
    }

    const currentState = String(record[workflow.workflowStateField] ?? workflow.states[0]?.state ?? 'Draft');

    // Find transitions from the current state
    const availableTransitions = workflow.transitions.filter((t) => t.state === currentState);

    return {
      success: true,
      nextActions: availableTransitions,
      currentState,
      workflow,
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, error: message };
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   WORKFLOW ACTIONS (Apply transition)
   ════════════════════════════════════════════════════════════════════════════ */

/** Apply a workflow transition to a document */
export async function applyWorkflowTransition(
  doctype: string,
  recordName: string,
  transitionName: string,
  userId?: string,
): Promise<WorkflowActionResult> {
  try {
    const wfResult = await getWorkflowForDoctype(doctype);
    if (!wfResult.success || !wfResult.workflow) {
      return { success: false, error: 'No active workflow for this DocType' };
    }

    const workflow = wfResult.workflow;
    const transition = workflow.transitions.find((t) => t.name === transitionName);
    if (!transition) {
      return { success: false, error: `Transition "${transitionName}" not found` };
    }

    const delegate = getDelegate(prisma, doctype);
    if (!delegate) {
      return { success: false, error: `Unknown DocType: ${doctype}` };
    }

    const record = await delegate.findUnique({ where: { name: recordName } }) as Record<string, unknown> | null;
    if (!record) {
      return { success: false, error: `${doctype} "${recordName}" not found` };
    }

    // Verify current state matches the transition's source state
    const currentState = String(record[workflow.workflowStateField] ?? '');
    if (currentState !== transition.state) {
      return { success: false, error: `Document is in state "${currentState}", expected "${transition.state}"` };
    }

    // Find the target state info
    const targetState = workflow.states.find((s) => s.state === transition.nextState);
    if (!targetState) {
      return { success: false, error: `Target state "${transition.nextState}" not defined in workflow` };
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      [workflow.workflowStateField]: transition.nextState,
      modified: new Date(),
      modified_by: userId ?? 'Administrator',
    };

    // Apply docstatus change based on target state's doc_status
    if (targetState.docStatus !== undefined) {
      updateData.docstatus = targetState.docStatus;
    }

    // Apply update_field / update_value if set
    if (targetState.updateField && targetState.updateValue) {
      updateData[targetState.updateField] = targetState.updateValue;
    }

    // Execute in transaction
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      // Update the record
      const txDelegate = (tx as unknown as Record<string, unknown>)[
        doctype.charAt(0).toLowerCase() + doctype.slice(1)
      ];
      if (txDelegate && typeof (txDelegate as Record<string, unknown>).update === 'function') {
        await (txDelegate as { update: (args: unknown) => Promise<unknown> }).update({
          where: { name: recordName },
          data: updateData,
        });
      }

      // Cascade docstatus to children if docstatus changed
      if (targetState.docStatus !== undefined && targetState.docStatus !== Number(record.docstatus)) {
        const { Prisma: PrismaNS } = await import('@/prisma/client');
        for (const m of PrismaNS.dmmf.datamodel.models) {
          const hasParent = m.fields.some((f) => f.name === 'parent');
          const hasParentType = m.fields.some((f) => f.name === 'parenttype');
          if (hasParent && hasParentType) {
            const childAccessor = m.name.charAt(0).toLowerCase() + m.name.slice(1);
            const childDelegate = (tx as unknown as Record<string, unknown>)[childAccessor];
            if (childDelegate && typeof (childDelegate as Record<string, unknown>).updateMany === 'function') {
              await (childDelegate as { updateMany: (args: unknown) => Promise<unknown> }).updateMany({
                where: { parent: recordName, parenttype: doctype },
                data: { docstatus: targetState.docStatus },
              });
            }
          }
        }
      }

      // Create workflow action log
      await tx.workflowAction.create({
        data: {
          name: `WA-${crypto.randomUUID().slice(0, 8)}`,
          reference_doctype: doctype,
          reference_name: recordName,
          workflow_state: transition.nextState,
          action: transition.action,
          next_state: transition.nextState,
          status: 'Completed',
          user: userId ?? 'Administrator',
          completed_by: userId ?? 'Administrator',
          completed_on: now,
        },
      });
    });

    // Get new available transitions
    const newTransitions = workflow.transitions.filter((t) => t.state === transition.nextState);

    return {
      success: true,
      nextActions: newTransitions,
      currentState: transition.nextState,
      workflow,
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, error: message };
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   WORKFLOW CRUD (Create / Update / Delete workflows)
   ════════════════════════════════════════════════════════════════════════════ */

export interface CreateWorkflowInput {
  workflowName: string;
  documentType: string;
  stateField?: string;
  states: Array<{
    state: string;
    docStatus: number;
    updateField?: string;
    updateValue?: string;
    allowEdit?: string;
    isOptional?: boolean;
    message?: string;
  }>;
  transitions: Array<{
    state: string;
    action: string;
    nextState: string;
    allowed: string;
    allowSelfApproval?: boolean;
    condition?: string;
  }>;
}

export async function createWorkflow(input: CreateWorkflowInput): Promise<WorkflowActionResult> {
  try {
    const name = `WF-${crypto.randomUUID().slice(0, 8)}`;

    // Deactivate any existing active workflows for this doctype
    await prisma.workflow.updateMany({
      where: { document_type: input.documentType, is_active: 1 },
      data: { is_active: 0 },
    });

    const workflow = await prisma.workflow.create({
      data: {
        name,
        workflow_name: input.workflowName,
        document_type: input.documentType,
        is_active: 1,
        workflow_state_field: input.stateField ?? 'workflow_state',
        states: {
          create: input.states.map((s, i) => ({
            name: `WDS-${crypto.randomUUID().slice(0, 8)}`,
            parent: name,
            parenttype: 'Workflow',
            parentfield: 'states',
            idx: i + 1,
            state: s.state,
            doc_status: s.docStatus,
            update_field: s.updateField ?? null,
            update_value: s.updateValue ?? null,
            allow_edit: s.allowEdit ?? null,
            is_optional_state: s.isOptional ? 1 : 0,
            message: s.message ?? null,
          })),
        },
        transitions: {
          create: input.transitions.map((t, i) => ({
            name: `WTR-${crypto.randomUUID().slice(0, 8)}`,
            parent: name,
            parenttype: 'Workflow',
            parentfield: 'transitions',
            idx: i + 1,
            state: t.state,
            action: t.action,
            next_state: t.nextState,
            allowed: t.allowed,
            allow_self_approval: t.allowSelfApproval !== false ? 1 : 0,
            condition: t.condition ?? null,
          })),
        },
      },
      include: { states: true, transitions: true },
    });

    return await getWorkflowForDoctype(input.documentType);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, error: message };
  }
}

export async function listWorkflows(): Promise<Array<{ name: string; workflowName: string; documentType: string; isActive: boolean }>> {
  try {
    const workflows = await prisma.workflow.findMany({
      select: { name: true, workflow_name: true, document_type: true, is_active: true },
      orderBy: { creation: 'desc' },
    });
    return workflows.map((w) => ({
      name: w.name,
      workflowName: w.workflow_name,
      documentType: w.document_type,
      isActive: Boolean(w.is_active),
    }));
  } catch (_e: unknown) {
    return [];
  }
}

export async function deleteWorkflow(name: string): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.workflowDocumentState.deleteMany({ where: { parent: name } });
    await prisma.workflowTransitionRule.deleteMany({ where: { parent: name } });
    await prisma.workflow.delete({ where: { name } });
    return { success: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, error: message };
  }
}

/** Seed a default approval workflow for a DocType */
export async function seedDefaultWorkflow(doctype: string): Promise<WorkflowActionResult> {
  return createWorkflow({
    workflowName: `${doctype} Approval`,
    documentType: doctype,
    states: [
      { state: 'Draft', docStatus: 0, allowEdit: 'All' },
      { state: 'Pending Approval', docStatus: 0, allowEdit: 'Approver', message: 'Awaiting approval' },
      { state: 'Approved', docStatus: 1, allowEdit: undefined, updateField: 'status', updateValue: 'Approved' },
      { state: 'Rejected', docStatus: 0, allowEdit: undefined, updateField: 'status', updateValue: 'Rejected' },
    ],
    transitions: [
      { state: 'Draft', action: 'Submit for Approval', nextState: 'Pending Approval', allowed: 'Employee' },
      { state: 'Pending Approval', action: 'Approve', nextState: 'Approved', allowed: 'Approver' },
      { state: 'Pending Approval', action: 'Reject', nextState: 'Rejected', allowed: 'Approver' },
      { state: 'Rejected', action: 'Resubmit', nextState: 'Pending Approval', allowed: 'Employee' },
    ],
  });
}
