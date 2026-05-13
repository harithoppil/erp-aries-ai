'use server';

import { prisma } from '@/lib/prisma';
import { toAccessor, getDelegate } from '@/lib/erpnext/prisma-delegate';

/** Validate a SQL identifier (table/column name) */
function isValidSqlIdentifier(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

/** Escape a SQL string value */
function escapeSqlValue(value: string): string {
  return value.replace(/'/g, "''").replace(/\\/g, '\\\\');
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface TreeNode {
  name: string;
  label: string;
  isGroup: boolean;
  parent: string | null;
  lft: number;
  rgt: number;
  children: TreeNode[];
  data: Record<string, unknown>;
}

export interface TreeResult {
  success: boolean;
  tree?: TreeNode[];
  error?: string;
}

// ── Fetch Tree Data ──────────────────────────────────────────────────────────

export async function fetchDoctypeTree(
  doctype: string,
  options?: {
    labelField?: string;
    parentField?: string;
    isGroupField?: string;
    rootParent?: string;
    filters?: Record<string, unknown>;
  },
): Promise<TreeResult> {
  try {
    const delegate = getDelegate(prisma, doctype);
    if (!delegate) return { success: false, error: `Unknown DocType: ${doctype}` };

    const labelField = options?.labelField ?? 'name';
    const parentField = options?.parentField ?? 'parent_account';
    const isGroupField = options?.isGroupField ?? 'is_group';

    const where: Record<string, unknown> = {};
    if (options?.filters) Object.assign(where, options.filters);

    const records = await delegate.findMany({
      where,
      orderBy: { lft: 'asc' },
    }) as Record<string, unknown>[];

    // Build tree from flat list using parent references
    const nodeMap = new Map<string, TreeNode>();
    const roots: TreeNode[] = [];

    for (const rec of records) {
      const name = String(rec.name ?? '');
      const node: TreeNode = {
        name,
        label: String(rec[labelField] ?? name),
        isGroup: rec[isGroupField] === true || rec[isGroupField] === 1,
        parent: rec[parentField] ? String(rec[parentField]) : null,
        lft: Number(rec.lft ?? 0),
        rgt: Number(rec.rgt ?? 0),
        children: [],
        data: rec,
      };
      nodeMap.set(name, node);
    }

    for (const node of nodeMap.values()) {
      if (node.parent && nodeMap.has(node.parent)) {
        nodeMap.get(node.parent)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return { success: true, tree: roots };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

// ── Rebuild nested set (lft/rgt) ────────────────────────────────────────────

export async function rebuildNestedSet(doctype: string, parentField = 'parent_account'): Promise<{ success: boolean; error?: string }> {
  try {
    const delegate = getDelegate(prisma, doctype);
    if (!delegate) return { success: false, error: `Unknown DocType: ${doctype}` };

    const records = await delegate.findMany({ orderBy: { name: 'asc' } }) as Record<string, unknown>[];
    const childrenMap = new Map<string, string[]>();
    const roots: string[] = [];

    for (const rec of records) {
      const name = String(rec.name);
      const parent = rec[parentField] ? String(rec[parentField]) : null;
      if (parent) {
        if (!childrenMap.has(parent)) childrenMap.set(parent, []);
        childrenMap.get(parent)!.push(name);
      } else {
        roots.push(name);
      }
    }

    let counter = 1;
    const accessor = toAccessor(doctype);
    if (!isValidSqlIdentifier(accessor)) {
      return { success: false, error: 'Invalid table name' };
    }

    async function walk(name: string): Promise<void> {
      const lft = counter++;
      const kids = childrenMap.get(name) ?? [];
      for (const kid of kids) await walk(kid);
      const rgt = counter++;
      await prisma.$executeRawUnsafe(
        `UPDATE "${accessor}" SET lft = ${lft}, rgt = ${rgt} WHERE name = '${escapeSqlValue(name)}'`
      );
    }

    for (const root of roots) await walk(root);

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}